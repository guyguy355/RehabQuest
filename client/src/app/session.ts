// The token is kept in localStorage so the session survives a refresh and works in the
// Capacitor Android shell. Trade-off: any XSS could read it; an httpOnly cookie would be
// safer for a web-only deployment (see README → Limitations).
const TOKEN_KEY = 'rehabquest.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    // Keys used by the earlier version of the app.
    localStorage.removeItem('rehabquestToken');
    localStorage.removeItem('rehabquestUserRole');
  } catch {
    // ignore
  }
}
