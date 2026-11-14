import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, SESSION_EXPIRED_EVENT } from './api';
import { clearToken, getToken, setToken } from './session';
import type { User } from './types';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null; reason?: 'expired' | 'signed-out' | 'unreachable' };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => void;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function homePathFor(user: Pick<User, 'role'> | null) {
  if (user?.role === 'THERAPIST') return '/therapist';
  if (user?.role === 'PATIENT') return '/patient';
  return '/login';
}

/** Restores the session once on load, then keeps it in memory for the whole app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => (getToken() ? { status: 'loading', user: null } : { status: 'anonymous', user: null }));

  useEffect(() => {
    if (!getToken()) return;
    const controller = new AbortController();

    api<{ user: User }>('/auth/me', { signal: controller.signal })
      .then(({ user }) => setState({ status: 'authenticated', user }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Invalid/expired tokens are already cleared by api(); a network error keeps the token
        // so the user is not logged out by a temporary outage, but the screen shows login.
        setState({ status: 'anonymous', user: null, reason: getToken() ? 'unreachable' : 'expired' });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onExpired = () => setState({ status: 'anonymous', user: null, reason: 'expired' });
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ user: User; token: string }>('/auth/login', { method: 'POST', body: { email, password }, anonymous: true });
    setToken(result.token);
    setState({ status: 'authenticated', user: result.user });
    return result.user;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await api<{ user: User; token: string }>('/auth/register', { method: 'POST', body: { ...input, timezone }, anonymous: true });
    setToken(result.token);
    setState({ status: 'authenticated', user: result.user });
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ status: 'anonymous', user: null, reason: 'signed-out' });
  }, []);

  const updateUser = useCallback((user: User) => setState({ status: 'authenticated', user }), []);

  const value = useMemo(() => ({ ...state, login, register, logout, updateUser }), [state, login, register, logout, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** For screens that only render for a signed-in user. */
export function useCurrentUser() {
  const auth = useAuth();
  if (auth.status !== 'authenticated') throw new Error('useCurrentUser requires an authenticated session');
  return auth.user;
}
