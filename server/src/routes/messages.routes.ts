import { PrismaClient, Role } from '@prisma/client';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';

const prisma = new PrismaClient();
const router = Router();

const messageSelect = {
  id: true,
  senderId: true,
  receiverId: true,
  text: true,
  createdAt: true,
  sender: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  receiver: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} as const;

router.post('/', requireAuth, async (request, response, next) => {
  try {
    const sender = request.user;

    if (!sender) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { receiverId, text } = request.body as { receiverId?: string; text?: string };
    const normalizedText = text?.trim();

    if (!receiverId || !normalizedText) {
      response.status(400).json({ message: 'receiverId and text are required' });
      return;
    }

    if (receiverId === sender.id) {
      response.status(400).json({ message: 'Cannot send a message to yourself' });
      return;
    }

    const receiver = await prisma.user.findUnique({
      where: {
        id: receiverId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!receiver) {
      response.status(404).json({ message: 'Receiver not found' });
      return;
    }

    const canMessage = await usersAreLinked(sender.id, sender.role, receiver.id, receiver.role);

    if (!canMessage) {
      response.status(403).json({ message: 'Messages are only allowed between linked therapists and patients' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        text: normalizedText,
      },
      select: messageSelect,
    });

    response.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId', requireAuth, async (request, response, next) => {
  try {
    const user = request.user;
    const otherUserId = getRouteParam(request.params.userId);

    if (!user) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!otherUserId) {
      response.status(400).json({ message: 'User id is required' });
      return;
    }

    const otherUser = await prisma.user.findUnique({
      where: {
        id: otherUserId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!otherUser) {
      response.status(404).json({ message: 'User not found' });
      return;
    }

    const canRead = await usersAreLinked(user.id, user.role, otherUser.id, otherUser.role);

    if (!canRead) {
      response.status(403).json({ message: 'Messages can only be read between linked therapists and patients' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: user.id,
            receiverId: otherUser.id,
          },
          {
            senderId: otherUser.id,
            receiverId: user.id,
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: messageSelect,
    });

    response.json({ messages });
  } catch (error) {
    next(error);
  }
});

async function usersAreLinked(currentUserId: string, currentRole: Role, otherUserId: string, otherRole: Role) {
  if (currentRole === Role.THERAPIST && otherRole === Role.PATIENT) {
    return Boolean(await findLink(currentUserId, otherUserId));
  }

  if (currentRole === Role.PATIENT && otherRole === Role.THERAPIST) {
    return Boolean(await findLink(otherUserId, currentUserId));
  }

  return false;
}

function findLink(therapistId: string, patientId: string) {
  return prisma.therapistPatient.findUnique({
    where: {
      therapistId_patientId: {
        therapistId,
        patientId,
      },
    },
    select: {
      id: true,
    },
  });
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default router;
