import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { oidcConfig } from '@/config';

const appOrigin = window.location.origin;
const redirectUri = new URL('/callback', appOrigin).toString();
const silentRedirectUri = new URL('/silent-renew', appOrigin).toString();
const postLogoutRedirectUri = appOrigin;

export const userManager = oidcConfig.enabled
  ? new UserManager({
      authority: oidcConfig.authority,
      client_id: oidcConfig.clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      silent_redirect_uri: silentRedirectUri,
      scope: oidcConfig.scope,
      resource: oidcConfig.resource ?? undefined,
      response_type: 'code',
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: true,
    })
  : null;

export async function getAccessToken(): Promise<string | null> {
  if (!userManager) return null;
  const user = await userManager.getUser();
  return user?.access_token ?? null;
}
