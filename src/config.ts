// Centralized environment configuration for tracing-app.
// Provides env-resolved values and throws if missing.

type ViteEnv = {
  VITE_API_BASE_URL?: string;
};

function requireEnv(name: keyof ViteEnv): string {
  const val = import.meta.env?.[name];
  if (typeof val === 'string' && val.trim()) return val;
  throw new Error(`tracing-app config: required env ${String(name)} is missing`);
}

function stripTrailingSlash(pathname: string): string {
  if (pathname === '/') return '';
  return pathname.replace(/\/+$/, '');
}

function stripTrailingApi(pathname: string): string {
  return pathname.replace(/\/api\/?$/, '/');
}

function resolveUrl(raw: string): URL {
  const trimmed = raw.trim();
  return new URL(trimmed, window.location.origin);
}

function deriveBase(raw: string, options: { stripApi: boolean }): string {
  const parsed = resolveUrl(raw);
  if (options.stripApi) parsed.pathname = stripTrailingApi(parsed.pathname);
  const cleanedPath = stripTrailingSlash(parsed.pathname);
  return cleanedPath ? `${parsed.origin}${cleanedPath}` : parsed.origin;
}

const rawApiBase = requireEnv('VITE_API_BASE_URL');

const apiBaseUrl = deriveBase(rawApiBase, { stripApi: true });
const socketBaseUrl = deriveBase(rawApiBase, { stripApi: true });
export const config = {
  apiBaseUrl,
  socketBaseUrl,
};

export function getSocketBaseUrl(): string {
  return socketBaseUrl;
}
