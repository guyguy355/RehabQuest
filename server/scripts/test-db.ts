/**
 * Test-database safety.
 *
 * Tests truncate every table, so they must never run against development or
 * demo data. A URL containing the word "test" is not considered proof. Checks:
 *
 *   1. Static: TEST_DATABASE_URL must use a local host, the exact database
 *      name "rehabquest_test", and a different host/port/database than the
 *      application DATABASE_URL (from the environment or server/.env).
 *   2. Runtime: the connected database must report that exact name AND carry
 *      the marker comment below. Only `npm run test:db:prepare` sets the marker,
 *      and only on a database it just created or that has no tables yet.
 *
 * Usage: `npm run test:db:prepare` (creates/marks/migrates the test database).
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_DB_MARKER = 'rehabquest-test-database';
export const TEST_DB_NAME = 'rehabquest_test';
export const DEFAULT_TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:5433/${TEST_DB_NAME}`;

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function describe(url: URL) {
  return `${url.hostname}:${url.port || '5432'}/${decodeURIComponent(url.pathname.replace(/^\/+/, ''))}`;
}

function applicationDatabaseUrls() {
  const urls: string[] = [];
  const envFile = path.join(serverRoot, '.env');

  if (fs.existsSync(envFile)) {
    const parsed = dotenv.parse(fs.readFileSync(envFile));
    if (parsed.DATABASE_URL) urls.push(parsed.DATABASE_URL);
  }

  // DATABASE_URL in the process env is only "the app database" if it isn't the one we set for tests.
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL && !process.env.REHABQUEST_TEST_RUN) {
    urls.push(process.env.DATABASE_URL);
  }

  return urls;
}

/** Validates the configured test database URL without connecting. Throws on any doubt. */
export function resolveTestDatabaseUrl() {
  const raw = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('TEST_DATABASE_URL must be a PostgreSQL URL.');
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to use a non-local test database host (${url.hostname}).`);
  }

  const name = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (name !== TEST_DB_NAME) {
    throw new Error(`The test database must be named exactly "${TEST_DB_NAME}" (got "${name}").`);
  }

  for (const appUrl of applicationDatabaseUrls()) {
    try {
      if (describe(new URL(appUrl)) === describe(url)) {
        throw new Error(`TEST_DATABASE_URL points at the application database (${describe(url)}).`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('TEST_DATABASE_URL points')) throw error;
    }
  }

  return url.toString();
}

/** Runtime proof that a connected client is the marked test database. */
export async function assertMarkedTestDatabase(client: PrismaClient) {
  const rows = await client.$queryRaw<{ name: string; comment: string | null }[]>`
    SELECT current_database() AS name, shobj_description(oid, 'pg_database') AS comment
    FROM pg_database WHERE datname = current_database()`;
  const row = rows[0];

  if (!row || row.name !== TEST_DB_NAME || row.comment !== TEST_DB_MARKER) {
    throw new Error(
      `Connected database "${row?.name}" is not a marked RehabQuest test database. Run "npm run test:db:prepare" first. No data was changed.`,
    );
  }
}

async function prepare() {
  const testUrl = resolveTestDatabaseUrl();
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });

  try {
    const existing = await admin.$queryRaw<{ comment: string | null }[]>`
      SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = ${TEST_DB_NAME}`;

    if (existing.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
      await admin.$executeRawUnsafe(`COMMENT ON DATABASE "${TEST_DB_NAME}" IS '${TEST_DB_MARKER}'`);
      console.log(`Created and marked ${TEST_DB_NAME}.`);
    } else if (existing[0].comment !== TEST_DB_MARKER) {
      const target = new PrismaClient({ datasourceUrl: testUrl });
      try {
        const [{ count }] = await target.$queryRaw<{ count: bigint }[]>`
          SELECT count(*)::bigint AS count FROM information_schema.tables WHERE table_schema = 'public'`;
        if (count > 0n) {
          throw new Error(`${TEST_DB_NAME} already exists, has tables and is not marked as a test database. Refusing to touch it.`);
        }
      } finally {
        await target.$disconnect();
      }
      await admin.$executeRawUnsafe(`COMMENT ON DATABASE "${TEST_DB_NAME}" IS '${TEST_DB_MARKER}'`);
      console.log(`Marked empty database ${TEST_DB_NAME} as the test database.`);
    } else {
      console.log(`${TEST_DB_NAME} is already marked as the test database.`);
    }
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    cwd: serverRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

if (process.argv[2] === 'prepare') {
  prepare().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
