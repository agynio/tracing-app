import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { oidcConfig } from '@/config';

export const userManager = oidcConfig.enabled
  ? new UserManager({
      authority: oidcConfig.authority,
      client_id: oidcConfig.clientId,
      redirect_uri: `${window.location.origin}/callback`,
      post_logout_redirect_uri: window.location.origin,
      scope: oidcConfig.scope,
      response_type: 'code',
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: true,
      metadata: {
        issuer: oidcConfig.authority,
        authorization_endpoint: `${oidcConfig.authority}/authorize`,
        token_endpoint: `${oidcConfig.authority}/token`,
        userinfo_endpoint: `${oidcConfig.authority}/userinfo`,
        end_session_endpoint: `${oidcConfig.authority}/end-session`,
        jwks_uri: `${oidcConfig.authority}/jwks.json`,
      },
    })
  : null;

export async function getAccessToken(): Promise<string | null> {
  if (!userManager) return null;
  const user = await userManager.getUser();
  return user?.access_token ?? null;
}
