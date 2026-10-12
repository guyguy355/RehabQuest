import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { createAuthToken, publicUserSelect } from '../auth.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { badRequest, conflict, handle, HttpError, parse, requireUser } from '../http.js';
import { isValidTimezone } from '../lib/dates.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-password', BCRYPT_ROUNDS);

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long');
const timezone = z.string().trim().refine(isValidTimezone, 'Unknown timezone');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email,
  password,
  timezone: timezone.optional(),
  // Public registration only creates patients. Therapist accounts are provisioned
  // server-side (npm run therapist:create), so a client cannot grant itself privileges.
  role: z.unknown().optional(),
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(128) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().trim().min(1, 'Reset token is required').max(200), password });
const updateMeSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), timezone: timezone.optional() });

export function createCareCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAuthRouter() {
  const router = Router();
  const limiter = rateLimit(config.authRateLimit);

  router.post(
    '/register',
    limiter,
    handle(async (request, response) => {
      const input = parse(registerSchema, request.body);

      if (input.role !== undefined && input.role !== Role.PATIENT) {
        throw new HttpError(403, 'Self-registration is available for patients only. Therapist accounts are created by an administrator.', 'role_not_allowed');
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const user = await prisma.user.create({
            data: {
              name: input.name,
              email: input.email,
              passwordHash,
              role: Role.PATIENT,
              timezone: input.timezone ?? config.defaultTimezone,
              careCode: createCareCode(),
            },
            select: publicUserSelect,
          });

          response.status(201).json({ user, token: createAuthToken(user.id) });
          return;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = String(error.meta?.target ?? '');
            if (target.includes('email')) throw conflict('An account with this email already exists', 'email_taken');
            continue; // care code collision: try another code
          }
          throw error;
        }
      }

      throw new HttpError(500, 'Could not create the account. Please try again.');
    }),
  );

  router.post(
    '/login',
    limiter,
    handle(async (request, response) => {
      const input = parse(loginSchema, request.body);
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

      if (!user || !passwordMatches) {
        throw new HttpError(401, 'Incorrect email or password', 'invalid_credentials');
      }

      const publicUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: publicUserSelect });
      response.json({ user: publicUser, token: createAuthToken(user.id) });
    }),
  );

  router.post(
    '/forgot-password',
    limiter,
    handle(async (request, response) => {
      const input = parse(forgotSchema, request.body);
      const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
      const result: { message: string; devResetToken?: string } = {
        message: 'If an account exists for that email, a reset link has been created.',
      };

      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        await prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
        });

        // No email service is integrated. For local development only, the token can be
        // returned in the response when DEV_EXPOSE_RESET_TOKENS=true (never in production).
        if (config.exposeDevResetTokens) {
          result.devResetToken = token;
        }
      }

      response.json(result);
    }),
  );

  router.post(
    '/reset-password',
    limiter,
    handle(async (request, response) => {
      const input = parse(resetSchema, request.body);
      const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.token) } });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        throw badRequest('This reset link is invalid or has expired');
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      const now = new Date();

      await prisma.$transaction([
        prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash, passwordChangedAt: now } }),
        prisma.passwordResetToken.updateMany({ where: { userId: resetToken.userId, usedAt: null }, data: { usedAt: now } }),
      ]);

      response.json({ message: 'Your password has been reset. Please sign in again.' });
    }),
  );

  router.get('/me', requireAuth, (request, response) => {
    response.json({ user: requireUser(request) });
  });

  router.patch(
    '/me',
    requireAuth,
    handle(async (request, response) => {
      const user = requireUser(request);
      const input = parse(updateMeSchema, request.body);
      const updated = await prisma.user.update({ where: { id: user.id }, data: input, select: publicUserSelect });
      response.json({ user: updated });
    }),
  );

  return router;
}
