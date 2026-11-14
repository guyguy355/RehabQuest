import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { handle, notFound, param, parse, requireUser } from '../http.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { pushAdapter } from '../services/push.js';

const pageSchema = z.object({ cursor: z.string().min(1).max(60).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine((value) => value.startsWith('https://'), 'Push endpoints must use https'),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

export function createNotificationsRouter() {
  const router = Router();
  router.use(requireAuth);

  /** Polled by the app every 30 s (see ADR-003: polling instead of WebSockets). */
  router.get(
    '/notifications/unread-count',
    handle(async (request, response) => {
      const user = requireUser(request);
      const [notifications, messages] = await Promise.all([
        prisma.notification.count({ where: { userId: user.id, readAt: null } }),
        prisma.message.count({ where: { receiverId: user.id, readAt: null } }),
      ]);
      response.json({ notifications, messages });
    }),
  );

  router.get(
    '/notifications',
    handle(async (request, response) => {
      const user = requireUser(request);
      const { cursor, limit } = parse(pageSchema, request.query);
      const rows = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, kind: true, title: true, body: true, link: true, createdAt: true, readAt: true },
      });
      response.json({ notifications: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1].id : null });
    }),
  );

  router.post(
    '/notifications/read-all',
    handle(async (request, response) => {
      const user = requireUser(request);
      const result = await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
      response.json({ marked: result.count });
    }),
  );

  router.post(
    '/notifications/:id/read',
    handle(async (request, response) => {
      const user = requireUser(request);
      const result = await prisma.notification.updateMany({ where: { id: param(request, 'id'), userId: user.id, readAt: null }, data: { readAt: new Date() } });
      const exists = result.count > 0 || (await prisma.notification.count({ where: { id: param(request, 'id'), userId: user.id } })) > 0;
      if (!exists) throw notFound('Notification not found');
      response.json({ ok: true });
    }),
  );

  /** The user's own recent delivery attempts, with honest states (sent / accepted / failed / skipped). */
  router.get(
    '/notifications/deliveries',
    handle(async (request, response) => {
      const user = requireUser(request);
      const deliveries = await prisma.notificationDelivery.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, channel: true, status: true, detail: true, createdAt: true, notification: { select: { kind: true, title: true, readAt: true } } },
      });
      response.json({ deliveries });
    }),
  );

  // ------------------------------------------------------------------- push
  router.get(
    '/push/config',
    handle(async (_request, response) => {
      const adapter = pushAdapter();
      response.json({ configured: adapter.configured, publicKey: adapter.publicKey });
    }),
  );

  router.post(
    '/push/subscriptions',
    handle(async (request, response) => {
      const user = requireUser(request);
      const input = parse(subscriptionSchema, request.body);
      const userAgent = String(request.headers['user-agent'] ?? '').slice(0, 200);
      // An endpoint belongs to one device; re-registering moves it to the current user.
      await prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: { userId: user.id, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
        update: { userId: user.id, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent, disabledAt: null, failureCount: 0 },
      });
      response.status(201).json({ ok: true });
    }),
  );

  router.delete(
    '/push/subscriptions',
    handle(async (request, response) => {
      const user = requireUser(request);
      const { endpoint } = parse(z.object({ endpoint: z.string().min(1).max(1000) }), request.body);
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
      response.json({ ok: true });
    }),
  );

  return router;
}
