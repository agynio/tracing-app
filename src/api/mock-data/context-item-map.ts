import type { ContextItem } from '@/api/types/agents';
import { DEFAULT_RUN_ID, getMockRun } from './store';

export const mockContextItemMap: Map<string, ContextItem> = getMockRun(DEFAULT_RUN_ID).contextItemMap;
