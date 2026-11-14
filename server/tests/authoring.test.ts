import { createApp, createExercise, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { addDays, localDateKey, toDbDate } from '../src/lib/dates.js';

const app = createApp({ summaryModel: null });
const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function practice() {
  const therapist = await createUser('THERAPIST');
  const patient = await createUser('PATIENT');
  await link(therapist.id, patient.id);
  const heel = await createExercise(therapist.id, 'Heel slides');
  const quad = await createExercise(therapist.id, 'Quad sets');
  const today = localDateKey(patient.timezone);
  return { therapist, patient, heel, quad, today };
}

function draftBody(today: string, exercises: { id: string }[], overrides: object = {}) {
  return {
    title: 'Knee plan',
    condition: 'Knee',
    effectiveFrom: today,
    endDate: addDays(today, 27),
    trainingWeekdays: ALL_DAYS,
    items: exercises.map((exercise) => ({ exerciseId: exercise.id, sets: 2, reps: 10, durationSeconds: 30 })),
    ...overrides,
  };
}

describe('templates', () => {
  test('editing a template does not change a plan created from it', async () => {
    const { therapist, patient, heel, quad, today } = await practice();
    const created = await request(app)
      .post('/therapist/templates')
      .set(auth(therapist.id))
      .send({ title: 'Knee basics', condition: 'Knee', trainingWeekdays: [1, 3, 5], durationWeeks: 4, items: [{ exerciseId: heel.id, sets: 2, reps: 10, holdSeconds: 5, durationSeconds: 30 }] })
      .expect(201);
    const template = created.body.template;

    const plan = await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ templateId: template.id, startDate: today }).expect(201);
    assert.equal(plan.body.draft.items[0].holdSeconds, 5);
    assert.equal(plan.body.draft.endDate, addDays(today, 27));

    // Edit the template: different sets, extra exercise.
    await request(app)
      .put(`/therapist/templates/${template.id}`)
      .set(auth(therapist.id))
      .send({ lockVersion: template.lockVersion, title: 'Knee basics v2', condition: 'Knee', trainingWeekdays: [1], durationWeeks: 2, items: [{ exerciseId: heel.id, sets: 5, reps: 5, durationSeconds: 30 }, { exerciseId: quad.id, sets: 1, reps: 1, durationSeconds: 10 }] })
      .expect(200);

    const draft = await request(app).get(`/therapist/plan-versions/${plan.body.draft.id}`).set(auth(therapist.id)).expect(200);
    assert.equal(draft.body.version.items.length, 1);
    assert.equal(draft.body.version.items[0].sets, 2);
    assert.deepEqual(draft.body.version.trainingWeekdays, [1, 3, 5]);
  });

  test('a stale template editor gets a recoverable conflict', async () => {
    const { therapist, heel } = await practice();
    const body = { title: 'T', condition: 'Knee', trainingWeekdays: [1], durationWeeks: 2, items: [{ exerciseId: heel.id, sets: 1, reps: 1, durationSeconds: 10 }] };
    const template = (await request(app).post('/therapist/templates').set(auth(therapist.id)).send(body).expect(201)).body.template;
    await request(app).put(`/therapist/templates/${template.id}`).set(auth(therapist.id)).send({ ...body, lockVersion: template.lockVersion, title: 'Tab A' }).expect(200);
    const stale = await request(app).put(`/therapist/templates/${template.id}`).set(auth(therapist.id)).send({ ...body, lockVersion: template.lockVersion, title: 'Tab B' }).expect(409);
    assert.equal(stale.body.code, 'stale_template');
    assert.equal((await prisma.programTemplate.findUniqueOrThrow({ where: { id: template.id } })).title, 'Tab A');
  });

  test('archived templates cannot be used until restored; other therapists get 404', async () => {
    const { therapist, patient, heel, today } = await practice();
    const other = await createUser('THERAPIST');
    const template = (await request(app).post('/therapist/templates').set(auth(therapist.id)).send({ title: 'T', condition: 'Knee', trainingWeekdays: [1], durationWeeks: 2, items: [{ exerciseId: heel.id, sets: 1, reps: 1, durationSeconds: 10 }] }).expect(201)).body.template;
    await request(app).get(`/therapist/templates/${template.id}`).set(auth(other.id)).expect(404);
    await request(app).post(`/therapist/templates/${template.id}/archive`).set(auth(therapist.id)).expect(200);
    assert.equal((await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ templateId: template.id, startDate: today }).expect(409)).body.code, 'template_archived');
    await request(app).post(`/therapist/templates/${template.id}/restore`).set(auth(therapist.id)).expect(200);
    await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ templateId: template.id, startDate: today }).expect(201);
  });
});

describe('drafts, preview and publication', () => {
  test('a draft is invisible to the patient until published; preview shows the patient view', async () => {
    const { therapist, patient, heel, today } = await practice();
    const created = await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(draftBody(today, [heel])).expect(201);
    const draft = created.body.draft;
    assert.equal(draft.status, 'DRAFT');

    assert.equal((await request(app).get('/patient/overview').set(auth(patient.id)).expect(200)).body.status, 'no-plan');

    const preview = await request(app).get(`/therapist/plan-versions/${draft.id}/preview`).set(auth(therapist.id)).expect(200);
    assert.equal(preview.body.preview.firstSessionDate, today);
    assert.equal(preview.body.preview.sessionItems[0].exercise.title, 'Heel slides');
    assert.equal(preview.body.preview.isRevision, false);

    await request(app).post(`/therapist/plan-versions/${draft.id}/publish`).set(auth(therapist.id)).send({ lockVersion: draft.lockVersion }).expect(200);
    const overview = await request(app).get('/patient/overview').set(auth(patient.id)).expect(200);
    assert.equal(overview.body.status, 'training');
    assert.equal(overview.body.plan.versionNumber, 1);
    assert.equal((await prisma.auditEvent.count({ where: { action: 'PLAN_PUBLISHED' } })), 1);
  });

  test('a stale draft editor receives a recoverable 409 and nothing is overwritten', async () => {
    const { therapist, patient, heel, quad, today } = await practice();
    const draft = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(draftBody(today, [heel])).expect(201)).body.draft;

    const tabA = await request(app).put(`/therapist/plan-versions/${draft.id}`).set(auth(therapist.id)).send({ ...draftBody(today, [heel, quad]), lockVersion: draft.lockVersion }).expect(200);
    assert.equal(tabA.body.version.lockVersion, draft.lockVersion + 1);

    const tabB = await request(app).put(`/therapist/plan-versions/${draft.id}`).set(auth(therapist.id)).send({ ...draftBody(today, [heel], { title: 'Overwrite?' }), lockVersion: draft.lockVersion }).expect(409);
    assert.equal(tabB.body.code, 'stale_draft');
    assert.match(tabB.body.message, /Reload/);

    const current = await request(app).get(`/therapist/plan-versions/${draft.id}`).set(auth(therapist.id)).expect(200);
    assert.equal(current.body.version.items.length, 2);
    // Publishing with the stale lockVersion is also refused.
    assert.equal((await request(app).post(`/therapist/plan-versions/${draft.id}/publish`).set(auth(therapist.id)).send({ lockVersion: draft.lockVersion }).expect(409)).body.code, 'stale_draft');
    await request(app).post(`/therapist/plan-versions/${draft.id}/publish`).set(auth(therapist.id)).send({ lockVersion: current.body.version.lockVersion }).expect(200);
  });

  test('published versions are immutable', async () => {
    const { therapist, patient, heel, today } = await practice();
    const created = await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ ...draftBody(today, [heel]), publish: true }).expect(201);
    const version = created.body.draft;
    assert.equal(version.status, 'PUBLISHED');
    const response = await request(app).put(`/therapist/plan-versions/${version.id}`).set(auth(therapist.id)).send({ ...draftBody(today, [heel], { title: 'Changed' }), lockVersion: version.lockVersion }).expect(409);
    assert.equal(response.body.code, 'not_draft');
  });

  test('two concurrent publications for the same patient leave exactly one active plan', async () => {
    const { therapist, patient, heel, today } = await practice();
    const a = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(draftBody(today, [heel], { title: 'A' })).expect(201)).body.draft;
    const b = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(draftBody(today, [heel], { title: 'B' })).expect(201)).body.draft;

    const results = await Promise.all([
      request(app).post(`/therapist/plan-versions/${a.id}/publish`).set(auth(therapist.id)).send({ lockVersion: a.lockVersion }),
      request(app).post(`/therapist/plan-versions/${b.id}/publish`).set(auth(therapist.id)).send({ lockVersion: b.lockVersion }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(results.find((result) => result.status === 409)!.body.code, 'active_plan_exists');
    assert.equal(await prisma.rehabPlan.count({ where: { patientId: patient.id, status: 'ACTIVE' } }), 1);
  });

  test('publishing the same draft twice at once creates one version', async () => {
    const { therapist, patient, heel, today } = await practice();
    const draft = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(draftBody(today, [heel])).expect(201)).body.draft;
    const results = await Promise.all([1, 2, 3].map(() => request(app).post(`/therapist/plan-versions/${draft.id}/publish`).set(auth(therapist.id)).send({ lockVersion: draft.lockVersion })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409, 409]);
    assert.equal(await prisma.planVersion.count({ where: { status: 'PUBLISHED' } }), 1);
  });

  test('only one draft per plan; reopening returns the existing draft', async () => {
    const { therapist, patient, heel, today } = await practice();
    const plan = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ ...draftBody(today, [heel]), publish: true }).expect(201)).body.plan;
    const results = await Promise.all([1, 2].map(() => request(app).post(`/therapist/plans/${plan.id}/drafts`).set(auth(therapist.id))));
    const ok = results.filter((result) => result.status === 201);
    assert.ok(ok.length >= 1);
    assert.ok(results.every((result) => result.status === 201 || result.body.code === 'draft_exists'));
    assert.equal(await prisma.planVersion.count({ where: { planId: plan.id, status: 'DRAFT' } }), 1);
  });
});

describe('revisions keep history stable', () => {
  test('publishing a revision does not rewrite earlier completions or adherence', async () => {
    const { therapist, patient, heel, quad, today } = await practice();
    // v1 started 3 days ago (created directly so the start can be in the past).
    const { createPublishedPlan } = await import('./helpers/setup.js');
    const { plan, tasks } = await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [{ id: heel.id, title: 'Heel slides' }], startDate: addDays(today, -3), endDate: addDays(today, 20) });
    const yesterday = await prisma.taskCompletion.create({
      data: { taskId: tasks[0].id, patientId: patient.id, sessionDate: toDbDate(addDays(today, -1)), painLevel: 2, planVersionItemId: tasks[0].versionItemId, prescribedSets: 2, prescribedReps: 10, prescribedDurationSecs: 30 },
    });
    const before = await request(app).get(`/therapist/patients/${patient.id}`).set(auth(therapist.id)).expect(200);
    const pastBefore = before.body.snapshot.days.filter((entry: { date: string }) => entry.date < today);

    // Revision: heel slides now 4 × 5, quad sets added, only Mondays.
    const draft = (await request(app).post(`/therapist/plans/${plan.id}/drafts`).set(auth(therapist.id)).expect(201)).body.draft;
    assert.equal(draft.effectiveFrom, today);
    assert.equal(draft.items[0].taskId, tasks[0].id, 'existing exercises keep their slot');
    await request(app)
      .put(`/therapist/plan-versions/${draft.id}`)
      .set(auth(therapist.id))
      .send({
        lockVersion: draft.lockVersion,
        title: 'Knee plan (revised)',
        condition: 'Knee',
        effectiveFrom: today,
        endDate: addDays(today, 20),
        trainingWeekdays: [1],
        changeNote: 'Progressed after review',
        items: [
          { taskId: tasks[0].id, exerciseId: heel.id, sets: 4, reps: 5, durationSeconds: 30 },
          { exerciseId: quad.id, sets: 2, reps: 8, durationSeconds: 20 },
        ],
      })
      .expect(200);
    const preview = await request(app).get(`/therapist/plan-versions/${draft.id}/preview`).set(auth(therapist.id)).expect(200);
    assert.deepEqual(preview.body.preview.changes, { added: ['Quad sets'], removed: [], changed: ['Heel slides'] });
    const latest = await request(app).get(`/therapist/plan-versions/${draft.id}`).set(auth(therapist.id)).expect(200);
    await request(app).post(`/therapist/plan-versions/${draft.id}/publish`).set(auth(therapist.id)).send({ lockVersion: latest.body.version.lockVersion }).expect(200);

    // The old completion still points at the v1 item with the old parameters.
    const kept = await prisma.taskCompletion.findUniqueOrThrow({ where: { id: yesterday.id }, include: { versionItem: { include: { version: true } } } });
    assert.equal(kept.versionItem?.version.number, 1);
    assert.equal(kept.versionItem?.sets, 2);

    const after = await request(app).get(`/therapist/patients/${patient.id}`).set(auth(therapist.id)).expect(200);
    const pastAfter = after.body.snapshot.days.filter((entry: { date: string }) => entry.date < today);
    assert.deepEqual(pastAfter, pastBefore, 'past days, states and denominators are unchanged');

    const versions = await request(app).get(`/therapist/plans/${plan.id}/versions`).set(auth(therapist.id)).expect(200);
    assert.deepEqual(versions.body.versions.map((version: { number: number }) => version.number), [2, 1]);
  });

  test('a revision cannot take effect in the past', async () => {
    const { therapist, patient, heel, today } = await practice();
    const plan = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ ...draftBody(today, [heel]), publish: true }).expect(201)).body.plan;
    const draft = (await request(app).post(`/therapist/plans/${plan.id}/drafts`).set(auth(therapist.id)).expect(201)).body.draft;
    // Saving a past date in a draft is allowed for editing, but publishing it is not.
    await prisma.planVersion.update({ where: { id: draft.id }, data: { effectiveFrom: toDbDate(addDays(today, -2)) } });
    const response = await request(app).post(`/therapist/plan-versions/${draft.id}/publish`).set(auth(therapist.id)).send({ lockVersion: draft.lockVersion }).expect(400);
    assert.match(response.body.message, /past/);
  });
});

describe('pauses and plan status', () => {
  test('pausing records a pause; completions are refused; resuming does not turn paused days into missed days', async () => {
    const { therapist, patient, heel, today } = await practice();
    const plan = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ ...draftBody(today, [heel]), publish: true }).expect(201)).body.plan;

    const paused = await request(app).patch(`/therapist/plans/${plan.id}/status`).set(auth(therapist.id)).send({ status: 'PAUSED', expectedRevision: plan.revision, reason: 'Travel' }).expect(200);
    assert.equal((await prisma.planPause.findFirstOrThrow({ where: { planId: plan.id } })).endDate, null);
    assert.equal((await request(app).get('/patient/overview').set(auth(patient.id)).expect(200)).body.status, 'paused');
    await request(app).post(`/patient/tasks/${plan.tasks[0].id}/completion`).set(auth(patient.id)).send({ painLevel: 1 }).expect(409);

    // A stale status change is refused.
    assert.equal((await request(app).patch(`/therapist/plans/${plan.id}/status`).set(auth(therapist.id)).send({ status: 'COMPLETED', expectedRevision: plan.revision }).expect(409)).body.code, 'stale_plan');

    // Resuming the same day removes the zero-length pause.
    await request(app).patch(`/therapist/plans/${plan.id}/status`).set(auth(therapist.id)).send({ status: 'ACTIVE', expectedRevision: paused.body.plan.revision }).expect(200);
    assert.equal(await prisma.planPause.count({ where: { planId: plan.id } }), 0);
    assert.equal((await request(app).get('/patient/overview').set(auth(patient.id)).expect(200)).body.status, 'training');
  });

  test('invalid transitions are refused', async () => {
    const { therapist, patient, heel, today } = await practice();
    const plan = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ ...draftBody(today, [heel]), publish: true }).expect(201)).body.plan;
    await request(app).patch(`/therapist/plans/${plan.id}/status`).set(auth(therapist.id)).send({ status: 'COMPLETED' }).expect(200);
    assert.equal((await request(app).patch(`/therapist/plans/${plan.id}/status`).set(auth(therapist.id)).send({ status: 'ACTIVE' }).expect(409)).body.code, 'invalid_transition');
    assert.equal((await request(app).post(`/therapist/plans/${plan.id}/drafts`).set(auth(therapist.id)).expect(409)).body.code, 'plan_closed');
  });
});

describe('authorization', () => {
  test('another therapist cannot read, edit, preview or publish a draft', async () => {
    const { therapist, patient, heel, today } = await practice();
    const other = await createUser('THERAPIST');
    const draft = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send(draftBody(today, [heel])).expect(201)).body.draft;
    await request(app).get(`/therapist/plan-versions/${draft.id}`).set(auth(other.id)).expect(404);
    await request(app).get(`/therapist/plan-versions/${draft.id}/preview`).set(auth(other.id)).expect(404);
    await request(app).put(`/therapist/plan-versions/${draft.id}`).set(auth(other.id)).send({ ...draftBody(today, [heel]), lockVersion: 1 }).expect(404);
    await request(app).post(`/therapist/plan-versions/${draft.id}/publish`).set(auth(other.id)).send({ lockVersion: 1 }).expect(404);
    await request(app).get(`/therapist/plans/${draft.planId}/versions`).set(auth(other.id)).expect(404);
    await request(app).get(`/therapist/plan-versions/${draft.id}`).set(auth(patient.id)).expect(403);
  });
});

describe('deletion', () => {
  test('deleting a patient account removes plans, versions, items and records together (regression)', async () => {
    const { therapist, patient, heel, today } = await practice();
    const plan = (await request(app).post(`/therapist/patients/${patient.id}/plans`).set(auth(therapist.id)).send({ ...draftBody(today, [heel]), publish: true }).expect(201)).body.plan;
    await request(app).post(`/patient/tasks/${plan.tasks[0].id}/completion`).set(auth(patient.id)).send({ painLevel: 2 }).expect(201);
    await prisma.user.delete({ where: { id: patient.id } });
    assert.equal(await prisma.rehabPlan.count(), 0);
    assert.equal(await prisma.planVersionItem.count(), 0);
    assert.equal(await prisma.taskCompletion.count(), 0);
  });
});
