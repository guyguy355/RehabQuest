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

async function therapistWithDemo(status: 'UNREVIEWED' | 'APPROVED' | 'REJECTED' = 'UNREVIEWED') {
  const therapist = await createUser('THERAPIST');
  const exercise = await createExercise(therapist.id, 'Calf raises');
  await prisma.exercise.update({ where: { id: exercise.id }, data: { demoType: 'PROCEDURAL', demoKey: 'ankle-calf-raises', demoReviewStatus: status } });
  return { therapist, exercise };
}

describe('therapist view of demonstrations', () => {
  test('the library lists the demonstration whatever its review status, and none for plain exercises', async () => {
    const { therapist, exercise } = await therapistWithDemo('REJECTED');
    const plain = await createExercise(therapist.id, 'Quad sets');

    const response = await request(app).get('/therapist/exercises').set(auth(therapist.id)).expect(200);
    const byId = Object.fromEntries(response.body.exercises.map((row: { id: string; demo: unknown }) => [row.id, row.demo]));
    assert.deepEqual(byId[exercise.id], { type: 'PROCEDURAL', key: 'ankle-calf-raises', reviewStatus: 'REJECTED', modelUrl: null, clipName: null });
    assert.equal(byId[plain.id], null);
  });

  test('the starter catalog says which entries carry a demonstration', async () => {
    const therapist = await createUser('THERAPIST');
    const response = await request(app).get('/therapist/exercise-catalog').set(auth(therapist.id)).expect(200);
    const rows = response.body.exercises as { key: string; demo: { key: string; reviewStatus: string } | null }[];
    const heel = rows.find((row) => row.key === 'knee-heel-slides');
    assert.ok(heel?.demo, 'heel slides carries a demonstration');
    assert.equal(heel!.demo!.key, 'heel-slides');
    assert.equal(heel!.demo!.reviewStatus, 'UNREVIEWED');
    assert.ok(rows.filter((row) => row.demo).length >= 170, 'most of the catalog has a demonstration');
  });
});

describe('demonstration review', () => {
  test('approving makes the demonstration visible to patients even without preview mode; it is audited', async () => {
    const { therapist, exercise } = await therapistWithDemo();
    const patient = await createUser('PATIENT');
    await link(therapist.id, patient.id);
    const today = localDateKey(patient.timezone);
    await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [{ id: exercise.id, title: 'Calf raises' }], startDate: addDays(today, -1), endDate: addDays(today, 7) });

    config.exerciseDemoPreview = false;
    const before = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(JSON.stringify(before.body).includes('ankle-calf-raises'), false, 'unreviewed: hidden from the patient');

    const review = await request(app).patch(`/therapist/exercises/${exercise.id}/demo-review`).set(auth(therapist.id)).send({ status: 'APPROVED' }).expect(200);
    assert.equal(review.body.exercise.demo.reviewStatus, 'APPROVED');

    const after = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(JSON.stringify(after.body).includes('ankle-calf-raises'), true, 'approved: visible to the patient');

    const events = await prisma.auditEvent.findMany({ where: { action: 'DEMO_REVIEWED' } });
    assert.equal(events.length, 1);
    assert.equal(events[0].actorId, therapist.id);
    assert.deepEqual(events[0].metadata, { demoKey: 'ankle-calf-raises', from: 'UNREVIEWED', to: 'APPROVED' });
  });

  test('a rejected demonstration is hidden from patients even in preview mode', async () => {
    const { therapist, exercise } = await therapistWithDemo();
    const patient = await createUser('PATIENT');
    await link(therapist.id, patient.id);
    const today = localDateKey(patient.timezone);
    await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [{ id: exercise.id, title: 'Calf raises' }], startDate: addDays(today, -1), endDate: addDays(today, 7) });

    await request(app).patch(`/therapist/exercises/${exercise.id}/demo-review`).set(auth(therapist.id)).send({ status: 'REJECTED' }).expect(200);
    config.exerciseDemoPreview = true;
    const overview = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(JSON.stringify(overview.body).includes('ankle-calf-raises'), false);
  });

  test('only the owner can review, only exercises with a demonstration, only valid statuses', async () => {
    const { therapist, exercise } = await therapistWithDemo();
    const other = await createUser('THERAPIST');
    const plain = await createExercise(therapist.id, 'Quad sets');

    await request(app).patch(`/therapist/exercises/${exercise.id}/demo-review`).set(auth(other.id)).send({ status: 'APPROVED' }).expect(404);
    const noDemo = await request(app).patch(`/therapist/exercises/${plain.id}/demo-review`).set(auth(therapist.id)).send({ status: 'APPROVED' }).expect(409);
    assert.equal(noDemo.body.code, 'no_demo');
    await request(app).patch(`/therapist/exercises/${exercise.id}/demo-review`).set(auth(therapist.id)).send({ status: 'MAYBE' }).expect(400);

    const unchanged = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } });
    assert.equal(unchanged.demoReviewStatus, 'UNREVIEWED');
  });

  test('editing the title of an approved exercise sends its demonstration back for review', async () => {
    const { therapist, exercise } = await therapistWithDemo('APPROVED');
    const body = { title: 'Calf raises (slow)', description: 'Test exercise', instructions: '', safetyNotes: '', bodyPart: 'Ankle', difficulty: 'EASY', sets: 3, reps: 10, durationSeconds: 60, videoUrl: '', imageUrl: '', mediaAlt: '' };
    const response = await request(app).put(`/therapist/exercises/${exercise.id}`).set(auth(therapist.id)).send(body).expect(200);
    assert.equal(response.body.exercise.demo.reviewStatus, 'UNREVIEWED');
  });
});
