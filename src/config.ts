type RuntimeEnv = {
  API_BASE_URL?: string;
  OIDC_AUTHORITY?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_SCOPE?: string;
};

export type OidcConfig = {
  enabled: boolean;
  authority: string;
  clientId: string;
  scope: string;
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

export const oidcConfig: OidcConfig = {
  enabled: true,
  authority,
  clientId,
  scope,
};

export const config = {
  apiBaseUrl,
};
