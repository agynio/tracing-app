import type { JsonObject } from '@bufbuild/protobuf';
import { notificationsClient } from '@/api/client';

const RECONNECT_DELAY_MS = 3000;

type SpanEventListener = (traceId: string, spanId: string, isNew: boolean) => void;
type ReconnectListener = () => void;

function getPayloadString(payload: JsonObject | undefined, key: string): string | null {
  if (!payload) return null;
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

class NotificationStream {
  private abortController: AbortController | null = null;
  private traceId = '';
  private listeners = {
    spanEvent: [] as SpanEventListener[],
    reconnect: [] as ReconnectListener[],
  };
  private hasConnected = false;

  connect(traceId: string) {
    this.disconnect();
    this.traceId = traceId;
    this.abortController = new AbortController();
    this.hasConnected = false;
    void this.startStream();
  }

  disconnect() {
    this.abortController?.abort();
    this.abortController = null;
    this.traceId = '';
    this.hasConnected = false;
  }

  onSpanEvent(cb: SpanEventListener): () => void {
    this.listeners.spanEvent.push(cb);
    return () => {
      this.listeners.spanEvent = this.listeners.spanEvent.filter((listener) => listener !== cb);
    };
  }

  onReconnect(cb: ReconnectListener): () => void {
    this.listeners.reconnect.push(cb);
    return () => {
      this.listeners.reconnect = this.listeners.reconnect.filter((listener) => listener !== cb);
    };
  }

  private emitReconnect() {
    for (const listener of this.listeners.reconnect) {
      listener();
    }
  }

  private emitSpanEvent(traceId: string, spanId: string, isNew: boolean) {
    for (const listener of this.listeners.spanEvent) {
      listener(traceId, spanId, isNew);
    }
  }

  private async startStream() {
    const signal = this.abortController?.signal;
    if (!signal) return;
    const isReconnect = this.hasConnected;
    this.hasConnected = true;
    if (isReconnect) this.emitReconnect();

    try {
      for await (const response of notificationsClient.subscribe({}, { signal })) {
        const envelope = response.envelope;
        if (!envelope) continue;
        if (!envelope.rooms.includes(`trace:${this.traceId}`)) continue;
        if (envelope.event !== 'span.created' && envelope.event !== 'span.updated') continue;

        const traceId = getPayloadString(envelope.payload, 'trace_id');
        const spanId = getPayloadString(envelope.payload, 'span_id');
        if (!traceId || !spanId) continue;

        const isNew = envelope.event === 'span.created';
        this.emitSpanEvent(traceId, spanId, isNew);
      }
    } catch (_err) {
      if (signal?.aborted) return;
      globalThis.setTimeout(() => {
        if (this.abortController?.signal.aborted) return;
        void this.startStream();
      }, RECONNECT_DELAY_MS);
    }
  }
}

export const notificationStream = new NotificationStream();
