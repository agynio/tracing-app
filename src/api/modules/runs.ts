import {
  ALL_EVENT_STATUSES,
  ALL_EVENT_TYPES,
  getLlmContextPage,
  getRunEvents,
  getRunSummary,
  getRunTotals,
  getToolOutputSnapshot,
  terminateRun,
} from '@/api/mock-data/store';
import type {
  LlmContextPage,
  LlmContextPageCursor,
  RunEventStatus,
  RunEventType,
  RunTimelineEventsResponse,
  RunTimelineSummary,
  RunTimelineTotalsResponse,
  ToolOutputSnapshot,
} from '@/api/types/agents';

function parseList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEventTypes(value?: string): RunEventType[] {
  const candidates = parseList(value);
  return candidates.filter((candidate): candidate is RunEventType => ALL_EVENT_TYPES.includes(candidate as RunEventType));
}

function parseEventStatuses(value?: string): RunEventStatus[] {
  const candidates = parseList(value);
  return candidates.filter((candidate): candidate is RunEventStatus => ALL_EVENT_STATUSES.includes(candidate as RunEventStatus));
}

export const runs = {
  timelineSummary: async (runId: string): Promise<RunTimelineSummary> => getRunSummary(runId),
  timelineEvents: async (
    runId: string,
    params: {
      types?: string;
      statuses?: string;
      limit?: number;
      order?: 'asc' | 'desc';
      cursorTs?: string;
      cursorId?: string;
      cursorParamMode?: 'both' | 'bracketed' | 'plain';
    },
  ): Promise<RunTimelineEventsResponse> => {
    const { cursorParamMode: _cursorParamMode, ...rest } = params;
    const types = parseEventTypes(rest.types);
    const statuses = parseEventStatuses(rest.statuses);
    const limit = rest.limit && rest.limit > 0 ? rest.limit : Number.MAX_SAFE_INTEGER;
    const order = rest.order === 'desc' ? 'desc' : 'asc';
    const cursor = rest.cursorTs && rest.cursorId ? { ts: rest.cursorTs, id: rest.cursorId } : null;
    return getRunEvents(runId, { types, statuses, limit, order, cursor });
  },
  timelineEventTotals: async (runId: string, params?: { types?: string; statuses?: string }): Promise<RunTimelineTotalsResponse> => {
    const types = parseEventTypes(params?.types);
    const statuses = parseEventStatuses(params?.statuses);
    return getRunTotals(runId, { types, statuses });
  },
  toolOutputSnapshot: async (
    runId: string,
    eventId: string,
    params?: { sinceSeq?: number; limit?: number; order?: 'asc' | 'desc' },
  ): Promise<ToolOutputSnapshot> =>
    getToolOutputSnapshot(runId, eventId, {
      order: params?.order ?? 'asc',
      ...(params?.sinceSeq !== undefined ? { sinceSeq: params.sinceSeq } : {}),
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    }),
  llmContext: async (
    runId: string,
    _eventId: string,
    params?: { limit?: number; cursor?: LlmContextPageCursor | null },
  ): Promise<LlmContextPage> => {
    const limit = params?.limit && params.limit > 0 ? params.limit : 100;
    return getLlmContextPage(runId, params?.cursor ?? null, limit);
  },
  terminate: async (runId: string): Promise<{ ok: boolean }> => terminateRun(runId),
};
