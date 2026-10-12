import { createApp, createExercise, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

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
      startDate: today,
      endDate: addDays(today, 13),
      trainingWeekdays: ALL_DAYS,
      therapistNotes: 'Go gently',
      tasks: exercises.map((exercise) => ({ exerciseId: exercise.id, sets: 2, reps: 8, durationSeconds: 45, notes: 'Slowly' })),
    })
    .expect(201);

  return { therapist, patient, exercises, plan: created.body.plan, today };
}

describe('therapist assigns a plan → patient completes → therapist reviews', () => {
  test('end-to-end workflow with persistence', async () => {
    const { therapist, patient, plan } = await setup(2);

    // Patient sees today's tasks with therapist-defined parameters.
    const overview = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(overview.body.status, 'training');
    assert.equal(overview.body.todayTasks.length, 2);
    assert.equal(overview.body.todayTasks[0].sets, 2);
    assert.equal(overview.body.todayTasks[0].notes, 'Slowly');
    assert.equal(overview.body.xpTotal, 0);

    // Complete the first task with feedback.
    const [first, second] = plan.tasks;
    const one = await request(app)
      .post(`/patient/tasks/${first.id}/completion`)
      .set(auth(patient.id))
      .send({ status: 'COMPLETED', painLevel: 3, difficulty: 'JUST_RIGHT', notes: 'Felt fine' })
      .expect(201);
    assert.equal(one.body.xpAwarded, TASK_XP);
    assert.equal(one.body.sessionComplete, false);

    // Second task finishes the session: task XP + one session bonus + first badge.
    const two = await request(app)
      .post(`/patient/tasks/${second.id}/completion`)
      .set(auth(patient.id))
      .send({ status: 'COMPLETED', painLevel: 8, difficulty: 'TOO_HARD' })
      .expect(201);
    assert.equal(two.body.xpAwarded, TASK_XP + SESSION_BONUS_XP);
    assert.equal(two.body.sessionComplete, true);
    assert.deepEqual(two.body.newBadges.map((badge: { id: string }) => badge.id), ['first-session']);
    assert.equal(two.body.completion.needsReview, true);

    // "Refresh": a fresh request reads the persisted state.
    const refreshed = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(refreshed.body.xpTotal, 2 * TASK_XP + SESSION_BONUS_XP);
    assert.equal(refreshed.body.streak, 1);
    assert.ok(refreshed.body.todayTasks.every((task: { completion: unknown }) => task.completion));
    const progress = await request(app).get('/patient/progress').set(auth(patient.id)).expect(200);
    assert.equal(progress.body.history.length, 2);
    assert.ok(progress.body.badges.find((badge: { id: string; earnedAt: string | null }) => badge.id === 'first-session').earnedAt);

    // Therapist sees the flagged record, reviews it, and it leaves the queue.
    const reviews = await request(app).get('/therapist/reviews').set(auth(therapist.id)).expect(200);
    assert.equal(reviews.body.reviews.length, 1);
    assert.deepEqual(reviews.body.reviews[0].reviewReasons, ['High pain reported (8/10)', 'Reported as too hard']);

    const detail = await request(app).get(`/therapist/patients/${patient.id}`).set(auth(therapist.id)).expect(200);
    assert.equal(detail.body.completions.length, 2);
    assert.equal(detail.body.snapshot.todayState, 'done');

    await request(app).post(`/therapist/completions/${reviews.body.reviews[0].id}/review`).set(auth(therapist.id)).expect(200);
    const after = await request(app).get('/therapist/reviews').set(auth(therapist.id)).expect(200);
    assert.equal(after.body.reviews.length, 0);
  });

  test('stopping for symptoms earns no task XP, is flagged, and still finishes the session', async () => {
    const { patient, plan } = await setup(1);
    const response = await request(app)
      .post(`/patient/tasks/${plan.tasks[0].id}/completion`)
      .set(auth(patient.id))
      .send({ status: 'STOPPED', painLevel: 6, notes: 'Sharp pain' })
      .expect(201);

    assert.equal(response.body.completion.status, 'STOPPED');
    assert.equal(response.body.completion.needsReview, true);
    assert.equal(response.body.completion.xpAwarded, 0);
    assert.equal(response.body.sessionComplete, true);
    assert.equal(response.body.xpAwarded, SESSION_BONUS_XP, 'only the session bonus, no reward for pushing through');
  });

  test('validates completion input', async () => {
    const { patient, plan } = await setup(1);
    await request(app).post(`/patient/tasks/${plan.tasks[0].id}/completion`).set(auth(patient.id)).send({ painLevel: 11 }).expect(400);
    await request(app).post(`/patient/tasks/${plan.tasks[0].id}/completion`).set(auth(patient.id)).send({ painLevel: 2, status: 'EXTRA' }).expect(400);
    await request(app).post(`/patient/tasks/${plan.tasks[0].id}/completion`).set(auth(patient.id)).send({}).expect(400);
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
    assert.equal(repeat.body.xpTotal, TASK_XP);
  });

  test('concurrent double-clicks on the same task award XP once', async () => {
    const { patient, plan } = await setup(2);
    const url = `/patient/tasks/${plan.tasks[0].id}/completion`;

    const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).post(url).set(auth(patient.id)).send({ painLevel: 2 })));

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 200, 200, 200, 200, 200, 200, 201]);
    assert.equal(await prisma.taskCompletion.count(), 1);
    const xp = await prisma.xpEvent.aggregate({ _sum: { amount: true } });
    assert.equal(xp._sum.amount, TASK_XP);
  });

  test('finishing the last two tasks at the same time awards the session bonus exactly once', async () => {
    const { patient, plan } = await setup(2);

    await Promise.all(
      plan.tasks.map((task: { id: string }) => request(app).post(`/patient/tasks/${task.id}/completion`).set(auth(patient.id)).send({ painLevel: 1 }).expect(201)),
    );

    const events = await prisma.xpEvent.findMany({ where: { userId: patient.id } });
    assert.equal(events.filter((event) => event.reason === 'SESSION_COMPLETED').length, 1);
    assert.equal(events.reduce((sum, event) => sum + event.amount, 0), 2 * TASK_XP + SESSION_BONUS_XP);
    assert.equal(await prisma.userBadge.count({ where: { userId: patient.id } }), 1);
  });

  test('concurrent first reads of reminder settings do not fail (found by the browser test)', async () => {
    const patient = await createUser('PATIENT');
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).get('/patient/notification-preferences').set(auth(patient.id))));
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200, 200]);
    assert.equal(await prisma.patientNotificationPreference.count({ where: { userId: patient.id } }), 1);
  });

  test('the database rejects a second completion for the same task and day', async () => {
    const { patient, plan, today } = await setup(1);
    const row = { taskId: plan.tasks[0].id, patientId: patient.id, sessionDate: toDbDate(today), painLevel: 1, prescribedSets: 1, prescribedReps: 1, prescribedDurationSecs: 1 };
    await prisma.taskCompletion.create({ data: row });
    await assert.rejects(prisma.taskCompletion.create({ data: row }), /Unique constraint/);
  });
});

describe('scheduling and timezones', () => {
  test('a task can only be completed on a scheduled day, and the day follows the patient timezone', async () => {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT', { timezone: 'Asia/Jerusalem' });
    await link(therapist.id, patient.id);
    const exercise = await createExercise(therapist.id);
    // Plan on Monday 2026-10-12 only.
    const plan = await prisma.rehabPlan.create({
      data: {
        patientId: patient.id,
        therapistId: therapist.id,
        title: 'Tz plan',
        condition: 'Knee',
        startDate: toDbDate('2026-10-05'),
        endDate: toDbDate('2026-10-20'),
        trainingWeekdays: [1],
        tasks: { create: [{ exerciseId: exercise.id, sets: 1, reps: 1, durationSeconds: 10, orderIndex: 0, activeFrom: toDbDate('2026-10-05') }] },
      },
      include: { tasks: true },
    });
    const taskId = plan.tasks[0].id;
    const user = { id: patient.id, timezone: 'Asia/Jerusalem' };

    // 2026-10-11 21:30 UTC is already Monday 00:30 in Jerusalem → allowed, stored as Monday.
    const result = await completeTask(user, taskId, { status: 'COMPLETED', painLevel: 1 }, new Date('2026-10-11T21:30:00Z'));
    assert.equal(result.today, '2026-10-12');

    // 2026-10-13 is a Tuesday (rest day) → rejected.
    await assert.rejects(completeTask(user, taskId, { status: 'COMPLETED', painLevel: 1 }, new Date('2026-10-13T09:00:00Z')), /not scheduled/);
  });

  test('only one active plan per patient, even under concurrent requests', async () => {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT');
    await link(therapist.id, patient.id);
    const exercise = await createExercise(therapist.id);
    const today = localDateKey(patient.timezone);
    const body = { title: 'P', condition: 'Knee', startDate: today, endDate: addDays(today, 6), trainingWeekdays: ALL_DAYS, tasks: [{ exerciseId: exercise.id, sets: 1, reps: 1, durationSeconds: 10 }] };

    const responses = await Promise.all([1, 2, 3].map(() => request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(body)));
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409, 409]);
  });

  test('editing a plan keeps history: removed tasks stay on past days, new ones start today', async () => {
    const { therapist, patient, plan, exercises } = await setup(2);
    await request(app).post(`/patient/tasks/${plan.tasks[0].id}/completion`).set(auth(patient.id)).send({ painLevel: 1 }).expect(201);
    const extra = await createExercise(therapist.id, 'Added later');

    const updated = await request(app)
      .put(`/therapist/plans/${plan.id}`)
      .set(auth(therapist.id))
      .send({
        title: 'Knee phase 1 (updated)',
        condition: 'Knee',
        endDate: plan.endDate,
        trainingWeekdays: ALL_DAYS,
        tasks: [
          { id: plan.tasks[1].id, exerciseId: exercises[1].id, sets: 3, reps: 10, durationSeconds: 45 },
          { exerciseId: extra.id, sets: 1, reps: 5, durationSeconds: 30 },
        ],
      })
      .expect(200);

    assert.deepEqual(updated.body.plan.tasks.map((task: { exercise: { title: string } }) => task.exercise.title), ['Exercise 2', 'Added later']);
    // The completed task is kept (not deleted) so the record and its history survive.
    assert.equal(await prisma.taskCompletion.count(), 1);
    assert.ok(await prisma.rehabTask.findUnique({ where: { id: plan.tasks[0].id } }));
  });

  test('plan input is validated', async () => {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT');
    await link(therapist.id, patient.id);
    const exercise = await createExercise(therapist.id);
    const today = localDateKey(patient.timezone);
    const valid = { title: 'P', condition: 'Knee', startDate: today, endDate: addDays(today, 6), trainingWeekdays: [1, 3], tasks: [{ exerciseId: exercise.id, sets: 1, reps: 1, durationSeconds: 10 }] };
    const post = (body: object) => request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(body);

    await post({ ...valid, endDate: addDays(today, -1) }).expect(400);
    await post({ ...valid, startDate: addDays(today, -3) }).expect(400);
    await post({ ...valid, trainingWeekdays: [] }).expect(400);
    await post({ ...valid, tasks: [] }).expect(400);
    await post({ ...valid, tasks: [{ exerciseId: exercise.id, sets: 0, reps: 1, durationSeconds: 10 }] }).expect(400);
    await post({ ...valid, startDate: 'tomorrow' }).expect(400);
    assert.equal(await prisma.rehabPlan.count(), 0);
  });
});
