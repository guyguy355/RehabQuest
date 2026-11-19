import { createApp, prisma } from './helpers/setup.js';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';

/** Same-origin production layout: the API serves the built web app and lives under /api. */
describe('serving the web app from the API', () => {
  let dist: string;
  let app: ReturnType<typeof createApp>;

  before(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'rehabquest-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><body><div id="root">app</div></body></html>');
    fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log("built")');
    fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), '{}');
    app = createApp({ summaryModel: null, clientDistDir: dist });
  });

  after(async () => {
    fs.rmSync(dist, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  test('refuses to start when the build output is missing', () => {
    assert.throws(() => createApp({ summaryModel: null, clientDistDir: path.join(os.tmpdir(), 'does-not-exist') }), /does not exist/);
  });

  test('the API answers under /api and the root health check stays available', async () => {
    const api = await request(app).get('/api/health').expect(200);
    assert.equal(api.body.status, 'ok');
    await request(app).get('/health').expect(200);
    const login = await request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'nope' }).expect(401);
    assert.equal(login.body.code, 'invalid_credentials');
  });

  test('app routes that collide with API prefixes get the web app, not a JSON 401', async () => {
    for (const route of ['/', '/patient', '/therapist/patients/abc', '/login', '/reset-password']) {
      const response = await request(app).get(route).set('Accept', 'text/html').expect(200);
      assert.match(response.headers['content-type'], /text\/html/);
      assert.match(response.text, /id="root"/);
      assert.equal(response.headers['cache-control'], 'no-cache');
    }
  });

  test('API routes are not available at the root when the app is served', async () => {
    const response = await request(app).post('/auth/login').send({ email: 'x@example.com', password: 'nope' }).expect(404);
    assert.equal(response.body.code, 'not_found');
  });

  test('unknown API paths and non-HTML requests get JSON errors, never the web app', async () => {
    // Authenticated routers answer unknown paths with 401 before the 404 handler; both are JSON.
    const api = await request(app).get('/api/nope');
    assert.ok([401, 404].includes(api.status), `status ${api.status}`);
    assert.match(api.headers['content-type'], /application\/json/);

    const json = await request(app).get('/patient').set('Accept', 'application/json');
    assert.ok([401, 404].includes(json.status), `status ${json.status}`);
    assert.match(json.headers['content-type'], /application\/json/);
    assert.doesNotMatch(json.text, /id="root"/);
  });

  test('build assets are immutable and security headers are set', async () => {
    const asset = await request(app).get('/assets/index-abc123.js').expect(200);
    assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');

    const page = await request(app).get('/').set('Accept', 'text/html').expect(200);
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal(page.headers['x-frame-options'], 'DENY');
    assert.match(page.headers['content-security-policy'], /default-src 'self'/);
    assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(page.headers['x-powered-by'], undefined);
  });
});

describe('API-only layout', () => {
  test('without a client build the API answers at the root and under /api, with no CSP', async () => {
    const app = createApp({ summaryModel: null, clientDistDir: null });
    await request(app).get('/health').expect(200);
    await request(app).get('/api/health').expect(200);
    const response = await request(app).post('/auth/login').send({ email: 'x@example.com', password: 'nope' }).expect(401);
    assert.equal(response.headers['content-security-policy'], undefined);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  });
});
