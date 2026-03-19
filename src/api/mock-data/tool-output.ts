import type { ToolOutputChunk, ToolOutputSnapshot } from '@/api/types/agents';
import { DEFAULT_EVENT_IDS, DEFAULT_RUN_ID, getMockRun } from './store';

const defaultRun = getMockRun(DEFAULT_RUN_ID);
const snapshot = defaultRun.toolOutputs.get(DEFAULT_EVENT_IDS.tool);

export const mockToolOutputSnapshot: ToolOutputSnapshot = snapshot ?? { items: [], terminal: null, nextSeq: null };
export const mockToolOutputChunks: ToolOutputChunk[] = mockToolOutputSnapshot.items ?? [];
