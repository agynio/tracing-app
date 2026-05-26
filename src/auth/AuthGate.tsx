import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { Button } from '@/components/Button';
import { oidcConfig } from '@/config';
import { clearSignedOutFlag, readSignedOutFlag } from './signed-out';
import { getSigninRedirectArgs } from './return-to';
import { userManager } from './user-manager';

type AuthGateProps = {
  children: ReactNode;
};

function handleSigninCallback() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const cleanedUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, cleanedUrl);
}

function hasAuthParams(location = window.location): boolean {
  let searchParams = new URLSearchParams(location.search);
  if ((searchParams.get('code') || searchParams.get('error')) && searchParams.get('state')) {
    return true;
  }

  searchParams = new URLSearchParams(location.hash.replace('#', '?'));
  if ((searchParams.get('code') || searchParams.get('error')) && searchParams.get('state')) {
    return true;
  }

  return false;
}

type SignedOutScreenProps = {
  onSignIn: () => void;
  title?: string;
  subtitle?: string;
};

function SignedOutScreen({
  onSignIn,
  title = 'You have signed out.',
  subtitle = 'Sign back in to continue.',
}: SignedOutScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="rounded-lg border bg-background px-6 py-5 text-center shadow-sm">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        <Button className="mt-4" size="sm" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 text-sm text-muted-foreground">
      Loading tracing...
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [signedOut, setSignedOut] = useState(() => readSignedOutFlag());
  const [redirectPending, setRedirectPending] = useState(false);

  const handleSignIn = useCallback(() => {
    clearSignedOutFlag();
    setSignedOut(false);
    setRedirectPending(true);
    void auth.signinRedirect(getSigninRedirectArgs());
  }, [auth]);

  useEffect(() => {
    if (!signedOut || !auth.isAuthenticated) return;
    clearSignedOutFlag();
    setSignedOut(false);
  }, [auth.isAuthenticated, signedOut]);

  useEffect(() => {
    if (signedOut || auth.isAuthenticated) return;
    if (!readSignedOutFlag()) return;
    setSignedOut(true);
  }, [auth.isAuthenticated, signedOut]);

  useEffect(() => {
    if (signedOut || redirectPending) return;
    if (auth.isLoading || auth.activeNavigator || auth.isAuthenticated) return;
    if (hasAuthParams()) return;
    setRedirectPending(true);
    void auth.signinRedirect(getSigninRedirectArgs());
  }, [auth, redirectPending, signedOut]);

  useEffect(() => {
    if (!redirectPending || !auth.isAuthenticated) return;
    setRedirectPending(false);
  }, [auth.isAuthenticated, redirectPending]);

  if (signedOut && !auth.isAuthenticated) {
    return <SignedOutScreen onSignIn={handleSignIn} />;
  }

  if (auth.isLoading || auth.activeNavigator || redirectPending || !auth.isAuthenticated) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

function AuthErrorBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { error, removeUser, signinRedirect } = auth;
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = null;
      return;
    }
    if (error.message === lastErrorRef.current) return;
    lastErrorRef.current = error.message;
    console.warn('OIDC error, redirecting to sign-in', error);
    void removeUser().catch((removeError) => {
      console.warn('Failed to clear OIDC user session.', removeError);
    });
  }, [error, removeUser]);

  if (error) {
    return (
      <SignedOutScreen
        onSignIn={() => void signinRedirect(getSigninRedirectArgs())}
        title="We couldn't sign you in."
        subtitle="Please sign in again to continue."
      />
    );
  }
  return <>{children}</>;
}

export function AuthGate({ children }: AuthGateProps) {
  if (!oidcConfig.enabled) return <>{children}</>;
  if (!userManager) throw new Error('auth: user manager not initialized');

  return (
    <AuthProvider userManager={userManager} onSigninCallback={handleSigninCallback}>
      <AuthErrorBoundary>
        <RequireAuth>{children}</RequireAuth>
      </AuthErrorBoundary>
    </AuthProvider>
  );
}
