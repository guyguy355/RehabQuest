/**
 * Starts the API for browser (Playwright) tests against a dedicated database.
 *
 * - Database: E2E_DATABASE_URL (default postgresql://postgres:postgres@localhost:5433/rehabquest_e2e),
 *   which must be local and named exactly "rehabquest_e2e". It lives in the throwaway
 *   test container, never in the development database.
 * - Creates the database if needed, applies migrations, loads the demo seed, then
 *   listens on E2E_API_PORT (default 3100).
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = new URL(process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/rehabquest_e2e');

if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/rehabquest_e2e') {
  console.error('E2E_DATABASE_URL must be a local database named rehabquest_e2e.');
  process.exit(1);
}

const admin = new PrismaClient({ datasourceUrl: Object.assign(new URL(url), { pathname: '/postgres' }).toString() });
const exists = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = 'rehabquest_e2e'`;
if (exists.length === 0) await admin.$executeRawUnsafe('CREATE DATABASE "rehabquest_e2e"');
await admin.$disconnect();

const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'development' };
execSync('npx prisma migrate deploy', { cwd: serverRoot, stdio: 'inherit', env });
execSync('npx tsx prisma/seed.ts', { cwd: serverRoot, stdio: 'inherit', env });

process.env.DATABASE_URL = url.toString();
process.env.PORT = process.env.E2E_API_PORT ?? '3100';
process.env.CORS_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:5174';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-only-secret-not-for-real-use';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.AI_SUMMARY_PROVIDER = 'none';

await import('../src/index.js');
