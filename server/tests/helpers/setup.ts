/**
 * Must be imported before anything from src/: it points the app at the test
 * database and verifies that database before any test can delete data.
 */
import bcrypt from 'bcrypt';
import { assertMarkedTestDatabase, resolveTestDatabaseUrl } from '../../scripts/test-db.js';

const testDatabaseUrl = resolveTestDatabaseUrl();

process.env.REHABQUEST_TEST_RUN = '1';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX ?? '10000';
process.env.AI_SUMMARY_PROVIDER = 'none';
process.env.NODE_ENV = 'test';

const { prisma } = await import('../../src/db.js');
const { createApp } = await import('../../src/app.js');

await assertMarkedTestDatabase(prisma);

export { createApp, prisma };

const TABLES_TO_KEEP = new Set(['_prisma_migrations', 'Badge']);

/** Empties every table except migrations and the badge definitions. */
export async function resetDatabase() {
  await assertMarkedTestDatabase(prisma);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const names = tables.map((table) => table.tablename).filter((name) => !TABLES_TO_KEEP.has(name));

  if (names.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${names.map((name) => `"${name}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

const passwordHash = bcrypt.hashSync('Password123!', 4);
export const PASSWORD = 'Password123!';

let counter = 0;
export async function createUser(role: 'PATIENT' | 'THERAPIST', overrides: { timezone?: string; name?: string } = {}) {
  counter += 1;
  return prisma.user.create({
    data: {
      name: overrides.name ?? `${role.toLowerCase()} ${counter}`,
      email: `${role.toLowerCase()}-${counter}-${Date.now()}@test.example`,
      passwordHash,
      role,
      timezone: overrides.timezone ?? 'Asia/Jerusalem',
      careCode: role === 'PATIENT' ? `${(counter * 7919).toString(16).toUpperCase().padStart(8, '0').slice(-8)}` : null,
    },
  });
}

export async function link(therapistId: string, patientId: string) {
  return prisma.therapistPatient.create({ data: { therapistId, patientId } });
}

export async function createExercise(therapistId: string, title = 'Heel slides') {
  return prisma.exercise.create({
    data: { title, description: 'Test exercise', bodyPart: 'Knee', difficulty: 'EASY', sets: 3, reps: 10, durationSeconds: 60, createdById: therapistId },
  });
}
