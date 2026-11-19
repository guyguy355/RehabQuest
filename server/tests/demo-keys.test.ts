import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { CATALOG_KEYS_WITH_DEMO } from '../src/data/demo-keys.js';
import { CATALOG_BY_KEY } from '../src/data/exercise-catalog.js';

// The server decides which library exercises point at a demonstration; the client holds the
// movements. These checks keep the two lists in step (no database needed).
describe('exercise demonstrations: key lists', () => {
  test('every listed key is a catalog exercise, listed once', () => {
    assert.equal(new Set(CATALOG_KEYS_WITH_DEMO).size, CATALOG_KEYS_WITH_DEMO.length);
    assert.deepEqual(CATALOG_KEYS_WITH_DEMO.filter((key) => !CATALOG_BY_KEY.has(key)), []);
  });

  test('the client has exactly one movement for every listed key', () => {
    const folder = new URL('../../client/src/features/demo/animations/', import.meta.url);
    const source = readdirSync(folder).map((file) => readFileSync(new URL(file, folder), 'utf8')).join('\n');
    const inClient = [...source.matchAll(/(?:anim|path)\(\s*'([a-z0-9-]+)'/g)].map((match) => match[1]);
    assert.equal(new Set(inClient).size, inClient.length, 'a movement key is defined twice in the client');
    assert.deepEqual([...inClient].sort(), [...CATALOG_KEYS_WITH_DEMO].sort());
  });
});
