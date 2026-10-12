/**
 * Provisions a therapist account. Therapist accounts are never created through
 * the public registration endpoint.
 *
 *   npm run therapist:create -- --name "Dana Cohen" --email dana@clinic.example
 *
 * The password is read from THERAPIST_PASSWORD, or a random one is generated
 * and printed once.
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import '../src/config.js';

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const name = arg('name')?.trim();
const email = arg('email')?.trim().toLowerCase();
const timezone = arg('timezone') ?? 'Asia/Jerusalem';

if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run therapist:create -- --name "Full Name" --email person@example.com [--timezone Asia/Jerusalem]');
  process.exit(1);
}

const password = process.env.THERAPIST_PASSWORD ?? crypto.randomBytes(9).toString('base64url');
if (password.length < 8) {
  console.error('THERAPIST_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.create({
    data: { name, email, timezone, role: Role.THERAPIST, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Created therapist ${user.email}`);
  if (!process.env.THERAPIST_PASSWORD) console.log(`Temporary password: ${password}`);
} catch (error) {
  console.error(error instanceof Error && error.message.includes('Unique') ? 'An account with that email already exists.' : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
