/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __ENV__?: {
    API_BASE_URL?: string;
    OIDC_AUTHORITY?: string;
    OIDC_CLIENT_ID?: string;
    OIDC_SCOPE?: string;
  };
}
