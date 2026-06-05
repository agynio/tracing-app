// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    window.__ENV__ = {
      OIDC_AUTHORITY: 'https://auth.example.com/',
      OIDC_CLIENT_ID: 'tracing-client',
      OIDC_SCOPE: 'openid profile',
    };
    vi.resetModules();
  });

  it('defaults OIDC resource to null', async () => {
    const { oidcConfig } = await import('../../src/config');

    expect(oidcConfig.resource).toBeNull();
  });

  it('reads runtime OIDC resource', async () => {
    window.__ENV__ = {
      ...window.__ENV__,
      OIDC_RESOURCE: 'https://api.example.com',
    };

    const { oidcConfig } = await import('../../src/config');

    expect(oidcConfig.resource).toBe('https://api.example.com');
  });
});
