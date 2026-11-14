import { Difficulty, PlanStatus, Prisma, Role, VersionStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { CATALOG_BY_KEY, EXERCISE_CATALOG } from '../data/exercise-catalog.js';
import { prisma } from '../db.js';
import { conflict, handle, notFound, param, parse, requireUser } from '../http.js';
import { addDays, fromDbDate, localDateKey } from '../lib/dates.js';
import { requireTherapist } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { activeLinkWhere, getLinkedPatient } from '../services/access.js';
import { audit } from '../services/audit.js';
import { endCareRelationship } from '../services/messaging.js';
import { activeReviewCount } from '../services/reviews.js';
import { loadCompletions, loadPlan, serializeCompletion, serializePlan, toLite, toTimeline } from '../services/plans.js';
import { buildDays, computeStreak, reviewReasons, sessionStats } from '../services/progress.js';
import { createProgressSummary, type SummaryModel } from '../services/summary/index.js';

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);
const optionalUrl = z
  .string()
  .trim()
  .url('Use a full https:// URL')
  .max(500)
  .refine((value) => value.startsWith('https://'), 'Only https:// links are allowed')
  .nullish()
  .or(z.literal(''))
  .transform((value) => value || null);

const linkSchema = z.object({
  patientEmail: z.string().trim().toLowerCase().email('Enter a valid email address'),
  careCode: z.string().trim().toUpperCase().regex(/^[0-9A-F]{8}$/, 'The care code has 8 characters (0-9, A-F)'),
});
const summarySchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14) });

const exerciseSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(100),
    description: z.string().trim().min(1, 'Description is required').max(500),
    instructions: optionalText(2000),
    safetyNotes: optionalText(1000),
    bodyPart: z.string().trim().min(1, 'Body area is required').max(60),
    difficulty: z.nativeEnum(Difficulty),
    sets: z.number().int().min(1).max(20),
    reps: z.number().int().min(1).max(100),
    durationSeconds: z.number().int().min(1).max(3600),
    videoUrl: optionalUrl,
    imageUrl: optionalUrl,
    mediaAlt: optionalText(500),
  })
  .refine((exercise) => !(exercise.videoUrl || exercise.imageUrl) || exercise.mediaAlt, {
    message: 'Describe the image or video in words (caption / text alternative)',
    path: ['mediaAlt'],
  });

const catalogImportSchema = z.object({
  keys: z
    .array(z.string().refine((key) => CATALOG_BY_KEY.has(key), 'Unknown catalog exercise'))
    .min(1, 'Choose at least one exercise')
    .max(EXERCISE_CATALOG.length)
    .transform((keys) => [...new Set(keys)]),
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
  mediaAlt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tasks: true, versionItems: true, templateItems: true } },
} as const;

type ExerciseRow = Prisma.ExerciseGetPayload<{ select: typeof exerciseSelect }>;
const serializeExercise = ({ _count, ...exercise }: ExerciseRow) => ({ ...exercise, usedInPlans: _count.tasks + _count.versionItems, usedInTemplates: _count.templateItems });

/** Snapshot used by the patient list and the patient detail header. */
export async function patientSnapshot(therapistId: string, patient: { id: string; timezone: string }) {
  const today = localDateKey(patient.timezone);
  const plan =
    (await loadPlan(prisma, { patientId: patient.id, therapistId, status: { in: [PlanStatus.ACTIVE, PlanStatus.PAUSED] } })) ??
    (await loadPlan(prisma, { patientId: patient.id, therapistId, status: { in: [PlanStatus.COMPLETED, PlanStatus.DRAFT] } }));
  const openReviews = await activeReviewCount(therapistId, patient.id);
  const last = await prisma.taskCompletion.findFirst({ where: { patientId: patient.id, task: { plan: { therapistId } } }, orderBy: { completedAt: 'desc' }, select: { completedAt: true } });
  const draft = plan ? await prisma.planVersion.findFirst({ where: { planId: plan.id, status: VersionStatus.DRAFT }, select: { id: true } }) : null;

  if (!plan) {
    return { today, plan: null, draftId: null, openReviews, lastActivityAt: last?.completedAt ?? null, streak: 0, last7Days: null, stats: null, todayState: null, days: [] };
  }

  const days = plan.versions.length ? buildDays(toTimeline(plan), toLite(await loadCompletions(prisma, plan.id)), today) : [];
  const recent = days.filter((day) => day.date > addDays(today, -7) && day.date <= today);
  const serialized = serializePlan(plan, today);

  return {
    today,
    plan: { id: plan.id, title: serialized.title, status: plan.status, revision: plan.revision, startDate: serialized.startDate, endDate: serialized.endDate, versionNumber: serialized.versionNumber },
    draftId: draft?.id ?? null,
    openReviews,
    lastActivityAt: last?.completedAt ?? null,
    streak: plan.status === PlanStatus.ACTIVE ? computeStreak(days, today) : 0,
    last7Days: days.length ? sessionStats(recent, today) : null,
    stats: days.length ? sessionStats(days, today) : null,
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
        where: activeLinkWhere(therapist.id),
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
      const patient = await prisma.user.findFirst({ where: { email: input.patientEmail, role: Role.PATIENT, careCode: input.careCode }, select: { id: true, name: true, email: true } });
      // One generic message, so the endpoint does not reveal which emails exist.
      if (!patient) throw notFound('No patient matches that email and care code. Ask the patient to check the code on their Profile screen.');

      try {
        const previous = await prisma.therapistPatient.findUnique({ where: { therapistId_patientId: { therapistId: therapist.id, patientId: patient.id } } });
        if (previous && !previous.endedAt) throw conflict('This patient is already in your list', 'already_linked');
        // A valid care code is the patient's consent, also for re-linking after the relationship ended.
        const link = previous
          ? await prisma.therapistPatient.update({ where: { id: previous.id }, data: { endedAt: null, endedById: null } })
          : await prisma.therapistPatient.create({ data: { therapistId: therapist.id, patientId: patient.id } });
        await audit(prisma, { actorId: therapist.id, action: 'CARE_LINK_CREATED', patientId: patient.id, subjectType: 'TherapistPatient', subjectId: link.id, metadata: { relinked: Boolean(previous) } });
        response.status(201).json({ patient, linkedAt: link.createdAt, relinked: Boolean(previous) });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw conflict('This patient is already in your list', 'already_linked');
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
          select: { id: true, title: true, condition: true, status: true, startDate: true, endDate: true, createdAt: true, _count: { select: { versions: { where: { status: VersionStatus.PUBLISHED } } } } },
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
        currentPlan: currentPlan && currentPlan.versions.length ? serializePlan(currentPlan, snapshot.today) : null,
        plans: plans.map(({ _count, ...plan }) => ({ ...plan, publishedVersions: _count.versions, startDate: fromDbDate(plan.startDate), endDate: fromDbDate(plan.endDate) })),
        completions: completions.map((completion) => ({ ...serializeCompletion(completion), reviewReasons: reviewReasons(completion) })),
      });
    }),
  );

  router.post(
    '/patients/:patientId/end-care',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      response.json(await endCareRelationship(therapist, { therapistId: therapist.id, patientId: patient.id }));
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
      response.json({ exercises: exercises.map(serializeExercise) });
    }),
  );

  router.post(
    '/exercises',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const input = parse(exerciseSchema, request.body);
      const exercise = await prisma.exercise.create({ data: { ...input, createdById: therapist.id }, select: exerciseSelect });
      response.status(201).json({ exercise: serializeExercise(exercise) });
    }),
  );

  /** Edits the library entry only. Published plan versions keep the text they were published with. */
  router.put(
    '/exercises/:exerciseId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const input = parse(exerciseSchema, request.body);
      const result = await prisma.exercise.updateMany({ where: { id: param(request, 'exerciseId'), createdById: therapist.id }, data: input });
      if (result.count === 0) throw notFound('Exercise not found');
      response.json({ exercise: serializeExercise(await prisma.exercise.findUniqueOrThrow({ where: { id: param(request, 'exerciseId') }, select: exerciseSelect })) });
    }),
  );

  router.delete(
    '/exercises/:exerciseId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const exercise = await prisma.exercise.findFirst({ where: { id: param(request, 'exerciseId'), createdById: therapist.id }, select: exerciseSelect });
      if (!exercise) throw notFound('Exercise not found');
      const usage = serializeExercise(exercise);
      if (usage.usedInPlans > 0 || usage.usedInTemplates > 0) throw conflict('This exercise is used in a plan or template and cannot be deleted', 'exercise_in_use');
      await prisma.exercise.delete({ where: { id: exercise.id } });
      response.status(204).send();
    }),
  );

  // ----------------------------------------------------- starter catalog
  /** The shared read-only catalog, with a flag for entries already copied into this therapist's library. */
  router.get(
    '/exercise-catalog',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const copied = await prisma.exercise.findMany({ where: { createdById: therapist.id, catalogKey: { not: null } }, select: { catalogKey: true } });
      const inLibrary = new Set(copied.map((exercise) => exercise.catalogKey));
      response.json({ exercises: EXERCISE_CATALOG.map((exercise) => ({ ...exercise, inLibrary: inLibrary.has(exercise.key) })) });
    }),
  );

  /** Copies catalog entries into the therapist's library. Entries already copied are skipped, so retries are safe. */
  router.post(
    '/exercise-catalog/import',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const { keys } = parse(catalogImportSchema, request.body);
      const result = await prisma.exercise.createMany({
        data: keys.map((key) => {
          const { key: catalogKey, ...exercise } = CATALOG_BY_KEY.get(key)!;
          return { ...exercise, catalogKey, createdById: therapist.id };
        }),
        skipDuplicates: true,
      });
      response.status(201).json({ added: result.count, alreadyInLibrary: keys.length - result.count });
    }),
  );

  return router;
}
