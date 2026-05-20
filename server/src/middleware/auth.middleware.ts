import { PrismaClient, Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth.js';

const prisma = new PrismaClient();

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const user = await getAuthenticatedUser(prisma, request.headers.authorization);

    if (!user) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(role: Role) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (request.user.role !== role) {
      response.status(403).json({ message: `Requires ${role} role` });
      return;
    }

    next();
  };
}

export const requireTherapist = requireRole(Role.THERAPIST);
export const requirePatient = requireRole(Role.PATIENT);
export const requireAdmin = requireRole(Role.ADMIN);
