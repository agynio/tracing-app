import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';

export function AuthCallbackScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const isPending = auth.isLoading || Boolean(auth.activeNavigator);

  useEffect(() => {
    if (isPending) return;
    if (!auth.isAuthenticated) return;
    navigate('/', { replace: true });
  }, [auth.isAuthenticated, isPending, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 text-sm text-muted-foreground">
        Completing sign-in...
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="rounded-lg border bg-background px-6 py-5 text-center shadow-sm">
          <div className="text-sm font-medium text-foreground">We couldn&apos;t sign you in.</div>
          <div className="mt-1 text-xs text-muted-foreground">{auth.error.message}</div>
          <Button className="mt-4" size="sm" onClick={() => void auth.signinRedirect()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 text-sm text-muted-foreground">
        Sign-in complete. Redirecting...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 text-sm text-muted-foreground">
      Waiting for sign-in response...
    </div>
  );
}
