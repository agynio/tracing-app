import type { SigninRedirectArgs } from 'oidc-client-ts';

export type ReturnToLocation = Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>;

const DEFAULT_RETURN_TO = '/';
const DISALLOWED_RETURN_TO_PATHS = new Set(['/callback', '/silent-renew']);

function normalizeReturnTo(value: string, origin: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;

  let url: URL;
  try {
    url = new URL(trimmed, origin);
  } catch {
    return null;
  }

  if (url.origin !== origin) return null;
  if (DISALLOWED_RETURN_TO_PATHS.has(url.pathname)) return null;

  const normalized = `${url.pathname}${url.search}${url.hash}`;
  return normalized.length > 0 ? normalized : null;
}

function readReturnToFromState(state: unknown, origin: string): string | null {
  if (!state || typeof state !== 'object') return null;
  if (!('returnTo' in state)) return null;
  const candidate = (state as { returnTo?: unknown }).returnTo;
  if (typeof candidate !== 'string') return null;
  return normalizeReturnTo(candidate, origin);
}

function readReturnToFromError(error: unknown, origin: string): string | null {
  if (!error || typeof error !== 'object') return null;
  const directState = (error as { state?: unknown }).state;
  const direct = readReturnToFromState(directState, origin);
  if (direct) return direct;
  const innerError = (error as { innerError?: unknown }).innerError;
  if (!innerError || typeof innerError !== 'object') return null;
  const innerState = (innerError as { state?: unknown }).state;
  return readReturnToFromState(innerState, origin);
}

export function buildReturnTo(location: ReturnToLocation = window.location): string {
  const candidate = `${location.pathname}${location.search}${location.hash}`;
  return normalizeReturnTo(candidate, location.origin) ?? DEFAULT_RETURN_TO;
}

export function resolveReturnTo(state: unknown, origin: string = window.location.origin): string {
  return readReturnToFromState(state, origin) ?? DEFAULT_RETURN_TO;
}

export function getReturnToFromError(error: unknown, origin: string = window.location.origin): string | null {
  return readReturnToFromError(error, origin);
}

export function getSigninRedirectArgs(
  options: { returnTo?: string | null; location?: ReturnToLocation } = {},
): SigninRedirectArgs {
  const location = options.location ?? window.location;
  const origin = location.origin;
  const override = typeof options.returnTo === 'string' ? normalizeReturnTo(options.returnTo, origin) : null;
  const returnTo = override ?? buildReturnTo(location);
  return { state: { returnTo } };
}
