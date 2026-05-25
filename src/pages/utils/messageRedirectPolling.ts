export const MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS = 1_000;
export const MESSAGE_RUN_LOOKUP_EMPTY_STATE_MS = 20_000;
export const MESSAGE_RUN_LOOKUP_TIMEOUT_MS = 120_000;

export type MessageRunLookup = { runId: string } | null | undefined;

export function messageRunLookupTimedOut(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs >= MESSAGE_RUN_LOOKUP_TIMEOUT_MS;
}

export function messageRunLookupEmptyStateVisible(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs >= MESSAGE_RUN_LOOKUP_EMPTY_STATE_MS;
}

export function messageRunRedirectRefetchInterval(
  data: MessageRunLookup,
  startedAtMs: number,
  nowMs: number,
): false | typeof MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS {
  if (data?.runId) return false;
  return messageRunLookupTimedOut(startedAtMs, nowMs) ? false : MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS;
}
