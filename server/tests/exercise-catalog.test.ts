import { createApp, createUser, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { EXERCISE_CATALOG } from '../src/data/exercise-catalog.js';

const app = createApp({ summaryModel: null });
const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

describe('exercise catalog content', () => {
  test('keys are unique and every entry passes the library validation limits', () => {
    assert.equal(new Set(EXERCISE_CATALOG.map((exercise) => exercise.key)).size, EXERCISE_CATALOG.length);
    for (const exercise of EXERCISE_CATALOG) {
      assert.ok(exercise.title.length >= 1 && exercise.title.length <= 100, exercise.key);
      assert.ok(exercise.description.length >= 1 && exercise.description.length <= 500, exercise.key);
      assert.ok(exercise.instructions.length <= 2000 && exercise.safetyNotes.length <= 1000, exercise.key);
      assert.ok(exercise.bodyPart.length >= 1 && exercise.bodyPart.length <= 60, exercise.key);
      assert.ok(exercise.sets >= 1 && exercise.sets <= 20, exercise.key);
      assert.ok(exercise.reps >= 1 && exercise.reps <= 100, exercise.key);
      assert.ok(exercise.durationSeconds >= 1 && exercise.durationSeconds <= 3600, exercise.key);
    }
  });
});

describe('exercise catalog import', () => {
  test('copies chosen entries into the therapist library and marks them as added', async () => {
    const therapist = await createUser('THERAPIST');
    const [first, second] = EXERCISE_CATALOG;

    const imported = await request(app).post('/therapist/exercise-catalog/import').set(auth(therapist.id)).send({ keys: [first.key, second.key, first.key] }).expect(201);
    assert.deepEqual(imported.body, { added: 2, alreadyInLibrary: 0 });

    const library = await request(app).get('/therapist/exercises').set(auth(therapist.id)).expect(200);
    assert.deepEqual(library.body.exercises.map((exercise: { title: string }) => exercise.title).sort(), [first.title, second.title].sort());

    const catalog = await request(app).get('/therapist/exercise-catalog').set(auth(therapist.id)).expect(200);
    assert.equal(catalog.body.exercises.length, EXERCISE_CATALOG.length);
    const added = catalog.body.exercises.filter((exercise: { inLibrary: boolean }) => exercise.inLibrary).map((exercise: { key: string }) => exercise.key);
    assert.deepEqual(added.sort(), [first.key, second.key].sort());
  });

  test('importing again skips entries already in the library, even after editing them', async () => {
    const therapist = await createUser('THERAPIST');
    const [first, second] = EXERCISE_CATALOG;
    await request(app).post('/therapist/exercise-catalog/import').set(auth(therapist.id)).send({ keys: [first.key] }).expect(201);
    await prisma.exercise.updateMany({ where: { createdById: therapist.id }, data: { title: 'My renamed copy' } });

    const again = await request(app).post('/therapist/exercise-catalog/import').set(auth(therapist.id)).send({ keys: [first.key, second.key] }).expect(201);
    assert.deepEqual(again.body, { added: 1, alreadyInLibrary: 1 });
    assert.equal(await prisma.exercise.count({ where: { createdById: therapist.id } }), 2);
  });

  test('copies are private to each therapist', async () => {
    const dana = await createUser('THERAPIST');
    const omer = await createUser('THERAPIST');
    await request(app).post('/therapist/exercise-catalog/import').set(auth(dana.id)).send({ keys: [EXERCISE_CATALOG[0].key] }).expect(201);

    const catalog = await request(app).get('/therapist/exercise-catalog').set(auth(omer.id)).expect(200);
    assert.ok(catalog.body.exercises.every((exercise: { inLibrary: boolean }) => !exercise.inLibrary));
    const library = await request(app).get('/therapist/exercises').set(auth(omer.id)).expect(200);
    assert.equal(library.body.exercises.length, 0);
  });

  test('rejects unknown keys, empty selections and patients', async () => {
    const therapist = await createUser('THERAPIST');
    const patient = await createUser('PATIENT');
    await request(app).post('/therapist/exercise-catalog/import').set(auth(therapist.id)).send({ keys: ['not-a-real-exercise'] }).expect(400);
    await request(app).post('/therapist/exercise-catalog/import').set(auth(therapist.id)).send({ keys: [] }).expect(400);
    await request(app).get('/therapist/exercise-catalog').set(auth(patient.id)).expect(403);
    assert.equal(await prisma.exercise.count(), 0);
  });
});
