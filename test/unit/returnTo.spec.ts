import { describe, expect, it } from 'vitest';
import {
  buildReturnTo,
  getReturnToFromError,
  getSigninRedirectArgs,
  resolveReturnTo,
  type ReturnToLocation,
} from '../../src/auth/return-to';

const baseLocation: ReturnToLocation = {
  origin: 'https://app.test',
  pathname: '/message/abc',
  search: '?orgId=org-1',
  hash: '#detail',
};

describe('return-to helpers', () => {
  it('builds return-to from the current location', () => {
    expect(buildReturnTo(baseLocation)).toBe('/message/abc?orgId=org-1#detail');
  });

  it('falls back to root for disallowed paths', () => {
    expect(buildReturnTo({ ...baseLocation, pathname: '/callback', search: '', hash: '' })).toBe('/');
  });

  it('resolves return-to from signin state', () => {
    expect(resolveReturnTo({ returnTo: '/runs/123?orgId=org-2' }, baseLocation.origin)).toBe('/runs/123?orgId=org-2');
  });

  it('rejects unsafe return-to values', () => {
    expect(resolveReturnTo({ returnTo: 'https://evil.test/steal' }, baseLocation.origin)).toBe('/');
  });

  it('rejects normalized protocol-relative paths', () => {
    expect(resolveReturnTo({ returnTo: '/.//evil.com' }, baseLocation.origin)).toBe('/');
  });

  it('extracts return-to from auth errors', () => {
    const error = { innerError: { state: { returnTo: '/message/xyz?orgId=org-9' } } };
    expect(getReturnToFromError(error, baseLocation.origin)).toBe('/message/xyz?orgId=org-9');
  });

  it('uses overrides when building redirect args', () => {
    const args = getSigninRedirectArgs({ returnTo: '/runs/override', location: baseLocation });
    expect(args.state).toEqual({ returnTo: '/runs/override' });
  });
});
