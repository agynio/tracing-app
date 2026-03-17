import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { getSocketBaseUrl } from '@/config';
import type { RunTimelineEvent, RunTimelineEventsCursor, ToolOutputChunk, ToolOutputTerminal } from '@/api/types/agents';

type RunSummary = {
  id: string;
  threadId?: string;
  status: 'running' | 'finished' | 'terminated';
  createdAt: string;
  updatedAt: string;
};
type RunEventSocketPayload = { runId: string; mutation: 'append' | 'update'; event: RunTimelineEvent };
interface ServerToClientEvents {
  run_status_changed: (payload: RunStatusChangedPayload) => void;
  run_event_appended: (payload: RunEventSocketPayload) => void;
  run_event_updated: (payload: RunEventSocketPayload) => void;
  tool_output_chunk: (payload: ToolOutputChunk) => void;
  tool_output_terminal: (payload: ToolOutputTerminal) => void;
}
type SubscribePayload = { room?: string; rooms?: string[] };
interface ClientToServerEvents { subscribe: (payload: SubscribePayload) => void }

type RunStatusChangedPayload = { threadId: string; run: RunSummary };
type RunEventListenerPayload = RunEventSocketPayload;
type ToolChunkListener = (payload: ToolOutputChunk) => void;
type ToolTerminalListener = (payload: ToolOutputTerminal) => void;

class GraphSocket {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private runStatusListeners = new Set<(payload: RunStatusChangedPayload) => void>();
  private runEventListeners = new Set<(payload: RunEventListenerPayload) => void>();
  private toolChunkListeners = new Set<ToolChunkListener>();
  private toolTerminalListeners = new Set<ToolTerminalListener>();
  private subscribedRooms = new Set<string>();
  private connectCallbacks = new Set<() => void>();
  private reconnectCallbacks = new Set<() => void>();
  private disconnectCallbacks = new Set<() => void>();
  private runCursors = new Map<string, RunTimelineEventsCursor>();
  private socketCleanup: Array<() => void> = [];
  private managerCleanup: Array<() => void> = [];

  private compareCursors(a: RunTimelineEventsCursor, b: RunTimelineEventsCursor): number {
    const parsedA = Date.parse(a.ts);
    const parsedB = Date.parse(b.ts);
    const timeA = Number.isNaN(parsedA) ? 0 : parsedA;
    const timeB = Number.isNaN(parsedB) ? 0 : parsedB;
    if (timeA !== timeB) return timeA - timeB;
    const lexical = a.ts.localeCompare(b.ts);
    if (lexical !== 0) return lexical;
    return a.id.localeCompare(b.id);
  }

  private bumpRunCursor(runId: string, candidate: RunTimelineEventsCursor | null, opts?: { force?: boolean }) {
    if (!runId) return;
    if (!candidate) {
      this.runCursors.delete(runId);
      return;
    }
    const current = this.runCursors.get(runId);
    if (!current || opts?.force || this.compareCursors(candidate, current) > 0) {
      this.runCursors.set(runId, candidate);
    }
  }

  private emitSubscriptions(rooms: string[]) {
    if (!rooms.length) return;
    const sock = this.socket;
    if (!sock) return;
    sock.emit('subscribe', { rooms });
  }

  private resubscribeAll() {
    if (!this.socket || this.subscribedRooms.size === 0) return;
    this.emitSubscriptions(Array.from(this.subscribedRooms));
  }

  connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket) return this.socket;
    const host = getSocketBaseUrl();
    const transports: ManagerOptions['transports'] = ['websocket'];
    const options: Partial<ManagerOptions & SocketOptions> = {
      path: '/socket.io',
      transports,
      forceNew: false,
      autoConnect: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: false,
    };
    this.socketCleanup = [];
    this.managerCleanup = [];

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(host, options);
    this.socket = socket;

    const manager = socket.io;

    const handleConnect = () => {
      this.resubscribeAll();
      for (const fn of this.connectCallbacks) fn();
    };
    const handleReconnect = () => {
      this.resubscribeAll();
      for (const fn of this.reconnectCallbacks) fn();
    };
    const handleDisconnect = () => {
      for (const fn of this.disconnectCallbacks) fn();
    };
    const handleConnectError = () => {};
    socket.on('connect', handleConnect);
    this.socketCleanup.push(() => socket.off('connect', handleConnect));
    socket.on('disconnect', handleDisconnect);
    this.socketCleanup.push(() => socket.off('disconnect', handleDisconnect));
    socket.on('connect_error', handleConnectError);
    this.socketCleanup.push(() => socket.off('connect_error', handleConnectError));
    manager.on('reconnect', handleReconnect);
    this.managerCleanup.push(() => manager.off('reconnect', handleReconnect));
    const handleRunStatusChanged: ServerToClientEvents['run_status_changed'] = (payload) => {
      for (const fn of this.runStatusListeners) fn(payload);
    };
    socket.on('run_status_changed', handleRunStatusChanged);
    this.socketCleanup.push(() => socket.off('run_status_changed', handleRunStatusChanged));
    const handleRunEvent = (eventName: 'run_event_appended' | 'run_event_updated', payload: RunEventSocketPayload) => {
      const cursor = { ts: payload.event.ts, id: payload.event.id } as RunTimelineEventsCursor;
      const force = eventName === 'run_event_updated';
      this.bumpRunCursor(payload.runId, cursor, force ? { force: true } : undefined);
      for (const fn of this.runEventListeners) fn(payload);
    };
    const handleRunEventAppended: ServerToClientEvents['run_event_appended'] = (payload) =>
      handleRunEvent('run_event_appended', payload);
    socket.on('run_event_appended', handleRunEventAppended);
    this.socketCleanup.push(() => socket.off('run_event_appended', handleRunEventAppended));

    const handleRunEventUpdated: ServerToClientEvents['run_event_updated'] = (payload) =>
      handleRunEvent('run_event_updated', payload);
    socket.on('run_event_updated', handleRunEventUpdated);
    this.socketCleanup.push(() => socket.off('run_event_updated', handleRunEventUpdated));
    const handleToolOutputChunk: ServerToClientEvents['tool_output_chunk'] = (payload) => {
      for (const fn of this.toolChunkListeners) fn(payload);
    };
    socket.on('tool_output_chunk', handleToolOutputChunk);
    this.socketCleanup.push(() => socket.off('tool_output_chunk', handleToolOutputChunk));

    const handleToolOutputTerminal: ServerToClientEvents['tool_output_terminal'] = (payload) => {
      for (const fn of this.toolTerminalListeners) fn(payload);
    };
    socket.on('tool_output_terminal', handleToolOutputTerminal);
    this.socketCleanup.push(() => socket.off('tool_output_terminal', handleToolOutputTerminal));

    return socket;
  }

  subscribe(rooms: string[]) {
    const sock = this.connect();
    if (!sock) return;
    const toJoin: string[] = [];
    for (const room of rooms) {
      if (!room || this.subscribedRooms.has(room)) continue;
      this.subscribedRooms.add(room);
      toJoin.push(room);
    }
    this.emitSubscriptions(toJoin);
  }

  unsubscribe(rooms: string[]) {
    for (const room of rooms) {
      this.subscribedRooms.delete(room);
      if (room.startsWith('run:')) {
        const runId = room.slice(4);
        this.runCursors.delete(runId);
      }
    }
  }

  dispose() {
    const socket = this.socket;
    if (socket) {
      for (const cleanup of this.socketCleanup) {
        cleanup();
      }
      for (const cleanup of this.managerCleanup) {
        cleanup();
      }
      this.socketCleanup = [];
      this.managerCleanup = [];
      socket.disconnect();
    }

    this.socket = null;
    this.subscribedRooms.clear();
    this.runCursors.clear();
    this.runStatusListeners.clear();
    this.runEventListeners.clear();
    this.connectCallbacks.clear();
    this.reconnectCallbacks.clear();
    this.disconnectCallbacks.clear();
  }
  onRunEvent(cb: (payload: RunEventListenerPayload) => void) {
    this.runEventListeners.add(cb);
    return () => {
      this.runEventListeners.delete(cb);
    };
  }
  onRunStatusChanged(cb: (payload: RunStatusChangedPayload) => void) {
    this.runStatusListeners.add(cb);
    return () => {
      this.runStatusListeners.delete(cb);
    };
  }

  onToolOutputChunk(cb: ToolChunkListener) {
    this.toolChunkListeners.add(cb);
    return () => {
      this.toolChunkListeners.delete(cb);
    };
  }

  onToolOutputTerminal(cb: ToolTerminalListener) {
    this.toolTerminalListeners.add(cb);
    return () => {
      this.toolTerminalListeners.delete(cb);
    };
  }

  onConnected(cb: () => void) {
    this.connectCallbacks.add(cb);
    return () => {
      this.connectCallbacks.delete(cb);
    };
  }

  onReconnected(cb: () => void) {
    this.reconnectCallbacks.add(cb);
    return () => {
      this.reconnectCallbacks.delete(cb);
    };
  }

  onDisconnected(cb: () => void) {
    this.disconnectCallbacks.add(cb);
    return () => {
      this.disconnectCallbacks.delete(cb);
    };
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }

  setRunCursor(runId: string, cursor: RunTimelineEventsCursor | null, opts?: { force?: boolean }) {
    if (!runId) return;
    this.bumpRunCursor(runId, cursor, opts);
  }

  getRunCursor(runId: string): RunTimelineEventsCursor | null {
    return this.runCursors.get(runId) ?? null;
  }
}

export const graphSocket = new GraphSocket();
