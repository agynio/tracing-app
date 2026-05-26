// @vitest-environment happy-dom

import { Code, ConnectError, createContextValues } from '@connectrpc/connect';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getAccessTokenMock, signinSilentMock } = vi.hoisted(() => ({
  getAccessTokenMock: vi.fn(),
  signinSilentMock: vi.fn(),
}));

vi.mock('@/auth/user-manager', () => ({
  getAccessToken: getAccessTokenMock,
  userManager: {
    signinSilent: signinSilentMock,
  },
}));

function createRequest() {
  return {
    header: new Headers(),
    contextValues: createContextValues(),
  };
}

describe('authInterceptor', () => {
  afterEach(() => {
    getAccessTokenMock.mockReset();
    signinSilentMock.mockReset();
  });

  it('does not attempt silent renew when the request had no token', async () => {
    const { authInterceptor } = await import('../../src/auth/auth-interceptor');
    const unauthenticatedError = new ConnectError('missing auth', Code.Unauthenticated);
    const next = vi.fn().mockRejectedValue(unauthenticatedError);
    const req = createRequest();

    getAccessTokenMock.mockResolvedValue(null);

    await expect(authInterceptor(next)(req)).rejects.toBe(unauthenticatedError);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.header.has('Authorization')).toBe(false);
    expect(signinSilentMock).not.toHaveBeenCalled();
  });

  it('silently renews and retries when the original token was rejected', async () => {
    const { authInterceptor } = await import('../../src/auth/auth-interceptor');
    const next = vi
      .fn()
      .mockRejectedValueOnce(new ConnectError('expired auth', Code.Unauthenticated))
      .mockResolvedValueOnce('ok');
    const req = createRequest();

    getAccessTokenMock.mockResolvedValueOnce('expired-token').mockResolvedValueOnce('fresh-token');
    signinSilentMock.mockResolvedValue(undefined);

    await expect(authInterceptor(next)(req)).resolves.toBe('ok');

    expect(signinSilentMock).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
    expect(req.header.get('Authorization')).toBe('Bearer fresh-token');
  });
});
