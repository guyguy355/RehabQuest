import { apiBaseUrl } from '../config/api';

export type SessionRole = 'PATIENT' | 'THERAPIST' | 'ADMIN';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: SessionRole;
  createdAt: string;
  updatedAt: string;
};

const SESSION_TOKEN_KEY = 'rehabquestToken';
const SESSION_USER_ROLE_KEY = 'rehabquestUserRole';

export function getStoredSession() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY) ?? localStorage.getItem('authToken') ?? localStorage.getItem('token');
  const userRole = localStorage.getItem(SESSION_USER_ROLE_KEY) ?? localStorage.getItem('rehabquestUserRole');

  return {
    token,
    userRole: (userRole as SessionRole | null) ?? null,
  };
}

export function saveSession(token: string, user?: Partial<SessionUser> | null) {
  if (!token) {
    return;
  }

  localStorage.setItem(SESSION_TOKEN_KEY, token);

  if (user?.role) {
    localStorage.setItem(SESSION_USER_ROLE_KEY, user.role);
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem(SESSION_USER_ROLE_KEY);
  localStorage.removeItem('rehabquestUserRole');
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}) {
  const { token } = getStoredSession();

  if (!token) {
    return extraHeaders;
  }

  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export function withAuthHeaders(headers: HeadersInit = {}) {
  const merged = new Headers(headers);
  const { token } = getStoredSession();

  if (token && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`);
  }

  return merged;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const requestInit = {
    ...init,
    headers: withAuthHeaders(init.headers ?? {}),
  };

  const response = await fetch(input, requestInit);

  if (response.status === 401) {
    clearSession();

    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }

  return response;
}

export async function restoreSession(): Promise<SessionUser | null> {
  const { token } = getStoredSession();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const data = (await response.json()) as { user?: SessionUser };

    if (!data.user) {
      clearSession();
      return null;
    }

    saveSession(token, data.user);
    return data.user;
  } catch {
    clearSession();
    return null;
  }
}

export function getHomeRouteForRole(role?: SessionRole | null) {
  if (role === 'THERAPIST') {
    return '/physio/dashboard';
  }

  if (role === 'PATIENT') {
    return '/patient/dashboard';
  }

  return '/login';
}

export function isProtectedRouteAllowed(userRole: SessionRole | null, allowedRoles: SessionRole[]) {
  if (!userRole) {
    return false;
  }

  return allowedRoles.includes(userRole);
}
