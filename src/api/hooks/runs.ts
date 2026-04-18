import { useQuery } from '@tanstack/react-query';
import { runs } from '@/api/modules/runs';
import type { RunTimelineEventsCursor } from '@/api/types/agents';

export function useRunTimelineSummary(organizationId: string | undefined, runId: string | undefined) {
  return useQuery({
    enabled: !!runId,
    queryKey: ['agents', 'runs', organizationId ?? '', runId, 'timeline', 'summary'],
    queryFn: () => runs.timelineSummary(runId as string),
    refetchOnWindowFocus: false,
  });
}

export function useRunTimelineEvents(
  organizationId: string | undefined,
  runId: string | undefined,
  filters: { types: string[]; statuses: string[]; limit?: number; order?: 'asc' | 'desc'; cursor?: RunTimelineEventsCursor | null },
) {
  return useQuery({
    enabled: !!runId && !!organizationId,
    queryKey: ['agents', 'runs', organizationId ?? '', runId, 'timeline', 'events', filters],
    queryFn: () =>
      runs.timelineEvents(organizationId as string, runId as string, {
        types: filters.types.length > 0 ? filters.types.join(',') : undefined,
        statuses: filters.statuses.length > 0 ? filters.statuses.join(',') : undefined,
        limit: filters.limit,
        order: filters.order,
        cursorTs: filters.cursor?.ts,
        cursorId: filters.cursor?.id,
      }),
    refetchOnWindowFocus: false,
  });
}

export function useRunTimelineEventTotals(
  organizationId: string | undefined,
  runId: string | undefined,
  filters: { types: string[]; statuses: string[] },
) {
  return useQuery({
    enabled: !!runId,
    queryKey: ['agents', 'runs', organizationId ?? '', runId, 'timeline', 'events', 'totals', filters],
    queryFn: () =>
      runs.timelineEventTotals(runId as string, {
        types: filters.types.length > 0 ? filters.types.join(',') : undefined,
        statuses: filters.statuses.length > 0 ? filters.statuses.join(',') : undefined,
      }),
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useOrganizationRuns(organizationId: string | undefined, options?: { limit?: number }) {
  return useQuery({
    enabled: !!organizationId,
    queryKey: ['organizations', organizationId ?? '', 'runs', options?.limit ?? 50],
    queryFn: () => runs.listOrganizationRuns(organizationId as string, { limit: options?.limit }),
    refetchOnWindowFocus: false,
  });
}
