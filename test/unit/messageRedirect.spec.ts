import { describe, expect, it } from 'vitest';
import {
  MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS,
  MESSAGE_RUN_LOOKUP_TIMEOUT_MS,
  messageRunLookupTimedOut,
  messageRunRedirectRefetchInterval,
} from '../../src/pages/utils/messageRedirectPolling';

describe('message redirect polling', () => {
  it('polls until the run id is resolved within the lookup window', () => {
    expect(messageRunRedirectRefetchInterval(undefined, 1_000, 1_000)).toBe(MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS);
    expect(messageRunRedirectRefetchInterval(null, 1_000, 1_000 + MESSAGE_RUN_LOOKUP_TIMEOUT_MS - 1)).toBe(
      MESSAGE_RUN_LOOKUP_REFETCH_INTERVAL_MS,
    );
  });

  it('stops polling after the run id is resolved', () => {
    expect(messageRunRedirectRefetchInterval({ runId: 'abc123' }, 1_000, 1_000)).toBe(false);
  });

  it('stops polling after the bounded lookup window expires', () => {
    expect(messageRunLookupTimedOut(1_000, 1_000 + MESSAGE_RUN_LOOKUP_TIMEOUT_MS)).toBe(true);
    expect(messageRunRedirectRefetchInterval(null, 1_000, 1_000 + MESSAGE_RUN_LOOKUP_TIMEOUT_MS)).toBe(false);
  });
});
