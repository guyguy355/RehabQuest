import { registerSW } from 'virtual:pwa-register';

/** Registers the service worker (production builds) and relays its messages to the app. */
registerSW({ immediate: true });

type Listener = (message: { type: string; url?: string }) => void;
const listeners = new Set<Listener>();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data as { type?: string; url?: string } | undefined;
    if (data?.type) for (const listener of listeners) listener({ type: data.type, url: data.url });
  });
}

export function onServiceWorkerMessage(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function serviceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}
