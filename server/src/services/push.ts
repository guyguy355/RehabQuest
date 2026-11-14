/**
 * Push delivery adapters (ADR-003).
 *
 * - Web Push is used only when VAPID keys are configured. Otherwise the app reports
 *   "not configured" honestly and in-app notifications remain the delivery channel.
 * - "ACCEPTED" means the browser vendor's push service accepted the message. It does not
 *   mean the device displayed it; RehabQuest never claims that.
 * - Lock-screen text is always generic (no exercise names, symptoms or message text).
 * - The development log adapter records that a notification would be pushed, so the
 *   pipeline can be demonstrated locally without a push service. It is labelled as such.
 */
import webpush from 'web-push';

export type PushMessage = { title: string; body: string; url: string; tag: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string };

export interface PushAdapter {
  readonly configured: boolean;
  readonly publicKey: string | null;
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}

export function createWebPushAdapter(env = process.env): PushAdapter {
  const publicKey = env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = env.WEB_PUSH_PRIVATE_KEY;
  const subject = env.WEB_PUSH_SUBJECT ?? 'mailto:admin@rehabquest.example';
  if (!publicKey || !privateKey) {
    return { configured: false, publicKey: null, send: async () => ({ ok: false, gone: false, error: 'push_not_configured' }) };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return {
    configured: true,
    publicKey,
    async send(target, message) {
      try {
        await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(message), { TTL: 6 * 3600, timeout: 10_000 });
        return { ok: true };
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        return { ok: false, gone: statusCode === 404 || statusCode === 410, error: statusCode ? `push_service_${statusCode}` : 'push_network_error' };
      }
    },
  };
}

let adapter: PushAdapter | null = null;
export function pushAdapter() {
  adapter ??= createWebPushAdapter();
  return adapter;
}
/** Tests inject a fake adapter. */
export function setPushAdapterForTests(next: PushAdapter | null) {
  adapter = next;
}

/** Development log channel: on unless explicitly disabled, never in production. */
export function devLogEnabled(env = process.env) {
  return env.NODE_ENV !== 'production' && env.NOTIFY_DEV_LOG !== 'false';
}

export const GENERIC_TEXT = {
  REMINDER: { title: 'RehabQuest', body: 'You have a planned session today.', url: '/patient' },
  MESSAGE: { title: 'RehabQuest', body: 'You have a new message.', url: '/notifications' },
  REVIEW: { title: 'RehabQuest', body: 'There is something new to review.', url: '/therapist/reviews' },
  PLAN: { title: 'RehabQuest', body: 'Your plan was updated.', url: '/patient' },
  CARE: { title: 'RehabQuest', body: 'There is an update about your care team.', url: '/notifications' },
} as const;
