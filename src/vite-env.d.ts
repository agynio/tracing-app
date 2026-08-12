/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CHAT_URL?: string;
  readonly VITE_TRACING_URL?: string;
  readonly VITE_CONSOLE_URL?: string;
  readonly VITE_SANDBOXES_URL?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_SCOPE?: string;
  readonly VITE_OIDC_RESOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __ENV__?: {
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
}
