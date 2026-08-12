type RuntimeEnv = {
  API_BASE_URL?: string;
  CHAT_URL?: string;
  TRACING_URL?: string;
  CONSOLE_URL?: string;
  SANDBOXES_URL?: string;
  OIDC_AUTHORITY?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_SCOPE?: string;
  OIDC_RESOURCE?: string;
};

export type OidcConfig = {
  enabled: boolean;
  authority: string;
  clientId: string;
  scope: string;
  resource: string | null;
};

const runtimeEnv: RuntimeEnv = window.__ENV__ ?? {};

function normalizeConfigValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readConfigValue(runtimeKey: keyof RuntimeEnv, envKey: keyof ImportMetaEnv): string | null {
  return normalizeConfigValue(runtimeEnv[runtimeKey]) ?? normalizeConfigValue(import.meta.env[envKey]);
}

function requireConfig(name: string, value: string | null): string {
  if (value) return value;
  throw new Error(`tracing-app config: required ${name} is missing`);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const rawApiBase = readConfigValue('API_BASE_URL', 'VITE_API_BASE_URL');
const apiBaseUrl = stripTrailingSlash(rawApiBase ?? '/api');

const authority = stripTrailingSlash(
  requireConfig('OIDC_AUTHORITY', readConfigValue('OIDC_AUTHORITY', 'VITE_OIDC_AUTHORITY')),
);
const clientId = requireConfig('OIDC_CLIENT_ID', readConfigValue('OIDC_CLIENT_ID', 'VITE_OIDC_CLIENT_ID'));
const scope = requireConfig('OIDC_SCOPE', readConfigValue('OIDC_SCOPE', 'VITE_OIDC_SCOPE'));
const resource = readConfigValue('OIDC_RESOURCE', 'VITE_OIDC_RESOURCE');

export const oidcConfig: OidcConfig = {
  enabled: true,
  authority,
  clientId,
  scope,
  resource,
};

// Sibling product origins, keyed by product id. Set by the operator when the
// apps are not served at <product>.<domain>; null falls back to derivation.
const productUrls: Record<string, string | null> = {
  chat: readProductUrl('CHAT_URL', 'VITE_CHAT_URL'),
  tracing: readProductUrl('TRACING_URL', 'VITE_TRACING_URL'),
  console: readProductUrl('CONSOLE_URL', 'VITE_CONSOLE_URL'),
  sandboxes: readProductUrl('SANDBOXES_URL', 'VITE_SANDBOXES_URL'),
};

function readProductUrl(runtimeKey: keyof RuntimeEnv, envKey: keyof ImportMetaEnv): string | null {
  const value = readConfigValue(runtimeKey, envKey);
  return value ? stripTrailingSlash(value) : null;
}

export const config = {
  apiBaseUrl,
  productUrls,
};

/**
 * Derive a sibling product base URL from the current page origin by replacing
 * the first subdomain label. Null when derivation is not possible (no
 * subdomain, IP address, SSR, etc.).
 */
export function deriveSiblingUrl(serviceName: string): string | null {
  if (typeof window === 'undefined') return null;

  const { protocol, hostname, port } = window.location;
  if (/^\d/.test(hostname) || hostname.includes(':')) return null;

  const dotIndex = hostname.indexOf('.');
  if (dotIndex === -1) return null;

  const rest = hostname.slice(dotIndex);
  if (!rest.includes('.', 1)) return null;

  const portSuffix = port ? `:${port}` : '';
  return `${protocol}//${serviceName}${rest}${portSuffix}`;
}
