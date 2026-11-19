/**
 * Program authoring: templates, plan drafts, preview, publication and plan status.
 *
 * Versioning rules (ADR-001):
 * - A plan has at most one DRAFT version at a time and any number of PUBLISHED versions.
 * - Published versions and their items are never updated.
 * - A published version applies from its effectiveFrom date. Revisions must take effect
 *   today or later (in the patient's timezone), so earlier dates keep their prescription.
 * - Drafts and templates carry a lockVersion; a write with a stale lockVersion is rejected
 *   with 409 `stale_draft` / `stale_template` instead of silently overwriting.
 * - Publishing locks the plan row; the partial unique index on ACTIVE plans makes a
 *   concurrent second publication for the same patient fail with 409.
 */
import { PlanStatus, Prisma, TemplateStatus, VersionStatus } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { badRequest, conflict, HttpError, notFound } from '../http.js';
import { addDays, type DateKey, diffDays, fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import { audit } from './audit.js';
import { activeLinkWhere } from './access.js';
import { dayKind, type PlanTimeline } from './progress.js';
import { type ItemView, loadPlan, toTimeline } from './plans.js';

export type ItemInput = {
  taskId?: string | null;
  exerciseId: string;
  sets: number;
  reps: number;
  holdSeconds?: number | null;
  restSeconds?: number | null;
  durationSeconds: number;
  notes?: string | null;
};

export type DraftInput = {
  title: string;
  condition: string;
  therapistNotes?: string | null;
  trainingWeekdays: number[];
  restDates: DateKey[];
  effectiveFrom: DateKey;
  endDate: DateKey;
  changeNote?: string | null;
  items: ItemInput[];
};

const versionInclude = {
  items: { orderBy: { orderIndex: 'asc' } },
  plan: { select: { id: true, patientId: true, therapistId: true, status: true, revision: true, patient: { select: { id: true, name: true, timezone: true } } } },
  publishedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.PlanVersionInclude;

type VersionWithItems = Prisma.PlanVersionGetPayload<{ include: typeof versionInclude }>;

export function serializeVersion(version: VersionWithItems) {
  return {
    id: version.id,
    planId: version.planId,
    patient: version.plan.patient,
    planStatus: version.plan.status,
    planRevision: version.plan.revision,
    number: version.number,
    status: version.status,
    title: version.title,
    condition: version.condition,
    therapistNotes: version.therapistNotes,
    trainingWeekdays: version.trainingWeekdays,
    restDates: version.restDates.map(fromDbDate),
    effectiveFrom: fromDbDate(version.effectiveFrom),
    endDate: fromDbDate(version.endDate),
    changeNote: version.changeNote,
    lockVersion: version.lockVersion,
    templateId: version.templateId,
    basedOnVersionId: version.basedOnVersionId,
    createdBy: version.createdBy,
    publishedBy: version.publishedBy,
    publishedAt: version.publishedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    items: version.items.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      exerciseId: item.exerciseId,
      orderIndex: item.orderIndex,
      sets: item.sets,
      reps: item.reps,
      holdSeconds: item.holdSeconds,
      restSeconds: item.restSeconds,
      durationSeconds: item.durationSeconds,
      notes: item.notes,
      exercise: {
        id: item.exerciseId,
        title: item.exerciseTitle,
        description: item.exerciseDescription,
        instructions: item.instructions,
        safetyNotes: item.safetyNotes,
        bodyPart: item.bodyPart,
        difficulty: item.difficulty,
        videoUrl: item.videoUrl,
        imageUrl: item.imageUrl,
        mediaAlt: item.mediaAlt,
      },
    })),
  };
}

/** Loads a version the therapist may access (own plan, active care link). 404 otherwise. */
export async function getOwnedVersion(therapistId: string, versionId: string, db: Tx | typeof prisma = prisma) {
  const version = await db.planVersion.findFirst({
    where: { id: versionId, plan: { therapistId, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } } },
    include: versionInclude,
  });
  if (!version) throw notFound('Plan version not found');
  return version;
}

async function exerciseSnapshots(db: Tx, therapistId: string, items: ItemInput[]) {
  const ids = [...new Set(items.map((item) => item.exerciseId))];
  const exercises = await db.exercise.findMany({ where: { id: { in: ids }, createdById: therapistId } });
  if (exercises.length !== ids.length) throw badRequest('One or more exercises were not found in your library');
  return new Map(exercises.map((exercise) => [exercise.id, exercise]));
}

function snapshotFields(exercise: Prisma.ExerciseGetPayload<object>) {
  return {
    exerciseTitle: exercise.title,
    exerciseDescription: exercise.description,
    instructions: exercise.instructions,
    safetyNotes: exercise.safetyNotes,
    bodyPart: exercise.bodyPart,
    difficulty: exercise.difficulty,
    videoUrl: exercise.videoUrl,
    imageUrl: exercise.imageUrl,
    mediaAlt: exercise.mediaAlt,
  };
}

function validateDraftShape(input: DraftInput) {
  if (input.endDate < input.effectiveFrom) throw badRequest('End date must be on or after the start date', { fields: { endDate: 'End date must be on or after the start date' } });
  if (diffDays(input.effectiveFrom, input.endDate) > 365) throw badRequest('A plan version can last at most one year', { fields: { endDate: 'At most one year' } });
  const outside = input.restDates.find((date) => date < input.effectiveFrom || date > input.endDate);
  if (outside) throw badRequest(`Rest date ${outside} is outside the plan dates`, { fields: { restDates: 'Rest dates must be inside the plan dates' } });
}

async function writeItems(db: Tx, versionId: string, therapistId: string, planId: string | null, items: ItemInput[]) {
  const snapshots = await exerciseSnapshots(db, therapistId, items);
  if (planId) {
    const slotIds = items.map((item) => item.taskId).filter(Boolean) as string[];
    if (new Set(slotIds).size !== slotIds.length) throw badRequest('The same exercise slot appears twice');
    if (slotIds.length) {
      const slots = await db.rehabTask.findMany({ where: { id: { in: slotIds }, planId }, select: { id: true, exerciseId: true } });
      const byId = new Map(slots.map((slot) => [slot.id, slot]));
      for (const item of items) {
        if (!item.taskId) continue;
        const slot = byId.get(item.taskId);
        if (!slot) throw badRequest('An exercise in this draft does not belong to this plan. Reload and try again.');
        if (slot.exerciseId !== item.exerciseId) throw badRequest('To swap an exercise, remove it and add the new one');
      }
    }
  }
  await db.planVersionItem.deleteMany({ where: { versionId } });
  await db.planVersionItem.createMany({
    data: items.map((item, index) => ({
      versionId,
      taskId: item.taskId ?? null,
      exerciseId: item.exerciseId,
      orderIndex: index,
      sets: item.sets,
      reps: item.reps,
      holdSeconds: item.holdSeconds ?? null,
      restSeconds: item.restSeconds ?? null,
      durationSeconds: item.durationSeconds,
      notes: item.notes ?? null,
      ...snapshotFields(snapshots.get(item.exerciseId)!),
    })),
  });
}

function draftData(input: DraftInput) {
  return {
    title: input.title,
    condition: input.condition,
    therapistNotes: input.therapistNotes ?? null,
    trainingWeekdays: [...input.trainingWeekdays].sort(),
    restDates: [...new Set(input.restDates)].sort().map(toDbDate),
    effectiveFrom: toDbDate(input.effectiveFrom),
    endDate: toDbDate(input.endDate),
    changeNote: input.changeNote ?? null,
  };
}

/** New plan for a linked patient, starting as an unpublished draft. */
export async function createPlanDraft(therapistId: string, patient: { id: string; timezone: string }, input: DraftInput, templateId?: string | null) {
  validateDraftShape(input);
  const today = localDateKey(patient.timezone);
  if (input.effectiveFrom < today) throw badRequest('The start date cannot be in the past', { fields: { effectiveFrom: 'The start date cannot be in the past' } });

  return prisma.$transaction(async (tx) => {
    const plan = await tx.rehabPlan.create({
      data: {
        patientId: patient.id,
        therapistId,
        status: PlanStatus.DRAFT,
        title: input.title,
        condition: input.condition,
        therapistNotes: input.therapistNotes ?? null,
        startDate: toDbDate(input.effectiveFrom),
        endDate: toDbDate(input.endDate),
        trainingWeekdays: [...input.trainingWeekdays].sort(),
      },
    });
    const version = await tx.planVersion.create({ data: { planId: plan.id, status: VersionStatus.DRAFT, createdById: therapistId, templateId: templateId ?? null, ...draftData(input) } });
    await writeItems(tx, version.id, therapistId, plan.id, input.items);
    await audit(tx, { actorId: therapistId, action: 'PLAN_DRAFT_CREATED', patientId: patient.id, subjectType: 'PlanVersion', subjectId: version.id, metadata: { planId: plan.id, templateId: templateId ?? null } });
    return getOwnedVersion(therapistId, version.id, tx);
  });
}

/** Opens (or returns the existing) revision draft based on the latest published version. */
export async function createRevisionDraft(therapistId: string, planId: string) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.rehabPlan.findFirst({
      where: { id: planId, therapistId, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } },
      include: { patient: { select: { timezone: true } }, versions: { where: { status: { in: [VersionStatus.DRAFT, VersionStatus.PUBLISHED] } }, include: { items: { orderBy: { orderIndex: 'asc' } } }, orderBy: [{ effectiveFrom: 'asc' }, { number: 'asc' }] } },
    });
    if (!plan) throw notFound('Plan not found');
    if (plan.status === PlanStatus.COMPLETED || plan.status === PlanStatus.ARCHIVED) throw conflict('Completed or archived plans cannot be revised. Create a new plan instead.', 'plan_closed');

    const existingDraft = plan.versions.find((version) => version.status === VersionStatus.DRAFT);
    if (existingDraft) return getOwnedVersion(therapistId, existingDraft.id, tx);

    const published = plan.versions.filter((version) => version.status === VersionStatus.PUBLISHED);
    const base = published.at(-1);
    if (!base) throw conflict('This plan has no published version yet', 'no_published_version');

    const today = localDateKey(plan.patient.timezone);
    const effectiveFrom = fromDbDate(base.effectiveFrom) > today ? fromDbDate(base.effectiveFrom) : today;
    const endDate = fromDbDate(base.endDate) >= effectiveFrom ? fromDbDate(base.endDate) : addDays(effectiveFrom, 27);

    try {
      const draft = await tx.planVersion.create({
        data: {
          planId: plan.id,
          status: VersionStatus.DRAFT,
          createdById: therapistId,
          basedOnVersionId: base.id,
          title: base.title,
          condition: base.condition,
          therapistNotes: base.therapistNotes,
          trainingWeekdays: base.trainingWeekdays,
          restDates: base.restDates.filter((date) => fromDbDate(date) >= effectiveFrom),
          effectiveFrom: toDbDate(effectiveFrom),
          endDate: toDbDate(endDate),
          items: {
            create: base.items.map(({ id: _id, versionId: _versionId, ...item }) => item),
          },
        },
      });
      await audit(tx, { actorId: therapistId, action: 'PLAN_DRAFT_CREATED', patientId: plan.patientId, subjectType: 'PlanVersion', subjectId: draft.id, metadata: { planId: plan.id, basedOnVersionId: base.id } });
      return getOwnedVersion(therapistId, draft.id, tx);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('Someone else just opened a draft for this plan. Reload to continue with it.', 'draft_exists');
      }
      throw error;
    }
  });
}

/** Saves a draft. Fails with 409 `stale_draft` if someone saved it since `lockVersion`. */
export async function updateDraft(therapistId: string, versionId: string, lockVersion: number, input: DraftInput) {
  validateDraftShape(input);
  return prisma.$transaction(async (tx) => {
    const current = await getOwnedVersion(therapistId, versionId, tx);
    if (current.status !== VersionStatus.DRAFT) throw conflict('Only drafts can be edited. Published versions never change.', 'not_draft');

    const updated = await tx.planVersion.updateMany({
      where: { id: versionId, status: VersionStatus.DRAFT, lockVersion },
      data: { ...draftData(input), lockVersion: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new HttpError(409, 'This draft was changed in another window or by another person. Reload to see the latest version, then re-apply your changes.', 'stale_draft', {
        currentLockVersion: current.lockVersion,
      });
    }
    await writeItems(tx, versionId, therapistId, current.planId, input.items);
    if (current.plan.status === PlanStatus.DRAFT) {
      await tx.rehabPlan.update({ where: { id: current.planId }, data: { title: input.title, condition: input.condition, startDate: toDbDate(input.effectiveFrom), endDate: toDbDate(input.endDate) } });
    }
    return getOwnedVersion(therapistId, versionId, tx);
  });
}

/** Patient-shaped preview of what the draft would show, without publishing anything. */
export async function previewDraft(therapistId: string, versionId: string) {
  const version = await getOwnedVersion(therapistId, versionId);
  const plan = await loadPlan(prisma, { id: version.planId });
  const base = plan ? toTimeline(plan) : { versions: [], pauses: [] };

  const draftItems: ItemView[] = version.items.map((item, index) => ({
    id: item.taskId ?? `preview-${index}`,
    versionItemId: item.id,
    versionId: version.id,
    taskId: item.taskId ?? `preview-${index}`,
    orderIndex: item.orderIndex,
    sets: item.sets,
    reps: item.reps,
    holdSeconds: item.holdSeconds,
    restSeconds: item.restSeconds,
    durationSeconds: item.durationSeconds,
    notes: item.notes,
    // The therapist's draft preview lists the session; it does not play 3D demonstrations.
    exercise: { ...serializeVersion(version).items[index].exercise, demo: null },
  }));

  const nextNumber = Math.max(0, ...base.versions.map((entry) => entry.number)) + 1;
  const timeline: PlanTimeline<ItemView> = {
    pauses: base.pauses,
    versions: [
      ...base.versions,
      {
        id: version.id,
        number: nextNumber,
        effectiveFrom: fromDbDate(version.effectiveFrom),
        endDate: fromDbDate(version.endDate),
        trainingWeekdays: version.trainingWeekdays,
        restDates: version.restDates.map(fromDbDate),
        items: draftItems,
      },
    ],
  };

  const from = fromDbDate(version.effectiveFrom);
  const days = Array.from({ length: 14 }, (_, offset) => addDays(from, offset)).map((date) => {
    const { kind } = dayKind(timeline, date);
    return { date, kind };
  });
  const firstSession = days.find((day) => day.kind === 'training')?.date ?? null;

  const currentPublished = base.versions.length ? base.versions.reduce((latest, entry) => (entry.effectiveFrom >= latest.effectiveFrom ? entry : latest)) : null;
  const before = new Map((currentPublished?.items ?? []).map((item) => [item.taskId, item]));
  const changes = {
    added: draftItems.filter((item) => !version.items.find((source) => source.id === item.versionItemId)?.taskId).map((item) => item.exercise.title),
    removed: [...before.values()].filter((item) => !version.items.some((source) => source.taskId === item.taskId)).map((item) => item.exercise.title),
    changed: draftItems
      .filter((item) => before.has(item.taskId))
      .filter((item) => {
        const old = before.get(item.taskId)!;
        return old.sets !== item.sets || old.reps !== item.reps || old.holdSeconds !== item.holdSeconds || old.restSeconds !== item.restSeconds || old.durationSeconds !== item.durationSeconds || old.notes !== item.notes;
      })
      .map((item) => item.exercise.title),
  };

  return {
    version: serializeVersion(version),
    versionNumber: nextNumber,
    isRevision: base.versions.length > 0,
    firstSessionDate: firstSession,
    sessionItems: draftItems,
    days,
    changes,
  };
}

/** Publishes a draft. Atomic; protects the one-active-plan invariant. */
export async function publishDraft(therapistId: string, versionId: string, lockVersion: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const draft = await getOwnedVersion(therapistId, versionId, tx);
      await tx.$queryRaw`SELECT "id" FROM "RehabPlan" WHERE "id" = ${draft.planId} FOR UPDATE`;
      const fresh = await tx.planVersion.findUniqueOrThrow({ where: { id: versionId }, include: { items: { orderBy: { orderIndex: 'asc' } } } });
      const plan = await tx.rehabPlan.findUniqueOrThrow({ where: { id: draft.planId }, include: { patient: { select: { timezone: true } } } });

      if (fresh.status !== VersionStatus.DRAFT) throw conflict('This draft was already published or discarded. Reload to see the plan.', 'not_draft');
      if (fresh.lockVersion !== lockVersion) {
        throw new HttpError(409, 'This draft changed since you last loaded it. Reload and review it before publishing.', 'stale_draft', { currentLockVersion: fresh.lockVersion });
      }
      if (plan.status === PlanStatus.COMPLETED || plan.status === PlanStatus.ARCHIVED) throw conflict('This plan is closed and cannot be published.', 'plan_closed');
      if (fresh.items.length === 0) throw badRequest('Add at least one exercise before publishing');

      const today = localDateKey(plan.patient.timezone);
      const effectiveFrom = fromDbDate(fresh.effectiveFrom);
      if (effectiveFrom < today) {
        throw badRequest('The start date is in the past. Choose today or a later date: past days keep the version that applied then.', { fields: { effectiveFrom: 'Choose today or later' } });
      }

      const max = await tx.planVersion.aggregate({ where: { planId: plan.id, status: VersionStatus.PUBLISHED }, _max: { number: true } });
      const number = (max._max.number ?? 0) + 1;

      // Refresh the exercise text at publication time and create stable slots for new items.
      const exercises = new Map((await tx.exercise.findMany({ where: { id: { in: fresh.items.map((item) => item.exerciseId) } } })).map((exercise) => [exercise.id, exercise]));
      for (const item of fresh.items) {
        const exercise = exercises.get(item.exerciseId)!;
        let taskId = item.taskId;
        if (!taskId) {
          const slot = await tx.rehabTask.create({
            data: { planId: plan.id, exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, durationSeconds: item.durationSeconds, orderIndex: item.orderIndex, notes: item.notes, activeFrom: fresh.effectiveFrom },
          });
          taskId = slot.id;
        }
        await tx.planVersionItem.update({ where: { id: item.id }, data: { taskId, ...snapshotFields(exercise) } });
      }

      await tx.planVersion.update({
        where: { id: versionId },
        data: { status: VersionStatus.PUBLISHED, number, publishedAt: new Date(), publishedById: therapistId, lockVersion: { increment: 1 } },
      });

      const firstPublication = plan.status === PlanStatus.DRAFT;
      await tx.rehabPlan.update({
        where: { id: plan.id },
        data: {
          status: firstPublication ? PlanStatus.ACTIVE : plan.status,
          title: fresh.title,
          condition: fresh.condition,
          therapistNotes: fresh.therapistNotes,
          trainingWeekdays: fresh.trainingWeekdays,
          endDate: fresh.endDate,
          ...(firstPublication ? { startDate: fresh.effectiveFrom } : {}),
          revision: { increment: 1 },
        },
      });

      await audit(tx, {
        actorId: therapistId,
        action: 'PLAN_PUBLISHED',
        patientId: plan.patientId,
        subjectType: 'PlanVersion',
        subjectId: versionId,
        metadata: { planId: plan.id, number, effectiveFrom, items: fresh.items.length },
      });

      return getOwnedVersion(therapistId, versionId, tx);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('This patient already has an active plan. Pause or complete it before publishing another plan.', 'active_plan_exists');
    }
    throw error;
  }
}

export async function discardDraft(therapistId: string, versionId: string, lockVersion: number) {
  return prisma.$transaction(async (tx) => {
    const draft = await getOwnedVersion(therapistId, versionId, tx);
    if (draft.status !== VersionStatus.DRAFT) throw conflict('Only drafts can be discarded', 'not_draft');
    const result = await tx.planVersion.updateMany({ where: { id: versionId, status: VersionStatus.DRAFT, lockVersion }, data: { status: VersionStatus.DISCARDED, lockVersion: { increment: 1 } } });
    if (result.count === 0) throw new HttpError(409, 'This draft changed since you loaded it. Reload first.', 'stale_draft');
    const published = await tx.planVersion.count({ where: { planId: draft.planId, status: VersionStatus.PUBLISHED } });
    if (published === 0) await tx.rehabPlan.update({ where: { id: draft.planId }, data: { status: PlanStatus.ARCHIVED, revision: { increment: 1 } } });
    await audit(tx, { actorId: therapistId, action: 'PLAN_DRAFT_DISCARDED', patientId: draft.plan.patientId, subjectType: 'PlanVersion', subjectId: versionId });
    return { discarded: true, planArchived: published === 0 };
  });
}

/**
 * Plan status changes with optimistic concurrency on RehabPlan.revision.
 * Pausing records a PlanPause from today (or tomorrow if today's session already has records);
 * resuming closes it at yesterday, so paused days are never counted as missed.
 */
export async function setPlanStatus(therapistId: string, planId: string, status: PlanStatus, expectedRevision: number | undefined, reason?: string | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const plan = await tx.rehabPlan.findFirst({
        where: { id: planId, therapistId, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } },
        include: { patient: { select: { timezone: true } }, pauses: { where: { endDate: null } } },
      });
      if (!plan) throw notFound('Plan not found');
      if (expectedRevision !== undefined && expectedRevision !== plan.revision) {
        throw new HttpError(409, 'This plan was changed by someone else. Reload to see its current status.', 'stale_plan', { currentRevision: plan.revision });
      }
      const today = localDateKey(plan.patient.timezone);
      const allowed: Record<PlanStatus, PlanStatus[]> = {
        DRAFT: [PlanStatus.ARCHIVED],
        ACTIVE: [PlanStatus.PAUSED, PlanStatus.COMPLETED],
        PAUSED: [PlanStatus.ACTIVE, PlanStatus.COMPLETED],
        COMPLETED: [PlanStatus.ARCHIVED],
        ARCHIVED: [],
      };
      if (!allowed[plan.status].includes(status)) throw conflict(`A ${plan.status.toLowerCase()} plan cannot become ${status.toLowerCase()}`, 'invalid_transition');

      if (status === PlanStatus.PAUSED) {
        const todayRecords = await tx.taskCompletion.count({ where: { task: { planId }, sessionDate: toDbDate(today) } });
        const start = todayRecords > 0 ? addDays(today, 1) : today;
        await tx.planPause.create({ data: { planId, startDate: toDbDate(start), createdById: therapistId, reason: reason ?? null } });
      }
      if (plan.status === PlanStatus.PAUSED && status !== PlanStatus.PAUSED) {
        for (const pause of plan.pauses) {
          const end = addDays(today, -1);
          if (end < fromDbDate(pause.startDate)) await tx.planPause.delete({ where: { id: pause.id } });
          else await tx.planPause.update({ where: { id: pause.id }, data: { endDate: toDbDate(end) } });
        }
      }

      const updated = await tx.rehabPlan.update({ where: { id: planId }, data: { status, revision: { increment: 1 } }, select: { id: true, status: true, revision: true } });
      const action = { ACTIVE: 'PLAN_RESUMED', PAUSED: 'PLAN_PAUSED', COMPLETED: 'PLAN_COMPLETED', ARCHIVED: 'PLAN_ARCHIVED', DRAFT: 'PLAN_ARCHIVED' } as const;
      await audit(tx, { actorId: therapistId, action: action[status], patientId: plan.patientId, subjectType: 'RehabPlan', subjectId: planId });
      return updated;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('This patient already has another active plan.', 'active_plan_exists');
    }
    throw error;
  }
}

export async function listVersions(therapistId: string, planId: string) {
  const plan = await prisma.rehabPlan.findFirst({ where: { id: planId, therapistId, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } }, select: { id: true } });
  if (!plan) throw notFound('Plan not found');
  return prisma.planVersion.findMany({
    where: { planId, status: { in: [VersionStatus.PUBLISHED, VersionStatus.DRAFT] } },
    orderBy: [{ status: 'asc' }, { number: 'desc' }],
    select: { id: true, number: true, status: true, title: true, effectiveFrom: true, endDate: true, changeNote: true, publishedAt: true, publishedBy: { select: { name: true } }, lockVersion: true, _count: { select: { items: true } } },
  });
}

// ---------------------------------------------------------------- templates

export type TemplateInput = {
  title: string;
  condition: string;
  description?: string | null;
  trainingWeekdays: number[];
  durationWeeks: number;
  items: ItemInput[];
};

const templateInclude = { items: { orderBy: { orderIndex: 'asc' }, include: { exercise: { select: { id: true, title: true, bodyPart: true } } } } } satisfies Prisma.ProgramTemplateInclude;

export async function getOwnedTemplate(therapistId: string, templateId: string) {
  const template = await prisma.programTemplate.findFirst({ where: { id: templateId, therapistId }, include: templateInclude });
  if (!template) throw notFound('Template not found');
  return template;
}

async function writeTemplateItems(tx: Tx, therapistId: string, templateId: string, items: ItemInput[]) {
  await exerciseSnapshots(tx, therapistId, items);
  await tx.programTemplateItem.deleteMany({ where: { templateId } });
  await tx.programTemplateItem.createMany({
    data: items.map((item, index) => ({ templateId, exerciseId: item.exerciseId, orderIndex: index, sets: item.sets, reps: item.reps, holdSeconds: item.holdSeconds ?? null, restSeconds: item.restSeconds ?? null, durationSeconds: item.durationSeconds, notes: item.notes ?? null })),
  });
}

export async function createTemplate(therapistId: string, input: TemplateInput) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.programTemplate.create({
      data: { therapistId, title: input.title, condition: input.condition, description: input.description ?? null, trainingWeekdays: [...input.trainingWeekdays].sort(), durationWeeks: input.durationWeeks },
    });
    await writeTemplateItems(tx, therapistId, template.id, input.items);
    await audit(tx, { actorId: therapistId, action: 'TEMPLATE_CREATED', subjectType: 'ProgramTemplate', subjectId: template.id });
    return tx.programTemplate.findUniqueOrThrow({ where: { id: template.id }, include: templateInclude });
  });
}

export async function updateTemplate(therapistId: string, templateId: string, lockVersion: number, input: TemplateInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.programTemplate.findFirst({ where: { id: templateId, therapistId } });
    if (!current) throw notFound('Template not found');
    const result = await tx.programTemplate.updateMany({
      where: { id: templateId, therapistId, lockVersion },
      data: { title: input.title, condition: input.condition, description: input.description ?? null, trainingWeekdays: [...input.trainingWeekdays].sort(), durationWeeks: input.durationWeeks, lockVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new HttpError(409, 'This template was changed in another window. Reload to see the latest version, then re-apply your changes.', 'stale_template', { currentLockVersion: current.lockVersion });
    }
    await writeTemplateItems(tx, therapistId, templateId, input.items);
    await audit(tx, { actorId: therapistId, action: 'TEMPLATE_UPDATED', subjectType: 'ProgramTemplate', subjectId: templateId });
    return tx.programTemplate.findUniqueOrThrow({ where: { id: templateId }, include: templateInclude });
  });
}

export async function setTemplateStatus(therapistId: string, templateId: string, status: TemplateStatus) {
  const result = await prisma.programTemplate.updateMany({ where: { id: templateId, therapistId }, data: { status, lockVersion: { increment: 1 } } });
  if (result.count === 0) throw notFound('Template not found');
  if (status === TemplateStatus.ARCHIVED) await audit(prisma, { actorId: therapistId, action: 'TEMPLATE_ARCHIVED', subjectType: 'ProgramTemplate', subjectId: templateId });
  return getOwnedTemplate(therapistId, templateId);
}

/** Copies a template into a new, independent draft plan for a patient. */
export async function createDraftFromTemplate(therapistId: string, patient: { id: string; timezone: string }, templateId: string, startDate: DateKey) {
  const template = await getOwnedTemplate(therapistId, templateId);
  if (template.status === TemplateStatus.ARCHIVED) throw conflict('This template is archived. Restore it first.', 'template_archived');
  return createPlanDraft(
    therapistId,
    patient,
    {
      title: template.title,
      condition: template.condition,
      therapistNotes: template.description,
      trainingWeekdays: template.trainingWeekdays,
      restDates: [],
      effectiveFrom: startDate,
      endDate: addDays(startDate, template.durationWeeks * 7 - 1),
      items: template.items.map((item) => ({ exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, holdSeconds: item.holdSeconds, restSeconds: item.restSeconds, durationSeconds: item.durationSeconds, notes: item.notes })),
    },
    template.id,
  );
}

/** Saves a plan version (draft or published) as a new reusable template. */
export async function saveVersionAsTemplate(therapistId: string, versionId: string, title: string) {
  const version = await getOwnedVersion(therapistId, versionId);
  const weeks = Math.max(1, Math.ceil((diffDays(fromDbDate(version.effectiveFrom), fromDbDate(version.endDate)) + 1) / 7));
  return createTemplate(therapistId, {
    title,
    condition: version.condition,
    description: version.therapistNotes,
    trainingWeekdays: version.trainingWeekdays,
    durationWeeks: weeks,
    items: version.items.map((item) => ({ exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, holdSeconds: item.holdSeconds, restSeconds: item.restSeconds, durationSeconds: item.durationSeconds, notes: item.notes })),
  });
}
