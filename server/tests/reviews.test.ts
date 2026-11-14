import { createApp, createExercise, createPublishedPlan, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { addDays, localDateKey, toDbDate } from '../src/lib/dates.js';
import { evaluateMissedActivity, recordReviewItemsForCompletion } from '../src/services/reviews.js';

const app = createApp({ summaryModel: null });
const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function setup(options: { startOffset?: number; weekdays?: number[]; name?: string } = {}) {
  const therapist = await createUser('THERAPIST');
  const patient = await createUser('PATIENT', { name: options.name });
  await link(therapist.id, patient.id);
  const exercise = await createExercise(therapist.id);
  const today = localDateKey(patient.timezone);
  const { plan, tasks } = await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [exercise], startDate: addDays(today, options.startOffset ?? 0), endDate: addDays(today, 20), trainingWeekdays: options.weekdays });
  return { therapist, patient, plan, taskId: tasks[0].id, today };
}

describe('rules and deduplication', () => {
  test('reprocessing the same exercise record does not create a second item', async () => {
    const { therapist, patient, taskId, today } = await setup();
    const completion = await prisma.taskCompletion.create({ data: { taskId, patientId: patient.id, sessionDate: toDbDate(today), painLevel: 9, prescribedSets: 2, prescribedReps: 10, prescribedDurationSecs: 30 } });
    for (let index = 0; index < 3; index += 1) {
      await prisma.$transaction((tx) => recordReviewItemsForCompletion(tx, { completion, therapistId: therapist.id, exerciseTitle: 'Heel slides' }));
    }
    assert.equal(await prisma.reviewItem.count(), 1);
    assert.equal(await prisma.notification.count({ where: { userId: therapist.id, kind: 'REVIEW' } }), 1);
  });

  test('review rules are configurable per therapist and the reason is always explained', async () => {
    const { therapist, patient, plan } = await setup();
    await request(app).put('/therapist/review-settings').set(auth(therapist.id)).send({ painThreshold: 5, flagTooHard: false, missedSessionsThreshold: 3 }).expect(200);
    await request(app).put('/therapist/review-settings').set(auth(therapist.id)).send({ painThreshold: 11, flagTooHard: false, missedSessionsThreshold: 3 }).expect(400);

    const taskId = (await prisma.rehabTask.findFirstOrThrow({ where: { planId: plan.id } })).id;
    await request(app).post(`/patient/tasks/${taskId}/completion`).set(auth(patient.id)).send({ painLevel: 5, difficulty: 'TOO_HARD' }).expect(201);
    const queue = await request(app).get('/therapist/review-items').set(auth(therapist.id)).expect(200);
    assert.deepEqual(queue.body.items[0].reasons, ['Pain 5/10 is at or above the review threshold (5)']);
  });
});

describe('workflow states', () => {
  test('acknowledge → resolve with note → reopen persists, records the actor and writes audit events', async () => {
    const { therapist, patient, taskId } = await setup();
    await request(app).post(`/patient/tasks/${taskId}/completion`).set(auth(patient.id)).send({ status: 'STOPPED', painLevel: 6 }).expect(201);
    const item = (await request(app).get('/therapist/review-items').set(auth(therapist.id)).expect(200)).body.items[0];
    assert.equal(item.kind, 'STOPPED');
    assert.equal(item.completion.status, 'STOPPED');

    await request(app).post(`/therapist/review-items/${item.id}/acknowledge`).set(auth(therapist.id)).expect(200);
    await request(app).post(`/therapist/review-items/${item.id}/acknowledge`).set(auth(therapist.id)).expect(409);
    await request(app).post(`/therapist/review-items/${item.id}/resolve`).set(auth(therapist.id)).send({ note: 'Phoned the patient; reduced range for now.' }).expect(200);

    const stored = await prisma.reviewItem.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(stored.status, 'RESOLVED');
    assert.equal(stored.resolvedById, therapist.id);
    assert.equal(stored.acknowledgedById, therapist.id);
    assert.ok(stored.resolvedAt && stored.acknowledgedAt);
    assert.equal(stored.resolutionNote, 'Phoned the patient; reduced range for now.');

    const resolvedList = await request(app).get('/therapist/review-items?status=RESOLVED').set(auth(therapist.id)).expect(200);
    assert.equal(resolvedList.body.items.length, 1);
    await request(app).post(`/therapist/review-items/${item.id}/reopen`).set(auth(therapist.id)).expect(200);
    assert.equal((await prisma.reviewItem.findUniqueOrThrow({ where: { id: item.id } })).status, 'OPEN');
    assert.deepEqual((await prisma.auditEvent.findMany({ where: { subjectId: item.id }, orderBy: { createdAt: 'asc' } })).map((event) => event.action), ['REVIEW_ACKNOWLEDGED', 'REVIEW_RESOLVED', 'REVIEW_REOPENED']);
    // Audit metadata never contains the note text.
    assert.ok(!JSON.stringify(await prisma.auditEvent.findMany()).includes('Phoned'));
  });
});

describe('missed scheduled activity', () => {
  test('consecutive missed sessions create one item that updates while the run grows', async () => {
    const { therapist } = await setup({ startOffset: -3 });
    await evaluateMissedActivity(therapist.id);
    await evaluateMissedActivity(therapist.id);
    const items = await prisma.reviewItem.findMany({ where: { kind: 'MISSED_ACTIVITY' } });
    assert.equal(items.length, 1);
    assert.match(items[0].reasons[0], /^3 planned sessions in a row were not done/);
  });

  test('rest days never trigger the missed-activity rule', async () => {
    const { therapist, today } = await setup({ startOffset: -6 });
    const todayWeekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    // Only today's weekday is a training day: the past six days were all rest days.
    await prisma.planVersion.updateMany({ data: { trainingWeekdays: [todayWeekday] } });
    await evaluateMissedActivity(therapist.id);
    assert.equal(await prisma.reviewItem.count({ where: { kind: 'MISSED_ACTIVITY' } }), 0);
  });
});

describe('search, filters, pagination and authorization', () => {
  test('search by patient name, filter by kind, and paginate with a cursor', async () => {
    const { therapist } = await setup({ name: 'Zelda Searchable' });
    const second = await createUser('PATIENT', { name: 'Other Person' });
    await link(therapist.id, second.id);
    for (let index = 0; index < 25; index += 1) {
      await prisma.reviewItem.create({
        data: { therapistId: therapist.id, patientId: second.id, kind: 'FEEDBACK', sourceType: 'COMPLETION', sourceId: `fake-${index}`, dedupeKey: `test:${index}`, reasons: ['Pain 8/10'], firstEventAt: new Date(Date.now() - index * 60_000), lastEventAt: new Date(Date.now() - index * 60_000) },
      });
    }
    const page1 = await request(app).get('/therapist/review-items?limit=20').set(auth(therapist.id)).expect(200);
    assert.equal(page1.body.items.length, 20);
    const page2 = await request(app).get(`/therapist/review-items?limit=20&cursor=${page1.body.nextCursor}`).set(auth(therapist.id)).expect(200);
    assert.equal(page2.body.items.length, 5);
    assert.equal(page2.body.nextCursor, null);

    const none = await request(app).get('/therapist/review-items?q=Zelda').set(auth(therapist.id)).expect(200);
    assert.equal(none.body.items.length, 0);
    const byKind = await request(app).get('/therapist/review-items?kind=STOPPED').set(auth(therapist.id)).expect(200);
    assert.equal(byKind.body.items.length, 0);
    assert.equal(page1.body.countsByKind.FEEDBACK, 25);
  });

  test('items for patients whose care link ended are not shown', async () => {
    const { therapist, patient, taskId } = await setup();
    await request(app).post(`/patient/tasks/${taskId}/completion`).set(auth(patient.id)).send({ painLevel: 9 }).expect(201);
    await prisma.therapistPatient.updateMany({ data: { endedAt: new Date() } });
    assert.equal((await request(app).get('/therapist/review-items').set(auth(therapist.id)).expect(200)).body.items.length, 0);
  });
});
