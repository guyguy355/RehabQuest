/**
 * Daily exercise reminders (ADR-003).
 *
 * scheduleReminders(): for every patient with reminders on, enqueue one job per local day
 * (today and tomorrow) with dedupeKey `reminder:<userId>:<date>`. Re-running it never
 * creates duplicates.
 *
 * processReminder(): re-checks everything at send time and suppresses the reminder when
 * - reminders were switched off, or the user snoozed past the end of that day,
 * - the plan is not active (none, paused, completed) or the day is an approved pause,
 * - the day is a rest day,
 * - every exercise for that day already has a result,
 * - the job's day is no longer today in the user's timezone (worker was down).
 * Otherwise it stores an in-app notification (if enabled) and queues a generic push (if enabled).
 */
import type { OutboxJob } from '@prisma/client';
import { PlanStatus } from '@prisma/client';
import { prisma } from '../../db.js';
import { addDays, type DateKey, fromDbDate, localDateKey, toDbDate } from '../../lib/dates.js';
import { devLogEnabled } from '../push.js';
import { notify } from '../notifications.js';
import { enqueue } from '../outbox.js';
import { dayKind } from '../progress.js';
import { loadCurrentPlan, toTimeline } from '../plans.js';
import { inQuietHours, localMinutes, reminderInstant } from './time.js';

const STALE_AFTER_MS = 3 * 3600_000;

export async function scheduleReminders(now = new Date(), userId?: string) {
  const preferences = await prisma.patientNotificationPreference.findMany({
    where: { dailyExerciseRemindersEnabled: true, ...(userId ? { userId } : {}), user: { role: 'PATIENT' } },
    include: { user: { select: { id: true, timezone: true } } },
  });
  let queued = 0;
  for (const preference of preferences) {
    const today = localDateKey(preference.user.timezone, now);
    for (const date of [today, addDays(today, 1)]) {
      const at = reminderInstant(date, preference.reminderTime, preference.user.timezone, preference.quietHoursStart, preference.quietHoursEnd);
      if (!at || at.getTime() < now.getTime() - STALE_AFTER_MS) continue;
      if (await enqueue(prisma, { kind: 'REMINDER', userId: preference.userId, dedupeKey: `reminder:${preference.userId}:${date}`, runAt: at, payload: { date } })) queued += 1;
    }
  }
  return queued;
}

/** After the user changes reminder settings: drop queued (not yet sent) reminders and reschedule. */
export async function rescheduleForUser(userId: string, now = new Date()) {
  await prisma.outboxJob.deleteMany({ where: { userId, kind: 'REMINDER', status: 'QUEUED' } });
  return scheduleReminders(now, userId);
}

export type ReminderOutcome = { status: 'DONE' | 'SUPPRESSED'; result: string } | { status: 'RESCHEDULE'; runAt: Date; result: string };

export async function processReminder(job: OutboxJob, now = new Date()): Promise<ReminderOutcome> {
  const userId = job.userId!;
  const date = (job.payload as { date: DateKey }).date;
  const [user, preference] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, timezone: true } }),
    prisma.patientNotificationPreference.findUnique({ where: { userId } }),
  ]);
  if (!user || !preference?.dailyExerciseRemindersEnabled) return { status: 'SUPPRESSED', result: 'reminders_off' };

  const today = localDateKey(user.timezone, now);
  if (date !== today || now.getTime() - job.runAt.getTime() > STALE_AFTER_MS) return { status: 'SUPPRESSED', result: 'stale' };

  if (preference.snoozedUntil && preference.snoozedUntil > now) {
    return localDateKey(user.timezone, preference.snoozedUntil) === date
      ? { status: 'RESCHEDULE', runAt: preference.snoozedUntil, result: 'snoozed' }
      : { status: 'SUPPRESSED', result: 'snoozed' };
  }

  const minutesNow = localMinutes(user.timezone, now);
  if (inQuietHours(minutesNow, preference.quietHoursStart, preference.quietHoursEnd)) {
    const next = reminderInstant(date, preference.quietHoursEnd!, user.timezone);
    return next && next > now && localDateKey(user.timezone, next) === date ? { status: 'RESCHEDULE', runAt: next, result: 'quiet_hours' } : { status: 'SUPPRESSED', result: 'quiet_hours' };
  }

  const plan = await loadCurrentPlan(prisma, userId);
  if (!plan || plan.status !== PlanStatus.ACTIVE || plan.versions.length === 0) return { status: 'SUPPRESSED', result: plan?.status === PlanStatus.PAUSED ? 'plan_paused' : 'no_active_plan' };
  const kind = dayKind(toTimeline(plan), date);
  if (kind.kind === 'paused') return { status: 'SUPPRESSED', result: 'plan_paused' };
  if (kind.kind !== 'training') return { status: 'SUPPRESSED', result: kind.kind === 'rest' ? 'rest_day' : 'outside_plan' };

  const recorded = await prisma.taskCompletion.findMany({ where: { patientId: userId, sessionDate: toDbDate(date), taskId: { in: kind.items.map((item) => item.taskId) } }, select: { taskId: true } });
  if (recorded.length >= kind.items.length) return { status: 'SUPPRESSED', result: 'already_done' };

  if (!preference.inAppEnabled && !preference.pushEnabled) return { status: 'SUPPRESSED', result: 'no_channel' };

  const notification = preference.inAppEnabled
    ? await notify(prisma, { userId, kind: 'REMINDER', title: 'Your planned session is ready', body: 'Open RehabQuest when it suits you.', link: '/patient', dedupeKey: `reminder:${userId}:${date}` }, now)
    : null;
  if (!preference.inAppEnabled && preference.pushEnabled) {
    // Push-only users: queue the push directly, still deduplicated per day.
    await enqueue(prisma, { kind: 'PUSH', userId, dedupeKey: `push:reminder:${userId}:${date}`, runAt: now, payload: { reminderDate: date } });
  }
  if (devLogEnabled()) {
    await prisma.notificationDelivery.create({ data: { userId, jobId: job.id, notificationId: notification?.id ?? null, channel: 'DEV_LOG', status: 'SENT', detail: `Development log: reminder for ${date} processed` } });
  }
  return { status: 'DONE', result: notification ? 'in_app_created' : 'push_queued' };
}

export { fromDbDate };
