import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getHomeRouteForRole, isProtectedRouteAllowed, restoreSession, type SessionRole, type SessionUser } from '../auth/session';

type ProtectedRouteProps = {
  allowedRoles: SessionRole[];
  children: React.ReactNode;
};

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const restoredUser = await restoreSession();
      if (isMounted) {
        setUser(restoredUser);
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-on-background">
        <div className="text-sm font-semibold text-on-surface-variant">Loading session...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isProtectedRouteAllowed(user.role, allowedRoles)) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
