/**
 * Unread counts for the notification bell and the Messages tab.
 * Polled every 30 seconds while the page is visible, and immediately when the tab
 * regains focus (ADR-003: polling was chosen over WebSockets for simplicity).
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onServiceWorkerMessage } from '../pwa';
import { api } from './api';
import { useAuth } from './AuthProvider';

type Counts = { notifications: number; messages: number };
type Value = Counts & { refresh: () => Promise<void> };
const UnreadContext = createContext<Value>({ notifications: 0, messages: 0, refresh: async () => undefined });
const POLL_MS = 30_000;

export function UnreadProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Counts>({ notifications: 0, messages: 0 });
  const signedIn = auth.status === 'authenticated';

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      setCounts(await api<Counts>('/notifications/unread-count'));
    } catch {
      // Keep the last known counts while offline.
    }
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      setCounts({ notifications: 0, messages: 0 });
      return;
    }
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn, refresh]);

  // A click on a push notification focuses this tab and asks it to open the target page.
  useEffect(() => {
    const unsubscribe = onServiceWorkerMessage((message) => {
      if (message.type === 'navigate' && message.url?.startsWith('/')) navigate(message.url);
    });
    return () => {
      unsubscribe();
    };
  }, [navigate]);

  const value = useMemo(() => ({ ...counts, refresh }), [counts, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  return useContext(UnreadContext);
}
