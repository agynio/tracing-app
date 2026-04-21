import { Code, ConnectError, createContextKey } from '@connectrpc/connect';
import type { Interceptor } from '@connectrpc/connect';
import { getAccessToken, userManager } from '@/auth/user-manager';

const retryKey = createContextKey(false, { description: 'authRetry' });

export const authInterceptor: Interceptor = (next) => async (req) => {
  const token = await getAccessToken();
  if (token) {
    req.header.set('Authorization', `Bearer ${token}`);
  }

  try {
    return await next(req);
  } catch (error) {
    if (error instanceof ConnectError && error.code === Code.Unauthenticated && userManager) {
      const didRetry = req.contextValues.get(retryKey);
      if (!didRetry) {
        req.contextValues.set(retryKey, true);
        await userManager.signinSilent();
        const refreshed = await getAccessToken();
        if (refreshed) {
          req.header.set('Authorization', `Bearer ${refreshed}`);
          return await next(req);
        }
      }
    }
    throw error;
  }
};
