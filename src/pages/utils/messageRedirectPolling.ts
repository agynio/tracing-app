export const MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS = 1000;
export const MESSAGE_RUN_LOOKUP_TIMEOUT_MS = 30_000;

export type MessageRunLookup = { runId: string } | null | undefined;

export function messageRunLookupTimedOut(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs >= MESSAGE_RUN_LOOKUP_TIMEOUT_MS;
}

export function messageRunRedirectRefetchInterval(
  data: MessageRunLookup,
  startedAtMs: number,
  nowMs: number,
): false | typeof MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS {
  if (data?.runId) return false;
  return messageRunLookupTimedOut(startedAtMs, nowMs) ? false : MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS;
}
