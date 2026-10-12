import { createApp, createExercise, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { addDays, localDateKey, toDbDate } from '../src/lib/dates.js';

const app = createApp({ summaryModel: null });
const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

/** Therapist A with patient A (with plan + a flagged completion), therapist B with patient B. */
async function twoPractices() {
  const therapistA = await createUser('THERAPIST');
  const therapistB = await createUser('THERAPIST');
  const patientA = await createUser('PATIENT');
  const patientB = await createUser('PATIENT');
  await link(therapistA.id, patientA.id);
  await link(therapistB.id, patientB.id);
  const exerciseA = await createExercise(therapistA.id);
  const exerciseB = await createExercise(therapistB.id);
  const today = localDateKey(patientA.timezone);

  const planA = await prisma.rehabPlan.create({
    data: {
      patientId: patientA.id,
      therapistId: therapistA.id,
      title: 'A plan',
      condition: 'Knee',
      startDate: toDbDate(today),
      endDate: toDbDate(addDays(today, 7)),
      trainingWeekdays: [0, 1, 2, 3, 4, 5, 6],
      tasks: { create: [{ exerciseId: exerciseA.id, sets: 1, reps: 1, durationSeconds: 10, orderIndex: 0, activeFrom: toDbDate(today) }] },
    },
    include: { tasks: true },
  });
  const completionA = await prisma.taskCompletion.create({
    data: { taskId: planA.tasks[0].id, patientId: patientA.id, sessionDate: toDbDate(addDays(today, -1)), painLevel: 8, needsReview: true, prescribedSets: 1, prescribedReps: 1, prescribedDurationSecs: 10 },
  });

  return { therapistA, therapistB, patientA, patientB, exerciseA, exerciseB, planA, completionA, today };
}

describe('role-based access', () => {
  test('patients cannot use therapist endpoints and therapists cannot use patient endpoints', async () => {
    const { therapistA, patientA } = await twoPractices();

    const patientTries = await request(app).get('/therapist/patients').set(auth(patientA.id)).expect(403);
    assert.equal(patientTries.body.code, 'forbidden');
    await request(app).post('/therapist/exercises').set(auth(patientA.id)).send({}).expect(403);
    await request(app).get('/patient/overview').set(auth(therapistA.id)).expect(403);
    await request(app).get('/patient/overview').expect(401);
  });
});

describe('record-level access (changing ids in the URL)', () => {
  test('a therapist cannot read, plan for, or summarize another therapist’s patient', async () => {
    const { therapistB, patientA } = await twoPractices();

    await request(app).get(`/therapist/patients/${patientA.id}`).set(auth(therapistB.id)).expect(404);
    await request(app).post(`/therapist/patients/${patientA.id}/summary`).set(auth(therapistB.id)).send({ days: 7 }).expect(404);
    const exercise = await createExercise(therapistB.id, 'B exercise');
    const today = localDateKey(patientA.timezone);
    await request(app)
      .post(`/therapist/patients/${patientA.id}/plans`)
      .set(auth(therapistB.id))
      .send({ title: 'x', condition: 'x', startDate: today, endDate: today, trainingWeekdays: [1], tasks: [{ exerciseId: exercise.id, sets: 1, reps: 1, durationSeconds: 1 }] })
      .expect(404);
  });

  test('a therapist cannot view, edit or change status of another therapist’s plan', async () => {
    const { therapistB, planA, exerciseA } = await twoPractices();

    await request(app).get(`/therapist/plans/${planA.id}`).set(auth(therapistB.id)).expect(404);
    await request(app).patch(`/therapist/plans/${planA.id}/status`).set(auth(therapistB.id)).send({ status: 'PAUSED' }).expect(404);
    await request(app)
      .put(`/therapist/plans/${planA.id}`)
      .set(auth(therapistB.id))
      .send({ title: 'hijack', condition: 'x', endDate: '2030-01-01', trainingWeekdays: [1], tasks: [{ exerciseId: exerciseA.id, sets: 1, reps: 1, durationSeconds: 1 }] })
      .expect(404);

    const unchanged = await prisma.rehabPlan.findUniqueOrThrow({ where: { id: planA.id } });
    assert.equal(unchanged.title, 'A plan');
    assert.equal(unchanged.status, 'ACTIVE');
  });

  test('a therapist cannot review another therapist’s records or see them in the queue', async () => {
    const { therapistA, therapistB, completionA } = await twoPractices();

    await request(app).post(`/therapist/completions/${completionA.id}/review`).set(auth(therapistB.id)).expect(404);
    const queueB = await request(app).get('/therapist/reviews').set(auth(therapistB.id)).expect(200);
    assert.equal(queueB.body.reviews.length, 0);
    const queueA = await request(app).get('/therapist/reviews').set(auth(therapistA.id)).expect(200);
    assert.equal(queueA.body.reviews.length, 1);
    assert.equal((await prisma.taskCompletion.findUniqueOrThrow({ where: { id: completionA.id } })).reviewedAt, null);
  });

  test('a therapist cannot use, edit or delete another therapist’s exercises', async () => {
    const { therapistB, exerciseA, patientB } = await twoPractices();
    const today = localDateKey(patientB.timezone);

    await request(app).delete(`/therapist/exercises/${exerciseA.id}`).set(auth(therapistB.id)).expect(404);
    await request(app)
      .put(`/therapist/exercises/${exerciseA.id}`)
      .set(auth(therapistB.id))
      .send({ title: 'x', description: 'x', bodyPart: 'x', difficulty: 'EASY', sets: 1, reps: 1, durationSeconds: 1 })
      .expect(404);
    await request(app)
      .post(`/therapist/patients/${patientB.id}/plans`)
      .set(auth(therapistB.id))
      .send({ title: 'x', condition: 'x', startDate: today, endDate: today, trainingWeekdays: [0, 1, 2, 3, 4, 5, 6], tasks: [{ exerciseId: exerciseA.id, sets: 1, reps: 1, durationSeconds: 1 }] })
      .expect(400);
  });

  test('a patient cannot complete another patient’s task', async () => {
    const { patientB, planA } = await twoPractices();
    await request(app).post(`/patient/tasks/${planA.tasks[0].id}/completion`).set(auth(patientB.id)).send({ painLevel: 1 }).expect(404);
    assert.equal(await prisma.taskCompletion.count({ where: { patientId: patientB.id } }), 0);
  });

  test('losing the link removes access immediately', async () => {
    const { therapistA, patientA } = await twoPractices();
    await request(app).get(`/therapist/patients/${patientA.id}`).set(auth(therapistA.id)).expect(200);
    await prisma.therapistPatient.deleteMany({ where: { therapistId: therapistA.id, patientId: patientA.id } });
    await request(app).get(`/therapist/patients/${patientA.id}`).set(auth(therapistA.id)).expect(404);
  });
});

describe('linking requires patient consent (care code)', () => {
  test('email alone is not enough; email + care code links the patient', async () => {
    const { therapistB, patientA } = await twoPractices();

    await request(app).post('/therapist/patients/link').set(auth(therapistB.id)).send({ patientEmail: patientA.email }).expect(400);
    await request(app).post('/therapist/patients/link').set(auth(therapistB.id)).send({ patientEmail: patientA.email, careCode: '00000000' }).expect(404);
    await request(app).post('/therapist/patients/link').set(auth(therapistB.id)).send({ patientEmail: patientA.email, careCode: patientA.careCode!.toLowerCase() }).expect(201);
    await request(app).post('/therapist/patients/link').set(auth(therapistB.id)).send({ patientEmail: patientA.email, careCode: patientA.careCode }).expect(409);
  });
});

describe('messages', () => {
  test('only linked therapist–patient pairs can exchange messages', async () => {
    const { therapistA, therapistB, patientA } = await twoPractices();

    await request(app).post('/messages').set(auth(patientA.id)).send({ receiverId: therapistA.id, text: 'Hi' }).expect(201);
    await request(app).post('/messages').set(auth(patientA.id)).send({ receiverId: therapistB.id, text: 'Hi' }).expect(404);
    await request(app).get(`/messages/${patientA.id}`).set(auth(therapistB.id)).expect(404);
    const thread = await request(app).get(`/messages/${patientA.id}`).set(auth(therapistA.id)).expect(200);
    assert.equal(thread.body.messages.length, 1);
  });
});
