import type { ReactNode } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Navigate } from 'react-router-dom';

/**
 * Route guard implementing rubric 1.2 (Access Control & Redirection):
 * any unauthenticated visitor is blocked and sent to the sign-up / login screen.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  if (authStatus === 'configuring') {
    return <div className="auth-shell"><p className="muted">Loading…</p></div>;
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
