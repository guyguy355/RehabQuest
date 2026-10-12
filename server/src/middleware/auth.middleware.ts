import { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth.js';
import { prisma } from '../db.js';
import { forbidden, handle, unauthorized } from '../http.js';

async function loadUser(request: Request) {
  if (!request.user) {
    const user = await getAuthenticatedUser(prisma, request.headers.authorization);

    if (!user) {
      throw unauthorized();
    }

    request.user = user;
  }

  return request.user;
}

/** 401 when the bearer token is missing, invalid, expired or revoked. */
export const requireAuth = handle(async (request: Request, _response: Response, next: NextFunction) => {
  await loadUser(request);
  next();
});

/** 401 when unauthenticated, 403 when authenticated with a different role. */
export function requireRole(role: Role) {
  return handle(async (request: Request, _response: Response, next: NextFunction) => {
    const user = await loadUser(request);

    if (user.role !== role) {
      throw forbidden(`This action requires the ${role.toLowerCase()} role`);
    }

    next();
  });
}

export const requireTherapist = requireRole(Role.THERAPIST);
export const requirePatient = requireRole(Role.PATIENT);
