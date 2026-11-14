import { createApp, createExercise, createPublishedPlan, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { addDays, localDateKey } from '../src/lib/dates.js';
import { weekStartOf } from '../src/services/gamification.js';

const app = createApp({ summaryModel: null });
const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function setup() {
  const therapist = await createUser('THERAPIST');
  const other = await createUser('THERAPIST');
  const patient = await createUser('PATIENT');
  await link(therapist.id, patient.id);
  const today = localDateKey(patient.timezone);
  return { therapist, other, patient, today };
}

async function defineKneeBend(therapistId: string, patientId: string, patientCanRecord = false) {
  const response = await request(app)
    .post(`/therapist/patients/${patientId}/measurements`)
    .set(auth(therapistId))
    .send({ name: 'Knee bend (right)', unit: '°', direction: 'HIGHER_IS_BETTER', minValue: 0, maxValue: 160, patientCanRecord });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.measurement.id as string;
}

describe('goals and milestones', () => {
  test('a measurement goal shows progress from measurements; only the therapist confirms it', async () => {
    const { therapist, patient, today } = await setup();
    const definitionId = await defineKneeBend(therapist.id, patient.id);
    const created = await request(app)
      .post(`/therapist/patients/${patient.id}/goals`)
      .set(auth(therapist.id))
      .send({ title: 'Bend the knee enough to ride a bike', kind: 'MEASUREMENT', definitionId, baselineValue: 90, targetValue: 120, milestones: [{ title: 'Reach 100°' }, { title: 'Reach 110°' }] });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const goal = created.body.goal;
    assert.equal(goal.milestones.length, 2);
    assert.equal(goal.measurement.percent, null, 'no measurement yet');

    await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(therapist.id)).send({ value: 123.5, measuredOn: today }).expect(201);
    const patientView = await request(app).get('/patient/goals').set(auth(patient.id)).expect(200);
    const seen = patientView.body.goals[0];
    assert.deepEqual({ percent: seen.measurement.percent, reached: seen.measurement.targetReached, status: seen.status }, { percent: 100, reached: true, status: 'ACTIVE' }, 'reaching the target does not confirm the goal');

    // Recording a value is not a goal edit, so the goal's lockVersion is unchanged.
    const confirmed = await request(app).patch(`/therapist/goals/${goal.id}`).set(auth(therapist.id)).send({ status: 'ACHIEVED', lockVersion: goal.lockVersion });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.goal.status, 'ACHIEVED');
  });

  test('stale goal edits get 409; confirming records the actor, notifies the patient and is audited', async () => {
    const { therapist, patient } = await setup();
    const created = await request(app).post(`/therapist/patients/${patient.id}/goals`).set(auth(therapist.id)).send({ title: 'Climb the stairs at home without the rail', kind: 'FUNCTIONAL' }).expect(201);
    const goal = created.body.goal;
    await request(app).patch(`/therapist/goals/${goal.id}`).set(auth(therapist.id)).send({ title: 'Climb the stairs without the rail', lockVersion: goal.lockVersion }).expect(200);
    const stale = await request(app).patch(`/therapist/goals/${goal.id}`).set(auth(therapist.id)).send({ status: 'ACHIEVED', lockVersion: goal.lockVersion });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'stale_goal');

    const ok = await request(app).patch(`/therapist/goals/${goal.id}`).set(auth(therapist.id)).send({ status: 'ACHIEVED', lockVersion: goal.lockVersion + 1 }).expect(200);
    assert.equal(ok.body.goal.status, 'ACHIEVED');
    const row = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    assert.equal(row.achievedById, therapist.id);
    assert.ok(await prisma.notification.findFirst({ where: { userId: patient.id, title: 'Your therapist confirmed a goal' } }));
    assert.ok(await prisma.auditEvent.findFirst({ where: { action: 'GOAL_CONFIRMED', subjectId: goal.id, actorId: therapist.id } }));
  });

  test('confirming a milestone awards "first-milestone"; reopening keeps the achievement', async () => {
    const { therapist, patient } = await setup();
    const created = await request(app).post(`/therapist/patients/${patient.id}/goals`).set(auth(therapist.id)).send({ title: 'Walk to the shop', kind: 'FUNCTIONAL', milestones: [{ title: 'Walk 10 minutes' }] }).expect(201);
    const milestoneId = created.body.goal.milestones[0].id;
    await request(app).patch(`/therapist/milestones/${milestoneId}`).set(auth(therapist.id)).send({ achieved: true }).expect(200);
    assert.ok(await prisma.userBadge.findFirst({ where: { userId: patient.id, badgeId: 'first-milestone' } }));
    const reopened = await request(app).patch(`/therapist/milestones/${milestoneId}`).set(auth(therapist.id)).send({ achieved: false }).expect(200);
    assert.equal(reopened.body.goal.milestones[0].achievedAt, null);
    assert.ok(await prisma.userBadge.findFirst({ where: { userId: patient.id, badgeId: 'first-milestone' } }), 'nothing is taken away');
  });

  test('another therapist can neither read nor change the goals; measurement goals need a valid target', async () => {
    const { therapist, other, patient } = await setup();
    const created = await request(app).post(`/therapist/patients/${patient.id}/goals`).set(auth(therapist.id)).send({ title: 'Return to gardening', kind: 'FUNCTIONAL', milestones: [{ title: 'Kneel for 2 minutes' }] }).expect(201);
    await request(app).get(`/therapist/patients/${patient.id}/goals`).set(auth(other.id)).expect(404);
    await request(app).patch(`/therapist/goals/${created.body.goal.id}`).set(auth(other.id)).send({ status: 'ARCHIVED', lockVersion: 0 }).expect(404);
    await request(app).patch(`/therapist/milestones/${created.body.goal.milestones[0].id}`).set(auth(other.id)).send({ achieved: true }).expect(404);
    await request(app).post(`/therapist/patients/${patient.id}/goals`).set(auth(other.id)).send({ title: 'x', kind: 'FUNCTIONAL' }).expect(404);

    const definitionId = await defineKneeBend(therapist.id, patient.id);
    const outOfRange = await request(app).post(`/therapist/patients/${patient.id}/goals`).set(auth(therapist.id)).send({ title: 'Bend', kind: 'MEASUREMENT', definitionId, targetValue: 400 });
    assert.equal(outOfRange.status, 400);
    const missingTarget = await request(app).post(`/therapist/patients/${patient.id}/goals`).set(auth(therapist.id)).send({ title: 'Bend', kind: 'MEASUREMENT', definitionId });
    assert.equal(missingTarget.status, 400);
  });
});

describe('measurements', () => {
  test('values are validated, retries with the same key are deduplicated, and patients record only when allowed', async () => {
    const { therapist, other, patient, today } = await setup();
    const definitionId = await defineKneeBend(therapist.id, patient.id);

    await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(therapist.id)).send({ value: 170, measuredOn: today }).expect(400);
    await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(therapist.id)).send({ value: 95.555, measuredOn: today }).expect(400);
    await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(therapist.id)).send({ value: 95, measuredOn: addDays(today, 1) }).expect(400);
    await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(other.id)).send({ value: 95, measuredOn: today }).expect(404);

    const key = 'measure-key-0001';
    const first = await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(therapist.id)).send({ value: 95.5, measuredOn: today, idempotencyKey: key });
    assert.equal(first.status, 201);
    const retry = await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(therapist.id)).send({ value: 95.5, measuredOn: today, idempotencyKey: key });
    assert.equal(retry.status, 200);
    const reused = await request(app).post(`/therapist/measurements/${definitionId}/values`).set(auth(therapist.id)).send({ value: 99, measuredOn: today, idempotencyKey: key });
    assert.equal(reused.status, 409);
    assert.equal(await prisma.measurement.count(), 1);
    assert.equal(first.body.measurement.values[0].value, 95.5, 'decimals are kept exactly');

    await request(app).post(`/patient/measurements/${definitionId}`).set(auth(patient.id)).send({ value: 100, measuredOn: today }).expect(404);
    await request(app).patch(`/therapist/measurements/${definitionId}`).set(auth(therapist.id)).send({ patientCanRecord: true }).expect(200);
    await request(app).post(`/patient/measurements/${definitionId}`).set(auth(patient.id)).send({ value: 100, measuredOn: today }).expect(201);
    const stored = await prisma.measurement.findFirstOrThrow({ where: { recordedById: patient.id } });
    assert.equal(stored.source, 'PATIENT');
  });
});

describe('weekly check-ins', () => {
  test('one per week, optional answers stay null, only this week and last week are open', async () => {
    const { patient, today } = await setup();
    const week = weekStartOf(today);

    const open = await request(app).get('/patient/check-ins').set(auth(patient.id)).expect(200);
    assert.deepEqual(open.body.openWeeks, [week, addDays(week, -7)]);

    const first = await request(app).put(`/patient/check-ins/${week}`).set(auth(patient.id)).send({ painTypical: 3, note: 'Better on the stairs' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.deepEqual({ painTypical: first.body.checkIn.painTypical, painWorst: first.body.checkIn.painWorst, confidence: first.body.checkIn.confidence }, { painTypical: 3, painWorst: null, confidence: null });
    assert.deepEqual(first.body.newBadges.map((badge: { id: string }) => badge.id), ['first-check-in']);

    const update = await request(app).put(`/patient/check-ins/${week}`).set(auth(patient.id)).send({ painTypical: 2, painWorst: 5, confidence: 4 });
    assert.equal(update.status, 200);
    assert.equal(await prisma.weeklyCheckIn.count(), 1);

    await request(app).put(`/patient/check-ins/${addDays(week, -14)}`).set(auth(patient.id)).send({ painTypical: 2 }).expect(400);
    await request(app).put(`/patient/check-ins/${addDays(week, 1)}`).set(auth(patient.id)).send({ painTypical: 2 }).expect(400);
    await request(app).put(`/patient/check-ins/${week}`).set(auth(patient.id)).send({ painTypical: 6, painWorst: 2 }).expect(400);
    await request(app).put(`/patient/check-ins/${week}`).set(auth(patient.id)).send({}).expect(400);
    await request(app).put(`/patient/check-ins/${week}`).set(auth(patient.id)).send({ painTypical: 11 }).expect(400);
  });

  test('analytics include the check-in and keep unanswered questions null; another therapist gets 404', async () => {
    const { therapist, other, patient, today } = await setup();
    await request(app).put(`/patient/check-ins/${weekStartOf(today)}`).set(auth(patient.id)).send({ activityLimit: 0 }).expect(201);
    const analytics = await request(app).get(`/therapist/patients/${patient.id}/analytics?weeks=4`).set(auth(therapist.id)).expect(200);
    assert.equal(analytics.body.weeks.length, 4);
    assert.deepEqual(analytics.body.weeks.at(-1).checkIn, { painTypical: null, painWorst: null, activityLimit: 0, confidence: null });
    assert.equal(analytics.body.weeks.at(-1).status, 'no-plan');
    await request(app).get(`/therapist/patients/${patient.id}/analytics`).set(auth(other.id)).expect(404);
  });
});

describe('motivation', () => {
  test('meeting the weekly goal is recorded once per week and awards "weekly-goal"', async () => {
    const { therapist, patient, today } = await setup();
    const exercise = await createExercise(therapist.id);
    const { tasks } = await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [exercise], startDate: addDays(today, -1), endDate: addDays(today, 20) });
    await request(app).patch('/me/preferences').set(auth(patient.id)).send({ weeklySessionGoal: 1 }).expect(200);

    const done = await request(app).post(`/patient/tasks/${tasks[0].id}/completion`).set(auth(patient.id)).send({ status: 'COMPLETED', painLevel: 2, difficulty: 'JUST_RIGHT' });
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.equal(done.body.weeklyGoal.justMet, true);
    assert.ok(done.body.newBadges.some((badge: { id: string }) => badge.id === 'weekly-goal'));
    assert.equal(await prisma.weeklyGoalWeek.count({ where: { userId: patient.id } }), 1);

    const motivation = await request(app).get('/patient/motivation').set(auth(patient.id)).expect(200);
    assert.equal(motivation.body.weeklyGoal.met, true);
    assert.ok(motivation.body.history.some((entry: { type: string }) => entry.type === 'weekly-goal'));
    assert.ok(motivation.body.badges.every((badge: { rule: string }) => badge.rule.length > 10), 'every achievement explains its rule');
  });

  test('preferences sync per account; a locked cosmetic cannot be chosen; therapists cannot set patient-only settings', async () => {
    const { therapist, patient } = await setup();
    const initial = await request(app).get('/me/preferences').set(auth(patient.id)).expect(200);
    assert.deepEqual(initial.body.preference, { calmMode: false, soundEnabled: false, weeklySessionGoal: null, mascotCosmetic: 'classic' });
    await request(app).patch('/me/preferences').set(auth(patient.id)).send({ calmMode: true }).expect(200);
    assert.equal((await request(app).get('/me/preferences').set(auth(patient.id))).body.preference.calmMode, true);

    await request(app).patch('/me/preferences').set(auth(patient.id)).send({ mascotCosmetic: 'scarf' }).expect(400);
    await prisma.userBadge.create({ data: { userId: patient.id, badgeId: 'steady-three' } });
    await request(app).patch('/me/preferences').set(auth(patient.id)).send({ mascotCosmetic: 'scarf' }).expect(200);
    await request(app).patch('/me/preferences').set(auth(patient.id)).send({ weeklySessionGoal: 8 }).expect(400);

    await request(app).patch('/me/preferences').set(auth(therapist.id)).send({ calmMode: true }).expect(200);
    await request(app).patch('/me/preferences').set(auth(therapist.id)).send({ weeklySessionGoal: 3 }).expect(400);
    await request(app).get('/me/preferences').expect(401);
  });
});

describe('educational cards', () => {
  test('versions, attachment, read confirmation per version, and "updated since you read it"', async () => {
    const { therapist, patient } = await setup();
    const created = await request(app).post('/therapist/education').set(auth(therapist.id)).send({ title: 'Why some soreness is expected', body: 'Mild soreness after exercise is common.\n- It should settle within a day.', readingMinutes: 2 });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const card = created.body.card;
    assert.equal(card.versions[0].number, 1);

    const assigned = await request(app).post(`/therapist/patients/${patient.id}/education`).set(auth(therapist.id)).send({ cardId: card.id }).expect(201);
    const duplicate = await request(app).post(`/therapist/patients/${patient.id}/education`).set(auth(therapist.id)).send({ cardId: card.id });
    assert.equal(duplicate.status, 409);

    let list = await request(app).get('/patient/education').set(auth(patient.id)).expect(200);
    assert.equal(list.body.cards[0].state, 'unread');
    await request(app).post(`/patient/education/${assigned.body.card.id}/read`).set(auth(patient.id)).send({ versionId: card.versions[0].id }).expect(200);
    list = await request(app).get('/patient/education').set(auth(patient.id)).expect(200);
    assert.equal(list.body.cards[0].state, 'read');

    const stale = await request(app).put(`/therapist/education/${card.id}`).set(auth(therapist.id)).send({ title: 'Soreness', body: 'v2', readingMinutes: 2, lockVersion: card.lockVersion + 5 });
    assert.equal(stale.status, 409);
    const v2 = await request(app).put(`/therapist/education/${card.id}`).set(auth(therapist.id)).send({ title: 'Why some soreness is expected', body: 'Updated advice.', readingMinutes: 3, lockVersion: card.lockVersion }).expect(200);
    assert.deepEqual(v2.body.card.versions.map((version: { number: number }) => version.number), [2, 1], 'old versions are kept');

    list = await request(app).get('/patient/education').set(auth(patient.id)).expect(200);
    assert.deepEqual({ state: list.body.cards[0].state, lastRead: list.body.cards[0].lastRead.versionNumber, latest: list.body.cards[0].latest.number }, { state: 'updated', lastRead: 1, latest: 2 });
    const oldVersion = await request(app).post(`/patient/education/${assigned.body.card.id}/read`).set(auth(patient.id)).send({ versionId: card.versions[0].id });
    assert.equal(oldVersion.status, 409, 'confirming an old version is refused');

    const therapistView = await request(app).get(`/therapist/patients/${patient.id}/education`).set(auth(therapist.id)).expect(200);
    assert.equal(therapistView.body.cards[0].state, 'updated');
  });

  test('cards and assignments are private to their therapist; exercises must come from this patient’s plan', async () => {
    const { therapist, other, patient, today } = await setup();
    const card = (await request(app).post('/therapist/education').set(auth(therapist.id)).send({ title: 'Ice or heat', body: 'Text', readingMinutes: 1 }).expect(201)).body.card;
    await request(app).get(`/therapist/education/${card.id}`).set(auth(other.id)).expect(404);
    await request(app).put(`/therapist/education/${card.id}`).set(auth(other.id)).send({ title: 'x', body: 'y', readingMinutes: 1, lockVersion: 0 }).expect(404);
    await request(app).get(`/therapist/patients/${patient.id}/education`).set(auth(other.id)).expect(404);

    const otherPatient = await createUser('PATIENT');
    await link(other.id, otherPatient.id);
    const otherExercise = await createExercise(other.id);
    const { tasks } = await createPublishedPlan({ therapistId: other.id, patientId: otherPatient.id, exercises: [otherExercise], startDate: today, endDate: addDays(today, 5) });
    await request(app).post(`/therapist/patients/${patient.id}/education`).set(auth(therapist.id)).send({ cardId: card.id, taskId: tasks[0].id }).expect(400);

    const assigned = await request(app).post(`/therapist/patients/${patient.id}/education`).set(auth(therapist.id)).send({ cardId: card.id }).expect(201);
    await request(app).delete(`/therapist/education-assignments/${assigned.body.card.id}`).set(auth(other.id)).expect(404);
    await request(app).delete(`/therapist/education-assignments/${assigned.body.card.id}`).set(auth(therapist.id)).expect(204);
    assert.equal((await request(app).get('/patient/education').set(auth(patient.id))).body.cards.length, 0);
    assert.ok(await prisma.educationAssignment.findUnique({ where: { id: assigned.body.card.id } }), 'removed assignments are kept for history');
  });
});
