import { createApp, createExercise, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createAuthToken } from '../src/auth.js';
import { config } from '../src/config.js';
import { addDays, localDateKey, toDbDate } from '../src/lib/dates.js';
import { toModelInput } from '../src/services/summary/anthropicModel.js';
import type { SummaryDataset } from '../src/services/summary/dataset.js';
import type { SummaryModel } from '../src/services/summary/index.js';
import { SummaryModelError } from '../src/services/summary/types.js';

const auth = (userId: string) => ({ Authorization: `Bearer ${createAuthToken(userId)}` });

beforeEach(resetDatabase);
after(() => prisma.$disconnect());

async function patientWithHistory() {
  const therapist = await createUser('THERAPIST');
  const patient = await createUser('PATIENT', { name: 'Very Unique Patient Name' });
  await link(therapist.id, patient.id);
  const exercise = await createExercise(therapist.id, 'Heel slides');
  const today = localDateKey(patient.timezone);
  const plan = await prisma.rehabPlan.create({
    data: {
      patientId: patient.id,
      therapistId: therapist.id,
      title: 'Knee plan',
      condition: 'Knee',
      startDate: toDbDate(addDays(today, -6)),
      endDate: toDbDate(addDays(today, 7)),
      trainingWeekdays: [0, 1, 2, 3, 4, 5, 6],
      tasks: { create: [{ exerciseId: exercise.id, sets: 2, reps: 10, durationSeconds: 30, orderIndex: 0, activeFrom: toDbDate(addDays(today, -6)) }] },
    },
    include: { tasks: true },
  });
  const pains = [2, 3, 3, 8];
  for (const [index, pain] of pains.entries()) {
    await prisma.taskCompletion.create({
      data: {
        taskId: plan.tasks[0].id,
        patientId: patient.id,
        sessionDate: toDbDate(addDays(today, -6 + index)),
        painLevel: pain,
        status: pain >= 8 ? 'STOPPED' : 'COMPLETED',
        needsReview: pain >= 7,
        notes: index === 0 ? 'A bit stiff in the morning' : null,
        prescribedSets: 2,
        prescribedReps: 10,
        prescribedDurationSecs: 30,
      },
    });
  }
  return { therapist, patient };
}

function fakeModel(generate: SummaryModel['generate']): SummaryModel {
  return { name: 'fake-model', generate };
}

const validOutput = {
  overview: 'Four records were submitted this week.',
  adherence: 'Four of seven planned sessions were finished.',
  observations: [{ text: 'Pain was low (2–3/10) in the first three records.', refs: ['R1', 'R2', 'R3'] }],
  itemsForReview: [{ text: 'The patient stopped because of symptoms with pain 8/10.', refs: ['R4'] }],
};

async function summarize(model: SummaryModel | null, days = 7) {
  const { therapist, patient } = await patientWithHistory();
  const app = createApp({ summaryModel: model });
  const response = await request(app).post(`/therapist/patients/${patient.id}/summary`).set(auth(therapist.id)).send({ days });
  return { response, therapist, patient, app };
}

describe('therapist summary drafts', () => {
  test('without a configured model the app returns a clearly labelled rule-based summary', async () => {
    const { response } = await summarize(null);
    assert.equal(response.status, 200);
    const { summary } = response.body;

    assert.equal(summary.source, 'RULE_BASED');
    assert.equal(summary.fallbackReason, 'not_configured');
    assert.match(summary.label, /Rule-based summary — no AI model was used/);
    assert.equal(summary.model, null);
    assert.equal(summary.recordCount, 4);
    assert.equal(summary.period.days, 7);
    assert.ok(summary.summary.itemsForReview[0].references[0].completionId);
    assert.equal(await prisma.aiSummaryRequest.count({ where: { source: 'RULE_BASED' } }), 1);
  });

  test('a valid model draft is labelled as AI-generated and its references are resolved to records', async () => {
    const { response } = await summarize(fakeModel(async () => validOutput));
    const { summary } = response.body;

    assert.equal(summary.source, 'MODEL');
    assert.equal(summary.model, 'fake-model');
    assert.match(summary.label, /AI-generated draft — requires therapist review/);
    const ref = summary.summary.itemsForReview[0].references[0];
    assert.equal(ref.ref, 'R4');
    assert.equal(ref.painLevel, 8);
    assert.equal(ref.status, 'STOPPED');
  });

  test('references to records that do not exist are rejected', async () => {
    const { response } = await summarize(fakeModel(async () => ({ ...validOutput, itemsForReview: [{ text: 'Made-up record', refs: ['R99'] }] })));
    assert.equal(response.body.summary.source, 'RULE_BASED');
    assert.equal(response.body.summary.fallbackReason, 'invalid_output');
  });

  test('wrongly shaped output is rejected', async () => {
    const { response } = await summarize(fakeModel(async () => ({ overview: 'Only an overview' })));
    assert.equal(response.body.summary.fallbackReason, 'invalid_output');
  });

  for (const unsafe of [
    'This pattern suggests a diagnosis of patellar tendinopathy.',
    'Consider increasing the intensity to 3 sets of 15 reps.',
    'You should change the plan to include harder exercises.',
  ]) {
    test(`unsafe text is rejected: "${unsafe.slice(0, 30)}…"`, async () => {
      const { response } = await summarize(fakeModel(async () => ({ ...validOutput, overview: unsafe })));
      assert.equal(response.body.summary.source, 'RULE_BASED');
      assert.equal(response.body.summary.fallbackReason, 'unsafe_output');
    });
  }

  test('provider errors fall back to the rule-based summary', async () => {
    const { response } = await summarize(fakeModel(async () => { throw new SummaryModelError('provider_error'); }));
    assert.equal(response.status, 200);
    assert.equal(response.body.summary.fallbackReason, 'provider_error');
  });

  test('a model that does not answer in time is aborted', async () => {
    const original = config.ai.timeoutMs;
    config.ai.timeoutMs = 50;
    let aborted = false;
    try {
      const { response } = await summarize(
        fakeModel((_dataset, signal) => new Promise((resolve) => {
          signal.addEventListener('abort', () => { aborted = true; });
          setTimeout(() => resolve(validOutput), 2_000).unref();
        })),
      );
      assert.equal(response.body.summary.fallbackReason, 'timeout');
      assert.equal(aborted, true);
    } finally {
      config.ai.timeoutMs = original;
    }
  });

  test('usage limits: model calls are capped per hour, then all requests', async () => {
    const originalModel = config.ai.modelHourlyLimit;
    const originalTotal = config.ai.totalHourlyLimit;
    config.ai.modelHourlyLimit = 1;
    config.ai.totalHourlyLimit = 3;
    let calls = 0;
    try {
      const { therapist, patient } = await patientWithHistory();
      const app = createApp({ summaryModel: fakeModel(async () => { calls += 1; return validOutput; }) });
      const post = () => request(app).post(`/therapist/patients/${patient.id}/summary`).set(auth(therapist.id)).send({ days: 7 });

      assert.equal((await post()).body.summary.source, 'MODEL');
      assert.equal((await post()).body.summary.fallbackReason, 'usage_limit');
      await post().expect(200);
      await post().expect(429);
      assert.equal(calls, 1);
    } finally {
      config.ai.modelHourlyLimit = originalModel;
      config.ai.totalHourlyLimit = originalTotal;
    }
  });

  test('the model never receives names, emails or database ids', async () => {
    let seen: SummaryDataset | null = null;
    const { patient } = await summarize(fakeModel(async (dataset) => { seen = dataset; return validOutput; }));
    const payload = JSON.stringify(toModelInput(seen!));

    assert.ok(!payload.includes('Very Unique Patient Name'));
    assert.ok(!payload.includes(patient.email));
    assert.ok(!payload.includes(patient.id));
    for (const record of seen!.records) assert.ok(!payload.includes(record.completionId));
  });

  test('only the requesting therapist’s records are used', async () => {
    const { therapist, patient } = await patientWithHistory();
    // A second therapist linked to the same patient with their own plan and record.
    const other = await createUser('THERAPIST');
    await link(other.id, patient.id);
    const exercise = await createExercise(other.id, 'Other therapist exercise');
    const today = localDateKey(patient.timezone);
    const otherPlan = await prisma.rehabPlan.create({
      data: {
        patientId: patient.id, therapistId: other.id, title: 'Other', condition: 'Shoulder', status: 'PAUSED',
        startDate: toDbDate(addDays(today, -3)), endDate: toDbDate(today), trainingWeekdays: [0, 1, 2, 3, 4, 5, 6],
        tasks: { create: [{ exerciseId: exercise.id, sets: 1, reps: 1, durationSeconds: 1, orderIndex: 0, activeFrom: toDbDate(addDays(today, -3)) }] },
      },
      include: { tasks: true },
    });
    await prisma.taskCompletion.create({
      data: { taskId: otherPlan.tasks[0].id, patientId: patient.id, sessionDate: toDbDate(addDays(today, -1)), painLevel: 5, prescribedSets: 1, prescribedReps: 1, prescribedDurationSecs: 1 },
    });

    const app = createApp({ summaryModel: null });
    const response = await request(app).post(`/therapist/patients/${patient.id}/summary`).set(auth(therapist.id)).send({ days: 7 }).expect(200);
    assert.equal(response.body.summary.recordCount, 4);
    assert.ok(response.body.summary.records.every((record: { exercise: string }) => record.exercise === 'Heel slides'));
  });

  test('summary period is validated', async () => {
    const { therapist, patient } = await patientWithHistory();
    await request(createApp({ summaryModel: null })).post(`/therapist/patients/${patient.id}/summary`).set(auth(therapist.id)).send({ days: 365 }).expect(400);
  });
});
