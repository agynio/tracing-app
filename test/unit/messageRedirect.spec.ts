import { describe, expect, it } from 'vitest';
import { messageRunRedirectRefetchInterval } from '../../src/pages/utils/messageRedirectPolling';

describe('messageRunRedirectRefetchInterval', () => {
  it('polls until the run id is resolved', () => {
    expect(messageRunRedirectRefetchInterval(undefined)).toBe(1000);
    expect(messageRunRedirectRefetchInterval(null)).toBe(1000);
  });

  it('stops polling after the run id is resolved', () => {
    expect(messageRunRedirectRefetchInterval({ runId: 'abc123' })).toBe(false);
  });
});
