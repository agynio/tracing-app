import type {
  ContextItem,
  LlmContextPage,
  LlmContextPageCursor,
  LlmContextPageItem,
  RunEventStatus,
  RunEventType,
  RunStatus,
  RunTimelineEvent,
  RunTimelineEventsCursor,
  RunTimelineEventsResponse,
  RunTimelineSummary,
  RunTimelineTotalsResponse,
  ToolOutputChunk,
  ToolOutputSnapshot,
  ToolOutputTerminal,
} from '@/api/types/agents';
import type { TemplateSchema } from '@/api/types/graph';

export type MockRunData = {
  runId: string;
  threadId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  events: RunTimelineEvent[];
  contextItems: LlmContextPageItem[];
  contextItemMap: Map<string, ContextItem>;
  toolOutputs: Map<string, ToolOutputSnapshot>;
};

export const DEFAULT_THREAD_ID = 'thread-demo';
export const DEFAULT_RUN_ID = 'run-demo';
export const DEFAULT_EVENT_IDS = {
  message: `evt-${DEFAULT_RUN_ID}-message`,
  llm: `evt-${DEFAULT_RUN_ID}-llm`,
  tool: `evt-${DEFAULT_RUN_ID}-tool`,
  summary: `evt-${DEFAULT_RUN_ID}-summary`,
} as const;

export const ALL_EVENT_TYPES: RunEventType[] = [
  'invocation_message',
  'injection',
  'llm_call',
  'tool_execution',
  'summarization',
];
export const ALL_EVENT_STATUSES: RunEventStatus[] = ['pending', 'running', 'success', 'error', 'cancelled'];

const mockRuns = new Map<string, MockRunData>();
const BASE_TIME = new Date('2026-01-15T12:00:00Z').getTime();

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function compareCursors(a: RunTimelineEventsCursor, b: RunTimelineEventsCursor): number {
  const timeDiff = new Date(a.ts).getTime() - new Date(b.ts).getTime();
  if (timeDiff !== 0) return timeDiff;
  const lexical = a.ts.localeCompare(b.ts);
  if (lexical !== 0) return lexical;
  return a.id.localeCompare(b.id);
}

function toCursor(event: RunTimelineEvent): RunTimelineEventsCursor {
  return { ts: event.ts, id: event.id };
}

function sumToolBytes(chunks: ToolOutputChunk[], source: 'stdout' | 'stderr'): number {
  return chunks.filter((chunk) => chunk.source === source).reduce((acc, chunk) => acc + chunk.data.length, 0);
}

function buildContextItems(
  runId: string,
  threadId: string,
  baseTime: number,
): { items: LlmContextPageItem[]; map: Map<string, ContextItem> } {
  const templates = [
    { role: 'system', content: 'You are assisting with tracing timeline analysis.' },
    { role: 'user', content: 'Summarize the latest agent run.' },
    { role: 'assistant', content: 'Collecting run metrics and timeline events.' },
    { role: 'user', content: 'Include any tool output highlights.' },
    { role: 'assistant', content: 'Reviewing tool execution output.' },
    { role: 'tool', content: 'pnpm install\nDependencies installed' },
    { role: 'assistant', content: 'Parsing LLM response for the run.' },
    { role: 'user', content: 'Highlight any warnings.' },
    { role: 'assistant', content: 'One warning detected about mock data usage.' },
    { role: 'assistant', content: 'Drafting summary for the trace.' },
    { role: 'user', content: 'Confirm follow mode for timeline.' },
    { role: 'assistant', content: 'Follow mode enabled for new events.' },
  ];

  const map = new Map<string, ContextItem>();
  const items = templates.map((template, index) => {
    const id = `ctx-${runId}-${index + 1}`;
    const createdAt = toIso(baseTime + index * 15000);
    const contentText = template.content;
    const contextItem: ContextItem = {
      id,
      role: template.role as ContextItem['role'],
      contentText,
      contentJson: null,
      metadata: { threadId, runId, source: 'mock' },
      sizeBytes: contentText.length,
      createdAt,
    };
    map.set(id, contextItem);
    return {
      rowId: `row-${id}`,
      idx: index,
      isNew: index >= templates.length - 3,
      contextItem,
    };
  });

  return { items, map };
}

function buildMockRun(runId: string): MockRunData {
  const threadId = runId === DEFAULT_RUN_ID ? DEFAULT_THREAD_ID : `thread-${runId}`;
  const baseTime = BASE_TIME;
  const createdAt = toIso(baseTime);
  const toolEventId = `evt-${runId}-tool`;

  const { items: contextItems, map: contextItemMap } = buildContextItems(runId, threadId, baseTime - 3 * 60 * 1000);
  const inputContext = contextItems.slice(-6).map((item, index) => ({
    id: `input-${item.rowId}`,
    contextItemId: item.contextItem.id,
    role: item.contextItem.role,
    order: index,
    createdAt: item.contextItem.createdAt,
    isNew: item.isNew,
  }));

  const messageEvent: RunTimelineEvent = {
    id: `evt-${runId}-message`,
    runId,
    threadId,
    type: 'invocation_message',
    status: 'success',
    ts: toIso(baseTime),
    startedAt: toIso(baseTime),
    endedAt: toIso(baseTime + 1200),
    durationMs: 1200,
    nodeId: null,
    sourceKind: 'internal',
    sourceSpanId: null,
    metadata: { source: 'mock' },
    errorCode: null,
    errorMessage: null,
    message: {
      messageId: `msg-${runId}-1`,
      role: 'user',
      kind: 'user',
      text: 'Provide a quick status update for the current run.',
      source: { channel: 'ui' },
      createdAt: toIso(baseTime),
    },
    attachments: [],
  };

  const llmEvent: RunTimelineEvent = {
    id: `evt-${runId}-llm`,
    runId,
    threadId,
    type: 'llm_call',
    status: 'success',
    ts: toIso(baseTime + 60000),
    startedAt: toIso(baseTime + 60000),
    endedAt: toIso(baseTime + 60000 + 2400),
    durationMs: 2400,
    nodeId: null,
    sourceKind: 'internal',
    sourceSpanId: null,
    metadata: { source: 'mock', trace: 'llm' },
    errorCode: null,
    errorMessage: null,
    llmCall: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      topP: 1,
      stopReason: 'stop',
      inputContextItems: inputContext,
      contextDeltaStatus: 'available',
      responseText: 'The run completed the tool step and summarized the output with one warning.',
      rawResponse: {
        choices: [
          {
            message: {
              content: 'The run completed the tool step and summarized the output with one warning.',
            },
          },
        ],
      },
      toolCalls: [
        {
          callId: 'call-1',
          name: 'shell_command',
          arguments: { command: 'pnpm install', cwd: '/workspace/tracing-app' },
        },
      ],
      linkedToolExecutionIds: [toolEventId],
      usage: {
        inputTokens: 142,
        cachedInputTokens: 0,
        outputTokens: 58,
        reasoningTokens: 12,
        totalTokens: 200,
      },
    },
    attachments: [],
  };

  const toolEvent: RunTimelineEvent = {
    id: toolEventId,
    runId,
    threadId,
    type: 'tool_execution',
    status: 'running',
    ts: toIso(baseTime + 120000),
    startedAt: toIso(baseTime + 120000),
    endedAt: toIso(baseTime + 120000 + 8000),
    durationMs: 8000,
    nodeId: null,
    sourceKind: 'internal',
    sourceSpanId: null,
    metadata: {
      threadId,
      runId,
      childThreadId: `${threadId}-child`,
      childRunId: `${runId}-child`,
    },
    errorCode: null,
    errorMessage: null,
    toolExecution: {
      toolName: 'shell_command',
      toolCallId: 'call-1',
      execStatus: 'success',
      input: {
        command: 'pnpm install',
        cwd: '/workspace/tracing-app',
        worker: 'local',
        threadAlias: 'tracing',
        childThreadId: `${threadId}-child`,
        childRunId: `${runId}-child`,
        message: 'Install dependencies for tracing timeline app',
      },
      output: 'Progress: resolved 128 packages\nDone in 3.4s',
      errorMessage: null,
      raw: null,
    },
    attachments: [],
  };

  const summarizationEvent: RunTimelineEvent = {
    id: `evt-${runId}-summary`,
    runId,
    threadId,
    type: 'summarization',
    status: 'success',
    ts: toIso(baseTime + 180000),
    startedAt: toIso(baseTime + 180000),
    endedAt: toIso(baseTime + 180000 + 1200),
    durationMs: 1200,
    nodeId: null,
    sourceKind: 'internal',
    sourceSpanId: null,
    metadata: {
      oldContext: [
        { role: 'user', content: 'Summarize the latest run.' },
        { role: 'assistant', content: 'Collecting timeline metrics.' },
      ],
      newContext: [
        { role: 'assistant', content: 'Summary: tool execution succeeded with one warning.' },
        { role: 'assistant', content: 'Follow mode enabled for new events.' },
      ],
    },
    errorCode: null,
    errorMessage: null,
    summarization: {
      summaryText: 'Tool execution succeeded with a single warning about mock data usage.',
      newContextCount: 2,
      oldContextTokens: 64,
      raw: null,
    },
    attachments: [],
  };

  const events = [messageEvent, llmEvent, toolEvent, summarizationEvent].sort((a, b) =>
    compareCursors(toCursor(a), toCursor(b)),
  );

  const toolChunks: ToolOutputChunk[] = [
    {
      runId,
      threadId,
      eventId: toolEventId,
      seqGlobal: 1,
      seqStream: 1,
      source: 'stdout',
      ts: toIso(baseTime + 120000 + 1000),
      data: 'Resolving packages...\n',
    },
    {
      runId,
      threadId,
      eventId: toolEventId,
      seqGlobal: 2,
      seqStream: 2,
      source: 'stdout',
      ts: toIso(baseTime + 120000 + 2000),
      data: 'Dependencies installed\n',
    },
    {
      runId,
      threadId,
      eventId: toolEventId,
      seqGlobal: 3,
      seqStream: 3,
      source: 'stderr',
      ts: toIso(baseTime + 120000 + 2600),
      data: 'warning: using mock data\n',
    },
  ];

  const terminal: ToolOutputTerminal = {
    runId,
    threadId,
    eventId: toolEventId,
    exitCode: 0,
    status: 'success',
    bytesStdout: sumToolBytes(toolChunks, 'stdout'),
    bytesStderr: sumToolBytes(toolChunks, 'stderr'),
    totalChunks: toolChunks.length,
    droppedChunks: 0,
    savedPath: null,
    message: null,
    ts: toIso(baseTime + 120000 + 3000),
  };

  const toolSnapshot: ToolOutputSnapshot = {
    items: toolChunks,
    terminal,
    nextSeq: toolChunks.length + 1,
  };

  const toolOutputs = new Map<string, ToolOutputSnapshot>([[toolEventId, toolSnapshot]]);

  return {
    runId,
    threadId,
    status: 'running',
    createdAt,
    updatedAt: toIso(baseTime + 180000),
    events,
    contextItems,
    contextItemMap,
    toolOutputs,
  };
}

export function getMockRun(runId: string): MockRunData {
  const existing = mockRuns.get(runId);
  if (existing) return existing;
  const created = buildMockRun(runId);
  mockRuns.set(runId, created);
  return created;
}

function ensureDefaultRun() {
  if (mockRuns.size === 0) {
    getMockRun(DEFAULT_RUN_ID);
  }
}

export function listThreads(): Array<{ id: string }> {
  ensureDefaultRun();
  const ids = new Set<string>();
  for (const run of mockRuns.values()) {
    ids.add(run.threadId);
  }
  return Array.from(ids).map((id) => ({ id }));
}

export function listRunsForThread(threadId: string): Array<{ id: string; threadId: string; status: RunStatus; createdAt: string }> {
  ensureDefaultRun();
  return Array.from(mockRuns.values())
    .filter((run) => run.threadId === threadId)
    .map((run) => ({
      id: run.runId,
      threadId: run.threadId,
      status: run.status,
      createdAt: run.createdAt,
    }));
}

export function getContextItems(ids: string[]): ContextItem[] {
  ensureDefaultRun();
  if (ids.length === 0) return [];
  const items: ContextItem[] = [];
  for (const id of ids) {
    for (const run of mockRuns.values()) {
      const found = run.contextItemMap.get(id);
      if (found) {
        items.push(found);
        break;
      }
    }
  }
  return items;
}

export function getLlmContextPage(runId: string, cursor: LlmContextPageCursor | null, limit: number): LlmContextPage {
  const run = getMockRun(runId);
  return getContextPage(run, cursor, limit);
}

function getContextPage(run: MockRunData, cursor: LlmContextPageCursor | null, limit: number): LlmContextPage {
  const items = run.contextItems;
  const endIndex = cursor?.idx ?? items.length;
  const startIndex = Math.max(0, endIndex - limit);
  const slice = items.slice(startIndex, endIndex);
  const newestFirst = [...slice].reverse();
  const nextCursor = startIndex > 0 ? { idx: startIndex, rowId: items[startIndex].rowId } : null;
  return { items: newestFirst, nextCursor };
}

function filterEvents(events: RunTimelineEvent[], types: RunEventType[], statuses: RunEventStatus[]): RunTimelineEvent[] {
  return events.filter((event) => {
    if (types.length > 0 && !types.includes(event.type)) return false;
    if (statuses.length > 0 && !statuses.includes(event.status)) return false;
    return true;
  });
}

type RunEventsParams = {
  types: RunEventType[];
  statuses: RunEventStatus[];
  limit: number;
  order: 'asc' | 'desc';
  cursor: RunTimelineEventsCursor | null;
};

export function getRunEvents(runId: string, params: RunEventsParams): RunTimelineEventsResponse {
  const run = getMockRun(runId);
  return buildEventsResponse(run, params);
}

export function getRunSummary(runId: string): RunTimelineSummary {
  return buildSummary(getMockRun(runId));
}

function buildEventsResponse(run: MockRunData, params: RunEventsParams): RunTimelineEventsResponse {
  const { types, statuses, order, limit, cursor } = params;
  let filtered = filterEvents(run.events, types, statuses).sort((a, b) => compareCursors(toCursor(a), toCursor(b)));
  if (cursor) {
    filtered = filtered.filter((event) => {
      const cmp = compareCursors(toCursor(event), cursor);
      return order === 'desc' ? cmp < 0 : cmp > 0;
    });
  }

  if (order === 'desc') {
    filtered = [...filtered].sort((a, b) => compareCursors(toCursor(b), toCursor(a)));
  }

  const pageItems = filtered.slice(0, limit);
  const nextCursor = filtered.length > limit && pageItems.length > 0 ? toCursor(pageItems[pageItems.length - 1]) : null;
  return { items: pageItems, nextCursor };
}

export function buildSummary(run: MockRunData): RunTimelineSummary {
  const countsByType = ALL_EVENT_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {} as Record<RunEventType, number>);
  const countsByStatus = ALL_EVENT_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as Record<RunEventStatus, number>);
  run.events.forEach((event) => {
    countsByType[event.type] += 1;
    countsByStatus[event.status] += 1;
  });

  return {
    runId: run.runId,
    threadId: run.threadId,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    firstEventAt: run.events[0]?.ts ?? null,
    lastEventAt: run.events[run.events.length - 1]?.ts ?? null,
    countsByType,
    countsByStatus,
    totalEvents: run.events.length,
  };
}

type RunTotalsParams = { types: RunEventType[]; statuses: RunEventStatus[] };

export function getRunTotals(runId: string, params: RunTotalsParams): RunTimelineTotalsResponse {
  const run = getMockRun(runId);
  return buildTotals(run, params);
}

function buildTotals(run: MockRunData, params: { types: RunEventType[]; statuses: RunEventStatus[] }): RunTimelineTotalsResponse {
  const types = params.types.length > 0 ? params.types : ALL_EVENT_TYPES;
  const statuses = params.statuses.length > 0 ? params.statuses : ALL_EVENT_STATUSES;
  const filtered = filterEvents(run.events, types, statuses);

  const tokenUsage = filtered.reduce(
    (acc, event) => {
      const usage = event.llmCall?.usage;
      if (!usage) return acc;
      acc.input += usage.inputTokens ?? 0;
      acc.cached += usage.cachedInputTokens ?? 0;
      acc.output += usage.outputTokens ?? 0;
      acc.reasoning += usage.reasoningTokens ?? 0;
      acc.total += usage.totalTokens ?? 0;
      return acc;
    },
    { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 },
  );

  return {
    runId: run.runId,
    filters: {
      types,
      statuses,
    },
    totals: {
      eventCount: filtered.length,
      tokenUsage,
    },
  };
}

export function getToolOutputSnapshot(
  runId: string,
  eventId: string,
  params?: { sinceSeq?: number; limit?: number; order?: 'asc' | 'desc' },
): ToolOutputSnapshot {
  const run = getMockRun(runId);
  const snapshot = run.toolOutputs.get(eventId);
  if (!snapshot) {
    return { items: [], terminal: null, nextSeq: null };
  }
  let items = snapshot.items;
  const sinceSeq = params?.sinceSeq;
  if (sinceSeq !== undefined) {
    items = items.filter((chunk) => chunk.seqGlobal > sinceSeq);
  }
  if (params?.order === 'desc') {
    items = [...items].sort((a, b) => b.seqGlobal - a.seqGlobal);
  }
  if (params?.limit !== undefined && params.limit > 0) {
    items = items.slice(0, params.limit);
  }
  return { ...snapshot, items };
}

export function terminateRun(runId: string): { ok: boolean } {
  const run = getMockRun(runId);
  run.status = 'terminated';
  run.updatedAt = toIso(Date.now());
  return { ok: true };
}

export function buildTemplates(): TemplateSchema[] {
  return [
    {
      name: 'agent',
      title: 'Agent',
      kind: 'agent',
      description: 'Mock template for tracing timeline',
      sourcePorts: [],
      targetPorts: [],
      capabilities: {
        pausable: true,
        dynamicConfigurable: true,
        staticConfigurable: true,
      },
    },
  ];
}
