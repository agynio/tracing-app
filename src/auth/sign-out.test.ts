import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMetadata = vi.fn();
const setSignedOutFlag = vi.fn();

vi.mock('./user-manager', () => ({
  userManager: { metadataService: { getMetadata } },
}));
vi.mock('./signed-out', () => ({ setSignedOutFlag }));

const { signOut } = await import('./sign-out');

function buildAuth() {
  return { signoutRedirect: vi.fn().mockResolvedValue(undefined), removeUser: vi.fn().mockResolvedValue(undefined) };
}

describe('signOut', () => {
  beforeEach(() => {
    getMetadata.mockReset();
    setSignedOutFlag.mockReset();
  });

  it('redirects to the provider when it publishes an end session endpoint', async () => {
    getMetadata.mockResolvedValue({ end_session_endpoint: 'https://auth.agyn.dev:2496/logout' });
    const auth = buildAuth();

    await signOut(auth);

    expect(auth.signoutRedirect).toHaveBeenCalledOnce();
    expect(auth.removeUser).not.toHaveBeenCalled();
  });

  // Dex publishes none and holds no browser session, so dropping the tokens is
  // the whole sign-out. The flag is what renders the signed-out screen, since
  // nothing navigates away to bring the app back through a fresh load.
  it('signs out locally and raises the signed-out flag when the provider publishes none', async () => {
    getMetadata.mockResolvedValue({ issuer: 'https://dex.agyn.dev:2496' });
    const auth = buildAuth();

    await signOut(auth);

    expect(setSignedOutFlag).toHaveBeenCalledOnce();
    expect(auth.removeUser).toHaveBeenCalledOnce();
    expect(auth.signoutRedirect).not.toHaveBeenCalled();
  });

  it('signs out locally when discovery cannot be read', async () => {
    getMetadata.mockRejectedValue(new Error('network down'));
    const auth = buildAuth();

    await signOut(auth);

    expect(auth.removeUser).toHaveBeenCalledOnce();
    expect(auth.signoutRedirect).not.toHaveBeenCalled();
  });
});
