import type { Prisma } from '@prisma/client';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { config, getJwtSecret } from './config.js';
import type { Db } from './db.js';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type AuthenticatedUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

const issuer = 'rehabquest';

export function createAuthToken(userId: string) {
  return jwt.sign({}, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    issuer,
    subject: userId,
  });
}

type VerifiedToken = { userId: string; issuedAt: number };

export function verifyAuthHeader(authorization?: string): VerifiedToken | null {
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer,
    }) as JwtPayload;

    if (typeof decoded.sub !== 'string' || typeof decoded.iat !== 'number') {
      return null;
    }

    return { userId: decoded.sub, issuedAt: decoded.iat };
  } catch {
    // Expired, malformed or wrongly signed tokens are all treated as "not authenticated".
    return null;
  }
}

export async function getAuthenticatedUser(db: Db, authorization?: string): Promise<AuthenticatedUser | null> {
  const verified = verifyAuthHeader(authorization);

  if (!verified) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: verified.userId },
    select: { ...publicUserSelect, passwordChangedAt: true },
  });

  if (!user) {
    return null;
  }

  // A password reset invalidates every token issued before it (JWT iat has second precision).
  if (user.passwordChangedAt && verified.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return null;
  }

  const { passwordChangedAt: _ignored, ...publicUser } = user;
  return publicUser;
}
