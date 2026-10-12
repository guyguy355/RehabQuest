import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FullPageLoader } from '../ui/States';
import { homePathFor, useAuth } from './AuthProvider';
import type { Role } from './types';

/**
 * Convenience guard for navigation only. Every API endpoint enforces roles and
 * record ownership on the server; this component just avoids showing screens
 * the user cannot use.
 */
export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return <FullPageLoader label="Restoring your session…" />;
  }

  if (auth.status === 'anonymous') {
    const params = new URLSearchParams({ next: location.pathname + location.search });
    if (auth.reason === 'expired' || auth.reason === 'unreachable') params.set('reason', auth.reason);
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  if (auth.user.role !== role) {
    return <Navigate to={homePathFor(auth.user)} replace />;
  }

  return <>{children}</>;
}
