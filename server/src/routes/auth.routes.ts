import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { createAuthToken, publicUserSelect } from '../auth.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const prisma = new PrismaClient();
const router = Router();

router.post('/register', async (request, response, next) => {
  try {
    const { name, email, password, role } = request.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: Role;
    };

    if (!name || !email || !password || !role) {
      response.status(400).json({ message: 'name, email, password, and role are required' });
      return;
    }

    if (!Object.values(Role).includes(role)) {
      response.status(400).json({ message: 'role must be PATIENT, THERAPIST, or ADMIN' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
      },
      select: publicUserSelect,
    });

    response.status(201).json({
      user,
      token: createAuthToken(user.id),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (request, response, next) => {
  try {
    const { email, password } = request.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      response.status(400).json({ message: 'email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!user) {
      response.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      response.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    response.json({
      user: toPublicUser(user),
      token: createAuthToken(user.id),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (request, response) => {
  response.json({ user: request.user });
});

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export default router;
