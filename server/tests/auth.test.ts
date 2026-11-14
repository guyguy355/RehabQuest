import { createApp, createUser, PASSWORD, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { config } from '../src/config.js';

const app = createApp({ summaryModel: null });
const secret = process.env.JWT_SECRET!;

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

describe('registration', () => {
  test('creates a patient account, a care code and a working token', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ name: 'Test Patient', email: 'New.Patient@Example.com', password: 'longenough1', timezone: 'Europe/London' })
      .expect(201);

    assert.equal(response.body.user.role, 'PATIENT');
    assert.equal(response.body.user.email, 'new.patient@example.com');
    assert.equal(response.body.user.timezone, 'Europe/London');
    assert.equal(response.body.user.passwordHash, undefined);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'new.patient@example.com' } });
    assert.match(stored.careCode ?? '', /^[0-9A-F]{8}$/);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${response.body.token}`).expect(200);
    assert.equal(me.body.user.id, stored.id);
  });

  test('a client cannot register itself as a therapist', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'longenough1', role: 'THERAPIST' })
      .expect(403);

    assert.equal(response.body.code, 'role_not_allowed');
    assert.equal(await prisma.user.count({ where: { email: 'sneaky@example.com' } }), 0);
  });

  test('validates input and rejects duplicate emails', async () => {
    const short = await request(app).post('/auth/register').send({ name: 'A', email: 'a@example.com', password: 'short' }).expect(400);
    assert.equal(short.body.code, 'validation_error');
    assert.ok(short.body.details.fields.password);

    await request(app).post('/auth/register').send({ name: 'A', email: 'not-an-email', password: 'longenough1' }).expect(400);
    await request(app).post('/auth/register').send({ name: 'A', email: 'a@example.com', password: 'longenough1', timezone: 'Mars/Base' }).expect(400);

    await request(app).post('/auth/register').send({ name: 'A', email: 'dup@example.com', password: 'longenough1' }).expect(201);
    const dup = await request(app).post('/auth/register').send({ name: 'B', email: 'DUP@example.com', password: 'longenough1' }).expect(409);
    assert.equal(dup.body.code, 'email_taken');
  });

  test('malformed JSON is a 400, not an authentication error', async () => {
    const response = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"email": "x",').expect(400);
    assert.equal(response.body.code, 'invalid_json');
  });
});

describe('login and tokens', () => {
  test('correct and incorrect credentials', async () => {
    const user = await createUser('PATIENT');

    const ok = await request(app).post('/auth/login').send({ email: user.email.toUpperCase(), password: PASSWORD }).expect(200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.id, user.id);

    const wrong = await request(app).post('/auth/login').send({ email: user.email, password: 'wrong-password' }).expect(401);
    const unknown = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password' }).expect(401);
    assert.equal(wrong.body.message, unknown.body.message, 'same message for unknown email and wrong password');
  });

  test('missing, malformed, expired, wrongly signed and foreign-issuer tokens are rejected with 401', async () => {
    const user = await createUser('PATIENT');
    const valid = jwt.sign({}, secret, { subject: user.id, issuer: 'rehabquest', expiresIn: '1h' });

    await request(app).get('/auth/me').set('Authorization', `Bearer ${valid}`).expect(200);
    await request(app).get('/auth/me').expect(401);
    await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    await request(app).get('/auth/me').set('Authorization', valid).expect(401); // missing "Bearer"
    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${jwt.sign({}, secret, { subject: user.id, issuer: 'rehabquest', expiresIn: '-1h' })}`)
      .expect(401);
    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${jwt.sign({}, 'another-secret-value', { subject: user.id, issuer: 'rehabquest', expiresIn: '1h' })}`)
      .expect(401);
    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${jwt.sign({}, secret, { subject: user.id, issuer: 'someone-else', expiresIn: '1h' })}`)
      .expect(401);
  });

  test('a token for a deleted user is rejected', async () => {
    const user = await createUser('PATIENT');
    const token = jwt.sign({}, secret, { subject: user.id, issuer: 'rehabquest', expiresIn: '1h' });
    await prisma.user.delete({ where: { id: user.id } });
    await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });
});

describe('password reset', () => {
  test('reset tokens are not exposed by default and are stored hashed', async () => {
    const user = await createUser('PATIENT');
    const response = await request(app).post('/auth/forgot-password').send({ email: user.email }).expect(200);

    assert.equal(response.body.devResetToken, undefined);
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    assert.match(stored.tokenHash, /^[0-9a-f]{64}$/);

    // Unknown emails get the same answer.
    const unknown = await request(app).post('/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);
    assert.equal(unknown.body.message, response.body.message);
  });

  test('resetting the password revokes earlier tokens and the reset token is single-use', async () => {
    const user = await createUser('PATIENT');
    const oldToken = jwt.sign({ iat: Math.floor(Date.now() / 1000) - 60 }, secret, { subject: user.id, issuer: 'rehabquest', expiresIn: '1h' });

    const original = config.exposeDevResetTokens;
    config.exposeDevResetTokens = true;
    const forgot = await request(app).post('/auth/forgot-password').send({ email: user.email }).expect(200);
    config.exposeDevResetTokens = original;

    await request(app).post('/auth/reset-password').send({ token: forgot.body.devResetToken, password: 'brand-new-pass' }).expect(200);
    await request(app).post('/auth/reset-password').send({ token: forgot.body.devResetToken, password: 'another-pass-1' }).expect(400);

    await request(app).get('/auth/me').set('Authorization', `Bearer ${oldToken}`).expect(401);
    await request(app).post('/auth/login').send({ email: user.email, password: PASSWORD }).expect(401);
    await request(app).post('/auth/login').send({ email: user.email, password: 'brand-new-pass' }).expect(200);
  });
});

describe('rate limiting', () => {
  test('repeated login attempts are throttled', async () => {
    const original = config.authRateLimit.max;
    config.authRateLimit.max = 3;
    const limitedApp = createApp({ summaryModel: null });
    config.authRateLimit.max = original;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(limitedApp).post('/auth/login').send({ email: 'x@example.com', password: 'whatever1' }).expect(401);
    }
    const blocked = await request(limitedApp).post('/auth/login').send({ email: 'x@example.com', password: 'whatever1' }).expect(429);
    assert.ok(blocked.headers['retry-after']);
  });
});
