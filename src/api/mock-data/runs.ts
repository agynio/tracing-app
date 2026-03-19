import type { RunStatus } from '@/api/types/agents';
import { DEFAULT_RUN_ID, getMockRun } from './store.ts';

export type MockRun = {
  id: string;
  threadId: string;
  status: RunStatus;
  createdAt: string;
};

const defaultRun = getMockRun(DEFAULT_RUN_ID);

export const mockRun: MockRun = {
  id: defaultRun.runId,
  threadId: defaultRun.threadId,
  status: defaultRun.status,
  createdAt: defaultRun.createdAt,
};

export const mockRuns: MockRun[] = [mockRun];
