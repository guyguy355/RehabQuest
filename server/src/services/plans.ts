import { CompletionSource, PlanStatus, Prisma, VersionStatus, XpReason } from '@prisma/client';
import { config } from '../config.js';
import { prisma, type Db, type Tx } from '../db.js';
import { conflict, HttpError, notFound } from '../http.js';
import { addDays, type DateKey, fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import {
  BADGE_IDS,
  buildDays,
  computeStreak,
  type CompletionLite,
  dayKind,
  type Outcome,
  type PlanTimeline,
  planEnd,
  planStart,
  qualifyingBadges,
  SESSION_BONUS_XP,
  sessionStats,
  TASK_XP,
  versionOn,
} from './progress.js';
import { returnAfterBreak, weeklyGoalProgress } from './gamification.js';
import { awardAfterSession } from './motivation.js';
import { recordReviewItemsForCompletion } from './reviews.js';

type Client = Db | Tx;

export const timelineInclude = {
  versions: {
    where: { status: VersionStatus.PUBLISHED },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
    orderBy: [{ effectiveFrom: 'asc' }, { number: 'asc' }],
  },
  pauses: { orderBy: { startDate: 'asc' } },
  therapist: { select: { id: true, name: true } },
} satisfies Prisma.RehabPlanInclude;

export type PlanWithTimeline = Prisma.RehabPlanGetPayload<{ include: typeof timelineInclude }>;
type DbItem = PlanWithTimeline['versions'][number]['items'][number];

export function serializeItem(item: DbItem) {
  return {
    id: item.taskId!, // stable task slot id: completions are recorded against it
    versionItemId: item.id,
    versionId: item.versionId,
    taskId: item.taskId!,
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
  };
}

export type ItemView = ReturnType<typeof serializeItem>;

export function toTimeline(plan: Pick<PlanWithTimeline, 'versions' | 'pauses'>): PlanTimeline<ItemView> {
  return {
    versions: plan.versions.map((version) => ({
      id: version.id,
      number: version.number ?? 0,
      effectiveFrom: fromDbDate(version.effectiveFrom),
      endDate: fromDbDate(version.endDate),
      trainingWeekdays: version.trainingWeekdays,
      restDates: version.restDates.map(fromDbDate),
      items: version.items.filter((item) => item.taskId).map(serializeItem),
    })),
    pauses: plan.pauses.map((pause) => ({ startDate: fromDbDate(pause.startDate), endDate: pause.endDate ? fromDbDate(pause.endDate) : null })),
  };
}

/** The version a patient sees for `today`: current, else first (not started), else last (finished). */
export function displayVersion(plan: PlanWithTimeline, today: DateKey) {
  const timeline = toTimeline(plan);
  const current = versionOn(timeline, today);
  if (current) return plan.versions.find((version) => version.id === current.id) ?? null;
  const start = planStart(timeline);
  if (start && today < start) return plan.versions[0] ?? null;
  return plan.versions.at(-1) ?? null;
}

export function serializePlan(plan: PlanWithTimeline, today: DateKey) {
  const timeline = toTimeline(plan);
  const version = displayVersion(plan, today);

  return {
    id: plan.id,
    status: plan.status,
    revision: plan.revision,
    title: version?.title ?? plan.title,
    condition: version?.condition ?? plan.condition,
    startDate: planStart(timeline) ?? fromDbDate(plan.startDate),
    endDate: planEnd(timeline) ?? fromDbDate(plan.endDate),
    trainingWeekdays: version?.trainingWeekdays ?? plan.trainingWeekdays,
    restDates: version?.restDates.map(fromDbDate) ?? [],
    therapistNotes: version?.therapistNotes ?? plan.therapistNotes,
    therapist: plan.therapist,
    versionId: version?.id ?? null,
    versionNumber: version?.number ?? null,
    tasks: (version?.items ?? []).filter((item) => item.taskId).map(serializeItem),
    pauses: timeline.pauses,
  };
}

export async function loadPlan(db: Client, where: Prisma.RehabPlanWhereInput) {
  return db.rehabPlan.findFirst({ where, include: timelineInclude, orderBy: { createdAt: 'desc' } });
}

/** The plan the patient follows: the ACTIVE or PAUSED one, else the most recent completed one. */
export async function loadCurrentPlan(db: Client, patientId: string) {
  return (
    (await loadPlan(db, { patientId, status: { in: [PlanStatus.ACTIVE, PlanStatus.PAUSED] } })) ??
    (await loadPlan(db, { patientId, status: PlanStatus.COMPLETED }))
  );
}

export const completionInclude = { task: { select: { exercise: { select: { id: true, title: true } } } } } satisfies Prisma.TaskCompletionInclude;
type CompletionWithExercise = Prisma.TaskCompletionGetPayload<{ include: typeof completionInclude }>;

export async function loadCompletions(db: Client, planId: string) {
  return db.taskCompletion.findMany({ where: { task: { planId } }, orderBy: { completedAt: 'asc' }, include: completionInclude });
}

export function toLite(completions: { taskId: string; sessionDate: Date; status: Outcome }[]): CompletionLite[] {
  return completions.map((completion) => ({ taskId: completion.taskId, sessionDate: fromDbDate(completion.sessionDate), status: completion.status }));
}

export async function getPatientTotals(db: Client, patientId: string, today: DateKey) {
  const weekStart = addDays(today, -6);
  const [total, week] = await Promise.all([
    db.xpEvent.aggregate({ where: { userId: patientId }, _sum: { amount: true } }),
    db.xpEvent.aggregate({ where: { userId: patientId, sessionDate: { gte: toDbDate(weekStart) } }, _sum: { amount: true } }),
  ]);
  return { xpTotal: total._sum.amount ?? 0, xpLast7Days: week._sum.amount ?? 0 };
}

export function serializeCompletion(completion: CompletionWithExercise | Prisma.TaskCompletionGetPayload<object>) {
  return {
    id: completion.id,
    taskId: completion.taskId,
    sessionDate: fromDbDate(completion.sessionDate),
    status: completion.status,
    painLevel: completion.painLevel,
    difficulty: completion.difficulty,
    reason: completion.reason,
    notes: completion.notes,
    setsCompleted: completion.setsCompleted,
    repsPerSet: completion.repsPerSet,
    activeSeconds: completion.activeSeconds,
    xpAwarded: completion.xpAwarded,
    needsReview: completion.needsReview,
    reviewedAt: completion.reviewedAt,
    completedAt: completion.completedAt,
    occurredAt: completion.occurredAt,
    receivedAt: completion.createdAt,
    source: completion.source,
    planVersionItemId: completion.planVersionItemId,
    prescribed: {
      sets: completion.prescribedSets,
      reps: completion.prescribedReps,
      durationSeconds: completion.prescribedDurationSecs,
      holdSeconds: completion.prescribedHoldSecs,
      restSeconds: completion.prescribedRestSecs,
    },
    exercise: 'task' in completion ? completion.task?.exercise : undefined,
  };
}

/** Everything the patient home screen needs: today's tasks, the path and totals. */
export async function getPatientOverview(db: Client, patient: { id: string; timezone: string }, now = new Date()) {
  const today = localDateKey(patient.timezone, now);
  const plan = await loadCurrentPlan(db, patient.id);
  const totals = await getPatientTotals(db, patient.id, today);

  if (!plan || plan.versions.length === 0) {
    return { today, timezone: patient.timezone, status: 'no-plan' as const, plan: null, careActive: false, weeklyGoal: null, returnAfterBreak: null, mascotCosmetic: 'classic', todayVersionId: null, todayTasks: [], days: [], streak: 0, stats: null, nextTrainingDay: null, ...totals };
  }

  const timeline = toTimeline(plan);
  const completions = await loadCompletions(db, plan.id);
  const days = buildDays(timeline, toLite(completions), today);
  const kind = dayKind(timeline, today);
  const start = planStart(timeline)!;
  const end = planEnd(timeline)!;

  let status: 'training' | 'rest' | 'not-started' | 'finished' | 'paused' | 'completed';
  if (plan.status === PlanStatus.COMPLETED) status = 'completed';
  else if (plan.status === PlanStatus.PAUSED || kind.kind === 'paused') status = 'paused';
  else if (today < start) status = 'not-started';
  else if (today > end) status = 'finished';
  else status = kind.kind === 'training' ? 'training' : 'rest';

  // A plan stays readable after care ends, but the patient should know nobody is following it.
  const careActive = (await db.therapistPatient.count({ where: { therapistId: plan.therapistId, patientId: patient.id, endedAt: null } })) > 0;

  const preference = await db.userPreference.findUnique({ where: { userId: patient.id }, select: { weeklySessionGoal: true, mascotCosmetic: true } });

  const todaysCompletions = new Map(completions.filter((completion) => fromDbDate(completion.sessionDate) === today).map((completion) => [completion.taskId, completion]));
  const todayTasks =
    status === 'training'
      ? kind.items.map((item) => {
          const completion = todaysCompletions.get(item.taskId);
          return { ...item, completion: completion ? serializeCompletion(completion) : null };
        })
      : [];

  return {
    today,
    timezone: patient.timezone,
    status,
    plan: serializePlan(plan, today),
    careActive,
    todayVersionId: kind.version?.id ?? null,
    todayTasks,
    nextTrainingDay: days.find((day) => day.isTrainingDay && day.date > today)?.date ?? null,
    days,
    streak: plan.status === PlanStatus.ACTIVE ? computeStreak(days, today) : 0,
    stats: sessionStats(days, today),
    weeklyGoal: weeklyGoalProgress(days, today, preference?.weeklySessionGoal ?? null),
    mascotCosmetic: preference?.mascotCosmetic ?? 'classic',
    returnAfterBreak: plan.status === PlanStatus.ACTIVE ? returnAfterBreak(days, today) : null,
    ...totals,
  };
}

export type CompletionInput = {
  status: Outcome;
  painLevel?: number | null;
  difficulty?: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD' | null;
  reason?: 'PAIN_OR_DISCOMFORT' | 'TIRED' | 'NO_TIME' | 'FORGOT' | 'NO_EQUIPMENT' | 'UNSURE_HOW' | 'OTHER' | null;
  notes?: string | null;
  setsCompleted?: number | null;
  repsPerSet?: number[];
  activeSeconds?: number | null;
  // Offline replay binding (all optional for online use):
  idempotencyKey?: string | null;
  sessionDate?: DateKey | null;
  planVersionId?: string | null;
  occurredAt?: Date | null;
  offline?: boolean;
};

/**
 * Records one outcome for one prescribed item on one patient-local day and awards rewards.
 *
 * Consistency:
 * - The patient's User row is locked (SELECT ... FOR UPDATE) for the transaction, so
 *   concurrent requests by the same patient run one after another; the "last item of the
 *   day" check for the session bonus is race-free.
 * - TaskCompletion is unique per (taskId, sessionDate) and per idempotencyKey; XpEvent.sourceKey
 *   is unique. A repeated or replayed request returns the existing record and awards nothing.
 * - Offline replays are bound to an occurrence (date + plan version). If the version that applied
 *   on that date is not the one the device used, the record is rejected as a conflict instead of
 *   being attached to a different prescription.
 */
export async function completeTask(patient: { id: string; timezone: string }, taskId: string, input: CompletionInput, now = new Date()) {
  const today = localDateKey(patient.timezone, now);
  const date = input.sessionDate ?? today;

  if (date > today) throw conflict('This session date is in the future', 'occurrence_in_future');
  if (date < addDays(today, -config.offlineGraceDays)) {
    throw conflict(`Records older than ${config.offlineGraceDays} days cannot be added. Tell your therapist in a message instead.`, 'occurrence_too_old');
  }
  if (input.occurredAt && input.occurredAt.getTime() > now.getTime() + 10 * 60 * 1000) {
    throw new HttpError(400, 'The reported time is in the future', 'invalid_occurred_at');
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${patient.id} FOR UPDATE`;

      if (input.idempotencyKey) {
        const byKey = await tx.taskCompletion.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: completionInclude });
        if (byKey) {
          if (byKey.patientId !== patient.id || byKey.taskId !== taskId || fromDbDate(byKey.sessionDate) !== date) {
            throw conflict('This request key was already used for a different record', 'idempotency_key_conflict');
          }
          return { alreadyRecorded: true, completion: byKey, xpAwarded: 0, sessionComplete: false, newBadgeIds: [] as string[], weeklyGoal: null, today, date, planId: '' };
        }
      }

      const task = await tx.rehabTask.findUnique({ where: { id: taskId }, select: { id: true, planId: true } });
      const plan = task ? await loadPlan(tx, { id: task.planId, patientId: patient.id }) : null;
      // Same 404 whether the task does not exist or belongs to someone else.
      if (!task || !plan) throw notFound('Exercise not found in your plan');
      if (plan.status !== PlanStatus.ACTIVE) throw conflict('This plan is not active right now', 'plan_not_active');

      const timeline = toTimeline(plan);
      const kind = dayKind(timeline, date);
      if (kind.kind === 'paused') throw conflict('Your plan was paused on this day', 'day_paused');
      const item = kind.items.find((candidate) => candidate.taskId === taskId);
      if (kind.kind !== 'training' || !item || !kind.version) throw conflict('This exercise is not scheduled for this day', 'not_scheduled_today');
      if (input.planVersionId && input.planVersionId !== kind.version.id) {
        throw new HttpError(409, 'Your plan was updated after this was recorded. The record was not added to the new plan.', 'plan_version_changed', {
          currentVersionId: kind.version.id,
        });
      }

      const loadDays = async () =>
        buildDays(timeline, toLite(await tx.taskCompletion.findMany({ where: { task: { planId: plan.id } }, select: { taskId: true, sessionDate: true, status: true } })), today);

      const existing = await tx.taskCompletion.findUnique({ where: { taskId_sessionDate: { taskId, sessionDate: toDbDate(date) } }, include: completionInclude });
      if (existing) {
        const days = await loadDays();
        return { alreadyRecorded: true, completion: existing, xpAwarded: 0, sessionComplete: days.find((day) => day.date === date)?.state === 'done', newBadgeIds: [] as string[], weeklyGoal: null, today, date, planId: plan.id };
      }

      if (input.status === 'PARTIAL' && (input.setsCompleted ?? 0) >= item.sets) {
        throw new HttpError(400, 'All sets were done: record this exercise as completed', 'partial_all_sets');
      }

      const xp = TASK_XP[input.status];
      const completion = await tx.taskCompletion.create({
        data: {
          taskId,
          patientId: patient.id,
          sessionDate: toDbDate(date),
          status: input.status,
          painLevel: input.painLevel ?? null,
          difficulty: input.difficulty ?? null,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          setsCompleted: input.setsCompleted ?? (input.status === 'COMPLETED' ? item.sets : null),
          repsPerSet: input.repsPerSet ?? [],
          activeSeconds: input.activeSeconds ?? null,
          occurredAt: input.occurredAt ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          source: input.offline ? CompletionSource.OFFLINE_SYNC : CompletionSource.ONLINE,
          planVersionItemId: item.versionItemId,
          prescribedSets: item.sets,
          prescribedReps: item.reps,
          prescribedDurationSecs: item.durationSeconds,
          prescribedHoldSecs: item.holdSeconds,
          prescribedRestSecs: item.restSeconds,
          xpAwarded: xp,
          completedAt: now,
        },
        include: completionInclude,
      });

      const flagged = await recordReviewItemsForCompletion(tx, { completion, therapistId: plan.therapistId, exerciseTitle: item.exercise.title });

      let xpAwarded = 0;
      if (xp > 0) {
        const created = await tx.xpEvent.createMany({
          data: [{ userId: patient.id, amount: xp, reason: XpReason.TASK_COMPLETED, sourceKey: `task:${taskId}:${date}`, sessionDate: toDbDate(date) }],
          skipDuplicates: true,
        });
        xpAwarded += created.count * xp;
      }

      const days = await loadDays();
      const sessionComplete = days.find((day) => day.date === date)?.state === 'done';
      if (sessionComplete) {
        const bonus = await tx.xpEvent.createMany({
          data: [{ userId: patient.id, amount: SESSION_BONUS_XP, reason: XpReason.SESSION_COMPLETED, sourceKey: `session:${plan.id}:${date}`, sessionDate: toDbDate(date) }],
          skipDuplicates: true,
        });
        xpAwarded += bonus.count * SESSION_BONUS_XP;
      }

      const qualifying = qualifyingBadges(days, date);
      const already = new Set((await tx.userBadge.findMany({ where: { userId: patient.id }, select: { badgeId: true } })).map((badge) => badge.badgeId));
      const newBadgeIds: string[] = qualifying.filter((id) => !already.has(id));
      if (newBadgeIds.length > 0) {
        await tx.userBadge.createMany({ data: newBadgeIds.map((badgeId) => ({ userId: patient.id, badgeId, earnedAt: now })), skipDuplicates: true });
      }

      let weeklyGoal: Awaited<ReturnType<typeof awardAfterSession>>['weeklyGoal'] | null = null;
      if (sessionComplete) {
        const motivation = await awardAfterSession(tx, { patientId: patient.id, days, date, now });
        weeklyGoal = motivation.weeklyGoal;
        newBadgeIds.push(...motivation.newBadgeIds);
      }

      return { alreadyRecorded: false, completion: { ...completion, needsReview: flagged }, xpAwarded, sessionComplete, newBadgeIds, weeklyGoal, today, date, planId: plan.id };
    },
    { timeout: 15_000 },
  );
}

export async function listBadges(db: Client, userId: string) {
  const [badges, earned] = await Promise.all([db.badge.findMany(), db.userBadge.findMany({ where: { userId } })]);
  const earnedAt = new Map(earned.map((entry) => [entry.badgeId, entry.earnedAt]));
  const order = [...BADGE_IDS, ...badges.map((badge) => badge.id).filter((id) => !(BADGE_IDS as readonly string[]).includes(id))];
  return order
    .map((id) => badges.find((badge) => badge.id === id))
    .filter((badge): badge is NonNullable<typeof badge> => Boolean(badge))
    .map((badge) => ({ id: badge.id, name: badge.name, description: badge.description, icon: badge.icon, earnedAt: earnedAt.get(badge.id) ?? null }));
}
