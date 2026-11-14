import { createApp, createExercise, createPublishedPlan, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { addDays, localDateKey } from '../src/lib/dates.js';

const app = createApp({ summaryModel: null });
const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });
let keyCounter = 0;
const key = () => `client-key-${Date.now()}-${++keyCounter}`;

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function pair() {
  const therapist = await createUser('THERAPIST', { name: 'Dana Therapist' });
  const patient = await createUser('PATIENT', { name: 'Maya Patient' });
  await link(therapist.id, patient.id);
  const exercise = await createExercise(therapist.id);
  const today = localDateKey(patient.timezone);
  const { plan, tasks } = await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [exercise], startDate: addDays(today, -3), endDate: addDays(today, 10) });
  return { therapist, patient, plan, taskId: tasks[0].id, today };
}

describe('sending and retries', () => {
  test('a retried send with the same key returns the original message (lost response)', async () => {
    const { therapist, patient } = await pair();
    const clientMessageId = key();
    const first = await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Is it normal that my knee clicks?', clientMessageId }).expect(201);
    const retry = await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Is it normal that my knee clicks?', clientMessageId }).expect(200);
    assert.equal(retry.body.alreadySent, true);
    assert.equal(retry.body.message.id, first.body.message.id);
    assert.equal(await prisma.message.count(), 1);
    assert.equal(await prisma.notification.count({ where: { userId: therapist.id, kind: 'MESSAGE' } }), 1);
  });

  test('concurrent retries create exactly one message', async () => {
    const { therapist, patient } = await pair();
    const clientMessageId = key();
    const results = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Hello', clientMessageId })));
    assert.ok(results.every((result) => result.status === 200 || result.status === 201));
    assert.equal(await prisma.message.count(), 1);
  });

  test('message text is stored and returned verbatim (rendered as text by the client)', async () => {
    const { therapist, patient } = await pair();
    const text = '<img src=x onerror="alert(1)"> **bold** https://example.com';
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text, clientMessageId: key() }).expect(201);
    const thread = await request(app).get(`/messages/${patient.id}`).set(auth(therapist.id)).expect(200);
    assert.equal(thread.body.messages[0].text, text);
    // Notifications never quote the message body.
    const notification = await prisma.notification.findFirstOrThrow({ where: { userId: therapist.id } });
    assert.ok(!notification.body.includes('onerror') && !notification.title.includes('onerror'));
  });
});

describe('context links', () => {
  test('a patient can link their own exercise; links to other people’s records are refused', async () => {
    const { therapist, patient, taskId } = await pair();
    const other = await pair();
    const ok = await request(app)
      .post('/messages')
      .set(auth(patient.id))
      .send({ receiverId: therapist.id, text: 'Question about this exercise', clientMessageId: key(), context: { type: 'TASK', id: taskId } })
      .expect(201);
    assert.equal(ok.body.message.context.label, 'Heel slides');

    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'x', clientMessageId: key(), context: { type: 'TASK', id: other.taskId } }).expect(404);
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'x', clientMessageId: key(), context: { type: 'PLAN', id: other.plan.id } }).expect(404);
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'x', clientMessageId: key(), context: { type: 'REVIEW_ITEM', id: 'anything' } }).expect(403);
  });

  test('another therapist can neither read the conversation nor the linked record', async () => {
    const { therapist, patient, taskId } = await pair();
    const outsider = await createUser('THERAPIST');
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'About this', clientMessageId: key(), context: { type: 'TASK', id: taskId } }).expect(201);
    await request(app).get(`/messages/${patient.id}`).set(auth(outsider.id)).expect(404);
    await request(app).get(`/messages/${therapist.id}`).set(auth(outsider.id)).expect(404); // therapist ↔ therapist: no conversation
    await request(app).post('/messages').set(auth(outsider.id)).send({ receiverId: patient.id, text: 'hi', clientMessageId: key() }).expect(404);
  });
});

describe('read state and pagination', () => {
  test('unread counts persist across requests until the conversation is marked read', async () => {
    const { therapist, patient } = await pair();
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'One', clientMessageId: key() }).expect(201);
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Two', clientMessageId: key() }).expect(201);

    assert.equal((await request(app).get('/notifications/unread-count').set(auth(therapist.id)).expect(200)).body.messages, 2);
    await request(app).get(`/messages/${patient.id}`).set(auth(therapist.id)).expect(200); // reading the page does not mark it
    assert.equal((await request(app).get('/notifications/unread-count').set(auth(therapist.id)).expect(200)).body.messages, 2);

    await request(app).post(`/messages/${patient.id}/read`).set(auth(therapist.id)).expect(200);
    const after = await request(app).get('/notifications/unread-count').set(auth(therapist.id)).expect(200);
    assert.deepEqual(after.body, { notifications: 0, messages: 0 });
    const conversations = await request(app).get('/messages/conversations').set(auth(therapist.id)).expect(200);
    assert.equal(conversations.body.conversations[0].unread, 0);
  });

  test('history is paginated newest-first with a cursor and returned oldest-first per page', async () => {
    const { therapist, patient } = await pair();
    const base = Date.now() - 100_000;
    await prisma.message.createMany({ data: Array.from({ length: 35 }, (_, index) => ({ senderId: patient.id, receiverId: therapist.id, text: `m${index}`, createdAt: new Date(base + index * 1000) })) });
    const first = await request(app).get(`/messages/${patient.id}?limit=30`).set(auth(therapist.id)).expect(200);
    assert.equal(first.body.messages.length, 30);
    assert.equal(first.body.messages.at(-1).text, 'm34');
    assert.ok(first.body.nextBefore);
    const second = await request(app).get(`/messages/${patient.id}?limit=30&before=${first.body.nextBefore}`).set(auth(therapist.id)).expect(200);
    assert.deepEqual(second.body.messages.map((message: { text: string }) => message.text), ['m0', 'm1', 'm2', 'm3', 'm4']);
    assert.equal(second.body.nextBefore, null);
  });
});

describe('ended care relationships', () => {
  test('therapist ends care: access is removed, the plan is paused, the patient keeps read-only history', async () => {
    const { therapist, patient, plan } = await pair();
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Hi', clientMessageId: key() }).expect(201);
    await request(app).post(`/therapist/patients/${patient.id}/end-care`).set(auth(therapist.id)).expect(200);

    await request(app).get(`/therapist/patients/${patient.id}`).set(auth(therapist.id)).expect(404);
    await request(app).get(`/messages/${patient.id}`).set(auth(therapist.id)).expect(404);
    await request(app).post('/messages').set(auth(therapist.id)).send({ receiverId: patient.id, text: 'Still there?', clientMessageId: key() }).expect(404);
    assert.equal((await request(app).get('/therapist/patients').set(auth(therapist.id)).expect(200)).body.patients.length, 0);

    const history = await request(app).get(`/messages/${therapist.id}`).set(auth(patient.id)).expect(200);
    assert.equal(history.body.active, false);
    assert.equal(history.body.messages.length, 1);
    const blocked = await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Hello?', clientMessageId: key() }).expect(403);
    assert.equal(blocked.body.code, 'care_ended');

    assert.equal((await prisma.rehabPlan.findUniqueOrThrow({ where: { id: plan.id } })).status, 'PAUSED');
    assert.equal(await prisma.reviewItem.count({ where: { status: { not: 'RESOLVED' } } }), 0);
    assert.equal(await prisma.auditEvent.count({ where: { action: 'CARE_LINK_ENDED' } }), 1);
    assert.equal(await prisma.notification.count({ where: { userId: patient.id, kind: 'CARE' } }), 1);
  });

  test('the patient can end care too; re-linking needs the care code and restores access', async () => {
    const { therapist, patient } = await pair();
    await request(app).post(`/patient/therapists/${therapist.id}/end-care`).set(auth(patient.id)).expect(200);
    await request(app).get(`/therapist/patients/${patient.id}`).set(auth(therapist.id)).expect(404);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: patient.id } });
    await request(app).post('/therapist/patients/link').set(auth(therapist.id)).send({ patientEmail: fresh.email, careCode: '00000000' }).expect(404);
    const relinked = await request(app).post('/therapist/patients/link').set(auth(therapist.id)).send({ patientEmail: fresh.email, careCode: fresh.careCode }).expect(201);
    assert.equal(relinked.body.relinked, true);
    await request(app).get(`/therapist/patients/${patient.id}`).set(auth(therapist.id)).expect(200);
  });

  test('regenerating the care code invalidates the old one', async () => {
    const patient = await createUser('PATIENT');
    const therapist = await createUser('THERAPIST');
    const before = await prisma.user.findUniqueOrThrow({ where: { id: patient.id } });
    const regenerated = await request(app).post('/patient/care-code/regenerate').set(auth(patient.id)).expect(200);
    assert.notEqual(regenerated.body.careCode, before.careCode);
    await request(app).post('/therapist/patients/link').set(auth(therapist.id)).send({ patientEmail: before.email, careCode: before.careCode }).expect(404);
  });
});

describe('unanswered messages in the review queue', () => {
  test('a patient message opens one item per conversation; the therapist reply resolves it with the actor', async () => {
    const { therapist, patient } = await pair();
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Question 1', clientMessageId: key() }).expect(201);
    await request(app).post('/messages').set(auth(patient.id)).send({ receiverId: therapist.id, text: 'Question 2', clientMessageId: key() }).expect(201);
    const queue = await request(app).get('/therapist/review-items?kind=UNANSWERED_MESSAGE').set(auth(therapist.id)).expect(200);
    assert.equal(queue.body.items.length, 1);
    assert.deepEqual(queue.body.items[0].reasons, ['Patient message without a reply']);

    await request(app).post('/messages').set(auth(therapist.id)).send({ receiverId: patient.id, text: 'Yes, that is fine.', clientMessageId: key() }).expect(201);
    const item = await prisma.reviewItem.findFirstOrThrow({ where: { kind: 'UNANSWERED_MESSAGE' } });
    assert.equal(item.status, 'RESOLVED');
    assert.equal(item.resolvedById, therapist.id);
    assert.equal(item.resolutionNote, 'Replied in messages');
  });
});
