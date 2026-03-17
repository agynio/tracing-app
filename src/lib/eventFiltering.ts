import type { RunEventStatus, RunEventType, RunTimelineEvent } from '@/api/types/agents';

export function matchesFilters(event: RunTimelineEvent, types: RunEventType[], statuses: RunEventStatus[]): boolean {
  const includeType = types.length === 0 || types.includes(event.type);
  const includeStatus = statuses.length === 0 || statuses.includes(event.status);
  return includeType && includeStatus;
}
