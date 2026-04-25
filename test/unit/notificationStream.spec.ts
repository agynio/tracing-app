import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { notificationStream as NotificationStreamInstance } from '../../src/lib/graph/socket';

const { subscribeMock } = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  notificationsClient: {
    subscribe: subscribeMock,
  },
}));

const emptyStream = async function* emptyStream() {};

describe('notification stream', () => {
  let notificationStream: NotificationStreamInstance;

  beforeEach(async () => {
    subscribeMock.mockReturnValue(emptyStream());
    ({ notificationStream } = await import('../../src/lib/graph/socket'));
  });

  afterEach(() => {
    notificationStream.disconnect();
    subscribeMock.mockReset();
  });

  it('subscribes with trace room', async () => {
    notificationStream.connect('trace-123');
    await Promise.resolve();

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    const [request, options] = subscribeMock.mock.calls[0];
    expect(request).toEqual({ rooms: ['trace:trace-123'] });
    expect(options).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
