import type { NotificationKind } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { enqueue } from './outbox.js';

type Db = Tx | typeof prisma;

/**
 * Creates an in-app notification at most once per dedupeKey and, if the user enabled push,
 * queues a push job. Notification text must stay short and must not quote message bodies
 * or health details (titles are shown in the app; push text is always generic).
 */
export async function notify(db: Db, input: { userId: string; kind: NotificationKind; title: string; body: string; link?: string | null; dedupeKey: string }) {
  const created = await db.notification.createMany({
    data: [{ userId: input.userId, kind: input.kind, title: input.title, body: input.body, link: input.link ?? null, dedupeKey: input.dedupeKey }],
    skipDuplicates: true,
  });
  if (created.count === 0) return null;

  const notification = await db.notification.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey } });
  await db.notificationDelivery.create({ data: { userId: input.userId, notificationId: notification.id, channel: 'IN_APP', status: 'SENT', detail: 'Stored in the notification center' } });

  const preference = await db.patientNotificationPreference.findUnique({ where: { userId: input.userId }, select: { pushEnabled: true } });
  const subscriptions = await db.pushSubscription.count({ where: { userId: input.userId, disabledAt: null } });
  // Patients opt in with their preference; for therapists, registering a subscription is the opt-in.
  const wantsPush = preference ? preference.pushEnabled : true;
  if (wantsPush && subscriptions > 0) {
    await enqueue(db, { kind: 'PUSH', userId: input.userId, dedupeKey: `push:${input.dedupeKey}`, runAt: new Date(), payload: { notificationId: notification.id } });
  }
  return notification;
}
