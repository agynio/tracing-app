export type MessageRunLookup = { runId: string } | null | undefined;

export function messageRunRedirectRefetchInterval(data: MessageRunLookup): false | 1000 {
  return data?.runId ? false : 1000;
}
