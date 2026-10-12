import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { handle, param, parse, requireUser } from '../http.js';
import { addDays, fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import { requirePatient } from '../middleware/auth.middleware.js';
import { completeTask, getPatientOverview, getPatientTotals, listBadges, serializeCompletion } from '../services/plans.js';

const completionSchema = z.object({
  status: z.enum(['COMPLETED', 'STOPPED']).default('COMPLETED'),
  painLevel: z.number({ required_error: 'Pain level is required' }).int().min(0).max(10),
  difficulty: z.enum(['TOO_EASY', 'JUST_RIGHT', 'TOO_HARD']).nullish(),
  notes: z.string().trim().max(500, 'Notes can be at most 500 characters').nullish().transform((value) => value || null),
});

const reminderSchema = z.object({
  dailyExerciseRemindersEnabled: z.boolean(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'),
});

const historySchema = z.object({ days: z.coerce.number().int().min(1).max(180).default(30) });

const notificationPreferenceSelect = { dailyExerciseRemindersEnabled: true, reminderTime: true, updatedAt: true } as const;

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

      const byDay = new Map<string, { date: string; completed: number; stopped: number; painTotal: number; count: number }>();
      for (const completion of completions) {
        const key = fromDbDate(completion.sessionDate);
        const entry = byDay.get(key) ?? { date: key, completed: 0, stopped: 0, painTotal: 0, count: 0 };
        if (completion.status === 'COMPLETED') entry.completed += 1;
        else entry.stopped += 1;
        entry.painTotal += completion.painLevel;
        entry.count += 1;
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
          .map((entry) => ({ date: entry.date, averagePain: Math.round((entry.painTotal / entry.count) * 10) / 10, completed: entry.completed, stopped: entry.stopped })),
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
          select: { createdAt: true, therapist: { select: { id: true, name: true, email: true } } },
        }),
      ]);

      response.json({
        careCode: user.careCode,
        therapists: links.map((link) => ({ ...link.therapist, linkedAt: link.createdAt })),
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
      response.json({ preference });
    }),
  );

  return router;
}
