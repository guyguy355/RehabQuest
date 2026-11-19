import { createApp, createExercise, createPublishedPlan, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { addDays, localDateKey, toDbDate } from '../src/lib/dates.js';
import { completeTask } from '../src/services/plans.js';
import { SESSION_BONUS_XP, TASK_XP } from '../src/services/progress.js';

const app = createApp({ summaryModel: null });
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });

/** Therapist + linked patient + a plan published through the API. */
async function setup(taskCount = 2) {
  const therapist = await createUser('THERAPIST');
  const patient = await createUser('PATIENT');
  await link(therapist.id, patient.id);
  const exercises = [];
  for (let index = 0; index < taskCount; index += 1) exercises.push(await createExercise(therapist.id, `Exercise ${index + 1}`));
  const today = localDateKey(patient.timezone);

  const created = await request(app)
    .post(`/therapist/patients/${patient.id}/plans`)
    .set(auth(therapist.id))
    .send({
      title: 'Knee phase 1',
      condition: 'Knee',
      effectiveFrom: today,
      endDate: addDays(today, 13),
      trainingWeekdays: ALL_DAYS,
      therapistNotes: 'Go gently',
      items: exercises.map((exercise) => ({ exerciseId: exercise.id, sets: 2, reps: 8, holdSeconds: 5, restSeconds: 30, durationSeconds: 45, notes: 'Slowly' })),
      publish: true,
    })
    .expect(201);

  return { therapist, patient, exercises, plan: created.body.plan, today };
}

describe('therapist assigns a plan → patient completes → therapist reviews', () => {
  test('end-to-end workflow with persistence', async () => {
    const { therapist, patient, plan } = await setup(2);

    const overview = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(overview.body.status, 'training');
    assert.equal(overview.body.todayTasks.length, 2);
    assert.equal(overview.body.todayTasks[0].sets, 2);
    assert.equal(overview.body.todayTasks[0].holdSeconds, 5);
    assert.equal(overview.body.todayTasks[0].notes, 'Slowly');
    assert.equal(overview.body.todayVersionId, overview.body.plan.versionId);
    assert.equal(overview.body.xpTotal, 0);

    const [first, second] = plan.tasks;
    const one = await request(app)
      .post(`/patient/tasks/${first.id}/completion`)
      .set(auth(patient.id))
      .send({ status: 'COMPLETED', painLevel: 3, difficulty: 'JUST_RIGHT', notes: 'Felt fine', repsPerSet: [8, 8], activeSeconds: 95 })
      .expect(201);
    assert.equal(one.body.xpAwarded, TASK_XP.COMPLETED);
    assert.equal(one.body.sessionComplete, false);
    assert.equal(one.body.completion.activeSeconds, 95);
    assert.equal(one.body.completion.prescribed.holdSeconds, 5);

    const two = await request(app).post(`/patient/tasks/${second.id}/completion`).set(auth(patient.id)).send({ status: 'COMPLETED', painLevel: 8, difficulty: 'TOO_HARD' }).expect(201);
    assert.equal(two.body.xpAwarded, TASK_XP.COMPLETED + SESSION_BONUS_XP);
    assert.equal(two.body.sessionComplete, true);
    assert.deepEqual(two.body.newBadges.map((badge: { id: string }) => badge.id), ['first-session']);
    assert.equal(two.body.completion.needsReview, true);

    // "Refresh": a fresh request reads the persisted state.
    const refreshed = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(refreshed.body.xpTotal, 2 * TASK_XP.COMPLETED + SESSION_BONUS_XP);
    assert.equal(refreshed.body.streak, 1);
    assert.ok(refreshed.body.todayTasks.every((task: { completion: unknown }) => task.completion));

    const reviews = await request(app).get('/therapist/review-items').set(auth(therapist.id)).expect(200);
    assert.equal(reviews.body.items.length, 1);
    assert.deepEqual(reviews.body.items[0].reasons, ['Pain 8/10 is at or above the review threshold (7)', 'Reported as too hard']);
    assert.equal(reviews.body.items[0].completion.painLevel, 8);

    await request(app).post(`/therapist/review-items/${reviews.body.items[0].id}/resolve`).set(auth(therapist.id)).send({ note: 'Called the patient' }).expect(200);
    assert.equal((await request(app).get('/therapist/review-items').set(auth(therapist.id)).expect(200)).body.items.length, 0);
  });

  test('outcomes: stopped and skipped earn no task XP; partial earns half; a fully skipped day is not "done"', async () => {
    const { patient, plan } = await setup(3);
    const [a, b, c] = plan.tasks;
    const post = (taskId: string, body: object) => request(app).post(`/patient/tasks/${taskId}/completion`).set(auth(patient.id)).send(body);

    const stopped = await post(a.id, { status: 'STOPPED', painLevel: 6, reason: 'PAIN_OR_DISCOMFORT', notes: 'Sharp pain' }).expect(201);
    assert.equal(stopped.body.completion.xpAwarded, 0);
    assert.equal(stopped.body.completion.needsReview, true);

    const partial = await post(b.id, { status: 'PARTIAL', painLevel: 2, setsCompleted: 1 }).expect(201);
    assert.equal(partial.body.completion.xpAwarded, TASK_XP.PARTIAL);

    const skipped = await post(c.id, { status: 'SKIPPED', reason: 'NO_TIME' }).expect(201);
    assert.equal(skipped.body.completion.painLevel, null, 'missing pain stays missing');
    assert.equal(skipped.body.sessionComplete, true, 'every item has an outcome and some were performed');
    assert.equal(skipped.body.xpAwarded, SESSION_BONUS_XP);
  });

  test('a patient can open a session day and see what was recorded; nobody else can', async () => {
    const { therapist, patient, plan, today } = await setup(3);
    const [a, b] = plan.tasks;
    const post = (taskId: string, body: object) => request(app).post(`/patient/tasks/${taskId}/completion`).set(auth(patient.id)).send(body);
    await post(a.id, { status: 'COMPLETED', painLevel: 3, difficulty: 'JUST_RIGHT', notes: 'Felt fine', repsPerSet: [8, 8], activeSeconds: 95 }).expect(201);
    await post(b.id, { status: 'SKIPPED', reason: 'NO_TIME' }).expect(201);

    const day = await request(app).get(`/patient/sessions/${today}`).set(auth(patient.id)).expect(200);
    assert.equal(day.body.date, today);
    assert.equal(day.body.state, 'today', 'one exercise has no result yet');
    assert.equal(day.body.planTitle, 'Knee phase 1');
    assert.equal(day.body.xpEarned, TASK_XP.COMPLETED);
    assert.deepEqual(day.body.items.map((item: { title: string }) => item.title), ['Exercise 1', 'Exercise 2', 'Exercise 3']);
    assert.equal(day.body.items[0].completion.notes, 'Felt fine');
    assert.deepEqual(day.body.items[0].completion.repsPerSet, [8, 8]);
    assert.deepEqual(day.body.items[0].prescribed, { sets: 2, reps: 8, durationSeconds: 45, holdSeconds: 5, restSeconds: 30 });
    assert.equal(day.body.items[1].completion.status, 'SKIPPED');
    assert.equal(day.body.items[2].completion, null);

    // Another patient asking for the same date sees nothing of this patient's records.
    const other = await createUser('PATIENT');
    await request(app).get(`/patient/sessions/${today}`).set(auth(other.id)).expect(404);
    await request(app).get(`/patient/sessions/${today}`).set(auth(therapist.id)).expect(403);
    await request(app).get(`/patient/sessions/${today}`).expect(401);

    await request(app).get(`/patient/sessions/${addDays(today, 1)}`).set(auth(patient.id)).expect(404);
    await request(app).get(`/patient/sessions/${addDays(today, -1)}`).set(auth(patient.id)).expect(404);
    await request(app).get('/patient/sessions/not-a-date').set(auth(patient.id)).expect(400);
  });

  test('validates outcome input', async () => {
    const { patient, plan } = await setup(1);
    const url = `/patient/tasks/${plan.tasks[0].id}/completion`;
    await request(app).post(url).set(auth(patient.id)).send({ painLevel: 11 }).expect(400);
    await request(app).post(url).set(auth(patient.id)).send({ status: 'COMPLETED' }).expect(400); // pain required
    await request(app).post(url).set(auth(patient.id)).send({ status: 'PARTIAL', painLevel: 2 }).expect(400); // sets required
    await request(app).post(url).set(auth(patient.id)).send({ status: 'PARTIAL', painLevel: 2, setsCompleted: 2 }).expect(400); // all sets = completed
    await request(app).post(url).set(auth(patient.id)).send({ status: 'COMPLETED', painLevel: 2, reason: 'TIRED' }).expect(400);
    await request(app).post(url).set(auth(patient.id)).send({ status: 'EXTRA', painLevel: 2 }).expect(400);
    assert.equal(await prisma.taskCompletion.count(), 0);
  });
});

describe('duplicate completion and duplicate XP prevention', () => {
  test('repeating the same request does not create a second record or more XP', async () => {
    const { patient, plan } = await setup(2);
    const url = `/patient/tasks/${plan.tasks[0].id}/completion`;
    await request(app).post(url).set(auth(patient.id)).send({ painLevel: 2 }).expect(201);
    const repeat = await request(app).post(url).set(auth(patient.id)).send({ painLevel: 9 }).expect(200);
    assert.equal(repeat.body.alreadyRecorded, true);
    assert.equal(repeat.body.xpAwarded, 0);
    assert.equal(repeat.body.completion.painLevel, 2, 'first submission wins');
    assert.equal(await prisma.taskCompletion.count(), 1);
  });

  test('concurrent double-clicks on the same task award XP once', async () => {
    const { patient, plan } = await setup(2);
    const url = `/patient/tasks/${plan.tasks[0].id}/completion`;
    const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).post(url).set(auth(patient.id)).send({ painLevel: 2 })));
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 200, 200, 200, 200, 200, 200, 201]);
    assert.equal(await prisma.taskCompletion.count(), 1);
    assert.equal((await prisma.xpEvent.aggregate({ _sum: { amount: true } }))._sum.amount, TASK_XP.COMPLETED);
  });

  test('finishing the last two tasks at the same time awards the session bonus exactly once', async () => {
    const { patient, plan } = await setup(2);
    await Promise.all(plan.tasks.map((task: { id: string }) => request(app).post(`/patient/tasks/${task.id}/completion`).set(auth(patient.id)).send({ painLevel: 1 }).expect(201)));
    const events = await prisma.xpEvent.findMany({ where: { userId: patient.id } });
    assert.equal(events.filter((event) => event.reason === 'SESSION_COMPLETED').length, 1);
    assert.equal(events.reduce((sum, event) => sum + event.amount, 0), 2 * TASK_XP.COMPLETED + SESSION_BONUS_XP);
  });

  test('the database rejects a second completion for the same task and day', async () => {
    const { patient, plan, today } = await setup(1);
    const row = { taskId: plan.tasks[0].id, patientId: patient.id, sessionDate: toDbDate(today), painLevel: 1, prescribedSets: 1, prescribedReps: 1, prescribedDurationSecs: 1 };
    await prisma.taskCompletion.create({ data: row });
    await assert.rejects(prisma.taskCompletion.create({ data: row }), /Unique constraint/);
  });

  test('concurrent first reads of reminder settings do not fail (found by the browser test)', async () => {
    const patient = await createUser('PATIENT');
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).get('/patient/notification-preferences').set(auth(patient.id))));
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200, 200]);
  });
});

describe('offline replay binding (server side)', () => {
  async function pastPlan() {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT');
    await link(therapist.id, patient.id);
    const exercise = await createExercise(therapist.id);
    const today = localDateKey(patient.timezone);
    const { version, tasks } = await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [exercise], startDate: addDays(today, -5), endDate: addDays(today, 10) });
    return { therapist, patient, today, version, taskId: tasks[0].id };
  }

  test('a queued record for yesterday syncs once with its idempotency key', async () => {
    const { patient, today, version, taskId } = await pastPlan();
    const body = { status: 'COMPLETED', painLevel: 2, sessionDate: addDays(today, -1), planVersionId: version.id, idempotencyKey: 'offline-key-0001', occurredAt: new Date().toISOString(), offline: true };
    const first = await request(app).post(`/patient/tasks/${taskId}/completion`).set(auth(patient.id)).send(body).expect(201);
    assert.equal(first.body.completion.source, 'OFFLINE_SYNC');
    assert.equal(first.body.completion.sessionDate, addDays(today, -1));
    assert.ok(first.body.completion.occurredAt && first.body.completion.receivedAt);

    // Replay after a lost response: same key → same record, no XP.
    const replay = await request(app).post(`/patient/tasks/${taskId}/completion`).set(auth(patient.id)).send(body).expect(200);
    assert.equal(replay.body.alreadyRecorded, true);
    assert.equal(replay.body.completion.id, first.body.completion.id);
    assert.equal(await prisma.taskCompletion.count(), 1);
    assert.equal((await prisma.xpEvent.count({ where: { reason: 'TASK_COMPLETED' } })), 1);
  });

  test('a record made against an older plan version is rejected as a conflict, never re-attached', async () => {
    const { patient, today, taskId } = await pastPlan();
    const response = await request(app)
      .post(`/patient/tasks/${taskId}/completion`)
      .set(auth(patient.id))
      .send({ status: 'COMPLETED', painLevel: 2, sessionDate: today, planVersionId: 'some-old-version-id', idempotencyKey: 'offline-key-0002' })
      .expect(409);
    assert.equal(response.body.code, 'plan_version_changed');
    assert.ok(response.body.details.currentVersionId);
    assert.equal(await prisma.taskCompletion.count(), 0);
  });

  test('future, too-old and reused-key records are rejected', async () => {
    const { patient, today, version, taskId } = await pastPlan();
    const url = `/patient/tasks/${taskId}/completion`;
    assert.equal((await request(app).post(url).set(auth(patient.id)).send({ painLevel: 1, sessionDate: addDays(today, 1) }).expect(409)).body.code, 'occurrence_in_future');
    assert.equal((await request(app).post(url).set(auth(patient.id)).send({ painLevel: 1, sessionDate: addDays(today, -5) }).expect(409)).body.code, 'occurrence_too_old');
    await request(app).post(url).set(auth(patient.id)).send({ painLevel: 1, sessionDate: addDays(today, -1), planVersionId: version.id, idempotencyKey: 'offline-key-0003' }).expect(201);
    const reused = await request(app).post(url).set(auth(patient.id)).send({ painLevel: 1, sessionDate: addDays(today, -2), planVersionId: version.id, idempotencyKey: 'offline-key-0003' }).expect(409);
    assert.equal(reused.body.code, 'idempotency_key_conflict');
  });
});

describe('scheduling and timezones', () => {
  test('a task can only be completed on a scheduled day, and the day follows the patient timezone', async () => {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT', { timezone: 'Asia/Jerusalem' });
    await link(therapist.id, patient.id);
    const exercise = await createExercise(therapist.id);
    const { tasks } = await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [exercise], startDate: '2026-10-05', endDate: '2026-10-20', trainingWeekdays: [1] });
    const user = { id: patient.id, timezone: 'Asia/Jerusalem' };

    // 2026-10-11 21:30 UTC is already Monday 00:30 in Jerusalem → allowed, stored as Monday.
    const result = await completeTask(user, tasks[0].id, { status: 'COMPLETED', painLevel: 1 }, new Date('2026-10-11T21:30:00Z'));
    assert.equal(result.date, '2026-10-12');
    // 2026-10-13 is a Tuesday (rest day) → rejected.
    await assert.rejects(completeTask(user, tasks[0].id, { status: 'COMPLETED', painLevel: 1 }, new Date('2026-10-13T09:00:00Z')), /not scheduled/);
  });

  test('plan input is validated', async () => {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT');
    await link(therapist.id, patient.id);
    const exercise = await createExercise(therapist.id);
    const today = localDateKey(patient.timezone);
    const valid = { title: 'P', condition: 'Knee', effectiveFrom: today, endDate: addDays(today, 6), trainingWeekdays: [1, 3], items: [{ exerciseId: exercise.id, sets: 1, reps: 1, durationSeconds: 10 }] };
    const post = (body: object) => request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(body);

    await post({ ...valid, endDate: addDays(today, -1) }).expect(400);
    await post({ ...valid, effectiveFrom: addDays(today, -3) }).expect(400);
    await post({ ...valid, trainingWeekdays: [] }).expect(400);
    await post({ ...valid, items: [] }).expect(400);
    await post({ ...valid, items: [{ exerciseId: exercise.id, sets: 0, reps: 1, durationSeconds: 10 }] }).expect(400);
    await post({ ...valid, items: [{ exerciseId: exercise.id, sets: 1, reps: 1, durationSeconds: 10, holdSeconds: -1 }] }).expect(400);
    await post({ ...valid, restDates: [addDays(today, 30)] }).expect(400);
    await post({ ...valid, effectiveFrom: 'tomorrow' }).expect(400);
    assert.equal(await prisma.rehabPlan.count(), 0);
  });
});
