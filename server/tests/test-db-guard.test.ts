import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { assertMarkedTestDatabase, resolveTestDatabaseUrl } from '../scripts/test-db.js';

const saved = { TEST_DATABASE_URL: process.env.TEST_DATABASE_URL };

afterEach(() => {
  if (saved.TEST_DATABASE_URL === undefined) delete process.env.TEST_DATABASE_URL;
  else process.env.TEST_DATABASE_URL = saved.TEST_DATABASE_URL;
});

describe('test database guard', () => {
  test('a URL that merely contains "test" is refused', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/my_test_copy';
    assert.throws(() => resolveTestDatabaseUrl(), /named exactly "rehabquest_test"/);
  });

  test('remote hosts are refused', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@db.example.com:5432/rehabquest_test';
    assert.throws(() => resolveTestDatabaseUrl(), /non-local/);
  });

  test('the configured test URL passes the static checks', () => {
    delete process.env.TEST_DATABASE_URL;
    assert.match(resolveTestDatabaseUrl(), /rehabquest_test$/);
  });

  test('a database without the test marker is refused at runtime (read-only check)', async (t) => {
    // The development database from docker-compose; only a SELECT is executed.
    const client = new PrismaClient({ datasourceUrl: 'postgresql://postgres:postgres@localhost:5432/rehabquest' });
    try {
      await client.$queryRaw`SELECT 1`;
    } catch {
      t.skip('development database is not running');
      await client.$disconnect();
      return;
    }
    await assert.rejects(assertMarkedTestDatabase(client), /not a marked RehabQuest test database/);
    await client.$disconnect();
  });
});
