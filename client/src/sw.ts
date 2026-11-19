/// <reference lib="webworker" />
/**
 * RehabQuest service worker.
 * - Precaches the app shell so the app opens offline.
 * - Does NOT cache API responses: authenticated data is never stored by the service worker.
 *   The only offline data is the user-scoped plan snapshot the app saves on purpose (ADR-002).
 * - Shows push notifications with generic text and opens the app on click.
 * - Background Sync is an optional hint: it asks open app windows to sync; the app also syncs
 *   on launch, on reconnect and on demand, so it never depends on this event.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Navigations get the app shell, except API URLs (e.g. a data export opened as a download).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'RehabQuest', {
      body: data.body ?? 'Open RehabQuest to see what is new.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'navigate', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('sync', (event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (promise: Promise<unknown>) => void };
  if (syncEvent.tag !== 'rehabquest-outbox') return;
  syncEvent.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) client.postMessage({ type: 'sync-outbox' });
    }),
  );
});
