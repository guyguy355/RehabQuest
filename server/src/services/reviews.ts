/**
 * Therapist review workspace.
 *
 * Items are created by explicit, therapist-configured review rules. They are a workflow
 * queue, not a risk score or a medical assessment. Every item states why it appeared.
 * Each item has a dedupeKey tied to its source event, so processing the same event again
 * updates the existing item instead of creating another one.
 */
import { PlanStatus, Prisma, ReviewKind, ReviewStatus } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { conflict, notFound } from '../http.js';
import { addDays, localDateKey } from '../lib/dates.js';
import { activeLinkWhere } from './access.js';
import { audit } from './audit.js';
import { notify } from './notifications.js';
import { buildDays, DEFAULT_REVIEW_RULES, type ReviewRuleSettings, reviewReasons } from './progress.js';
import { loadCompletions, timelineInclude, toLite, toTimeline } from './plans.js';

type Db = Tx | typeof prisma;

export async function getReviewSettings(db: Db, therapistId: string): Promise<ReviewRuleSettings & { missedSessionsThreshold: number }> {
  const settings = await db.reviewSettings.findUnique({ where: { therapistId } });
  return {
    painThreshold: settings?.painThreshold ?? DEFAULT_REVIEW_RULES.painThreshold,
    flagTooHard: settings?.flagTooHard ?? DEFAULT_REVIEW_RULES.flagTooHard,
    missedSessionsThreshold: settings?.missedSessionsThreshold ?? 2,
  };
}

async function upsertItem(db: Db, input: { therapistId: string; patientId: string; kind: ReviewKind; sourceType: string; sourceId: string; dedupeKey: string; reasons: string[]; at: Date }) {
  const existing = await db.reviewItem.findUnique({ where: { dedupeKey: input.dedupeKey } });
  if (existing) {
    // Same source event processed again: refresh the explanation, keep status and history.
    return { item: await db.reviewItem.update({ where: { id: existing.id }, data: { reasons: input.reasons, lastEventAt: input.at } }), created: false };
  }
  try {
    const item = await db.reviewItem.create({
      data: { therapistId: input.therapistId, patientId: input.patientId, kind: input.kind, sourceType: input.sourceType, sourceId: input.sourceId, dedupeKey: input.dedupeKey, reasons: input.reasons, firstEventAt: input.at, lastEventAt: input.at },
    });
    return { item, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { item: await db.reviewItem.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey } }), created: false };
    }
    throw error;
  }
}

type CompletionForReview = { id: string; status: string; painLevel: number | null; difficulty: string | null; reason: string | null; patientId: string; completedAt: Date };

/** Applies the therapist's review rules to a new exercise record. Returns whether it was flagged. */
export async function recordReviewItemsForCompletion(tx: Tx, input: { completion: CompletionForReview; therapistId: string; exerciseTitle: string }) {
  const rules = await getReviewSettings(tx, input.therapistId);
  const reasons = reviewReasons(input.completion, rules);
  if (reasons.length === 0) return false;

  const stopped = input.completion.status === 'STOPPED' || (input.completion.status === 'SKIPPED' && input.completion.reason === 'PAIN_OR_DISCOMFORT');
  const { item, created } = await upsertItem(tx, {
    therapistId: input.therapistId,
    patientId: input.completion.patientId,
    kind: stopped ? ReviewKind.STOPPED : ReviewKind.FEEDBACK,
    sourceType: 'COMPLETION',
    sourceId: input.completion.id,
    dedupeKey: `completion:${input.completion.id}`,
    reasons,
    at: input.completion.completedAt,
  });
  await tx.taskCompletion.update({ where: { id: input.completion.id }, data: { needsReview: true } });
  if (created) {
    await notify(tx, { userId: input.therapistId, kind: 'REVIEW', title: 'New exercise report to review', body: input.exerciseTitle, link: `/therapist/reviews?item=${item.id}`, dedupeKey: `review:${item.id}` });
  }
  return true;
}

/** A patient message without a reply appears in the queue; a therapist reply resolves it. */
export async function recordPatientMessage(db: Db, input: { therapistId: string; patientId: string; messageId: string; at: Date }) {
  const open = await db.reviewItem.findFirst({ where: { therapistId: input.therapistId, patientId: input.patientId, kind: ReviewKind.UNANSWERED_MESSAGE, status: { not: ReviewStatus.RESOLVED } } });
  const reason = 'Patient message without a reply';
  if (open) {
    await db.reviewItem.update({ where: { id: open.id }, data: { lastEventAt: input.at, reasons: [reason] } });
    return open;
  }
  return (await upsertItem(db, { ...input, kind: ReviewKind.UNANSWERED_MESSAGE, sourceType: 'MESSAGE', sourceId: input.messageId, dedupeKey: `unanswered:${input.messageId}`, reasons: [reason] })).item;
}

export async function resolveUnansweredOnReply(db: Db, input: { therapistId: string; patientId: string; at: Date }) {
  const items = await db.reviewItem.findMany({ where: { therapistId: input.therapistId, patientId: input.patientId, kind: ReviewKind.UNANSWERED_MESSAGE, status: { not: ReviewStatus.RESOLVED } }, select: { id: true } });
  for (const item of items) {
    await db.reviewItem.update({ where: { id: item.id }, data: { status: ReviewStatus.RESOLVED, resolvedAt: input.at, resolvedById: input.therapistId, resolutionNote: 'Replied in messages' } });
    await audit(db, { actorId: input.therapistId, action: 'REVIEW_RESOLVED', patientId: input.patientId, subjectType: 'ReviewItem', subjectId: item.id, metadata: { via: 'reply' } });
  }
}

/**
 * Missed-activity rule: N or more planned sessions in a row (most recent past ones) without a
 * finished session. Rest and paused days are skipped, so they never trigger it. One item per run
 * of missed days (dedupe on the run's first date); the item updates while the run grows.
 */
export async function evaluateMissedActivity(therapistId: string, now = new Date()) {
  const rules = await getReviewSettings(prisma, therapistId);
  const plans = await prisma.rehabPlan.findMany({
    where: { therapistId, status: PlanStatus.ACTIVE, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } },
    include: { ...timelineInclude, patient: { select: { id: true, timezone: true } } },
  });

  for (const plan of plans) {
    if (plan.versions.length === 0) continue;
    const today = localDateKey(plan.patient.timezone, now);
    const days = buildDays(toTimeline(plan), toLite(await loadCompletions(prisma, plan.id)), today).filter((day) => day.isTrainingDay && day.date < today);
    const run: string[] = [];
    for (let index = days.length - 1; index >= 0; index -= 1) {
      if (days[index].state === 'missed' || days[index].state === 'skipped') run.unshift(days[index].date);
      else break;
    }
    if (run.length < rules.missedSessionsThreshold) continue;
    await upsertItem(prisma, {
      therapistId,
      patientId: plan.patientId,
      kind: ReviewKind.MISSED_ACTIVITY,
      sourceType: 'PLAN_DAYS',
      sourceId: `${plan.id}:${run[0]}`,
      dedupeKey: `missed:${plan.id}:${run[0]}`,
      reasons: [`${run.length} planned sessions in a row were not done (${run[0]} – ${run.at(-1)}). Review rule: ${rules.missedSessionsThreshold} or more.`],
      at: now,
    });
  }
}

// ----------------------------------------------------------------- queries

const itemInclude = { patient: { select: { id: true, name: true } }, therapist: { select: { id: true } } } satisfies Prisma.ReviewItemInclude;

export type ReviewFilter = { status?: 'ACTIVE' | ReviewStatus; kind?: ReviewKind; patientId?: string; q?: string; cursor?: string; limit: number };

export async function listReviewItems(therapistId: string, filter: ReviewFilter) {
  const where: Prisma.ReviewItemWhereInput = {
    therapistId,
    patient: { patientLinks: { some: activeLinkWhere(therapistId) } },
    ...(filter.status === 'ACTIVE' || !filter.status ? { status: { in: [ReviewStatus.OPEN, ReviewStatus.ACKNOWLEDGED] } } : { status: filter.status }),
    ...(filter.kind ? { kind: filter.kind } : {}),
    ...(filter.patientId ? { patientId: filter.patientId } : {}),
    ...(filter.q ? { OR: [{ patient: { name: { contains: filter.q, mode: 'insensitive' } } }, { resolutionNote: { contains: filter.q, mode: 'insensitive' } }] } : {}),
  };
  const rows = await prisma.reviewItem.findMany({
    where,
    include: itemInclude,
    orderBy: [{ lastEventAt: 'desc' }, { id: 'desc' }],
    take: filter.limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, filter.limit);

  // Attach the underlying records (already authorized: same therapist + active link).
  const completionIds = page.filter((item) => item.sourceType === 'COMPLETION').map((item) => item.sourceId);
  const messageIds = page.filter((item) => item.sourceType === 'MESSAGE').map((item) => item.sourceId);
  const [completions, messages] = await Promise.all([
    prisma.taskCompletion.findMany({ where: { id: { in: completionIds } }, include: { task: { select: { exercise: { select: { title: true } } } } } }),
    prisma.message.findMany({ where: { id: { in: messageIds } }, select: { id: true, text: true, createdAt: true } }),
  ]);

  const counts = await prisma.reviewItem.groupBy({ by: ['kind'], where: { ...where, kind: undefined }, _count: { _all: true } });

  return {
    items: page.map((item) => ({
      id: item.id,
      kind: item.kind,
      status: item.status,
      reasons: item.reasons,
      patient: item.patient,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      firstEventAt: item.firstEventAt,
      lastEventAt: item.lastEventAt,
      acknowledgedAt: item.acknowledgedAt,
      resolvedAt: item.resolvedAt,
      resolutionNote: item.resolutionNote,
      completion: (() => {
        const completion = completions.find((entry) => entry.id === item.sourceId);
        return completion
          ? { id: completion.id, exercise: completion.task.exercise.title, sessionDate: completion.sessionDate.toISOString().slice(0, 10), status: completion.status, painLevel: completion.painLevel, difficulty: completion.difficulty, reason: completion.reason, notes: completion.notes }
          : null;
      })(),
      message: messages.find((entry) => entry.id === item.sourceId) ?? null,
    })),
    nextCursor: rows.length > filter.limit ? page.at(-1)!.id : null,
    countsByKind: Object.fromEntries(counts.map((entry) => [entry.kind, entry._count._all])),
  };
}

async function ownedItem(therapistId: string, itemId: string) {
  const item = await prisma.reviewItem.findFirst({ where: { id: itemId, therapistId, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } } });
  if (!item) throw notFound('Review item not found');
  return item;
}

export async function setReviewStatus(therapistId: string, itemId: string, action: 'acknowledge' | 'resolve' | 'reopen', note?: string | null) {
  const item = await ownedItem(therapistId, itemId);
  const now = new Date();
  if (action === 'acknowledge' && item.status !== ReviewStatus.OPEN) throw conflict('Only open items can be acknowledged', 'invalid_transition');
  if (action === 'resolve' && item.status === ReviewStatus.RESOLVED) return item;
  if (action === 'reopen' && item.status !== ReviewStatus.RESOLVED) throw conflict('Only resolved items can be reopened', 'invalid_transition');

  const data: Prisma.ReviewItemUpdateInput =
    action === 'acknowledge'
      ? { status: ReviewStatus.ACKNOWLEDGED, acknowledgedAt: now, acknowledgedById: therapistId }
      : action === 'resolve'
        ? { status: ReviewStatus.RESOLVED, resolvedAt: now, resolvedById: therapistId, resolutionNote: note ?? null }
        : { status: ReviewStatus.OPEN, resolvedAt: null, resolvedById: null };
  const updated = await prisma.reviewItem.update({ where: { id: item.id }, data });

  if (item.sourceType === 'COMPLETION' && action === 'resolve') {
    await prisma.taskCompletion.updateMany({ where: { id: item.sourceId, reviewedAt: null }, data: { reviewedAt: now, reviewedById: therapistId } });
  }
  await audit(prisma, {
    actorId: therapistId,
    action: action === 'acknowledge' ? 'REVIEW_ACKNOWLEDGED' : action === 'resolve' ? 'REVIEW_RESOLVED' : 'REVIEW_REOPENED',
    patientId: item.patientId,
    subjectType: 'ReviewItem',
    subjectId: item.id,
    metadata: { kind: item.kind, hasNote: Boolean(note) },
  });
  return updated;
}

/** Count of active items for one patient (used by snapshots). */
export function activeReviewCount(therapistId: string, patientId: string) {
  return prisma.reviewItem.count({ where: { therapistId, patientId, status: { in: [ReviewStatus.OPEN, ReviewStatus.ACKNOWLEDGED] } } });
}

export { addDays };
