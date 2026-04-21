import { useEffect, useState } from 'react';
import { userManager } from './user-manager';

type SilentRenewState = {
  status: 'loading' | 'success' | 'error';
  error: Error | null;
};

export function SilentRenewScreen() {
  const [state, setState] = useState<SilentRenewState>({ status: 'loading', error: null });

  useEffect(() => {
    let isActive = true;
    if (!userManager) {
      setState({ status: 'error', error: new Error('OIDC user manager not initialized.') });
      return () => {
        isActive = false;
      };
    }

    userManager
      .signinSilentCallback()
      .then(() => {
        if (!isActive) return;
        setState({ status: 'success', error: null });
      })
      .catch((error) => {
        if (!isActive) return;
        setState({ status: 'error', error: error instanceof Error ? error : new Error('Silent renew failed.') });
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 text-xs text-muted-foreground">
        Silent renew failed: {state.error?.message ?? 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 text-xs text-muted-foreground">
      Completing silent sign-in...
    </div>
  );
}
