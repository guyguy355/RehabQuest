/**
 * Stage 3 routes: goals and milestones, measurements, weekly check-ins, analytics, motivation and
 * educational cards. Therapist routes require an active care link (ADR-004); patients only reach
 * their own data.
 */
import { Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest, handle, param, parse, requireUser } from '../http.js';
import { isDateKey, localDateKey } from '../lib/dates.js';
import { requirePatient, requireTherapist } from '../middleware/auth.middleware.js';
import { getLinkedPatient } from '../services/access.js';
import { listCheckIns, openWeeks, submitCheckIn } from '../services/checkins.js';
import { acknowledge, assignCard, createCard, getCard, listAssignments, listCards, setCardArchived, unassignCard, updateCard } from '../services/education.js';
import { isCosmeticUnlocked } from '../services/gamification.js';
import { addMilestone, createDefinition, createGoal, recordMeasurement, serializeDefinition, setMilestone, updateDefinition, updateGoal } from '../services/goals.js';
import { getAnalytics, getGoalsAndMeasurements } from '../services/insights.js';
import { getMotivation, getPreferences } from '../services/motivation.js';
import { listBadges } from '../services/plans.js';


const dateKey = z.string().refine(isDateKey, 'Use a valid date (YYYY-MM-DD)');
const text = (max: number) => z.string().trim().min(1, 'This field is required').max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);
const decimal = z.number().finite().refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, 'Use at most 2 decimal places');
const idempotencyKey = z.string().trim().min(8).max(100).nullish().transform((value) => value ?? null);
const weeksQuery = z.object({ weeks: z.coerce.number().int().min(4).max(52).default(12) });

const goalSchema = z.object({
  title: text(120),
  description: optionalText(500),
  kind: z.enum(['FUNCTIONAL', 'MEASUREMENT']),
  definitionId: z.string().min(1).nullish().transform((value) => value ?? null),
  baselineValue: decimal.nullish().transform((value) => value ?? null),
  targetValue: decimal.nullish().transform((value) => value ?? null),
  targetDate: dateKey.nullish().transform((value) => value ?? null),
  milestones: z.array(z.object({ title: text(120), targetDate: dateKey.nullish().transform((value) => value ?? null) })).max(10).default([]),
});

const goalPatchSchema = z.object({
  lockVersion: z.number().int().min(0),
  title: text(120).optional(),
  description: optionalText(500).optional(),
  targetDate: dateKey.nullable().optional(),
  targetValue: decimal.nullable().optional(),
  baselineValue: decimal.nullable().optional(),
  status: z.enum(['ACTIVE', 'ACHIEVED', 'ARCHIVED']).optional(),
});

const milestoneSchema = z.object({ title: text(120), targetDate: dateKey.nullish().transform((value) => value ?? null) });
const milestonePatchSchema = z.object({ achieved: z.boolean().optional(), note: optionalText(300).optional(), title: text(120).optional() });

const definitionSchema = z.object({
  name: text(80),
  unit: text(20),
  direction: z.enum(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER']),
  minValue: decimal,
  maxValue: decimal,
  patientCanRecord: z.boolean().default(false),
});

const measurementSchema = z.object({ value: decimal, measuredOn: dateKey, note: optionalText(300), idempotencyKey });

const score = (min: number, max: number) => z.number().int().min(min).max(max).nullable().default(null);
const checkInSchema = z.object({
  painTypical: score(0, 10),
  painWorst: score(0, 10),
  activityLimit: score(0, 10),
  confidence: score(1, 5),
  note: optionalText(500),
  idempotencyKey,
});

const cardSchema = z.object({ title: text(120), body: text(4000), readingMinutes: z.number().int().min(1).max(30) });
const assignSchema = z.object({ cardId: z.string().min(1), taskId: z.string().min(1).nullish().transform((value) => value ?? null), note: optionalText(300) });

const preferencesSchema = z.object({
  calmMode: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  weeklySessionGoal: z.number().int().min(1).max(7).nullable().optional(),
  mascotCosmetic: z.string().min(1).max(40).optional(),
});

/** Comfort settings for every signed-in user; motivation settings for patients. */
export function createPreferencesRouter() {
  const router = Router();

  router.get(
    '/preferences',
    handle(async (request, response) => {
      response.json({ preference: await getPreferences(prisma, requireUser(request).id) });
    }),
  );

  router.patch(
    '/preferences',
    handle(async (request, response) => {
      const user = requireUser(request);
      const patch = parse(preferencesSchema, request.body);
      if (user.role !== Role.PATIENT && (patch.weeklySessionGoal !== undefined || patch.mascotCosmetic !== undefined)) {
        throw badRequest('These settings are for patients');
      }
      if (patch.mascotCosmetic !== undefined) {
        const earned = (await listBadges(prisma, user.id)).filter((badge) => badge.earnedAt).map((badge) => badge.id);
        if (!isCosmeticUnlocked(patch.mascotCosmetic, earned)) throw badRequest('This look is not unlocked yet');
      }
      await getPreferences(prisma, user.id);
      await prisma.userPreference.update({ where: { userId: user.id }, data: patch });
      response.json({ preference: await getPreferences(prisma, user.id) });
    }),
  );

  return router;
}

export function createPatientCareRouter() {
  const router = Router();
  router.use(requirePatient);

  router.get(
    '/motivation',
    handle(async (request, response) => {
      response.json(await getMotivation(prisma, requireUser(request)));
    }),
  );

  router.get(
    '/analytics',
    handle(async (request, response) => {
      const { weeks } = parse(weeksQuery, request.query);
      response.json(await getAnalytics(requireUser(request), weeks));
    }),
  );

  router.get(
    '/goals',
    handle(async (request, response) => {
      response.json(await getGoalsAndMeasurements(requireUser(request).id));
    }),
  );

  router.post(
    '/measurements/:definitionId',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const input = parse(measurementSchema, request.body);
      const result = await recordMeasurement({ id: patient.id, role: 'PATIENT' }, param(request, 'definitionId'), input);
      response.status(result.created ? 201 : 200).json({ created: result.created, id: result.measurement.id });
    }),
  );

  router.get(
    '/check-ins',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const today = localDateKey(patient.timezone);
      response.json({ today, openWeeks: openWeeks(today), checkIns: await listCheckIns(patient.id) });
    }),
  );

  router.put(
    '/check-ins/:weekStart',
    handle(async (request, response) => {
      const patient = requireUser(request);
      const weekStart = param(request, 'weekStart');
      if (!isDateKey(weekStart)) throw badRequest('Use a valid week (YYYY-MM-DD)');
      const input = parse(checkInSchema, request.body);
      const result = await submitCheckIn(patient, weekStart, input);
      const newBadges = result.newBadgeIds.length ? (await listBadges(prisma, patient.id)).filter((badge) => result.newBadgeIds.includes(badge.id)) : [];
      response.status(result.created ? 201 : 200).json({ checkIn: result.checkIn, newBadges });
    }),
  );

  router.get(
    '/education',
    handle(async (request, response) => {
      response.json({ cards: await listAssignments(requireUser(request).id) });
    }),
  );

  router.post(
    '/education/:assignmentId/read',
    handle(async (request, response) => {
      const { versionId } = parse(z.object({ versionId: z.string().min(1) }), request.body);
      response.json({ card: await acknowledge(requireUser(request).id, param(request, 'assignmentId'), versionId) });
    }),
  );

  return router;
}

export function createTherapistCareRouter() {
  const router = Router();
  router.use(requireTherapist);

  router.get(
    '/patients/:patientId/goals',
    handle(async (request, response) => {
      const patient = await getLinkedPatient(requireUser(request).id, param(request, 'patientId'));
      response.json(await getGoalsAndMeasurements(patient.id, { includeArchived: true }));
    }),
  );

  router.post(
    '/patients/:patientId/goals',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      response.status(201).json({ goal: await createGoal(therapist.id, patient.id, parse(goalSchema, request.body)) });
    }),
  );

  router.patch(
    '/goals/:goalId',
    handle(async (request, response) => {
      response.json({ goal: await updateGoal(requireUser(request).id, param(request, 'goalId'), parse(goalPatchSchema, request.body)) });
    }),
  );

  router.post(
    '/goals/:goalId/milestones',
    handle(async (request, response) => {
      response.status(201).json({ goal: await addMilestone(requireUser(request).id, param(request, 'goalId'), parse(milestoneSchema, request.body)) });
    }),
  );

  router.patch(
    '/milestones/:milestoneId',
    handle(async (request, response) => {
      response.json({ goal: await setMilestone(requireUser(request).id, param(request, 'milestoneId'), parse(milestonePatchSchema, request.body)) });
    }),
  );

  router.post(
    '/patients/:patientId/measurements',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      response.status(201).json({ measurement: await createDefinition(therapist.id, patient.id, parse(definitionSchema, request.body)) });
    }),
  );

  router.patch(
    '/measurements/:definitionId',
    handle(async (request, response) => {
      const patch = parse(z.object({ patientCanRecord: z.boolean().optional(), archived: z.boolean().optional() }), request.body);
      response.json({ measurement: await updateDefinition(requireUser(request).id, param(request, 'definitionId'), patch) });
    }),
  );

  router.post(
    '/measurements/:definitionId/values',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const result = await recordMeasurement({ id: therapist.id, role: 'THERAPIST' }, param(request, 'definitionId'), parse(measurementSchema, request.body));
      const definition = await prisma.measurementDefinition.findUniqueOrThrow({ where: { id: result.measurement.definitionId }, include: { measurements: { orderBy: [{ measuredOn: 'asc' }, { createdAt: 'asc' }] } } });
      response.status(result.created ? 201 : 200).json({ created: result.created, measurement: serializeDefinition(definition) });
    }),
  );

  router.get(
    '/patients/:patientId/analytics',
    handle(async (request, response) => {
      const patient = await getLinkedPatient(requireUser(request).id, param(request, 'patientId'));
      const { weeks } = parse(weeksQuery, request.query);
      const [analytics, checkIns] = await Promise.all([getAnalytics(patient, weeks), listCheckIns(patient.id)]);
      response.json({ ...analytics, checkIns });
    }),
  );

  router.get(
    '/education',
    handle(async (request, response) => {
      const archived = request.query.archived === 'true';
      response.json({ cards: await listCards(requireUser(request).id, { includeArchived: archived }) });
    }),
  );

  router.post(
    '/education',
    handle(async (request, response) => {
      response.status(201).json({ card: await createCard(requireUser(request).id, parse(cardSchema, request.body)) });
    }),
  );

  router.get(
    '/education/:cardId',
    handle(async (request, response) => {
      response.json({ card: await getCard(requireUser(request).id, param(request, 'cardId')) });
    }),
  );

  router.put(
    '/education/:cardId',
    handle(async (request, response) => {
      const input = parse(cardSchema.extend({ lockVersion: z.number().int().min(0) }), request.body);
      response.json({ card: await updateCard(requireUser(request).id, param(request, 'cardId'), input) });
    }),
  );

  router.post(
    '/education/:cardId/archive',
    handle(async (request, response) => {
      const { archived } = parse(z.object({ archived: z.boolean() }), request.body);
      response.json({ card: await setCardArchived(requireUser(request).id, param(request, 'cardId'), archived) });
    }),
  );

  router.get(
    '/patients/:patientId/education',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      response.json({ cards: await listAssignments(patient.id, therapist.id) });
    }),
  );

  router.post(
    '/patients/:patientId/education',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      response.status(201).json({ card: await assignCard(therapist.id, patient.id, parse(assignSchema, request.body)) });
    }),
  );

  router.delete(
    '/education-assignments/:assignmentId',
    handle(async (request, response) => {
      await unassignCard(requireUser(request).id, param(request, 'assignmentId'));
      response.status(204).end();
    }),
  );

  return router;
}
