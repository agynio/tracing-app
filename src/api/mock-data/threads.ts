import { DEFAULT_THREAD_ID } from './store.ts';

export type MockThread = { id: string };

export const mockThreads: MockThread[] = [{ id: DEFAULT_THREAD_ID }];
