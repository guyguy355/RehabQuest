import { PlanStatus, TemplateStatus, VersionStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { handle, param, parse, requireUser } from '../http.js';
import { fromDbDate, isDateKey, localDateKey } from '../lib/dates.js';
import { requireTherapist } from '../middleware/auth.middleware.js';
import { getLinkedPatient, getOwnedPlanId } from '../services/access.js';
import {
  createDraftFromTemplate,
  createPlanDraft,
  createRevisionDraft,
  createTemplate,
  discardDraft,
  getOwnedTemplate,
  getOwnedVersion,
  listVersions,
  previewDraft,
  publishDraft,
  saveVersionAsTemplate,
  serializeVersion,
  setPlanStatus,
  setTemplateStatus,
  updateDraft,
  updateTemplate,
} from '../services/authoring.js';
import { loadPlan, serializePlan } from '../services/plans.js';

const dateKey = z.string().refine(isDateKey, 'Use a valid date (YYYY-MM-DD)');
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);
const optionalSeconds = z.number().int().min(0).max(600).nullish();

export const itemSchema = z.object({
  taskId: z.string().min(1).nullish(),
  exerciseId: z.string().min(1, 'Choose an exercise'),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  holdSeconds: optionalSeconds,
  restSeconds: optionalSeconds,
  durationSeconds: z.number().int().min(1).max(3600),
  notes: optionalText(300),
});

const weekdays = z
  .array(z.number().int().min(0).max(6))
  .min(1, 'Choose at least one training day')
  .max(7)
  .refine((days) => new Set(days).size === days.length, 'Training days must be unique');

export const draftSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  condition: z.string().trim().min(1, 'Focus area is required').max(100),
  therapistNotes: optionalText(1000),
  trainingWeekdays: weekdays,
  restDates: z.array(dateKey).max(120).default([]),
  effectiveFrom: dateKey,
  endDate: dateKey,
  changeNote: optionalText(300),
  items: z.array(itemSchema).min(1, 'Add at least one exercise').max(12, 'A plan can have at most 12 exercises'),
});

const createPlanSchema = z.union([
  z.object({ templateId: z.string().min(1), startDate: dateKey, publish: z.boolean().optional() }),
  draftSchema.extend({ publish: z.boolean().optional() }),
]);

const lockSchema = z.object({ lockVersion: z.number().int().min(1) });
const statusSchema = z.object({
  status: z.enum([PlanStatus.ACTIVE, PlanStatus.PAUSED, PlanStatus.COMPLETED, PlanStatus.ARCHIVED]),
  expectedRevision: z.number().int().min(1).optional(),
  reason: optionalText(300),
});

const templateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  condition: z.string().trim().min(1, 'Focus area is required').max(100),
  description: optionalText(1000),
  trainingWeekdays: weekdays,
  durationWeeks: z.number().int().min(1).max(52),
  items: z.array(itemSchema.omit({ taskId: true })).min(1, 'Add at least one exercise').max(12),
});

function serializeTemplate(template: Awaited<ReturnType<typeof getOwnedTemplate>>) {
  return {
    id: template.id,
    title: template.title,
    condition: template.condition,
    description: template.description,
    trainingWeekdays: template.trainingWeekdays,
    durationWeeks: template.durationWeeks,
    status: template.status,
    lockVersion: template.lockVersion,
    updatedAt: template.updatedAt,
    items: template.items.map((item) => ({
      id: item.id,
      exerciseId: item.exerciseId,
      exercise: item.exercise,
      orderIndex: item.orderIndex,
      sets: item.sets,
      reps: item.reps,
      holdSeconds: item.holdSeconds,
      restSeconds: item.restSeconds,
      durationSeconds: item.durationSeconds,
      notes: item.notes,
    })),
  };
}

export function createAuthoringRouter() {
  const router = Router();
  router.use(requireTherapist);

  // ------------------------------------------------------------------ plans
  /** Creates a draft plan (from a template or from explicit content). `publish: true` publishes it in the same request. */
  router.post(
    '/patients/:patientId/plans',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const patient = await getLinkedPatient(therapist.id, param(request, 'patientId'));
      const input = parse(createPlanSchema, request.body);

      let draft = 'templateId' in input
        ? await createDraftFromTemplate(therapist.id, patient, input.templateId, input.startDate)
        : await createPlanDraft(therapist.id, patient, input);
      if (input.publish) draft = await publishDraft(therapist.id, draft.id, draft.lockVersion);

      const plan = await loadPlan(prisma, { id: draft.planId });
      response.status(201).json({ draft: serializeVersion(draft), plan: serializePlan(plan!, localDateKey(patient.timezone)) });
    }),
  );

  router.get(
    '/plans/:planId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const owned = await getOwnedPlanId(therapist.id, param(request, 'planId'));
      const patient = await getLinkedPatient(therapist.id, owned.patientId);
      const plan = await loadPlan(prisma, { id: owned.id });
      const draft = await prisma.planVersion.findFirst({ where: { planId: owned.id, status: VersionStatus.DRAFT }, select: { id: true, lockVersion: true, updatedAt: true } });
      response.json({ plan: serializePlan(plan!, localDateKey(patient.timezone)), draft, patient: { id: patient.id, name: patient.name } });
    }),
  );

  router.get(
    '/plans/:planId/versions',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const versions = await listVersions(therapist.id, param(request, 'planId'));
      response.json({
        versions: versions.map((version) => ({ ...version, effectiveFrom: fromDbDate(version.effectiveFrom), endDate: fromDbDate(version.endDate), itemCount: version._count.items, _count: undefined })),
      });
    }),
  );

  router.post(
    '/plans/:planId/drafts',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const draft = await createRevisionDraft(therapist.id, param(request, 'planId'));
      response.status(201).json({ draft: serializeVersion(draft) });
    }),
  );

  router.patch(
    '/plans/:planId/status',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const input = parse(statusSchema, request.body);
      const plan = await setPlanStatus(therapist.id, param(request, 'planId'), input.status, input.expectedRevision, input.reason);
      response.json({ plan });
    }),
  );

  // --------------------------------------------------------------- versions
  router.get(
    '/plan-versions/:versionId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      response.json({ version: serializeVersion(await getOwnedVersion(therapist.id, param(request, 'versionId'))) });
    }),
  );

  router.put(
    '/plan-versions/:versionId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const { lockVersion } = parse(lockSchema, request.body);
      const input = parse(draftSchema, request.body);
      const version = await updateDraft(therapist.id, param(request, 'versionId'), lockVersion, input);
      response.json({ version: serializeVersion(version) });
    }),
  );

  router.get(
    '/plan-versions/:versionId/preview',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      response.json({ preview: await previewDraft(therapist.id, param(request, 'versionId')) });
    }),
  );

  router.post(
    '/plan-versions/:versionId/publish',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const { lockVersion } = parse(lockSchema, request.body);
      const version = await publishDraft(therapist.id, param(request, 'versionId'), lockVersion);
      response.json({ version: serializeVersion(version) });
    }),
  );

  router.post(
    '/plan-versions/:versionId/discard',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const { lockVersion } = parse(lockSchema, request.body);
      response.json(await discardDraft(therapist.id, param(request, 'versionId'), lockVersion));
    }),
  );

  router.post(
    '/plan-versions/:versionId/save-as-template',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const { title } = parse(z.object({ title: z.string().trim().min(1).max(100) }), request.body);
      const template = await saveVersionAsTemplate(therapist.id, param(request, 'versionId'), title);
      response.status(201).json({ template: serializeTemplate(template) });
    }),
  );

  // -------------------------------------------------------------- templates
  router.get(
    '/templates',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const status = request.query.status === 'ARCHIVED' ? TemplateStatus.ARCHIVED : TemplateStatus.ACTIVE;
      const templates = await prisma.programTemplate.findMany({
        where: { therapistId: therapist.id, status },
        orderBy: { updatedAt: 'desc' },
        include: { items: { orderBy: { orderIndex: 'asc' }, include: { exercise: { select: { id: true, title: true, bodyPart: true } } } } },
      });
      response.json({ templates: templates.map(serializeTemplate) });
    }),
  );

  router.post(
    '/templates',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const template = await createTemplate(therapist.id, parse(templateSchema, request.body));
      response.status(201).json({ template: serializeTemplate(template) });
    }),
  );

  router.get(
    '/templates/:templateId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      response.json({ template: serializeTemplate(await getOwnedTemplate(therapist.id, param(request, 'templateId'))) });
    }),
  );

  router.put(
    '/templates/:templateId',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const { lockVersion } = parse(lockSchema, request.body);
      const template = await updateTemplate(therapist.id, param(request, 'templateId'), lockVersion, parse(templateSchema, request.body));
      response.json({ template: serializeTemplate(template) });
    }),
  );

  router.post(
    '/templates/:templateId/archive',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      response.json({ template: serializeTemplate(await setTemplateStatus(therapist.id, param(request, 'templateId'), TemplateStatus.ARCHIVED)) });
    }),
  );

  router.post(
    '/templates/:templateId/restore',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      response.json({ template: serializeTemplate(await setTemplateStatus(therapist.id, param(request, 'templateId'), TemplateStatus.ACTIVE)) });
    }),
  );

  router.post(
    '/templates/:templateId/duplicate',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const source = await getOwnedTemplate(therapist.id, param(request, 'templateId'));
      const copy = await createTemplate(therapist.id, {
        title: `${source.title} (copy)`.slice(0, 100),
        condition: source.condition,
        description: source.description,
        trainingWeekdays: source.trainingWeekdays,
        durationWeeks: source.durationWeeks,
        items: source.items,
      });
      response.status(201).json({ template: serializeTemplate(copy) });
    }),
  );

  return router;
}
