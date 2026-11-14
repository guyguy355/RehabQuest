/**
 * Goals, milestones and measurements.
 *
 * - Goals are written by the therapist in plain language. A goal is either FUNCTIONAL ("Climb the stairs
 *   at home without the rail") or MEASUREMENT (a target on one of the patient's measurements).
 * - The app never declares a goal or milestone achieved by itself. A measurement can show "target
 *   reached in the latest measurement", but only the therapist confirms (status ACHIEVED / achievedAt).
 * - Measurement values are decimals with 2 places, validated against the definition's range.
 * - Every change is audited without free text (ids and statuses only).
 */
import { type GoalKind, type MeasurementDirection, MeasurementSource, Prisma } from '@prisma/client';
import { prisma, type Db, type Tx } from '../db.js';
import { badRequest, conflict, notFound } from '../http.js';
import { addDays, type DateKey, fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import { measurementGoalProgress } from './analytics.js';
import { audit } from './audit.js';
import { activeLinkWhere } from './access.js';
import { awardCountAchievements } from './motivation.js';
import { notify } from './notifications.js';

type Client = Db | Tx;

const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

const definitionInclude = { measurements: { orderBy: [{ measuredOn: 'asc' }, { createdAt: 'asc' }] } } satisfies Prisma.MeasurementDefinitionInclude;
type DefinitionWithValues = Prisma.MeasurementDefinitionGetPayload<{ include: typeof definitionInclude }>;

export function serializeDefinition(definition: DefinitionWithValues) {
  return {
    id: definition.id,
    name: definition.name,
    unit: definition.unit,
    direction: definition.direction,
    minValue: Number(definition.minValue),
    maxValue: Number(definition.maxValue),
    patientCanRecord: definition.patientCanRecord,
    archived: definition.archivedAt !== null,
    values: definition.measurements.map((measurement) => ({
      id: measurement.id,
      value: Number(measurement.value),
      measuredOn: fromDbDate(measurement.measuredOn),
      note: measurement.note,
      source: measurement.source,
      createdAt: measurement.createdAt.toISOString(),
    })),
  };
}

const goalInclude = {
  milestones: { orderBy: { orderIndex: 'asc' } },
  definition: { include: definitionInclude },
  therapist: { select: { id: true, name: true } },
} satisfies Prisma.GoalInclude;
type GoalWithRelations = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

export function serializeGoal(goal: GoalWithRelations) {
  const target = num(goal.targetValue);
  const measurement =
    goal.kind === 'MEASUREMENT' && goal.definition && target !== null
      ? {
          definitionId: goal.definition.id,
          name: goal.definition.name,
          unit: goal.definition.unit,
          direction: goal.definition.direction,
          target,
          ...measurementGoalProgress({
            baseline: num(goal.baselineValue),
            target,
            direction: goal.definition.direction,
            points: goal.definition.measurements.map((point) => ({ measuredOn: fromDbDate(point.measuredOn), value: Number(point.value) })),
          }),
        }
      : null;
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    kind: goal.kind,
    status: goal.status,
    targetDate: goal.targetDate ? fromDbDate(goal.targetDate) : null,
    achievedAt: goal.achievedAt?.toISOString() ?? null,
    lockVersion: goal.lockVersion,
    therapist: goal.therapist,
    createdAt: goal.createdAt.toISOString(),
    milestones: goal.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      orderIndex: milestone.orderIndex,
      targetDate: milestone.targetDate ? fromDbDate(milestone.targetDate) : null,
      achievedAt: milestone.achievedAt?.toISOString() ?? null,
      note: milestone.note,
    })),
    measurement,
  };
}

export async function listGoals(db: Client, patientId: string, options: { includeArchived?: boolean } = {}) {
  const goals = await db.goal.findMany({
    where: { patientId, ...(options.includeArchived ? {} : { status: { not: 'ARCHIVED' } }) },
    include: goalInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });
  return goals.map(serializeGoal);
}

export async function listDefinitions(db: Client, patientId: string, options: { includeArchived?: boolean } = {}) {
  const definitions = await db.measurementDefinition.findMany({
    where: { patientId, ...(options.includeArchived ? {} : { archivedAt: null }) },
    include: definitionInclude,
    orderBy: { createdAt: 'asc' },
  });
  return definitions.map(serializeDefinition);
}

/** A goal the therapist may manage: the patient must be actively linked to them. */
async function linkedGoal(db: Client, therapistId: string, goalId: string) {
  const goal = await db.goal.findFirst({ where: { id: goalId, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } } });
  if (!goal) throw notFound('Goal not found');
  return goal;
}

async function linkedDefinition(db: Client, therapistId: string, definitionId: string) {
  const definition = await db.measurementDefinition.findFirst({ where: { id: definitionId, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } } });
  if (!definition) throw notFound('Measurement not found');
  return definition;
}

export type GoalInput = {
  title: string;
  description: string | null;
  kind: GoalKind;
  definitionId: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  targetDate: DateKey | null;
  milestones: { title: string; targetDate: DateKey | null }[];
};

async function checkMeasurementFields(db: Client, patientId: string, input: Pick<GoalInput, 'kind' | 'definitionId' | 'baselineValue' | 'targetValue'>) {
  if (input.kind === 'FUNCTIONAL') {
    if (input.definitionId || input.targetValue !== null || input.baselineValue !== null) throw badRequest('A functional goal has no measurement target');
    return;
  }
  if (!input.definitionId || input.targetValue === null) throw badRequest('A measurement goal needs a measurement and a target value');
  const definition = await db.measurementDefinition.findFirst({ where: { id: input.definitionId, patientId, archivedAt: null } });
  if (!definition) throw badRequest('Choose one of this patient’s measurements');
  for (const value of [input.targetValue, input.baselineValue]) {
    if (value !== null && (value < Number(definition.minValue) || value > Number(definition.maxValue))) {
      throw badRequest(`Values for ${definition.name} must be between ${Number(definition.minValue)} and ${Number(definition.maxValue)} ${definition.unit}`);
    }
  }
}

export async function createGoal(therapistId: string, patientId: string, input: GoalInput) {
  await checkMeasurementFields(prisma, patientId, input);
  const goal = await prisma.$transaction(async (tx) => {
    const created = await tx.goal.create({
      data: {
        patientId,
        therapistId,
        title: input.title,
        description: input.description,
        kind: input.kind,
        definitionId: input.definitionId,
        baselineValue: input.baselineValue,
        targetValue: input.targetValue,
        targetDate: input.targetDate ? toDbDate(input.targetDate) : null,
        milestones: { create: input.milestones.map((milestone, index) => ({ title: milestone.title, targetDate: milestone.targetDate ? toDbDate(milestone.targetDate) : null, orderIndex: index })) },
      },
      include: goalInclude,
    });
    await audit(tx, { actorId: therapistId, action: 'GOAL_CREATED', patientId, subjectType: 'Goal', subjectId: created.id, metadata: { kind: input.kind, milestones: input.milestones.length } });
    await notify(tx, { userId: patientId, kind: 'PLAN', title: 'New goal from your therapist', body: 'Open your progress to see it.', link: '/patient/progress#goals', dedupeKey: `goal-created:${created.id}` });
    return created;
  });
  return serializeGoal(goal);
}

export type GoalPatch = Partial<Pick<GoalInput, 'title' | 'description' | 'targetDate' | 'targetValue' | 'baselineValue'>> & { status?: 'ACTIVE' | 'ACHIEVED' | 'ARCHIVED'; lockVersion: number };

export async function updateGoal(therapistId: string, goalId: string, patch: GoalPatch, now = new Date()) {
  const goal = await linkedGoal(prisma, therapistId, goalId);
  if (patch.targetValue !== undefined || patch.baselineValue !== undefined) {
    await checkMeasurementFields(prisma, goal.patientId, {
      kind: goal.kind,
      definitionId: goal.definitionId,
      targetValue: patch.targetValue !== undefined ? patch.targetValue : num(goal.targetValue),
      baselineValue: patch.baselineValue !== undefined ? patch.baselineValue : num(goal.baselineValue),
    });
  }
  const confirming = patch.status === 'ACHIEVED' && goal.status !== 'ACHIEVED';
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.goal.updateMany({
      where: { id: goalId, lockVersion: patch.lockVersion },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.targetDate !== undefined ? { targetDate: patch.targetDate ? toDbDate(patch.targetDate) : null } : {}),
        ...(patch.targetValue !== undefined ? { targetValue: patch.targetValue } : {}),
        ...(patch.baselineValue !== undefined ? { baselineValue: patch.baselineValue } : {}),
        ...(patch.status !== undefined
          ? { status: patch.status, achievedAt: patch.status === 'ACHIEVED' ? (goal.achievedAt ?? now) : null, achievedById: patch.status === 'ACHIEVED' ? (goal.achievedById ?? therapistId) : null }
          : {}),
        lockVersion: { increment: 1 },
      },
    });
    if (result.count === 0) throw conflict('This goal was changed somewhere else. Reload to see the latest version.', 'stale_goal');
    await audit(tx, { actorId: therapistId, action: confirming ? 'GOAL_CONFIRMED' : 'GOAL_UPDATED', patientId: goal.patientId, subjectType: 'Goal', subjectId: goalId, metadata: { status: patch.status ?? goal.status } });
    if (confirming) {
      await notify(tx, { userId: goal.patientId, kind: 'PLAN', title: 'Your therapist confirmed a goal', body: 'Open your progress to see it.', link: '/patient/progress#goals', dedupeKey: `goal-achieved:${goalId}` });
    }
    return tx.goal.findUniqueOrThrow({ where: { id: goalId }, include: goalInclude });
  });
  return serializeGoal(updated);
}

export async function addMilestone(therapistId: string, goalId: string, input: { title: string; targetDate: DateKey | null }) {
  const goal = await linkedGoal(prisma, therapistId, goalId);
  const count = await prisma.milestone.count({ where: { goalId } });
  if (count >= 10) throw badRequest('A goal can have at most 10 milestones');
  await prisma.milestone.create({ data: { goalId, title: input.title, targetDate: input.targetDate ? toDbDate(input.targetDate) : null, orderIndex: count } });
  await prisma.goal.update({ where: { id: goalId }, data: { lockVersion: { increment: 1 } } });
  return serializeGoal(await prisma.goal.findUniqueOrThrow({ where: { id: goal.id }, include: goalInclude }));
}

/** Confirm (achieved=true) or reopen a milestone. Reopening never removes an earned achievement. */
export async function setMilestone(therapistId: string, milestoneId: string, input: { achieved?: boolean; note?: string | null; title?: string }, now = new Date()) {
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, goal: { patient: { patientLinks: { some: activeLinkWhere(therapistId) } } } }, include: { goal: true } });
  if (!milestone) throw notFound('Milestone not found');
  const confirming = input.achieved === true && milestone.achievedAt === null;
  const reopening = input.achieved === false && milestone.achievedAt !== null;
  await prisma.$transaction(async (tx) => {
    await tx.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(confirming ? { achievedAt: now, achievedById: therapistId } : {}),
        ...(reopening ? { achievedAt: null, achievedById: null } : {}),
      },
    });
    await tx.goal.update({ where: { id: milestone.goalId }, data: { lockVersion: { increment: 1 } } });
    if (confirming || reopening) {
      await audit(tx, { actorId: therapistId, action: confirming ? 'MILESTONE_CONFIRMED' : 'MILESTONE_REOPENED', patientId: milestone.goal.patientId, subjectType: 'Milestone', subjectId: milestoneId });
    }
    if (confirming) {
      await notify(tx, { userId: milestone.goal.patientId, kind: 'PLAN', title: 'Milestone reached', body: 'Your therapist confirmed a milestone.', link: '/patient/progress#goals', dedupeKey: `milestone:${milestoneId}:${now.getTime()}` });
      await awardCountAchievements(tx, milestone.goal.patientId, now);
    }
  });
  return serializeGoal(await prisma.goal.findUniqueOrThrow({ where: { id: milestone.goalId }, include: goalInclude }));
}

export type DefinitionInput = { name: string; unit: string; direction: MeasurementDirection; minValue: number; maxValue: number; patientCanRecord: boolean };

export async function createDefinition(therapistId: string, patientId: string, input: DefinitionInput) {
  if (input.minValue >= input.maxValue) throw badRequest('The lowest allowed value must be below the highest');
  const definition = await prisma.$transaction(async (tx) => {
    const created = await tx.measurementDefinition.create({ data: { ...input, patientId, therapistId }, include: definitionInclude });
    await audit(tx, { actorId: therapistId, action: 'MEASUREMENT_DEFINED', patientId, subjectType: 'MeasurementDefinition', subjectId: created.id });
    return created;
  });
  return serializeDefinition(definition);
}

export async function updateDefinition(therapistId: string, definitionId: string, patch: { patientCanRecord?: boolean; archived?: boolean }) {
  await linkedDefinition(prisma, therapistId, definitionId);
  const updated = await prisma.measurementDefinition.update({
    where: { id: definitionId },
    data: {
      ...(patch.patientCanRecord !== undefined ? { patientCanRecord: patch.patientCanRecord } : {}),
      ...(patch.archived !== undefined ? { archivedAt: patch.archived ? new Date() : null } : {}),
    },
    include: definitionInclude,
  });
  return serializeDefinition(updated);
}

export type MeasurementInput = { value: number; measuredOn: DateKey; note: string | null; idempotencyKey: string | null };

/**
 * Records one value. Therapists can record any active measurement of a linked patient; patients only
 * those marked "patient can record". Dates: not in the future (patient timezone), at most a year back.
 * The same idempotency key returns the original record (safe retries and offline replays).
 */
export async function recordMeasurement(actor: { id: string; role: 'PATIENT' | 'THERAPIST' }, definitionId: string, input: MeasurementInput, now = new Date()) {
  const definition =
    actor.role === 'THERAPIST'
      ? await linkedDefinition(prisma, actor.id, definitionId)
      : await prisma.measurementDefinition.findFirst({ where: { id: definitionId, patientId: actor.id, patientCanRecord: true } });
  if (!definition) throw notFound('Measurement not found');
  if (definition.archivedAt) throw conflict('This measurement is no longer in use.', 'measurement_archived');

  if (input.idempotencyKey) {
    const existing = await prisma.measurement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.definitionId !== definitionId || Number(existing.value) !== input.value || fromDbDate(existing.measuredOn) !== input.measuredOn) {
        throw conflict('This retry key was already used for a different value.', 'idempotency_key_conflict');
      }
      return { measurement: existing, created: false };
    }
  }

  const min = Number(definition.minValue);
  const max = Number(definition.maxValue);
  if (input.value < min || input.value > max) throw badRequest(`${definition.name} must be between ${min} and ${max} ${definition.unit}`);
  const patient = await prisma.user.findUniqueOrThrow({ where: { id: definition.patientId }, select: { timezone: true } });
  const today = localDateKey(patient.timezone, now);
  if (input.measuredOn > today) throw badRequest('The date cannot be in the future');
  if (input.measuredOn < addDays(today, -366)) throw badRequest('The date can be at most one year ago');

  try {
    const measurement = await prisma.$transaction(async (tx) => {
      const created = await tx.measurement.create({
        data: {
          definitionId,
          patientId: definition.patientId,
          recordedById: actor.id,
          source: actor.role === 'THERAPIST' ? MeasurementSource.THERAPIST : MeasurementSource.PATIENT,
          value: input.value,
          measuredOn: toDbDate(input.measuredOn),
          note: input.note,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await audit(tx, { actorId: actor.id, action: 'MEASUREMENT_RECORDED', patientId: definition.patientId, subjectType: 'Measurement', subjectId: created.id });
      return created;
    });
    return { measurement, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && input.idempotencyKey) {
      const existing = await prisma.measurement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { measurement: existing, created: false };
    }
    throw error;
  }
}
