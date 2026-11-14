import { createExercise, createPublishedPlan, createUser, link, prisma, resetDatabase } from './helpers/setup.js';

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, test } from 'node:test';
import { toDbDate } from '../src/lib/dates.js';
import { claimJobs, enqueue } from '../src/services/outbox.js';
import { type PushAdapter, setPushAdapterForTests } from '../src/services/push.js';
import { scheduleReminders } from '../src/services/reminders/index.js';
import { zonedTimeToUtc } from '../src/services/reminders/time.js';
import { runWorkerOnce } from '../src/worker/run.js';

const TZ = 'Asia/Jerusalem';
const DAY = '2026-10-14'; // a Wednesday
const at = (time: string, date = DAY) => zonedTimeToUtc(date, time, TZ);
const plus = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

beforeEach(resetDatabase);
afterEach(() => setPushAdapterForTests(null));
after(() => prisma.$disconnect());

async function patientWithReminder(options: { reminderTime?: string; quiet?: [string, string]; weekdays?: number[]; status?: 'ACTIVE' | 'PAUSED' } = {}) {
  const therapist = await createUser('THERAPIST');
  const patient = await createUser('PATIENT', { timezone: TZ });
  await link(therapist.id, patient.id);
  const exercise = await createExercise(therapist.id);
  const { plan, tasks } = await createPublishedPlan({ therapistId: therapist.id, patientId: patient.id, exercises: [exercise], startDate: '2026-10-10', endDate: '2026-10-30', trainingWeekdays: options.weekdays, status: options.status });
  await prisma.patientNotificationPreference.create({
    data: { userId: patient.id, dailyExerciseRemindersEnabled: true, reminderTime: options.reminderTime ?? '09:00', quietHoursStart: options.quiet?.[0] ?? null, quietHoursEnd: options.quiet?.[1] ?? null },
  });
  return { therapist, patient, plan, taskId: tasks[0].id, versionItemId: tasks[0].versionItemId };
}

const reminderJob = (userId: string, date = DAY) => prisma.outboxJob.findUniqueOrThrow({ where: { dedupeKey: `reminder:${userId}:${date}` } });

describe('scheduling', () => {
  test('re-running the scheduler or the worker never duplicates the same reminder', async () => {
    const { patient } = await patientWithReminder();
    const morning = at('07:00');
    await scheduleReminders(morning);
    await scheduleReminders(morning);
    assert.equal(await prisma.outboxJob.count({ where: { kind: 'REMINDER' } }), 2, 'today + tomorrow, once each');
    assert.equal((await reminderJob(patient.id)).runAt.toISOString(), '2026-10-14T06:00:00.000Z');

    await runWorkerOnce(plus(at('09:00'), 1));
    await runWorkerOnce(plus(at('09:00'), 2));
    await runWorkerOnce(plus(at('09:00'), 3));
    assert.equal(await prisma.notification.count({ where: { userId: patient.id, kind: 'REMINDER' } }), 1);
    assert.equal((await reminderJob(patient.id)).status, 'DONE');
  });

  test('a reminder inside quiet hours is moved to the end of the quiet period', async () => {
    const { patient } = await patientWithReminder({ reminderTime: '06:30', quiet: ['22:00', '07:00'] });
    await scheduleReminders(at('00:30'));
    assert.equal((await reminderJob(patient.id)).runAt.toISOString(), at('07:00').toISOString());
  });
});

describe('suppression at send time', () => {
  test('completing the session before dispatch suppresses the reminder', async () => {
    const { patient, taskId, versionItemId } = await patientWithReminder();
    await scheduleReminders(at('07:00'));
    await prisma.taskCompletion.create({ data: { taskId, patientId: patient.id, sessionDate: toDbDate(DAY), painLevel: 1, planVersionItemId: versionItemId, prescribedSets: 2, prescribedReps: 10, prescribedDurationSecs: 30 } });
    await runWorkerOnce(plus(at('09:00'), 1));
    const job = await reminderJob(patient.id);
    assert.equal(job.status, 'SUPPRESSED');
    assert.equal(job.result, 'already_done');
    assert.equal(await prisma.notification.count({ where: { kind: 'REMINDER' } }), 0);
  });

  test('rest days and approved pauses do not get reminders', async () => {
    const rest = await patientWithReminder({ weekdays: [1] }); // Mondays only; DAY is a Wednesday
    await scheduleReminders(at('07:00'));
    await runWorkerOnce(plus(at('09:00'), 1));
    assert.equal((await reminderJob(rest.patient.id)).result, 'rest_day');

    await resetDatabase();
    const paused = await patientWithReminder({ status: 'PAUSED' });
    await scheduleReminders(at('07:00'));
    await runWorkerOnce(plus(at('09:00'), 1));
    assert.equal((await reminderJob(paused.patient.id)).result, 'plan_paused');
  });

  test('snooze: within the day it reschedules; past the day it suppresses', async () => {
    const { patient } = await patientWithReminder();
    await scheduleReminders(at('07:00'));
    await prisma.patientNotificationPreference.update({ where: { userId: patient.id }, data: { snoozedUntil: at('10:00') } });
    await runWorkerOnce(plus(at('09:00'), 1));
    let job = await reminderJob(patient.id);
    assert.equal(job.status, 'QUEUED');
    assert.equal(job.runAt.toISOString(), at('10:00').toISOString());
    await runWorkerOnce(plus(at('10:00'), 1));
    assert.equal((await reminderJob(patient.id)).status, 'DONE');

    await prisma.patientNotificationPreference.update({ where: { userId: patient.id }, data: { snoozedUntil: at('06:00', '2026-10-16') } });
    await scheduleReminders(at('07:00', '2026-10-15'));
    await runWorkerOnce(plus(at('09:00', '2026-10-15'), 1));
    job = await reminderJob(patient.id, '2026-10-15');
    assert.equal(job.result, 'snoozed');
  });

  test('a job whose day has passed (worker was down) is suppressed as stale', async () => {
    const { patient } = await patientWithReminder();
    await scheduleReminders(at('07:00'));
    await runWorkerOnce(at('08:00', '2026-10-15'));
    assert.equal((await reminderJob(patient.id)).result, 'stale');
  });
});

describe('outbox mechanics', () => {
  test('two workers claiming at the same time never get the same job', async () => {
    const now = new Date();
    for (let index = 0; index < 20; index += 1) await enqueue(prisma, { kind: 'NOOP', dedupeKey: `noop-${index}`, runAt: new Date(now.getTime() - 1000) });
    const [a, b] = await Promise.all([claimJobs('worker-a', 15, now), claimJobs('worker-b', 15, now)]);
    const ids = [...a, ...b].map((job) => job.id);
    assert.equal(new Set(ids).size, ids.length, 'no job claimed twice');
    assert.equal(ids.length, 20);
  });

  test('a failing job is retried with backoff and finally marked FAILED', async () => {
    const { patient } = await patientWithReminder();
    await prisma.pushSubscription.create({ data: { userId: patient.id, endpoint: 'https://push.example/one', p256dh: 'p256dh-key-xxxx', auth: 'auth-key' } });
    setPushAdapterForTests({ configured: true, publicKey: 'x', send: async () => { throw new Error('boom'); } } as PushAdapter);
    await enqueue(prisma, { kind: 'PUSH', userId: patient.id, dedupeKey: 'push:test', runAt: new Date(Date.now() - 1000), maxAttempts: 2 });

    await runWorkerOnce(new Date());
    let job = await prisma.outboxJob.findUniqueOrThrow({ where: { dedupeKey: 'push:test' } });
    assert.equal(job.status, 'QUEUED');
    assert.equal(job.attempts, 1);
    assert.ok(job.runAt.getTime() > Date.now(), 'backoff moved runAt into the future');

    await runWorkerOnce(new Date(job.runAt.getTime() + 1000));
    job = await prisma.outboxJob.findUniqueOrThrow({ where: { dedupeKey: 'push:test' } });
    assert.equal(job.status, 'FAILED');
    assert.match(job.lastError ?? '', /boom/);
  });
});

describe('delivery states are honest', () => {
  test('without Web Push configuration the push is recorded as skipped and in-app still works', async () => {
    const { patient } = await patientWithReminder();
    await prisma.patientNotificationPreference.update({ where: { userId: patient.id }, data: { pushEnabled: true } });
    await prisma.pushSubscription.create({ data: { userId: patient.id, endpoint: 'https://push.example/a', p256dh: 'p256dh-key-xxxx', auth: 'auth-key' } });
    setPushAdapterForTests({ configured: false, publicKey: null, send: async () => ({ ok: false, gone: false, error: 'push_not_configured' }) });
    await scheduleReminders(at('07:00'));
    await runWorkerOnce(plus(at('09:00'), 1));
    await runWorkerOnce(plus(at('09:00'), 2)); // processes the queued PUSH job

    const deliveries = await prisma.notificationDelivery.findMany({ where: { userId: patient.id }, orderBy: { createdAt: 'asc' } });
    assert.ok(deliveries.some((delivery) => delivery.channel === 'IN_APP' && delivery.status === 'SENT'));
    assert.ok(deliveries.some((delivery) => delivery.channel === 'WEB_PUSH' && delivery.status === 'SKIPPED' && /not configured/.test(delivery.detail ?? '')));
  });

  test('an accepted push is recorded as ACCEPTED (never "delivered"), with generic lock-screen text; gone endpoints are disabled', async () => {
    const { patient } = await patientWithReminder();
    await prisma.patientNotificationPreference.update({ where: { userId: patient.id }, data: { pushEnabled: true } });
    await prisma.pushSubscription.createMany({
      data: [
        { userId: patient.id, endpoint: 'https://push.example/ok', p256dh: 'p256dh-key-xxxx', auth: 'auth-key' },
        { userId: patient.id, endpoint: 'https://push.example/gone', p256dh: 'p256dh-key-yyyy', auth: 'auth-key' },
      ],
    });
    const sent: { title: string; body: string }[] = [];
    setPushAdapterForTests({
      configured: true,
      publicKey: 'x',
      send: async (target, message) => {
        sent.push(message);
        return target.endpoint.endsWith('/ok') ? { ok: true } : { ok: false, gone: true, error: 'push_service_410' };
      },
    });
    await scheduleReminders(at('07:00'));
    await runWorkerOnce(plus(at('09:00'), 1));
    await runWorkerOnce(plus(at('09:00'), 2));

    const statuses = (await prisma.notificationDelivery.findMany({ where: { channel: 'WEB_PUSH' } })).map((delivery) => delivery.status).sort();
    assert.deepEqual(statuses, ['ACCEPTED', 'FAILED']);
    assert.ok(sent.every((message) => message.body === 'You have a planned session today.'));
    assert.ok((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: 'https://push.example/gone' } })).disabledAt);
  });
});
