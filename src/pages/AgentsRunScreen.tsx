import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import RunScreen, { type EventFilter, type StatusFilter } from '@/components/screens/RunScreen';
import type { RunEvent as UiRunEvent } from '@/components/RunEventsList';
import { useRunTimelineEventTotals, useRunTimelineSummary } from '@/api/hooks/runs';
import { runs } from '@/api/modules/runs';
import type {
  LlmContextPageCursor,
  LlmContextPageItem,
  RunEventStatus,
  RunEventType,
} from '@/api/types/agents';
import { useFollowState } from '@/hooks/useFollowState';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTimelinePagination } from '@/hooks/useTimelinePagination';
import { matchesFilters } from '@/lib/eventFiltering';
import { createUiEvent, extractLlmResponse, mapRunStatus } from '@/lib/eventMapping';
import { toContextRecord } from '@/lib/llmContext';
import { buildToolLinkData } from '@/lib/toolDataParsing';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatDuration } from '@/components/agents/runTimelineFormatting';

const EVENT_FILTER_OPTIONS: EventFilter[] = ['message', 'llm', 'tool', 'summary'];
const STATUS_FILTER_OPTIONS: StatusFilter[] = ['running', 'finished', 'failed', 'terminated'];
const API_EVENT_TYPES: RunEventType[] = ['invocation_message', 'injection', 'llm_call', 'tool_execution', 'summarization'];
const API_EVENT_STATUSES: RunEventStatus[] = ['pending', 'running', 'success', 'error', 'cancelled'];
const LLM_CONTEXT_PAGE_LIMIT = 100;

type LlmContextState = {
  items: LlmContextPageItem[];
  nextCursor: LlmContextPageCursor | null;
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
};

const EVENT_FILTER_TO_TYPES: Record<EventFilter, RunEventType[]> = {
  message: ['invocation_message', 'injection'],
  llm: ['llm_call'],
  tool: ['tool_execution'],
  summary: ['summarization'],
};

const STATUS_FILTER_TO_STATUSES: Record<StatusFilter, RunEventStatus[]> = {
  running: ['pending', 'running'],
  finished: ['success'],
  failed: ['error'],
  terminated: ['cancelled'],
};


type TokenTotals = {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  total: number;
};

const EMPTY_TOKENS: TokenTotals = { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 };

type ContextRecord = Record<string, unknown> & { __agynIsNew?: boolean };

function buildContextRecords(items: LlmContextPageItem[]): ContextRecord[] {
  if (items.length === 0) return [];
  return items.map((item) => {
    const record = toContextRecord(item.contextItem);
    return item.isNew ? { ...record, __agynIsNew: true } : record;
  });
}

function useRunDuration(
  createdAt: string | undefined,
  status: 'running' | 'finished' | 'terminated' | undefined,
  reference: string | undefined,
): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!createdAt || status !== 'running') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [createdAt, status]);

  const start = createdAt ? Date.parse(createdAt) : NaN;
  if (Number.isNaN(start)) return '—';
  const end = (() => {
    if (status === 'running') return now;
    if (reference) {
      const parsed = Date.parse(reference);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return now;
  })();
  const durationMs = Math.max(0, end - start);
  const label = formatDuration(durationMs);
  return label === '—' ? '0 ms' : label;
}

function sanitizeEventFilters(filters: EventFilter[]): EventFilter[] {
  if (filters.length === 0) return EVENT_FILTER_OPTIONS;
  const next = Array.from(new Set(filters));
  return EVENT_FILTER_OPTIONS.filter((filter) => next.includes(filter));
}

function sanitizeStatusFilters(filters: StatusFilter[]): StatusFilter[] {
  const next = Array.from(new Set(filters));
  return STATUS_FILTER_OPTIONS.filter((filter) => next.includes(filter));
}

export function AgentsRunScreen() {
  const params = useParams<{ threadId: string; runId: string }>();
  const runId = params.runId;
  const [searchParams, setSearchParams] = useSearchParams();
  const updateSearchParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        mutator(next);
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );
  const selectedEventId = searchParams.get('eventId');

  const isMdUp = useMediaQuery('(min-width: 768px)');
  const [liveMessage, setLiveMessage] = useState('');
  const [eventFilters, setEventFilters] = useState<EventFilter[]>(EVENT_FILTER_OPTIONS);
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);
  const [tokensPopoverOpen, setTokensPopoverOpen] = useState(false);
  const [runsPopoverOpen, setRunsPopoverOpen] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const contextStateRef = useRef<Map<string, LlmContextState>>(new Map());
  const [contextStateVersion, setContextStateVersion] = useState(0);

  const announce = useCallback((message: string) => {
    setLiveMessage((prev) => (prev === message ? `${message} ` : message));
  }, []);

  const { isFollowing, followRef, setFollowing, toggleFollowing } = useFollowState({
    runId,
    searchParams,
    updateSearchParams,
    defaultFollow: isMdUp,
    onAnnounce: announce,
  });

  useEffect(() => {
    setEventFilters(EVENT_FILTER_OPTIONS);
    setStatusFilters([]);
    setIsTerminating(false);
    contextStateRef.current.clear();
    setContextStateVersion((version) => version + 1);
  }, [runId]);

  const apiTypes = useMemo(() => {
    if (eventFilters.length === EVENT_FILTER_OPTIONS.length) return [] as RunEventType[];
    const set = new Set<RunEventType>();
    eventFilters.forEach((filter) => {
      for (const type of EVENT_FILTER_TO_TYPES[filter]) set.add(type);
    });
    return set.size === API_EVENT_TYPES.length ? [] : Array.from(set);
  }, [eventFilters]);

  const selectedTypes = useMemo(() => (apiTypes.length === 0 ? API_EVENT_TYPES : apiTypes), [apiTypes]);

  const apiStatuses = useMemo(() => {
    if (statusFilters.length === 0) return [] as RunEventStatus[];
    const set = new Set<RunEventStatus>();
    statusFilters.forEach((filter) => {
      for (const status of STATUS_FILTER_TO_STATUSES[filter]) set.add(status);
    });
    return set.size === API_EVENT_STATUSES.length ? [] : Array.from(set);
  }, [statusFilters]);

  const selectedStatuses = useMemo(() => (apiStatuses.length === 0 ? API_EVENT_STATUSES : apiStatuses), [apiStatuses]);

  const summaryQuery = useRunTimelineSummary(runId);
  const totalsQuery = useRunTimelineEventTotals(runId, { types: apiTypes, statuses: apiStatuses });

  const { refetch: refetchTotals } = totalsQuery;
  const totalsRefetchStateRef = useRef<{ timeout: ReturnType<typeof setTimeout> | null; lastInvoked: number }>({
    timeout: null,
    lastInvoked: 0,
  });

  useEffect(() => {
    const state = totalsRefetchStateRef.current;
    return () => {
      if (state.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
      }
    };
  }, []);

  const scheduleTotalsRefetch = useCallback(() => {
    if (!runId) return;
    const state = totalsRefetchStateRef.current;
    const minIntervalMs = 2000;
    const now = Date.now();

    const invoke = () => {
      state.timeout = null;
      state.lastInvoked = Date.now();
      void refetchTotals();
    };

    if (state.timeout) return;
    if (now - state.lastInvoked >= minIntervalMs) {
      invoke();
      return;
    }

    state.timeout = setTimeout(invoke, Math.max(0, minIntervalMs - (now - state.lastInvoked)));
  }, [refetchTotals, runId]);

  useEffect(() => {
    if (!runId) return;
    void refetchTotals();
  }, [runId, apiTypes, apiStatuses, refetchTotals]);

  const refreshSummaryAndTotals = useCallback(() => {
    void summaryQuery.refetch();
    scheduleTotalsRefetch();
  }, [summaryQuery, scheduleTotalsRefetch]);

  const {
    allEvents,
    events,
    nextCursor,
    loadingOlder,
    loadOlderError,
    loadOlderEvents,
    isLoading: eventsLoading,
    error: eventsError,
    queryData: eventsQueryData,
  } = useTimelinePagination({
    runId,
    apiTypes,
    apiStatuses,
    selectedTypes,
    selectedStatuses,
    onRunEvent: refreshSummaryAndTotals,
    onRunStatusChange: refreshSummaryAndTotals,
    onReconnect: refreshSummaryAndTotals,
  });

  const updateContextState = useCallback(
    (eventId: string, updater: (state: LlmContextState) => LlmContextState) => {
      const map = contextStateRef.current;
      const current: LlmContextState = map.get(eventId) ?? {
        items: [],
        nextCursor: null,
        isLoading: false,
        error: null,
        hasFetched: false,
      };
      const next = updater(current);
      if (next !== current) {
        map.set(eventId, next);
        setContextStateVersion((version) => version + 1);
      }
      return next;
    },
    [],
  );

  const loadContextPage = useCallback(
    async (eventId: string, cursor: LlmContextPageCursor | null): Promise<{ addedCount: number; hasMore: boolean }> => {
      if (!runId) return { addedCount: 0, hasMore: false };
      const current = contextStateRef.current.get(eventId);
      if (current?.isLoading) return { addedCount: 0, hasMore: current.nextCursor !== null };

      updateContextState(eventId, (state) => ({
        ...state,
        isLoading: true,
        error: null,
      }));

      try {
        const page = await runs.llmContext(runId, eventId, {
          limit: LLM_CONTEXT_PAGE_LIMIT,
          cursor,
        });
        const newestFirstItems = Array.isArray(page.items) ? page.items : [];
        const reversedItems = [...newestFirstItems].reverse();
        let addedCount = 0;

        updateContextState(eventId, (state) => {
          const existing = state.items ?? [];
          const existingIds = new Set(existing.map((item) => item.rowId));
          const deduped: LlmContextPageItem[] = [];
          for (const item of reversedItems) {
            if (existingIds.has(item.rowId)) continue;
            existingIds.add(item.rowId);
            deduped.push(item);
          }
          addedCount = deduped.length;
          const merged = cursor ? [...deduped, ...existing] : deduped;
          return {
            items: merged,
            nextCursor: page.nextCursor ?? null,
            isLoading: false,
            error: null,
            hasFetched: true,
          };
        });

        return { addedCount, hasMore: page.nextCursor !== null };
      } catch (error) {
        updateContextState(eventId, (state) => ({
          ...state,
          isLoading: false,
          error: 'Failed to load context.',
        }));
        throw error;
      }
    },
    [runId, updateContextState],
  );

  useEffect(() => {
    if (!runId) return;
    if (!selectedEventId) return;
    const selectedEvent =
      allEvents.find((event) => event.id === selectedEventId) ??
      eventsQueryData?.items?.find((event) => event.id === selectedEventId);
    if (!selectedEvent || selectedEvent.type !== 'llm_call') return;
    const state = contextStateRef.current.get(selectedEvent.id);
    if (state?.hasFetched || state?.isLoading) return;
    void loadContextPage(selectedEvent.id, null);
  }, [allEvents, runId, selectedEventId, loadContextPage, eventsQueryData]);

  useEffect(() => {
    if (!events.length) return;
    const latest = events[events.length - 1];
    if (!latest) return;
    if (!selectedEventId) {
      updateSearchParams((params) => {
        params.set('eventId', latest.id);
      });
      return;
    }
    if (!followRef.current) return;
    if (latest.id !== selectedEventId) {
      updateSearchParams((params) => {
        params.set('eventId', latest.id);
      });
      announce('Selected latest event');
    }
  }, [events, selectedEventId, updateSearchParams, announce, followRef]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (!eventsQueryData) return;
    if (events.length === 0) {
      if ((eventsQueryData.items ?? []).length > 0) return;
    }
    const exists = events.some((event) => event.id === selectedEventId);
    if (!exists) {
      updateSearchParams((params) => {
        params.delete('eventId');
      });
    }
  }, [events, selectedEventId, updateSearchParams, eventsQueryData]);

  const selectEvent = useCallback(
    (eventId: string) => {
      updateSearchParams((params) => {
        params.set('eventId', eventId);
      });
    },
    [updateSearchParams],
  );

  const clearSelection = useCallback(() => {
    updateSearchParams((params) => {
      params.delete('eventId');
    });
  }, [updateSearchParams]);

  const manualSelect = useCallback(
    (eventId: string) => {
      if (followRef.current) {
        setFollowing(false, { announceMessage: 'Follow disabled' });
        updateSearchParams((params) => {
          params.set('eventId', eventId);
        });
        return;
      }
      selectEvent(eventId);
    },
    [selectEvent, updateSearchParams, setFollowing, followRef],
  );

  const ensureSelectionVisible = useCallback(
    (nextTypes: RunEventType[], nextStatuses: RunEventStatus[]) => {
      if (followRef.current) return;
      if (!selectedEventId) return;
      const stillVisible = events.some((event) => event.id === selectedEventId && matchesFilters(event, nextTypes, nextStatuses));
      if (!stillVisible) {
        clearSelection();
      }
    },
    [clearSelection, events, selectedEventId, followRef],
  );

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      manualSelect(eventId);
    },
    [manualSelect],
  );

  const handleFollowingChange = useCallback(
    (value: boolean) => {
      setFollowing(value, { announceMessage: value ? 'Follow enabled' : 'Follow disabled' });
    },
    [setFollowing],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key?.toLowerCase() !== 'f') return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      toggleFollowing();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFollowing]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      if (events.length === 0) return;

      const currentIndex = selectedEventId ? events.findIndex((item) => item.id === selectedEventId) : -1;
      let nextIndex = currentIndex;

      if (event.key === 'ArrowDown') {
        nextIndex = currentIndex < 0 ? 0 : Math.min(events.length - 1, currentIndex + 1);
      } else {
        nextIndex = currentIndex < 0 ? events.length - 1 : Math.max(0, currentIndex - 1);
      }

      if (nextIndex === currentIndex || nextIndex < 0 || nextIndex >= events.length) return;

      event.preventDefault();
      manualSelect(events[nextIndex].id);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [events, selectedEventId, manualSelect]);

  const handleEventFiltersChange = useCallback(
    (filters: EventFilter[]) => {
      const sanitized = sanitizeEventFilters(filters);
      setEventFilters(sanitized);
      const nextTypes = sanitized.length === EVENT_FILTER_OPTIONS.length ? API_EVENT_TYPES : Array.from(new Set(sanitized.flatMap((filter) => EVENT_FILTER_TO_TYPES[filter])));
      ensureSelectionVisible(nextTypes, selectedStatuses);
    },
    [ensureSelectionVisible, selectedStatuses],
  );

  const handleStatusFiltersChange = useCallback(
    (filters: StatusFilter[]) => {
      const sanitized = sanitizeStatusFilters(filters);
      setStatusFilters(sanitized);
      if (sanitized.length === 0) {
        ensureSelectionVisible(selectedTypes, API_EVENT_STATUSES);
        return;
      }
      const statuses = Array.from(new Set(sanitized.flatMap((filter) => STATUS_FILTER_TO_STATUSES[filter])));
      ensureSelectionVisible(selectedTypes, statuses.length === API_EVENT_STATUSES.length ? API_EVENT_STATUSES : statuses);
    },
    [ensureSelectionVisible, selectedTypes],
  );

  const handleTerminate = useCallback(async () => {
    if (!runId || isTerminating) return;
    if (!window.confirm('Terminate this run?')) {
      return;
    }
    setIsTerminating(true);
    try {
      await runs.terminate(runId);
      notifySuccess('Termination signaled');
      await summaryQuery.refetch();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Failed to terminate run';
      notifyError(message);
    } finally {
      setIsTerminating(false);
    }
  }, [runId, isTerminating, summaryQuery]);

  const handleLoadOlderContext = useCallback(
    async (eventId: string) => {
      const state = contextStateRef.current.get(eventId);
      if (state?.isLoading) return { addedCount: 0, hasMore: state.nextCursor !== null };
      if (!state || !state.hasFetched) {
        return await loadContextPage(eventId, null);
      }
      if (!state.nextCursor) return { addedCount: 0, hasMore: false };
      return await loadContextPage(eventId, state.nextCursor);
    },
    [loadContextPage],
  );

  const runSummary = summaryQuery.data;
  const runStatus = mapRunStatus(runSummary?.status);
  const runDuration = useRunDuration(runSummary?.createdAt, runSummary?.status, runSummary?.lastEventAt ?? runSummary?.updatedAt);
  const filteredEventCount = totalsQuery.data?.totals.eventCount;
  const tokenUsageTotals = totalsQuery.data?.totals.tokenUsage ?? null;

  const statistics = useMemo(() => {
    const summary = runSummary;
    const resolvedTotal = typeof filteredEventCount === 'number' ? filteredEventCount : summary?.totalEvents ?? 0;
    if (!summary) {
      return {
        totalEvents: resolvedTotal,
        messages: 0,
        llm: 0,
        tools: 0,
        summaries: 0,
      };
    }
    const counts = summary.countsByType ?? {};
    return {
      totalEvents: resolvedTotal,
      messages: (counts.invocation_message ?? 0) + (counts.injection ?? 0),
      llm: counts.llm_call ?? 0,
      tools: counts.tool_execution ?? 0,
      summaries: counts.summarization ?? 0,
    };
  }, [filteredEventCount, runSummary]);

  const selectedContextState = useMemo(() => {
    const currentVersion = contextStateVersion;
    if (currentVersion < 0) return undefined;
    if (!selectedEventId) return undefined;
    const state = contextStateRef.current.get(selectedEventId);
    if (!state) return undefined;
    return {
      hasMore: state.nextCursor !== null,
      isLoading: state.isLoading,
      error: state.error,
    };
  }, [selectedEventId, contextStateVersion]);

  const uiEvents = useMemo<UiRunEvent[]>(() => {
    const contextStates = contextStateRef.current;
    const resolvedEvents = contextStateVersion >= 0 ? events : [];
    return resolvedEvents.map((event) => {
      const contextState = event.type === 'llm_call' ? contextStates.get(event.id) : undefined;
      const contextRecords = contextState?.hasFetched ? buildContextRecords(contextState.items) : undefined;
      const toolLinks = event.type === 'tool_execution' ? buildToolLinkData(event) : undefined;
      return createUiEvent(event, { context: contextRecords, assistant: [], tool: toolLinks });
    });
  }, [events, contextStateVersion]);

  const isLoading = eventsLoading || summaryQuery.isLoading;
  const hasMoreEvents = Boolean(nextCursor);
  const isEmpty = allEvents.length === 0 && !isLoading;

  const primaryError =
    (eventsError as Error | undefined) ??
    (summaryQuery.error as Error | undefined) ??
    (totalsQuery.error as Error | undefined);
  const errorMessage = primaryError?.message ?? loadOlderError ?? undefined;

  const tokens = tokenUsageTotals ?? { ...EMPTY_TOKENS };

  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">
        {liveMessage}
      </div>
      <RunScreen
        runId={runId ?? ''}
        status={runStatus}
        createdAt={runSummary?.createdAt ?? ''}
        duration={runDuration}
        statistics={statistics}
        tokens={tokens}
        events={uiEvents}
        selectedEventId={selectedEventId ?? null}
        contextPagination={selectedContextState}
        onLoadOlderContext={handleLoadOlderContext}
        isFollowing={isFollowing}
        eventFilters={eventFilters}
        statusFilters={statusFilters}
        tokensPopoverOpen={tokensPopoverOpen}
        runsPopoverOpen={runsPopoverOpen}
        hasMoreEvents={hasMoreEvents}
        isLoadingMoreEvents={loadingOlder}
        isLoading={isLoading}
        isEmpty={isEmpty}
        error={errorMessage}
        onSelectEvent={handleSelectEvent}
        onFollowingChange={handleFollowingChange}
        onEventFiltersChange={handleEventFiltersChange}
        onStatusFiltersChange={handleStatusFiltersChange}
        onTokensPopoverOpenChange={setTokensPopoverOpen}
        onRunsPopoverOpenChange={setRunsPopoverOpen}
        onLoadMoreEvents={hasMoreEvents ? loadOlderEvents : undefined}
        onTerminate={runStatus === 'running' && !isTerminating ? handleTerminate : undefined}
      />
    </>
  );
}

type AgentsRunScreenComponent = typeof AgentsRunScreen & {
  __testing__?: {
    extractLlmResponse: typeof extractLlmResponse;
  };
};

(AgentsRunScreen as AgentsRunScreenComponent).__testing__ = {
  extractLlmResponse,
};
