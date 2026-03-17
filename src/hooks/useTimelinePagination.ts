import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRunTimelineEvents } from '@/api/hooks/runs';
import { runs } from '@/api/modules/runs';
import type {
  RunEventStatus,
  RunEventType,
  RunTimelineEvent,
  RunTimelineEventsCursor,
  RunTimelineEventsResponse,
} from '@/api/types/agents';
import { matchesFilters } from '@/lib/eventFiltering';
import { graphSocket } from '@/lib/graph/socket';

type UseTimelinePaginationOptions = {
  runId: string | undefined;
  apiTypes: RunEventType[];
  apiStatuses: RunEventStatus[];
  selectedTypes: RunEventType[];
  selectedStatuses: RunEventStatus[];
  onRunEvent?: (event: RunTimelineEvent) => void;
  onRunStatusChange?: () => void;
  onReconnect?: () => void;
};

type UseTimelinePaginationResult = {
  allEvents: RunTimelineEvent[];
  events: RunTimelineEvent[];
  nextCursor: RunTimelineEventsCursor | null;
  loadingOlder: boolean;
  loadOlderError: string | null;
  loadOlderEvents: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  queryData: RunTimelineEventsResponse | undefined;
};

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareEvents(a: RunTimelineEvent, b: RunTimelineEvent): number {
  const timeDiff = parseTimestamp(a.ts) - parseTimestamp(b.ts);
  if (timeDiff !== 0) return timeDiff;
  const lexical = a.ts.localeCompare(b.ts);
  if (lexical !== 0) return lexical;
  return a.id.localeCompare(b.id);
}

function sortEvents(events: RunTimelineEvent[]): RunTimelineEvent[] {
  if (events.length <= 1) return events.slice();
  return [...events].sort(compareEvents);
}

function areEventListsEqual(a: RunTimelineEvent[], b: RunTimelineEvent[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function buildCursorAttemptModes(preferred: 'both' | 'plain' | 'bracketed'): Array<'both' | 'plain' | 'bracketed'> {
  if (preferred === 'both') return ['both', 'plain'];
  const fallback = preferred === 'plain' ? 'bracketed' : 'plain';
  return [preferred, fallback];
}

function compareCursors(a: RunTimelineEventsCursor, b: RunTimelineEventsCursor): number {
  const timeDiff = parseTimestamp(a.ts) - parseTimestamp(b.ts);
  if (timeDiff !== 0) return timeDiff;
  const lexical = a.ts.localeCompare(b.ts);
  if (lexical !== 0) return lexical;
  return a.id.localeCompare(b.id);
}

function isNonAdvancingPage(response: RunTimelineEventsResponse, cursor: RunTimelineEventsCursor): boolean {
  const items = response.items ?? [];
  const lastMatches = items.length > 0 && compareCursors(toCursor(items[items.length - 1]), cursor) === 0;
  const nextMatches = response.nextCursor ? compareCursors(response.nextCursor, cursor) === 0 : false;
  return lastMatches || nextMatches;
}

function toCursor(event: RunTimelineEvent): RunTimelineEventsCursor {
  return { ts: event.ts, id: event.id };
}

export function useTimelinePagination({
  runId,
  apiTypes,
  apiStatuses,
  selectedTypes,
  selectedStatuses,
  onRunEvent,
  onRunStatusChange,
  onReconnect,
}: UseTimelinePaginationOptions): UseTimelinePaginationResult {
  const [allEvents, setAllEvents] = useState<RunTimelineEvent[]>([]);
  const [events, setEvents] = useState<RunTimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<RunTimelineEventsCursor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadOlderError, setLoadOlderError] = useState<string | null>(null);

  const cursorRef = useRef<RunTimelineEventsCursor | null>(null);
  const catchUpRef = useRef<Promise<unknown> | null>(null);
  const olderCursorRef = useRef<RunTimelineEventsCursor | null>(null);
  const loadOlderCursorParamModeRef = useRef<'both' | 'plain' | 'bracketed'>('both');
  const catchUpCursorParamModeRef = useRef<'both' | 'plain' | 'bracketed'>('both');
  const loadingOlderRef = useRef(false);
  const replaceEventsRef = useRef(false);
  const lastRunIdRef = useRef<string | undefined>(undefined);
  const lastFilterKeyRef = useRef<string>('');
  const reachedHistoryEndRef = useRef(false);
  const apiTypesRef = useRef(apiTypes);
  const apiStatusesRef = useRef(apiStatuses);

  const eventsQuery = useRunTimelineEvents(runId, {
    types: apiTypes,
    statuses: apiStatuses,
    limit: 100,
    order: 'desc',
  });

  useEffect(() => {
    apiTypesRef.current = apiTypes;
  }, [apiTypes]);

  useEffect(() => {
    apiStatusesRef.current = apiStatuses;
  }, [apiStatuses]);

  const updateCursor = useCallback(
    (cursor: RunTimelineEventsCursor | null, opts?: { force?: boolean }) => {
      if (!runId) return;
      if (!cursor) {
        cursorRef.current = null;
        graphSocket.setRunCursor(runId, null, { force: true });
        return;
      }
      const current = cursorRef.current;
      if (!current || opts?.force || compareCursors(cursor, current) > 0) {
        cursorRef.current = cursor;
        graphSocket.setRunCursor(runId, cursor, { force: opts?.force });
      }
    },
    [runId],
  );

  const updateEventsState = useCallback((incoming: RunTimelineEvent[]) => {
    if (incoming.length === 0) return;
    setAllEvents((prev) => {
      const map = new Map<string, RunTimelineEvent>();
      for (const event of prev) {
        map.set(event.id, event);
      }
      for (const event of incoming) {
        map.set(event.id, event);
      }
      return sortEvents(Array.from(map.values()));
    });
  }, []);

  const updateOlderCursor = useCallback(
    (
      update:
        | RunTimelineEventsCursor
        | null
        | ((prev: RunTimelineEventsCursor | null) => RunTimelineEventsCursor | null),
    ) => {
      const nextValue = typeof update === 'function'
        ? (update as (prev: RunTimelineEventsCursor | null) => RunTimelineEventsCursor | null)(olderCursorRef.current)
        : update;
      olderCursorRef.current = nextValue;
      setNextCursor(nextValue);
    },
    [],
  );

  useEffect(() => {
    setEvents((prev) => {
      const next = allEvents.filter((event) => matchesFilters(event, selectedTypes, selectedStatuses));
      if (areEventListsEqual(prev, next)) return prev;
      return next;
    });
  }, [allEvents, selectedTypes, selectedStatuses]);

  useEffect(() => {
    const currentFilterKey = JSON.stringify([apiTypes, apiStatuses]);
    const previousRunId = lastRunIdRef.current;
    const previousFilterKey = lastFilterKeyRef.current;

    lastRunIdRef.current = runId;
    lastFilterKeyRef.current = currentFilterKey;

    if (!runId) {
      setAllEvents([]);
      setEvents([]);
      cursorRef.current = null;
      return;
    }

    if (previousRunId !== runId) {
      replaceEventsRef.current = true;
      reachedHistoryEndRef.current = false;
      setLoadOlderError(null);
      setLoadingOlder(false);
      loadingOlderRef.current = false;
      catchUpRef.current = null;
      setAllEvents([]);
      setEvents([]);
      cursorRef.current = null;
      updateOlderCursor(null);
      updateCursor(null, { force: true });
      return;
    }

    if (previousFilterKey !== currentFilterKey) {
      reachedHistoryEndRef.current = false;
      setLoadOlderError(null);
      setLoadingOlder(false);
      loadingOlderRef.current = false;
      catchUpRef.current = null;
      updateCursor(null, { force: true });
      updateOlderCursor(null);
    }
  }, [runId, apiTypes, apiStatuses, updateCursor, updateOlderCursor]);

  useEffect(() => {
    if (!eventsQuery.data) return;
    const incoming = eventsQuery.data.items ?? [];
    const newestIncoming = incoming.length > 0
      ? incoming.reduce<RunTimelineEvent>((latest, event) => (compareEvents(event, latest) > 0 ? event : latest), incoming[0])
      : null;
    const queryCursor = eventsQuery.data.nextCursor ?? null;

    setLoadOlderError(null);
    if (replaceEventsRef.current) {
      setAllEvents([]);
      setEvents([]);
      replaceEventsRef.current = false;
    }
    if (incoming.length > 0) {
      updateEventsState(incoming);
    }
    if (newestIncoming) {
      updateCursor(toCursor(newestIncoming), { force: true });
    } else {
      updateCursor(null, { force: true });
    }
    if (!queryCursor) {
      reachedHistoryEndRef.current = true;
      updateOlderCursor(null);
    } else if (!reachedHistoryEndRef.current) {
      reachedHistoryEndRef.current = false;
      updateOlderCursor((prev) => {
        if (!prev) return queryCursor;
        return compareCursors(queryCursor, prev) < 0 ? queryCursor : prev;
      });
    }
  }, [eventsQuery.data, updateEventsState, updateCursor, updateOlderCursor]);

  const fetchSinceCursor = useCallback(() => {
    if (!runId) return Promise.resolve();
    if (catchUpRef.current) return catchUpRef.current;

    const cursor = graphSocket.getRunCursor(runId) ?? cursorRef.current;
    if (!cursor) {
      const fallback = eventsQuery.refetch();
      catchUpRef.current = fallback.finally(() => {
        catchUpRef.current = null;
      });
      return catchUpRef.current;
    }

    const promise = (async () => {
      try {
        const currentApiTypes = apiTypesRef.current;
        const currentApiStatuses = apiStatusesRef.current;
        const attemptModes = buildCursorAttemptModes(catchUpCursorParamModeRef.current);

        let response: RunTimelineEventsResponse | null = null;
        let successfulMode: 'both' | 'plain' | 'bracketed' | null = null;

        for (let i = 0; i < attemptModes.length; i += 1) {
          const mode = attemptModes[i];
          const candidate = await runs.timelineEvents(runId, {
            types: currentApiTypes.length > 0 ? currentApiTypes.join(',') : undefined,
            statuses: currentApiStatuses.length > 0 ? currentApiStatuses.join(',') : undefined,
            cursorTs: cursor.ts,
            cursorId: cursor.id,
            cursorParamMode: mode,
          });
          if (!isNonAdvancingPage(candidate, cursor)) {
            response = candidate;
            successfulMode = mode;
            break;
          }
        }

        if (!response) {
          reachedHistoryEndRef.current = true;
          return;
        }

        catchUpCursorParamModeRef.current = successfulMode ?? catchUpCursorParamModeRef.current;

        const items = response.items ?? [];
        if (items.length > 0) {
          updateEventsState(items);
          const newest = items[items.length - 1];
          if (newest) updateCursor(toCursor(newest));
        }
      } catch {
        await eventsQuery.refetch();
      }
    })();

    catchUpRef.current = promise.finally(() => {
      catchUpRef.current = null;
    });
    return catchUpRef.current;
  }, [runId, eventsQuery, updateEventsState, updateCursor]);

  const loadOlderEvents = useCallback(async () => {
    if (!runId) return;
    const cursor = olderCursorRef.current;
    if (!cursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setLoadOlderError(null);
    const currentApiTypes = apiTypesRef.current;
    const currentApiStatuses = apiStatusesRef.current;
    const attemptModes = buildCursorAttemptModes(loadOlderCursorParamModeRef.current);

    try {
      let response: RunTimelineEventsResponse | null = null;
      let successfulMode: 'both' | 'plain' | 'bracketed' | null = null;

      for (let i = 0; i < attemptModes.length; i += 1) {
        const mode = attemptModes[i];
        const candidate = await runs.timelineEvents(runId, {
          types: currentApiTypes.length > 0 ? currentApiTypes.join(',') : undefined,
          statuses: currentApiStatuses.length > 0 ? currentApiStatuses.join(',') : undefined,
          limit: 100,
          order: 'desc',
          cursorTs: cursor.ts,
          cursorId: cursor.id,
          cursorParamMode: mode,
        });
        if (!isNonAdvancingPage(candidate, cursor)) {
          response = candidate;
          successfulMode = mode;
          break;
        }
      }

      if (!response) {
        reachedHistoryEndRef.current = true;
        updateOlderCursor(null);
        return;
      }

      loadOlderCursorParamModeRef.current = successfulMode ?? loadOlderCursorParamModeRef.current;

      const items = response.items ?? [];
      if (response.nextCursor) {
        reachedHistoryEndRef.current = false;
        updateOlderCursor(response.nextCursor);
      } else {
        reachedHistoryEndRef.current = true;
        updateOlderCursor(null);
      }
      if (items.length > 0) {
        updateEventsState(items);
      }
    } catch (error) {
      setLoadOlderError((error as Error)?.message ?? 'Failed to load older events');
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [runId, updateOlderCursor, updateEventsState]);

  useEffect(() => {
    if (!runId) return;
    const room = `run:${runId}`;
    graphSocket.subscribe([room]);
    const offEvent = graphSocket.onRunEvent(({ runId: incomingRunId, event }) => {
      if (incomingRunId !== runId) return;
      updateEventsState([event]);
      updateCursor(toCursor(event));
      if (onRunEvent) onRunEvent(event);
    });
    const offStatus = graphSocket.onRunStatusChanged(({ run }) => {
      if (run.id === runId && onRunStatusChange) {
        onRunStatusChange();
      }
    });
    const offReconnect = graphSocket.onReconnected(() => {
      void fetchSinceCursor();
      if (onReconnect) onReconnect();
    });
    return () => {
      offEvent();
      offStatus();
      offReconnect();
      graphSocket.unsubscribe([room]);
    };
  }, [runId, updateEventsState, updateCursor, fetchSinceCursor, onRunEvent, onRunStatusChange, onReconnect]);

  const error = useMemo(() => (eventsQuery.error as Error | null) ?? null, [eventsQuery.error]);

  return {
    allEvents,
    events,
    nextCursor,
    loadingOlder,
    loadOlderError,
    loadOlderEvents,
    isLoading: eventsQuery.isLoading,
    error,
    queryData: eventsQuery.data,
  };
}
