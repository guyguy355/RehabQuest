/**
 * One worker pass: schedule reminders, evaluate missed-activity review rules, then claim
 * and process due outbox jobs. Safe to run in several processes at once.
 */
import os from 'node:os';
import { prisma } from '../db.js';
import { claimJobs, failJob, finishJob, rescheduleJob } from '../services/outbox.js';
import { GENERIC_TEXT, pushAdapter } from '../services/push.js';
import { processReminder, scheduleReminders } from '../services/reminders/index.js';
import { evaluateMissedActivity } from '../services/reviews.js';

export const WORKER_ID = `${os.hostname()}:${process.pid}`;

async function processPush(job: { id: string; userId: string | null; payload: unknown }) {
  const adapter = pushAdapter();
  const payload = (job.payload ?? {}) as { notificationId?: string; reminderDate?: string };
  const notification = payload.notificationId ? await prisma.notification.findUnique({ where: { id: payload.notificationId } }) : null;
  const kind = notification?.kind ?? 'REMINDER';
  const text = GENERIC_TEXT[kind];
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: job.userId!, disabledAt: null } });

  if (!adapter.configured) {
    await prisma.notificationDelivery.create({ data: { userId: job.userId!, jobId: job.id, notificationId: notification?.id ?? null, channel: 'WEB_PUSH', status: 'SKIPPED', detail: 'Web Push is not configured on this server' } });
    return 'push_not_configured';
  }
  if (subscriptions.length === 0) return 'no_subscription';

  let accepted = 0;
  for (const subscription of subscriptions) {
    const result = await adapter.send(subscription, { ...text, tag: notification?.dedupeKey ?? job.id });
    if (result.ok) {
      accepted += 1;
      await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastAcceptedAt: new Date(), failureCount: 0 } });
    } else {
      await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { failureCount: { increment: 1 }, ...(result.gone ? { disabledAt: new Date() } : {}) } });
    }
    await prisma.notificationDelivery.create({
      data: { userId: job.userId!, jobId: job.id, notificationId: notification?.id ?? null, channel: 'WEB_PUSH', status: result.ok ? 'ACCEPTED' : 'FAILED', detail: result.ok ? 'Accepted by the push service (not a delivery confirmation)' : result.error },
    });
  }
  return accepted > 0 ? `accepted_by_${accepted}` : 'all_failed';
}

export async function runWorkerOnce(now = new Date(), workerId = WORKER_ID) {
  const scheduled = await scheduleReminders(now);
  const therapists = await prisma.user.findMany({ where: { role: 'THERAPIST' }, select: { id: true } });
  for (const therapist of therapists) await evaluateMissedActivity(therapist.id, now);

  const jobs = await claimJobs(workerId, 50, now);
  const summary = { scheduled, processed: 0, suppressed: 0, rescheduled: 0, failed: 0 };

  for (const job of jobs) {
    try {
      if (job.kind === 'REMINDER') {
        const outcome = await processReminder(job, now);
        if (outcome.status === 'RESCHEDULE') {
          await rescheduleJob(job, workerId, outcome.runAt, outcome.result);
          summary.rescheduled += 1;
        } else {
          await finishJob(job, workerId, outcome.status, outcome.result, now);
          if (outcome.status === 'SUPPRESSED') summary.suppressed += 1;
          else summary.processed += 1;
        }
      } else if (job.kind === 'PUSH') {
        await finishJob(job, workerId, 'DONE', await processPush(job), now);
        summary.processed += 1;
      } else {
        await finishJob(job, workerId, 'SUPPRESSED', 'unknown_kind', now);
      }
    } catch (error) {
      summary.failed += 1;
      // Log only the job id and error type, never payloads.
      console.error(`[worker] job ${job.id} (${job.kind}) failed: ${error instanceof Error ? error.name : 'error'}`);
      await failJob(job, workerId, error instanceof Error ? error.message : 'error', now);
    }
  }
  return summary;
}
