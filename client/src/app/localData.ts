/**
 * Device-local data, always scoped by user id (`rehabquest.u.<userId>.<name>`).
 * Only minimal data is stored: the in-progress session, the downloaded offline plan
 * snapshot and queued (not yet synced) records. It is removed on sign-out (after the
 * user confirms if unsynced work exists) and when a different account signs in.
 */
const PREFIX = 'rehabquest.u.';
const OWNER_KEY = 'rehabquest.owner';

export function userKey(userId: string, name: string) {
  return `${PREFIX}${userId}.${name}`;
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the session still works for this page view.
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Removes every device-local entry that belongs to `userId` (or to all users when omitted). */
export function clearUserLocalData(userId?: string) {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (key.startsWith(userId ? `${PREFIX}${userId}.` : PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/**
 * Called after sign-in: if the device was last used by another account, that account's
 * local data is removed so the new user can never see it.
 */
export function claimDevice(userId: string) {
  try {
    const previous = localStorage.getItem(OWNER_KEY);
    if (previous && previous !== userId) clearUserLocalData(previous);
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // ignore
  }
}

export function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '');
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
