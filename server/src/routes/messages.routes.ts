import { MessageContextType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { handle, param, parse, requireUser } from '../http.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { listConversations, listMessages, markRead, sendMessage } from '../services/messaging.js';

const sendSchema = z.object({
  receiverId: z.string().min(1, 'receiverId is required'),
  text: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
  clientMessageId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, 'Invalid message key'),
  context: z.object({ type: z.nativeEnum(MessageContextType), id: z.string().min(1).max(60) }).nullish(),
});
const pageSchema = z.object({ before: z.string().min(1).max(60).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });

export function createMessagesRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/conversations',
    handle(async (request, response) => {
      response.json({ conversations: await listConversations(requireUser(request)) });
    }),
  );

  router.post(
    '/',
    handle(async (request, response) => {
      const result = await sendMessage(requireUser(request), parse(sendSchema, request.body));
      response.status(result.alreadySent ? 200 : 201).json(result);
    }),
  );

  router.get(
    '/:userId',
    handle(async (request, response) => {
      const { before, limit } = parse(pageSchema, request.query);
      response.json(await listMessages(requireUser(request), param(request, 'userId'), before ?? null, limit));
    }),
  );

  router.post(
    '/:userId/read',
    handle(async (request, response) => {
      response.json(await markRead(requireUser(request), param(request, 'userId')));
    }),
  );

  return router;
}
