import { tracingClient } from '@/api/client';
import {
  deriveEventStatus,
  flattenResourceSpans,
  getIntAttr,
  getJsonAttr,
  getStringAttr,
  hexToBytes,
  nanosToIso,
  SPAN_NAME_TO_EVENT_TYPE,
  spanToEvent,
} from '@/api/spanToEvent';
import type {
  ContextItemRole,
  LlmContextPage,
  LlmContextPageCursor,
  LlmContextPageItem,
  RunEventStatus,
  RunEventType,
  RunStatus,
  RunTimelineEventsCursor,
  RunTimelineEventsResponse,
  RunTimelineSummary,
  RunTimelineTotalsResponse,
  ToolOutputSnapshot,
} from '@/api/types/agents';
import { ListSpansOrderBy, SpanStatus, TraceStatus } from '@/gen/agynio/api/tracing/v1/tracing_pb';

const EVENT_TYPE_TO_SPAN_NAME: Record<RunEventType, string> =
  (Object.entries(SPAN_NAME_TO_EVENT_TYPE) as Array<[string, RunEventType]>).reduce(
    (acc, [spanName, eventType]) => {
      acc[eventType] = spanName;
      return acc;
    },
    {} as Record<RunEventType, string>,
  );

const RUN_EVENT_TYPES = new Set<RunEventType>(Object.keys(EVENT_TYPE_TO_SPAN_NAME) as RunEventType[]);
const RUN_EVENT_STATUSES = new Set<RunEventStatus>(['pending', 'running', 'success', 'error', 'cancelled']);

const EMPTY_COUNTS_BY_TYPE: Record<RunEventType, number> = {
  invocation_message: 0,
  injection: 0,
  llm_call: 0,
  tool_execution: 0,
  summarization: 0,
};

const EMPTY_COUNTS_BY_STATUS: Record<RunEventStatus, number> = {
  pending: 0,
  running: 0,
  success: 0,
  error: 0,
  cancelled: 0,
};

function parseCommaSeparated(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEventTypes(value?: string): RunEventType[] {
  return parseCommaSeparated(value).filter((type): type is RunEventType => RUN_EVENT_TYPES.has(type as RunEventType));
}

function parseEventStatuses(value?: string): RunEventStatus[] {
  return parseCommaSeparated(value).filter((status): status is RunEventStatus =>
    RUN_EVENT_STATUSES.has(status as RunEventStatus));
}

function mapTraceStatus(status: TraceStatus): RunStatus {
  switch (status) {
    case TraceStatus.RUNNING:
    case TraceStatus.UNSPECIFIED:
      return 'running';
    case TraceStatus.COMPLETED:
    case TraceStatus.ERROR:
      return 'finished';
    default:
      throw new Error(`Unhandled TraceStatus: ${status}`);
  }
}

function mapCountsByName(countsByName: Record<string, bigint>): Record<RunEventType, number> {
  const counts = { ...EMPTY_COUNTS_BY_TYPE };
  for (const [key, value] of Object.entries(countsByName)) {
    const type = SPAN_NAME_TO_EVENT_TYPE[key];
    if (!type) continue;
    counts[type] = Number(value);
  }
  return counts;
}

function mapCountsByStatus(countsByStatus: Record<string, bigint>): Record<RunEventStatus, number> {
  const counts = { ...EMPTY_COUNTS_BY_STATUS };
  for (const [key, value] of Object.entries(countsByStatus)) {
    switch (key) {
      case 'SPAN_STATUS_RUNNING':
        counts.running = Number(value);
        break;
      case 'SPAN_STATUS_OK':
        counts.success = Number(value);
        break;
      case 'SPAN_STATUS_ERROR':
        counts.error = Number(value);
        break;
    }
  }
  return counts;
}

function mapEventTypesToSpanNames(types: RunEventType[]): string[] {
  const spanNames: string[] = [];
  for (const type of types) {
    const mapped = EVENT_TYPE_TO_SPAN_NAME[type as RunEventType];
    if (mapped) spanNames.push(mapped);
  }
  return spanNames;
}

function mapEventStatusesToSpanStatuses(statuses: RunEventStatus[]): SpanStatus[] {
  const spanStatuses: SpanStatus[] = [];
  for (const status of statuses) {
    switch (status) {
      case 'running':
        spanStatuses.push(SpanStatus.RUNNING);
        break;
      case 'success':
        spanStatuses.push(SpanStatus.OK);
        break;
      case 'error':
        spanStatuses.push(SpanStatus.ERROR);
        break;
    }
  }
  return spanStatuses;
}

function buildPageToken(cursorTs?: string, cursorId?: string): string | null {
  if (!cursorTs || !cursorId) return null;
  const payload = JSON.stringify({ ts: cursorTs, id: cursorId });
  return btoa(payload);
}

function decodeCursorFromPageToken(token: string): RunTimelineEventsCursor | null {
  if (!token) return null;
  let decoded: string;
  try {
    decoded = atob(token);
  } catch {
    throw new Error(`Invalid base64 page token: ${token}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new Error('Invalid page token');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid page token');
  const { ts, id } = parsed as { ts?: unknown; id?: unknown };
  if (typeof ts !== 'string' || typeof id !== 'string') throw new Error('Invalid page token');
  return { ts, id };
}

export const runs = {
  timelineSummary: async (runId: string): Promise<RunTimelineSummary> => {
    const resp = await tracingClient.getTraceSummary({
      traceId: hexToBytes(runId),
    });
    const updatedAtNanos = resp.lastSpanEndTime !== 0n ? resp.lastSpanEndTime : resp.lastSpanStartTime;
    return {
      runId,
      threadId: '',
      status: mapTraceStatus(resp.status),
      createdAt: nanosToIso(resp.firstSpanStartTime),
      updatedAt: nanosToIso(updatedAtNanos),
      firstEventAt: nanosToIso(resp.firstSpanStartTime),
      lastEventAt: nanosToIso(resp.lastSpanStartTime),
      countsByType: mapCountsByName(resp.countsByName ?? {}),
      countsByStatus: mapCountsByStatus(resp.countsByStatus ?? {}),
      totalEvents: Number(resp.totalSpans),
    };
  },
  timelineEvents: async (
    runId: string,
    params: {
      types?: string;
      statuses?: string;
      limit?: number;
      order?: 'asc' | 'desc';
      cursorTs?: string;
      cursorId?: string;
    },
  ): Promise<RunTimelineEventsResponse> => {
    const filter: { traceId: Uint8Array; names?: string[]; statuses?: SpanStatus[] } = {
      traceId: hexToBytes(runId),
    };
    const types = parseEventTypes(params.types);
    if (types.length > 0) {
      filter.names = mapEventTypesToSpanNames(types);
    }
    const statuses = parseEventStatuses(params.statuses);
    if (statuses.length > 0) {
      const spanStatuses = mapEventStatusesToSpanStatuses(statuses);
      if (spanStatuses.length > 0) {
        filter.statuses = spanStatuses;
      }
    }
    const resp = await tracingClient.listSpans({
      filter,
      pageSize: params.limit ?? 50,
      orderBy: params.order === 'asc'
        ? ListSpansOrderBy.START_TIME_ASC
        : ListSpansOrderBy.START_TIME_DESC,
      pageToken: buildPageToken(params.cursorTs, params.cursorId) ?? '',
    });

    const spans = flattenResourceSpans(resp.resourceSpans);
    const items = spans.map(({ span, resourceAttrs }) => spanToEvent(span, resourceAttrs));

    return {
      items,
      nextCursor: resp.nextPageToken ? decodeCursorFromPageToken(resp.nextPageToken) : null,
    };
  },
  timelineEventTotals: async (
    runId: string,
    params?: { types?: string; statuses?: string },
  ): Promise<RunTimelineTotalsResponse> => {
    const req: { traceId: Uint8Array; names?: string[]; statuses?: SpanStatus[] } = {
      traceId: hexToBytes(runId),
    };
    const types = parseEventTypes(params?.types);
    if (types.length > 0) req.names = mapEventTypesToSpanNames(types);
    const statuses = parseEventStatuses(params?.statuses);
    if (statuses.length > 0) {
      const spanStatuses = mapEventStatusesToSpanStatuses(statuses);
      if (spanStatuses.length > 0) {
        req.statuses = spanStatuses;
      }
    }

    const resp = await tracingClient.getTraceSpanTotals(req);
    const tokenUsage = resp.tokenUsage;
    return {
      runId,
      filters: {
        types: params?.types ? parseEventTypes(params.types) : [],
        statuses: params?.statuses ? parseEventStatuses(params.statuses) : [],
      },
      totals: {
        eventCount: Number(resp.spanCount),
        tokenUsage: {
          input: Number(tokenUsage?.inputTokens ?? 0n),
          cached: Number(tokenUsage?.cacheReadInputTokens ?? 0n),
          output: Number(tokenUsage?.outputTokens ?? 0n),
          reasoning: Number(tokenUsage?.reasoningTokens ?? 0n),
          total: Number(tokenUsage?.totalTokens ?? 0n),
        },
      },
    };
  },
  toolOutputSnapshot: async (
    runId: string,
    eventId: string,
  ): Promise<ToolOutputSnapshot> => {
    const resp = await tracingClient.getSpan({
      traceId: hexToBytes(runId),
      spanId: hexToBytes(eventId),
    });
    const spans = flattenResourceSpans(resp.resourceSpans);
    if (spans.length === 0) return { items: [], terminal: null, nextSeq: null };

    const { span } = spans[0];
    const output = getStringAttr(span.attributes, 'agyn.tool.output');
    if (!output) return { items: [], terminal: null, nextSeq: null };

    const status = deriveEventStatus(span);
    const outputTs = span.endTimeUnixNano !== 0n ? span.endTimeUnixNano : span.startTimeUnixNano;
    return {
      items: [
        {
          runId,
          threadId: '',
          eventId,
          seqGlobal: 0,
          seqStream: 0,
          source: 'stdout',
          ts: nanosToIso(outputTs),
          data: output,
        },
      ],
      terminal: span.endTimeUnixNano !== 0n
        ? {
            runId,
            threadId: '',
            eventId,
            exitCode: status === 'error' ? 1 : 0,
            status: status === 'error' ? 'error' : 'success',
            bytesStdout: output.length,
            bytesStderr: 0,
            totalChunks: 1,
            droppedChunks: 0,
            savedPath: null,
            message: null,
            ts: nanosToIso(span.endTimeUnixNano),
          }
        : null,
      nextSeq: null,
    };
  },
  llmContext: async (
    runId: string,
    eventId: string,
    params?: { limit?: number; cursor?: LlmContextPageCursor | null },
  ): Promise<LlmContextPage> => {
    const resp = await tracingClient.getSpan({
      traceId: hexToBytes(runId),
      spanId: hexToBytes(eventId),
    });
    const spans = flattenResourceSpans(resp.resourceSpans);
    if (spans.length === 0) return { items: [], nextCursor: null };

    const { span } = spans[0];
    const contextEvents = span.events.filter((event) => event.name === 'agyn.llm.context_item');

    const limit = params?.limit ?? 50;
    const startIdx = params?.cursor?.idx ?? 0;
    const slice = contextEvents.slice(startIdx, startIdx + limit);

    const items: LlmContextPageItem[] = slice.map((event, index) => {
      const idx = startIdx + index;
      const eventAttrs = event.attributes;
      return {
        rowId: `${eventId}-ctx-${idx}`,
        idx,
        isNew: getStringAttr(eventAttrs, 'agyn.context.is_new') === 'true',
        contextItem: {
          id: `${eventId}-ctx-${idx}`,
          role: (getStringAttr(eventAttrs, 'agyn.context.role') ?? 'other') as ContextItemRole,
          contentText: getStringAttr(eventAttrs, 'agyn.context.text'),
          contentJson: getJsonAttr(eventAttrs, 'agyn.context.content_json'),
          metadata: null,
          sizeBytes: getIntAttr(eventAttrs, 'agyn.context.size_bytes') ?? 0,
          createdAt: nanosToIso(event.timeUnixNano),
        },
      };
    });

    const hasMore = startIdx + limit < contextEvents.length;
    return {
      items,
      nextCursor: hasMore
        ? { idx: startIdx + limit, rowId: items[items.length - 1]?.rowId ?? '' }
        : null,
    };
  },
};
