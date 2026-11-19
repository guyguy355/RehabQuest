import { createApp, createExercise, createPublishedPlan, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { config } from '../src/config.js';
import { addDays, localDateKey } from '../src/lib/dates.js';

const app = createApp({ summaryModel: null });
const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });
const previewDefault = config.exerciseDemoPreview;

beforeEach(resetDatabase);
afterEach(() => {
  config.exerciseDemoPreview = previewDefault;
});
after(() => prisma.$disconnect());

/** A patient whose session today has two exercises: one with a demonstration, one without. */
async function scenario() {
  const therapist = await createUser('THERAPIST');
  const patient = await createUser('PATIENT');
  await link(therapist.id, patient.id);
  const withDemo = await createExercise(therapist.id, 'Heel slides');
  const plain = await createExercise(therapist.id, 'Quad sets');
  await prisma.exercise.update({ where: { id: withDemo.id }, data: { demoType: 'PROCEDURAL', demoKey: 'heel-slides' } });
  const today = localDateKey(patient.timezone);
  await createPublishedPlan({
    therapistId: therapist.id,
    patientId: patient.id,
    exercises: [
      { id: withDemo.id, title: 'Heel slides' },
      { id: plain.id, title: 'Quad sets' },
    ],
    startDate: addDays(today, -1),
    endDate: addDays(today, 7),
  });
  const demos = async () => {
    const overview = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(overview.body.status, 'training');
    return overview.body.todayTasks.map((task: { exercise: { demo: unknown } }) => task.exercise.demo);
  };
  return { therapist, patient, withDemo, plain, demos };
}

describe('exercise demonstrations: review gate', () => {
  test('an unreviewed demonstration is hidden from the patient outside preview mode', async () => {
    const { demos } = await scenario();
    config.exerciseDemoPreview = false;
    assert.deepEqual(await demos(), [null, null]);
  });

  test('preview mode sends unreviewed demonstrations, marked as unreviewed', async () => {
    const { demos } = await scenario();
    config.exerciseDemoPreview = true;
    assert.deepEqual(await demos(), [{ type: 'PROCEDURAL', key: 'heel-slides', reviewStatus: 'UNREVIEWED', modelUrl: null, clipName: null }, null]);
  });

  test('an approved demonstration reaches the patient, also in a plan published before the approval', async () => {
    const { demos, withDemo } = await scenario();
    config.exerciseDemoPreview = false;
    await prisma.exercise.update({ where: { id: withDemo.id }, data: { demoReviewStatus: 'APPROVED' } });
    assert.deepEqual(await demos(), [{ type: 'PROCEDURAL', key: 'heel-slides', reviewStatus: 'APPROVED', modelUrl: null, clipName: null }, null]);
  });

  test('a rejected demonstration is never sent, and a GLB demonstration needs a model URL', async () => {
    const { demos, withDemo, plain } = await scenario();
    config.exerciseDemoPreview = true;
    await prisma.exercise.update({ where: { id: withDemo.id }, data: { demoReviewStatus: 'REJECTED' } });
    await prisma.exercise.update({ where: { id: plain.id }, data: { demoType: 'GLB', demoKey: 'quad-sets', demoReviewStatus: 'APPROVED' } });
    assert.deepEqual(await demos(), [null, null]);

    await prisma.exercise.update({ where: { id: plain.id }, data: { demoModelUrl: '/models/figure.glb', demoClipName: 'QuadSets' } });
    assert.deepEqual(await demos(), [null, { type: 'GLB', key: 'quad-sets', reviewStatus: 'APPROVED', modelUrl: '/models/figure.glb', clipName: 'QuadSets' }]);
  });
});

describe('exercise demonstrations: library', () => {
  test('importing the catalog entry attaches its demonstration, unreviewed; other entries get none', async () => {
    const therapist = await createUser('THERAPIST');
    await request(app).post('/therapist/exercise-catalog/import').set(auth(therapist.id)).send({ keys: ['knee-heel-slides', 'knee-quad-sets', 'core-abdominal-bracing'] }).expect(201);
    const rows = await prisma.exercise.findMany({ where: { createdById: therapist.id }, orderBy: { catalogKey: 'asc' }, select: { catalogKey: true, demoType: true, demoKey: true, demoReviewStatus: true } });
    assert.deepEqual(rows, [
      { catalogKey: 'core-abdominal-bracing', demoType: null, demoKey: null, demoReviewStatus: 'UNREVIEWED' },
      { catalogKey: 'knee-heel-slides', demoType: 'PROCEDURAL', demoKey: 'heel-slides', demoReviewStatus: 'UNREVIEWED' },
      { catalogKey: 'knee-quad-sets', demoType: 'PROCEDURAL', demoKey: 'knee-quad-sets', demoReviewStatus: 'UNREVIEWED' },
    ]);
  });

  test('changing the title or instructions of an exercise sends an approved demonstration back to review', async () => {
    const therapist = await createUser('THERAPIST');
    const exercise = await createExercise(therapist.id, 'Heel slides');
    await prisma.exercise.update({ where: { id: exercise.id }, data: { demoType: 'PROCEDURAL', demoKey: 'heel-slides', demoReviewStatus: 'APPROVED', instructions: 'Slide the heel.' } });
    const body = { title: 'Heel slides', description: 'Test exercise', instructions: 'Slide the heel.', bodyPart: 'Knee', difficulty: 'EASY', sets: 2, reps: 12, durationSeconds: 60 };
    const status = async () => (await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } })).demoReviewStatus;

    await request(app).put(`/therapist/exercises/${exercise.id}`).set(auth(therapist.id)).send(body).expect(200);
    assert.equal(await status(), 'APPROVED', 'changing sets/reps keeps the approval');

    await request(app).put(`/therapist/exercises/${exercise.id}`).set(auth(therapist.id)).send({ ...body, instructions: 'Lift the leg instead.' }).expect(200);
    assert.equal(await status(), 'UNREVIEWED');
  });
});
