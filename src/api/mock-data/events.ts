import type { RunTimelineEvent } from '@/api/types/agents';
import { DEFAULT_EVENT_IDS, DEFAULT_RUN_ID, getMockRun } from './store';

const defaultRun = getMockRun(DEFAULT_RUN_ID);

export const mockRunEvents: RunTimelineEvent[] = defaultRun.events;
export const mockEventIds = DEFAULT_EVENT_IDS;
