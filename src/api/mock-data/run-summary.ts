import type { RunTimelineSummary } from '@/api/types/agents';
import { DEFAULT_RUN_ID, buildSummary, getMockRun } from './store';

export const mockRunSummary: RunTimelineSummary = buildSummary(getMockRun(DEFAULT_RUN_ID));
