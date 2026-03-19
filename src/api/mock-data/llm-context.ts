import type { LlmContextPageItem } from '@/api/types/agents';
import { DEFAULT_RUN_ID, getMockRun } from './store';

const defaultRun = getMockRun(DEFAULT_RUN_ID);

export const mockLlmContextItems: LlmContextPageItem[] = defaultRun.contextItems;
