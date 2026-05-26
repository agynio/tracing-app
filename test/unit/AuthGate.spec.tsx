// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authState, signinRedirectMock } = vi.hoisted(() => ({
  authState: {
    isAuthenticated: false,
    isLoading: false,
    activeNavigator: undefined as string | undefined,
    error: undefined as Error | undefined,
  },
  signinRedirectMock: vi.fn(),
}));

vi.mock('react-oidc-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    ...authState,
    removeUser: vi.fn(),
    signinRedirect: signinRedirectMock,
  }),
}));

vi.mock('@/config', () => ({
  oidcConfig: {
    enabled: true,
    authority: 'https://auth.test',
    clientId: 'tracing-app',
    scope: 'openid profile',
  },
}));

vi.mock('@/auth/user-manager', () => ({
  userManager: {},
}));

describe('AuthGate', () => {
  afterEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.activeNavigator = undefined;
    authState.error = undefined;
    signinRedirectMock.mockReset();
    window.history.replaceState({}, '', '/');
    window.sessionStorage.clear();
  });

  it('blocks route rendering while signin redirect is pending', async () => {
    const { AuthGate } = await import('../../src/auth/AuthGate');

    render(
      <AuthGate>
        <div>Protected route</div>
      </AuthGate>,
    );

    await waitFor(() => expect(signinRedirectMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Loading tracing...')).not.toBeNull();
    expect(screen.queryByText('Protected route')).toBeNull();
  });

  it('renders protected routes only after authentication', async () => {
    const { AuthGate } = await import('../../src/auth/AuthGate');
    authState.isAuthenticated = true;

    render(
      <AuthGate>
        <div>Protected route</div>
      </AuthGate>,
    );

    expect(screen.getByText('Protected route')).not.toBeNull();
    expect(signinRedirectMock).not.toHaveBeenCalled();
  });
});
