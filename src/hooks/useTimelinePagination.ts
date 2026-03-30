import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tracingClient } from '@/api/client';
import { useRunTimelineEvents } from '@/api/hooks/runs';
import { runs } from '@/api/modules/runs';
import { flattenResourceSpans, hexToBytes, spanToEvent } from '@/api/spanToEvent';
import type {
  RunEventStatus,
  RunEventType,
  RunTimelineEvent,
  RunTimelineEventsCursor,
  RunTimelineEventsResponse,
} from '@/api/types/agents';
import { matchesFilters } from '@/lib/eventFiltering';
import { notificationStream } from '@/lib/graph/socket';

type UseTimelinePaginationOptions = {
  runId: string | undefined;
  apiTypes: RunEventType[];
  apiStatuses: RunEventStatus[];
  selectedTypes: RunEventType[];
  selectedStatuses: RunEventStatus[];
  onRunEvent?: (event: RunTimelineEvent) => void;
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
  onReconnect,
}: UseTimelinePaginationOptions): UseTimelinePaginationResult {
  const [allEvents, setAllEvents] = useState<RunTimelineEvent[]>([]);
  const [events, setEvents] = useState<RunTimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<RunTimelineEventsCursor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadOlderError, setLoadOlderError] = useState<string | null>(null);

  const olderCursorRef = useRef<RunTimelineEventsCursor | null>(null);
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
  const refetchEvents = eventsQuery.refetch;

  useEffect(() => {
    apiTypesRef.current = apiTypes;
  }, [apiTypes]);

  useEffect(() => {
    apiStatusesRef.current = apiStatuses;
  }, [apiStatuses]);

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
      return;
    }

    if (previousRunId !== runId) {
      replaceEventsRef.current = true;
      reachedHistoryEndRef.current = false;
      setLoadOlderError(null);
      setLoadingOlder(false);
      loadingOlderRef.current = false;
      setAllEvents([]);
      setEvents([]);
      updateOlderCursor(null);
      return;
    }

    if (previousFilterKey !== currentFilterKey) {
      reachedHistoryEndRef.current = false;
      setLoadOlderError(null);
      setLoadingOlder(false);
      loadingOlderRef.current = false;
      updateOlderCursor(null);
    }
  }, [runId, apiTypes, apiStatuses, updateOlderCursor]);

  useEffect(() => {
    if (!eventsQuery.data) return;
    const incoming = eventsQuery.data.items ?? [];
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
  }, [eventsQuery.data, updateEventsState, updateOlderCursor]);

  const loadOlderEvents = useCallback(async () => {
    if (!runId) return;
    const cursor = olderCursorRef.current;
    if (!cursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setLoadOlderError(null);
    const currentApiTypes = apiTypesRef.current;
    const currentApiStatuses = apiStatusesRef.current;

    try {
      const response = await runs.timelineEvents(runId, {
        types: currentApiTypes.length > 0 ? currentApiTypes.join(',') : undefined,
        statuses: currentApiStatuses.length > 0 ? currentApiStatuses.join(',') : undefined,
        limit: 100,
        order: 'desc',
        cursorTs: cursor.ts,
        cursorId: cursor.id,
      });
      if (isNonAdvancingPage(response, cursor)) {
        reachedHistoryEndRef.current = true;
        updateOlderCursor(null);
        return;
      }
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
    notificationStream.connect(runId);
    const offEvent = notificationStream.onSpanEvent((traceId, spanId) => {
      if (traceId !== runId) return;
      void (async () => {
        const response = await tracingClient.getSpan({
          traceId: hexToBytes(traceId),
          spanId: hexToBytes(spanId),
        });
        const spans = flattenResourceSpans(response.resourceSpans);
        if (spans.length === 0) return;
        const event = spanToEvent(spans[0].span, spans[0].resourceAttrs);
        updateEventsState([event]);
        if (onRunEvent) onRunEvent(event);
      })().catch(() => {
        void refetchEvents();
      });
    });
    const offReconnect = notificationStream.onReconnect(() => {
      void refetchEvents();
      if (onReconnect) onReconnect();
    });
    return () => {
      offEvent();
      offReconnect();
      notificationStream.disconnect();
    };
  }, [runId, updateEventsState, refetchEvents, onRunEvent, onReconnect]);

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
