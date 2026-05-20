import type { PrismaClient } from '@prisma/client';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createAuthToken(userId: string) {
  return Buffer.from(userId, 'utf8').toString('base64url');
}

export function getUserIdFromAuthHeader(authorization?: string) {
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  try {
    return Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(prisma: PrismaClient, authorization?: string) {
  const userId = getUserIdFromAuthHeader(authorization);

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: publicUserSelect,
  });
}

export { publicUserSelect };
