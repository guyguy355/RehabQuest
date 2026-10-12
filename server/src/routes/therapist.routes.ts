import { Difficulty, PlanStatus, Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { badRequest, conflict, handle, param, notFound, parse, requireUser } from '../http.js';
import { addDays, type DateKey, diffDays, fromDbDate, isDateKey, localDateKey, toDbDate } from '../lib/dates.js';
import { requireTherapist } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getLinkedPatient, getOwnedPlanId } from '../services/access.js';
import { loadCompletions, loadPlan, serializeCompletion, serializePlan, toSchedule } from '../services/plans.js';
import { buildDays, computeStreak, reviewReasons, sessionStats } from '../services/progress.js';
import { createProgressSummary, type SummaryModel } from '../services/summary/index.js';

const dateKey = z.string().refine(isDateKey, 'Use a valid date (YYYY-MM-DD)');
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);

const taskInput = z.object({
  id: z.string().min(1).optional(),
  exerciseId: z.string().min(1, 'Choose an exercise'),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  durationSeconds: z.number().int().min(1).max(3600),
  notes: optionalText(300),
});

const planFields = {
  title: z.string().trim().min(1, 'Title is required').max(100),
  condition: z.string().trim().min(1, 'Focus area is required').max(100),
  endDate: dateKey,
  trainingWeekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Choose at least one training day')
    .max(7)
    .refine((days) => new Set(days).size === days.length, 'Training days must be unique')
    .transform((days) => [...days].sort()),
  therapistNotes: optionalText(1000),
  tasks: z.array(taskInput).min(1, 'Add at least one exercise').max(12, 'A plan can have at most 12 exercises'),
};

const createPlanSchema = z
  .object({ ...planFields, startDate: dateKey })
  .refine((plan) => plan.endDate >= plan.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] })
  .refine((plan) => diffDays(plan.startDate, plan.endDate) <= 365, { message: 'A plan can last at most one year', path: ['endDate'] });

const updatePlanSchema = z.object({ ...planFields, startDate: dateKey.optional() });

const statusSchema = z.object({ status: z.enum([PlanStatus.ACTIVE, PlanStatus.PAUSED, PlanStatus.COMPLETED]) });
const linkSchema = z.object({
  patientEmail: z.string().trim().toLowerCase().email('Enter a valid email address'),
  careCode: z.string().trim().toUpperCase().regex(/^[0-9A-F]{8}$/, 'The care code has 8 characters (0-9, A-F)'),
});
const summarySchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14) });

const exerciseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  description: z.string().trim().min(1, 'Description is required').max(500),
  instructions: optionalText(2000),
  safetyNotes: optionalText(1000),
  bodyPart: z.string().trim().min(1, 'Body area is required').max(60),
  difficulty: z.nativeEnum(Difficulty),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  durationSeconds: z.number().int().min(1).max(3600),
  videoUrl: z.string().trim().url('Use a full https:// URL').max(500).nullish().or(z.literal('')).transform((value) => value || null),
  imageUrl: z.string().trim().url('Use a full https:// URL').max(500).nullish().or(z.literal('')).transform((value) => value || null),
});

const exerciseSelect = {
  id: true,
  title: true,
  description: true,
  instructions: true,
  safetyNotes: true,
  bodyPart: true,
  difficulty: true,
  sets: true,
  reps: true,
  durationSeconds: true,
  videoUrl: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tasks: true } },
} as const;

async function assertOwnExercises(therapistId: string, exerciseIds: string[]) {
  const unique = [...new Set(exerciseIds)];
  const count = await prisma.exercise.count({ where: { id: { in: unique }, createdById: therapistId } });

  if (count !== unique.length) {
    throw badRequest('One or more exercises were not found in your library');
  }
}

/** Snapshot used by the patient list and the patient detail header. */
async function patientSnapshot(therapistId: string, patient: { id: string; timezone: string }) {
  const today = localDateKey(patient.timezone);
  const plan =
    (await loadPlan(prisma, { patientId: patient.id, therapistId, status: PlanStatus.ACTIVE })) ??
    (await loadPlan(prisma, { patientId: patient.id, therapistId }));
  const openReviews = await prisma.taskCompletion.count({
    where: { patientId: patient.id, needsReview: true, reviewedAt: null, task: { plan: { therapistId } } },
  });
  const last = await prisma.taskCompletion.findFirst({
    where: { patientId: patient.id, task: { plan: { therapistId } } },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  });

  if (!plan) {
    return { today, plan: null, openReviews, lastActivityAt: last?.completedAt ?? null, streak: 0, last7Days: null, stats: null, todayState: null };
  }

  const completions = await loadCompletions(prisma, plan.id);
  const days = buildDays(
    toSchedule(plan),
    completions.map((completion) => ({ taskId: completion.taskId, sessionDate: fromDbDate(completion.sessionDate), status: completion.status })),
    today,
  );
  const recent = days.filter((day) => day.date > addDays(today, -7) && day.date <= today);

  return {
    today,
    plan: { id: plan.id, title: plan.title, status: plan.status, startDate: fromDbDate(plan.startDate), endDate: fromDbDate(plan.endDate) },
    openReviews,
    lastActivityAt: last?.completedAt ?? null,
    streak: plan.status === PlanStatus.ACTIVE ? computeStreak(days, today) : 0,
    last7Days: sessionStats(recent, today),
    stats: sessionStats(days, today),
    todayState: days.find((day) => day.date === today)?.state ?? null,
    days,
  };
}

export function createTherapistRouter(deps: { summaryModel?: SummaryModel | null } = {}) {
  const router = Router();
  router.use(requireTherapist);

  // ---------------------------------------------------------------- patients
  router.get(
    '/patients',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const links = await prisma.therapistPatient.findMany({
        where: { therapistId: therapist.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, patient: { select: { id: true, name: true, email: true, timezone: true } } },
      });

      const patients = await Promise.all(
        links.map(async (link) => {
          const { days: _days, ...snapshot } = await patientSnapshot(therapist.id, link.patient);
          return { id: link.patient.id, name: link.patient.name, email: link.patient.email, linkedAt: link.createdAt, ...snapshot };
        }),
      );

      response.json({ patients });
    }),
  );

  router.post(
    '/patients/link',
    rateLimit({ windowMs: 15 * 60 * 1000, max: config.authRateLimit.max }),
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const input = parse(linkSchema, request.body);
      const patient = await prisma.user.findFirst({
        where: { email: input.patientEmail, role: Role.PATIENT, careCode: input.careCode },
        select: { id: true, name: true, email: true },
      });

      // One generic message, so the endpoint does not reveal which emails exist.
      if (!patient) {
        throw notFound('No patient matches that email and care code. Ask the patient to check the code on their Profile screen.');
      }

      try {
        const link = await prisma.therapistPatient.create({ data: { therapistId: therapist.id, patientId: patient.id } });
        response.status(201).json({ patient, linkedAt: link.createdAt });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw conflict('This patient is already in your list', 'already_linked');
        }
        throw error;
      }
    }),
  );

  router.get(
    '/patients/:patientId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      const snapshot = await patientSnapshot(therapist.id, patient);

      const [plans, completions] = await Promise.all([
        prisma.rehabPlan.findMany({
          where: { patientId: patient.id, therapistId: therapist.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, condition: true, status: true, startDate: true, endDate: true, createdAt: true },
        }),
        prisma.taskCompletion.findMany({
          where: { patientId: patient.id, task: { plan: { therapistId: therapist.id } } },
          orderBy: [{ sessionDate: 'desc' }, { completedAt: 'desc' }],
          take: 100,
          include: { task: { select: { exercise: { select: { id: true, title: true } } } } },
        }),
      ]);

      const currentPlan = snapshot.plan ? await loadPlan(prisma, { id: snapshot.plan.id }) : null;

      response.json({
        patient: { id: patient.id, name: patient.name, email: patient.email, timezone: patient.timezone, linkedAt: patient.linkedAt },
        snapshot,
        currentPlan: currentPlan ? serializePlan(currentPlan, snapshot.today) : null,
        plans: plans.map((plan) => ({ ...plan, startDate: fromDbDate(plan.startDate), endDate: fromDbDate(plan.endDate) })),
        completions: completions.map((completion) => ({ ...serializeCompletion(completion), reviewReasons: reviewReasons(completion) })),
      });
    }),
  );

  // ------------------------------------------------------------------- plans
  router.post(
    '/patients/:patientId/plans',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      const input = parse(createPlanSchema, request.body);
      const today = localDateKey(patient.timezone);

      if (input.startDate < today) {
        throw badRequest('The start date cannot be in the past', { fields: { startDate: 'The start date cannot be in the past' } });
      }

      await assertOwnExercises(therapist.id, input.tasks.map((task) => task.exerciseId));

      const active = await prisma.rehabPlan.findFirst({ where: { patientId: patient.id, status: PlanStatus.ACTIVE }, select: { therapistId: true } });
      if (active) {
        throw conflict(
          active.therapistId === therapist.id
            ? 'This patient already has an active plan. Edit it, or pause/complete it first.'
            : 'This patient already has an active plan with another therapist.',
          'active_plan_exists',
        );
      }

      try {
        const plan = await prisma.rehabPlan.create({
          data: {
            patientId: patient.id,
            therapistId: therapist.id,
            title: input.title,
            condition: input.condition,
            startDate: toDbDate(input.startDate),
            endDate: toDbDate(input.endDate),
            trainingWeekdays: input.trainingWeekdays,
            therapistNotes: input.therapistNotes,
            status: PlanStatus.ACTIVE,
            tasks: {
              create: input.tasks.map((task, index) => ({
                exerciseId: task.exerciseId,
                sets: task.sets,
                reps: task.reps,
                durationSeconds: task.durationSeconds,
                notes: task.notes,
                orderIndex: index,
                activeFrom: toDbDate(input.startDate),
              })),
            },
          },
        });

        const created = await loadPlan(prisma, { id: plan.id });
        response.status(201).json({ plan: serializePlan(created!, today) });
      } catch (error) {
        // The partial unique index catches a concurrent second "create plan" request.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw conflict('This patient already has an active plan.', 'active_plan_exists');
        }
        throw error;
      }
    }),
  );

  router.get(
    '/plans/:planId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const owned = await getOwnedPlanId(therapist.id, param(request, 'planId'));
      const plan = await loadPlan(prisma, { id: owned.id });
      const patient = await getLinkedPatient(therapist.id, owned.patientId);
      response.json({ plan: serializePlan(plan!, localDateKey(patient.timezone)), patient: { id: patient.id, name: patient.name } });
    }),
  );

  router.put(
    '/plans/:planId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const owned = await getOwnedPlanId(therapist.id, param(request, 'planId'));
      const patient = await getLinkedPatient(therapist.id, owned.patientId);
      const input = parse(updatePlanSchema, request.body);
      const plan = (await loadPlan(prisma, { id: owned.id }))!;
      const today = localDateKey(patient.timezone);
      const currentStart = fromDbDate(plan.startDate);

      if (plan.status === PlanStatus.COMPLETED) {
        throw conflict('Completed plans cannot be edited. Create a new plan instead.', 'plan_completed');
      }

      let startDate: DateKey = currentStart;
      if (input.startDate && input.startDate !== currentStart) {
        if (currentStart <= today) throw badRequest('The start date cannot change after the plan has started');
        if (input.startDate < today) throw badRequest('The start date cannot be in the past');
        startDate = input.startDate;
      }

      if (input.endDate < startDate) {
        throw badRequest('End date must be on or after the start date', { fields: { endDate: 'End date must be on or after the start date' } });
      }

      await assertOwnExercises(therapist.id, input.tasks.map((task) => task.exerciseId));

      const schedule = toSchedule(plan);
      const currentTasks = schedule.tasks.filter((task) => task.activeUntil === null);
      const currentIds = new Set(currentTasks.map((task) => task.id));

      for (const task of input.tasks) {
        if (task.id && !currentIds.has(task.id)) throw badRequest('One of the exercises is no longer part of this plan. Reload and try again.');
        const existing = task.id ? currentTasks.find((candidate) => candidate.id === task.id) : null;
        if (existing && existing.exerciseId !== task.exerciseId) throw badRequest('To swap an exercise, remove it and add the new one');
      }

      const keptIds = new Set(input.tasks.map((task) => task.id).filter(Boolean) as string[]);
      const removed = currentTasks.filter((task) => !keptIds.has(task.id));
      const newTaskStart = startDate > today ? startDate : today;

      await prisma.$transaction(async (tx) => {
        await tx.rehabPlan.update({
          where: { id: plan.id },
          data: {
            title: input.title,
            condition: input.condition,
            startDate: toDbDate(startDate),
            endDate: toDbDate(input.endDate),
            trainingWeekdays: input.trainingWeekdays,
            therapistNotes: input.therapistNotes,
          },
        });

        for (const task of removed) {
          const completionCount = await tx.taskCompletion.count({ where: { taskId: task.id } });
          if (completionCount === 0 && task.activeFrom >= today) {
            await tx.rehabTask.delete({ where: { id: task.id } });
            continue;
          }
          // Keep history: the task stays visible on days it was prescribed.
          const doneToday = await tx.taskCompletion.count({ where: { taskId: task.id, sessionDate: toDbDate(today) } });
          const lastDay = doneToday > 0 ? today : addDays(today, -1);
          await tx.rehabTask.update({ where: { id: task.id }, data: { activeUntil: toDbDate(lastDay < task.activeFrom ? task.activeFrom : lastDay) } });
        }

        for (const [index, task] of input.tasks.entries()) {
          const data = { sets: task.sets, reps: task.reps, durationSeconds: task.durationSeconds, notes: task.notes, orderIndex: index };
          if (task.id) {
            await tx.rehabTask.update({
              where: { id: task.id },
              // Before the plan starts, moving the start date moves the tasks with it.
              data: currentStart > today ? { ...data, activeFrom: toDbDate(startDate) } : data,
            });
          } else {
            await tx.rehabTask.create({ data: { ...data, planId: plan.id, exerciseId: task.exerciseId, activeFrom: toDbDate(newTaskStart) } });
          }
        }
      });

      const updated = await loadPlan(prisma, { id: plan.id });
      response.json({ plan: serializePlan(updated!, today) });
    }),
  );

  router.patch(
    '/plans/:planId/status',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const owned = await getOwnedPlanId(therapist.id, param(request, 'planId'));
      const { status } = parse(statusSchema, request.body);
      const plan = await prisma.rehabPlan.findUniqueOrThrow({ where: { id: owned.id }, select: { status: true } });

      if (plan.status === PlanStatus.COMPLETED && status !== PlanStatus.COMPLETED) {
        throw conflict('A completed plan cannot be reopened. Create a new plan instead.', 'plan_completed');
      }

      try {
        const updated = await prisma.rehabPlan.update({ where: { id: owned.id }, data: { status }, select: { id: true, status: true } });
        response.json({ plan: updated });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw conflict('This patient already has another active plan.', 'active_plan_exists');
        }
        throw error;
      }
    }),
  );

  // ----------------------------------------------------------------- reviews
  router.get(
    '/reviews',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const items = await prisma.taskCompletion.findMany({
        where: {
          needsReview: true,
          reviewedAt: null,
          task: { plan: { therapistId: therapist.id } },
          patient: { patientLinks: { some: { therapistId: therapist.id } } },
        },
        orderBy: [{ sessionDate: 'desc' }, { completedAt: 'desc' }],
        take: 100,
        include: {
          patient: { select: { id: true, name: true } },
          task: { select: { exercise: { select: { id: true, title: true } } } },
        },
      });

      response.json({
        reviews: items.map((item) => ({ ...serializeCompletion(item), patient: item.patient, reviewReasons: reviewReasons(item) })),
      });
    }),
  );

  router.post(
    '/completions/:completionId/review',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const completion = await prisma.taskCompletion.findFirst({
        where: {
          id: param(request, 'completionId'),
          task: { plan: { therapistId: therapist.id } },
          patient: { patientLinks: { some: { therapistId: therapist.id } } },
        },
        select: { id: true, reviewedAt: true },
      });

      if (!completion) throw notFound('Record not found');

      const updated = completion.reviewedAt
        ? await prisma.taskCompletion.findUniqueOrThrow({ where: { id: completion.id }, include: { task: { select: { exercise: { select: { id: true, title: true } } } } } })
        : await prisma.taskCompletion.update({
            where: { id: completion.id },
            data: { reviewedAt: new Date(), reviewedById: therapist.id },
            include: { task: { select: { exercise: { select: { id: true, title: true } } } } },
          });

      response.json({ completion: serializeCompletion(updated) });
    }),
  );

  // ----------------------------------------------------------------- summary
  router.post(
    '/patients/:patientId/summary',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      const { days } = parse(summarySchema, request.body ?? {});
      const summary = await createProgressSummary({ therapistId: therapist.id, patient, days, model: deps.summaryModel });
      response.json({ summary });
    }),
  );

  // --------------------------------------------------------------- exercises
  router.get(
    '/exercises',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const exercises = await prisma.exercise.findMany({ where: { createdById: therapist.id }, orderBy: { title: 'asc' }, select: exerciseSelect });
      response.json({ exercises: exercises.map(({ _count, ...exercise }) => ({ ...exercise, usedInPlans: _count.tasks })) });
    }),
  );

  router.post(
    '/exercises',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const input = parse(exerciseSchema, request.body);
      const { _count, ...exercise } = await prisma.exercise.create({ data: { ...input, createdById: therapist.id }, select: exerciseSelect });
      response.status(201).json({ exercise: { ...exercise, usedInPlans: _count.tasks } });
    }),
  );

  router.put(
    '/exercises/:exerciseId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const input = parse(exerciseSchema, request.body);
      const result = await prisma.exercise.updateMany({ where: { id: param(request, 'exerciseId'), createdById: therapist.id }, data: input });
      if (result.count === 0) throw notFound('Exercise not found');
      const { _count, ...exercise } = await prisma.exercise.findUniqueOrThrow({ where: { id: param(request, 'exerciseId') }, select: exerciseSelect });
      response.json({ exercise: { ...exercise, usedInPlans: _count.tasks } });
    }),
  );

  router.delete(
    '/exercises/:exerciseId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const exercise = await prisma.exercise.findFirst({ where: { id: param(request, 'exerciseId'), createdById: therapist.id }, select: { id: true, _count: { select: { tasks: true } } } });
      if (!exercise) throw notFound('Exercise not found');
      if (exercise._count.tasks > 0) throw conflict('This exercise is used in a plan and cannot be deleted', 'exercise_in_use');
      await prisma.exercise.delete({ where: { id: exercise.id } });
      response.status(204).send();
    }),
  );

  return router;
}
