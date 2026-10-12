import { Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest, handle, param, notFound, parse, requireUser } from '../http.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const sendSchema = z.object({
  receiverId: z.string().min(1, 'receiverId is required'),
  text: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
});

const messageSelect = {
  id: true,
  senderId: true,
  receiverId: true,
  text: true,
  createdAt: true,
} as const;

/** Messages are only allowed between a therapist and a patient who are linked. */
async function findLinkedCounterpart(user: { id: string; role: Role }, otherUserId: string) {
  const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true, name: true, role: true } });

  if (!other) return null;

  const pair =
    user.role === Role.THERAPIST && other.role === Role.PATIENT
      ? { therapistId: user.id, patientId: other.id }
      : user.role === Role.PATIENT && other.role === Role.THERAPIST
        ? { therapistId: other.id, patientId: user.id }
        : null;

  if (!pair) return null;

  const link = await prisma.therapistPatient.findUnique({ where: { therapistId_patientId: pair }, select: { id: true } });
  return link ? other : null;
}

export function createMessagesRouter() {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/',
    handle(async (request, response) => {
      const sender = requireUser(request);
      const input = parse(sendSchema, request.body);

      if (input.receiverId === sender.id) throw badRequest('You cannot message yourself');

      const receiver = await findLinkedCounterpart(sender, input.receiverId);
      if (!receiver) throw notFound('Conversation not found');

      const message = await prisma.message.create({
        data: { senderId: sender.id, receiverId: receiver.id, text: input.text },
        select: messageSelect,
      });

      response.status(201).json({ message });
    }),
  );

  router.get(
    '/:userId',
    handle(async (request, response) => {
      const user = requireUser(request);
      const other = await findLinkedCounterpart(user, param(request, 'userId'));
      if (!other) throw notFound('Conversation not found');

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: user.id, receiverId: other.id },
            { senderId: other.id, receiverId: user.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: messageSelect,
      });

      response.json({ with: { id: other.id, name: other.name }, messages });
    }),
  );

  return router;
}
