import { createApp, createUser, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { config, validateProductionConfig } from '../src/config.js';
import { createEmailAdapter, type EmailMessage, passwordResetEmail, setEmailAdapter } from '../src/services/email.js';

const app = createApp({ summaryModel: null });

beforeEach(resetDatabase);
afterEach(() => setEmailAdapter(null));
after(() => prisma.$disconnect());

describe('email adapters', () => {
  test('"none" reports itself as not configured and never claims success', async () => {
    const adapter = createEmailAdapter({ provider: 'none', from: 'x', replyTo: undefined, resendApiKey: undefined });
    assert.equal(adapter.configured, false);
    const result = await adapter.send({ to: 'a@example.com', subject: 's', text: 't' });
    assert.equal(result.ok, false);
  });

  test('"resend" without an API key is not configured', () => {
    const adapter = createEmailAdapter({ provider: 'resend', from: 'x', replyTo: undefined, resendApiKey: undefined });
    assert.equal(adapter.configured, false);
  });

  test('"resend" posts the message to the Resend API with the bearer key', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    try {
      const adapter = createEmailAdapter({ provider: 'resend', from: 'RehabQuest <no-reply@clinic.example>', replyTo: 'clinic@clinic.example', resendApiKey: 're_test' });
      assert.equal(adapter.configured, true);
      const result = await adapter.send({ to: 'patient@example.com', subject: 'Hello', text: 'Body', html: '<p>Body</p>' });
      assert.deepEqual(result, { ok: true, id: 'msg_1' });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.resend.com/emails');
      const headers = calls[0].init.headers as Record<string, string>;
      assert.equal(headers.Authorization, 'Bearer re_test');
      const body = JSON.parse(String(calls[0].init.body));
      assert.deepEqual(body.to, ['patient@example.com']);
      assert.equal(body.from, 'RehabQuest <no-reply@clinic.example>');
      assert.equal(body.reply_to, 'clinic@clinic.example');
      assert.equal(body.html, '<p>Body</p>');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('"resend" turns an API error into a failed result instead of throwing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('invalid api key', { status: 401 })) as typeof fetch;
    try {
      const adapter = createEmailAdapter({ provider: 'resend', from: 'x', replyTo: undefined, resendApiKey: 're_bad' });
      const result = await adapter.send({ to: 'a@example.com', subject: 's', text: 't' });
      assert.equal(result.ok, false);
      assert.match(result.ok ? '' : result.error, /401/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('password reset email', () => {
  test('contains the link in both languages and escapes HTML in the name', () => {
    const message = passwordResetEmail({ to: 'p@example.com', name: 'Dana <script>', link: 'https://app.example/reset-password?token=abc' });
    assert.equal(message.to, 'p@example.com');
    assert.equal(message.text.split('https://app.example/reset-password?token=abc').length, 3);
    assert.match(message.text, /שלום Dana <script>/);
    assert.match(message.html ?? '', /Dana &lt;script&gt;/);
    assert.doesNotMatch(message.html ?? '', /<script>/);
    assert.match(message.html ?? '', /href="https:\/\/app\.example\/reset-password\?token=abc"/);
  });

  test('forgot-password sends the reset link to the account email', async () => {
    const user = await createUser('PATIENT', { name: 'Maya' });
    const sent: EmailMessage[] = [];
    setEmailAdapter({ provider: 'fake', configured: true, send: async (message) => (sent.push(message), { ok: true }) });

    const response = await request(app).post('/auth/forgot-password').send({ email: user.email }).expect(200);
    assert.equal(response.body.devResetToken, undefined);

    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, user.email);
    const match = sent[0].text.match(new RegExp(`${config.appBaseUrl}/reset-password\\?token=([0-9a-f]{64})`));
    assert.ok(match, 'reset link with a 64-hex token is in the email');

    // The emailed token is the real one: it resets the password.
    await request(app).post('/auth/reset-password').send({ token: match![1], password: 'brand-new-pass' }).expect(200);
    await request(app).post('/auth/login').send({ email: user.email, password: 'brand-new-pass' }).expect(200);
  });

  test('a sending failure is not revealed to the caller and no email goes to unknown addresses', async () => {
    const user = await createUser('PATIENT');
    const attempts: string[] = [];
    setEmailAdapter({ provider: 'fake', configured: true, send: async (message) => (attempts.push(message.to), { ok: false, error: 'provider down' }) });

    const known = await request(app).post('/auth/forgot-password').send({ email: user.email }).expect(200);
    const unknown = await request(app).post('/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);

    assert.equal(known.body.message, unknown.body.message);
    assert.deepEqual(attempts, [user.email]);
  });
});

describe('production configuration guard', () => {
  const good: NodeJS.ProcessEnv = {
    DATABASE_URL: 'postgresql://u:p@db.internal:5432/rehabquest',
    APP_BASE_URL: 'https://app.clinic.example',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_live',
    EMAIL_FROM: 'RehabQuest <no-reply@clinic.example>',
    CLIENT_DIST_DIR: '/app/client/dist',
  };

  test('does nothing outside production', () => {
    validateProductionConfig({}, false);
  });

  test('accepts a complete production configuration', () => {
    validateProductionConfig(good, true);
  });

  test('refuses to start without email, without https, or with dev switches on', () => {
    assert.throws(() => validateProductionConfig({ ...good, EMAIL_PROVIDER: 'log' }, true), /EMAIL_PROVIDER/);
    assert.throws(() => validateProductionConfig({ ...good, EMAIL_PROVIDER: undefined }, true), /EMAIL_PROVIDER/);
    assert.throws(() => validateProductionConfig({ ...good, RESEND_API_KEY: undefined }, true), /RESEND_API_KEY/);
    assert.throws(() => validateProductionConfig({ ...good, APP_BASE_URL: 'http://app.clinic.example' }, true), /https/);
    assert.throws(() => validateProductionConfig({ ...good, DEV_EXPOSE_RESET_TOKENS: 'true' }, true), /DEV_EXPOSE_RESET_TOKENS/);
    assert.throws(() => validateProductionConfig({ ...good, CLIENT_DIST_DIR: undefined }, true), /CORS_ORIGIN/);
    assert.throws(() => validateProductionConfig({ ...good, AI_SUMMARY_PROVIDER: 'anthropic' }, true), /ANTHROPIC_API_KEY/);
  });
});
