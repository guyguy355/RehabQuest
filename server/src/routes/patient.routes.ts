import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { handle, HttpError, param, parse, requireUser } from '../http.js';
import { addDays, fromDbDate, isDateKey, localDateKey, toDbDate } from '../lib/dates.js';
import { requirePatient } from '../middleware/auth.middleware.js';
import { endCareRelationship } from '../services/messaging.js';
import { completeTask, getPatientOverview, getPatientTotals, listBadges, serializeCompletion } from '../services/plans.js';
import { rescheduleForUser } from '../services/reminders/index.js';
import { zonedTimeToUtc } from '../services/reminders/time.js';
import { createCareCode } from './auth.routes.js';

const OUTCOME_REASONS = ['PAIN_OR_DISCOMFORT', 'TIRED', 'NO_TIME', 'FORGOT', 'NO_EQUIPMENT', 'UNSURE_HOW', 'OTHER'] as const;

/**
 * One outcome for one prescribed exercise.
 * - Pain (0–10) is required when the exercise was performed or stopped; optional when skipped.
 * - PARTIAL needs the number of sets done.
 * - sessionDate / planVersionId / idempotencyKey / occurredAt bind an offline replay to its occurrence.
 */
export const completionSchema = z
  .object({
    status: z.enum(['COMPLETED', 'PARTIAL', 'SKIPPED', 'STOPPED']).default('COMPLETED'),
    painLevel: z.number().int().min(0).max(10).nullish(),
    difficulty: z.enum(['TOO_EASY', 'JUST_RIGHT', 'TOO_HARD']).nullish(),
    reason: z.enum(OUTCOME_REASONS).nullish(),
    notes: z.string().trim().max(500, 'Notes can be at most 500 characters').nullish().transform((value) => value || null),
    setsCompleted: z.number().int().min(0).max(20).nullish(),
    repsPerSet: z.array(z.number().int().min(0).max(200)).max(20).optional(),
    activeSeconds: z.number().int().min(0).max(24 * 3600).nullish(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, 'Invalid request key').nullish(),
    sessionDate: z.string().refine(isDateKey, 'Use a valid date (YYYY-MM-DD)').nullish(),
    planVersionId: z.string().min(1).max(60).nullish(),
    occurredAt: z.coerce.date().nullish(),
    offline: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.status !== 'SKIPPED' && (value.painLevel === null || value.painLevel === undefined)) {
      context.addIssue({ code: 'custom', path: ['painLevel'], message: 'Pain level is required' });
    }
    if (value.status === 'PARTIAL' && !value.setsCompleted) {
      context.addIssue({ code: 'custom', path: ['setsCompleted'], message: 'How many sets were done?' });
    }
    if ((value.status === 'COMPLETED' || value.status === 'PARTIAL') && value.reason) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'A reason is only recorded for skipped or stopped exercises' });
    }
  });

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format');
const reminderSchema = z
  .object({
    dailyExerciseRemindersEnabled: z.boolean(),
    reminderTime: hhmm,
    quietHoursStart: hhmm.nullish().transform((value) => value ?? null),
    quietHoursEnd: hhmm.nullish().transform((value) => value ?? null),
    inAppEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.quietHoursStart) === Boolean(value.quietHoursEnd), { message: 'Set both the start and the end of quiet hours', path: ['quietHoursEnd'] });
const snoozeSchema = z.object({ until: z.enum(['1h', '3h', 'tomorrow', 'off']) });

const historySchema = z.object({ days: z.coerce.number().int().min(1).max(180).default(30) });

const notificationPreferenceSelect = { dailyExerciseRemindersEnabled: true, reminderTime: true, quietHoursStart: true, quietHoursEnd: true, snoozedUntil: true, inAppEnabled: true, pushEnabled: true, updatedAt: true } as const;

export function createPatientRouter() {
  const router = Router();
  router.use(requirePatient);

  /** Home screen: today's prescribed tasks, the plan path, streak and XP. */
  router.get(
    '/overview',
    handle(async (request, response) => {
      const patient = requireUser(request);
      response.json(await getPatientOverview(prisma, patient));
    }),
  );

  /** Complete (or stop for symptoms) one of today's tasks. Idempotent per task per day. */
  router.post(
    '/tasks/:taskId/completion',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const input = parse(completionSchema, request.body);
      const result = await completeTask(patient, param(request, 'taskId'), input);
      const badges = result.newBadgeIds.length > 0 ? (await listBadges(prisma, patient.id)).filter((badge) => result.newBadgeIds.includes(badge.id)) : [];
      const totals = await getPatientTotals(prisma, patient.id, result.today);

      response.status(result.alreadyRecorded ? 200 : 201).json({
        alreadyRecorded: result.alreadyRecorded,
        completion: serializeCompletion(result.completion),
        xpAwarded: result.xpAwarded,
        sessionComplete: result.sessionComplete,
        newBadges: badges,
        weeklyGoal: result.weeklyGoal,
        ...totals,
      });
    }),
  );

  /** Progress screen: totals, achievements, recent history and pain trend. */
  router.get(
    '/progress',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const { days } = parse(historySchema, request.query);
      const today = localDateKey(patient.timezone);
      const from = addDays(today, -(days - 1));

      const [overview, badges, completions] = await Promise.all([
        getPatientOverview(prisma, patient),
        listBadges(prisma, patient.id),
        prisma.taskCompletion.findMany({
          where: { patientId: patient.id, sessionDate: { gte: toDbDate(from) } },
          orderBy: [{ sessionDate: 'desc' }, { completedAt: 'desc' }],
          include: { task: { select: { exercise: { select: { id: true, title: true } } } } },
        }),
      ]);

      // Days without any pain report are left out of the pain series (missing data, not zero pain).
      const byDay = new Map<string, { date: string; completed: number; partial: number; skipped: number; stopped: number; painTotal: number; count: number }>();
      for (const completion of completions) {
        const key = fromDbDate(completion.sessionDate);
        const entry = byDay.get(key) ?? { date: key, completed: 0, partial: 0, skipped: 0, stopped: 0, painTotal: 0, count: 0 };
        if (completion.status === 'COMPLETED') entry.completed += 1;
        else if (completion.status === 'PARTIAL') entry.partial += 1;
        else if (completion.status === 'SKIPPED') entry.skipped += 1;
        else entry.stopped += 1;
        if (completion.painLevel !== null) {
          entry.painTotal += completion.painLevel;
          entry.count += 1;
        }
        byDay.set(key, entry);
      }

      response.json({
        today,
        streak: overview.streak,
        xpTotal: overview.xpTotal,
        xpLast7Days: overview.xpLast7Days,
        stats: overview.stats,
        plan: overview.plan ? { id: overview.plan.id, title: overview.plan.title, startDate: overview.plan.startDate, endDate: overview.plan.endDate } : null,
        badges,
        history: completions.map(serializeCompletion),
        dailyPain: [...byDay.values()]
          .sort((a, b) => a.date.localeCompare(b.date))
          .filter((entry) => entry.count > 0)
          .map((entry) => ({ date: entry.date, averagePain: Math.round((entry.painTotal / entry.count) * 10) / 10, reports: entry.count, completed: entry.completed, partial: entry.partial, skipped: entry.skipped, stopped: entry.stopped })),
      });
    }),
  );

  /** Care team + the code the patient shares to let a therapist link to them. */
  router.get(
    '/profile',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const [user, links] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: patient.id }, select: { careCode: true } }),
        prisma.therapistPatient.findMany({
          where: { patientId: patient.id },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true, endedAt: true, therapist: { select: { id: true, name: true, email: true } } },
        }),
      ]);

      response.json({
        careCode: user.careCode,
        therapists: links.map((link) => ({ ...link.therapist, linkedAt: link.createdAt, endedAt: link.endedAt, active: link.endedAt === null })),
      });
    }),
  );

  router.get(
    '/notification-preferences',
    handle(async (request, response) => {
      const patient = requireUser(request);
      // Insert-if-missing without a race: Prisma's upsert can fail with a unique
      // violation when two first requests arrive at the same time.
      await prisma.patientNotificationPreference.createMany({ data: [{ userId: patient.id }], skipDuplicates: true });
      const preference = await prisma.patientNotificationPreference.findUniqueOrThrow({
        where: { userId: patient.id },
        select: notificationPreferenceSelect,
      });
      response.json({ preference });
    }),
  );

  router.patch(
    '/notification-preferences',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const input = parse(reminderSchema, request.body);
      const preference = await prisma.patientNotificationPreference.upsert({
        where: { userId: patient.id },
        create: { userId: patient.id, ...input },
        update: input,
        select: notificationPreferenceSelect,
      });
      await rescheduleForUser(patient.id);
      response.json({ preference });
    }),
  );

  /** Snooze today's reminder. Snoozing past the end of the day skips today's reminder. */
  router.post(
    '/notification-preferences/snooze',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const { until } = parse(snoozeSchema, request.body);
      const now = Date.now();
      const tomorrow = zonedTimeToUtc(addDays(localDateKey(patient.timezone), 1), '06:00', patient.timezone);
      const snoozedUntil = until === 'off' ? null : until === '1h' ? new Date(now + 3600_000) : until === '3h' ? new Date(now + 3 * 3600_000) : tomorrow;
      await prisma.patientNotificationPreference.createMany({ data: [{ userId: patient.id }], skipDuplicates: true });
      const preference = await prisma.patientNotificationPreference.update({ where: { userId: patient.id }, data: { snoozedUntil }, select: notificationPreferenceSelect });
      response.json({ preference });
    }),
  );

  /** Replaces the care code, e.g. if it was shared by mistake. Existing links are not affected. */
  router.post(
    '/care-code/regenerate',
    handle(async (request, response) => {
      const patient = requireUser(request);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const user = await prisma.user.update({ where: { id: patient.id }, data: { careCode: createCareCode() }, select: { careCode: true } });
          response.json({ careCode: user.careCode });
          return;
        } catch {
          // unique collision: try again
        }
      }
      throw new HttpError(500, 'Could not create a new code. Please try again.');
    }),
  );

  /** The patient ends a care relationship (ADR-004). */
  router.post(
    '/therapists/:therapistId/end-care',
    handle(async (request, response) => {
      const patient = requireUser(request);
      response.json(await endCareRelationship(patient, { therapistId: param(request, 'therapistId'), patientId: patient.id }));
    }),
  );

  return router;
}
