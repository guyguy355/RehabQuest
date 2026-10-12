import { PlanStatus, Prisma, XpReason } from '@prisma/client';
import { prisma, type Db, type Tx } from '../db.js';
import { conflict, notFound } from '../http.js';
import { addDays, fromDbDate, localDateKey, type DateKey, toDbDate } from '../lib/dates.js';
import {
  BADGE_IDS,
  buildDays,
  computeStreak,
  type CompletionLite,
  isInPlan,
  isTrainingDay,
  needsReview,
  type PlanSchedule,
  qualifyingBadges,
  SESSION_BONUS_XP,
  sessionStats,
  TASK_XP,
  tasksOn,
} from './progress.js';

type Client = Db | Tx;

export const exercisePublicSelect = {
  id: true,
  title: true,
  description: true,
  instructions: true,
  safetyNotes: true,
  bodyPart: true,
  difficulty: true,
  videoUrl: true,
  imageUrl: true,
} as const;

const planWithTasks = {
  tasks: {
    orderBy: { orderIndex: 'asc' },
    include: { exercise: { select: exercisePublicSelect } },
  },
  therapist: { select: { id: true, name: true } },
} satisfies Prisma.RehabPlanInclude;

export type PlanWithTasks = Prisma.RehabPlanGetPayload<{ include: typeof planWithTasks }>;

export type ScheduledTask = Omit<PlanWithTasks['tasks'][number], 'activeFrom' | 'activeUntil'> & {
  activeFrom: DateKey;
  activeUntil: DateKey | null;
};

export function toSchedule(plan: PlanWithTasks): Omit<PlanSchedule, 'tasks'> & { tasks: ScheduledTask[] } {
  return {
    startDate: fromDbDate(plan.startDate),
    endDate: fromDbDate(plan.endDate),
    trainingWeekdays: plan.trainingWeekdays,
    tasks: plan.tasks.map((task) => ({
      ...task,
      activeFrom: fromDbDate(task.activeFrom),
      activeUntil: task.activeUntil ? fromDbDate(task.activeUntil) : null,
    })),
  };
}

export function serializePlan(plan: PlanWithTasks, today: DateKey) {
  const schedule = toSchedule(plan);
  // Tasks still in the plan going forward (removed tasks get an activeUntil date and stay only in history).
  const current = schedule.tasks.filter((task) => task.activeUntil === null).sort((a, b) => a.orderIndex - b.orderIndex);

  return {
    id: plan.id,
    title: plan.title,
    condition: plan.condition,
    status: plan.status,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    trainingWeekdays: plan.trainingWeekdays,
    therapistNotes: plan.therapistNotes,
    therapist: plan.therapist,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    tasks: current.map(serializeTask),
  };
}

export function serializeTask(task: ScheduledTask) {
  return {
    id: task.id,
    sets: task.sets,
    reps: task.reps,
    durationSeconds: task.durationSeconds,
    orderIndex: task.orderIndex,
    notes: task.notes,
    activeFrom: task.activeFrom,
    activeUntil: task.activeUntil,
    exercise: task.exercise,
  };
}

export async function loadPlan(db: Client, where: Prisma.RehabPlanWhereInput) {
  return db.rehabPlan.findFirst({ where, include: planWithTasks, orderBy: { createdAt: 'desc' } });
}

/** The plan the patient follows today: the ACTIVE plan, or otherwise the most recent one. */
export async function loadCurrentPlan(db: Client, patientId: string) {
  return (
    (await loadPlan(db, { patientId, status: PlanStatus.ACTIVE })) ??
    (await loadPlan(db, { patientId }))
  );
}

export async function loadCompletions(db: Client, planId: string) {
  return db.taskCompletion.findMany({
    where: { task: { planId } },
    orderBy: { completedAt: 'asc' },
    include: { task: { select: { exercise: { select: { id: true, title: true } } } } },
  });
}

function toLite(completions: { taskId: string; sessionDate: Date; status: 'COMPLETED' | 'STOPPED' }[]): CompletionLite[] {
  return completions.map((completion) => ({
    taskId: completion.taskId,
    sessionDate: fromDbDate(completion.sessionDate),
    status: completion.status,
  }));
}

export async function getPatientTotals(db: Client, patientId: string, today: DateKey) {
  const weekStart = addDays(today, -6);
  const [total, week] = await Promise.all([
    db.xpEvent.aggregate({ where: { userId: patientId }, _sum: { amount: true } }),
    db.xpEvent.aggregate({ where: { userId: patientId, sessionDate: { gte: toDbDate(weekStart) } }, _sum: { amount: true } }),
  ]);

  return { xpTotal: total._sum.amount ?? 0, xpLast7Days: week._sum.amount ?? 0 };
}

/** Everything the patient home screen needs: today's tasks, the path and totals. */
export async function getPatientOverview(db: Client, patient: { id: string; timezone: string }, now = new Date()) {
  const today = localDateKey(patient.timezone, now);
  const plan = await loadCurrentPlan(db, patient.id);
  const totals = await getPatientTotals(db, patient.id, today);

  if (!plan) {
    return { today, timezone: patient.timezone, status: 'no-plan' as const, plan: null, todayTasks: [], days: [], streak: 0, stats: null, ...totals };
  }

  const schedule = toSchedule(plan);
  const completions = await loadCompletions(db, plan.id);
  const days = buildDays(schedule, toLite(completions), today);
  const isActive = plan.status === PlanStatus.ACTIVE;

  let status: 'training' | 'rest' | 'not-started' | 'finished' | 'paused' | 'completed';
  if (plan.status === PlanStatus.PAUSED) status = 'paused';
  else if (plan.status === PlanStatus.COMPLETED) status = 'completed';
  else if (today < schedule.startDate) status = 'not-started';
  else if (today > schedule.endDate) status = 'finished';
  else status = isTrainingDay(schedule, today) ? 'training' : 'rest';

  const todaysCompletions = new Map(
    completions.filter((completion) => fromDbDate(completion.sessionDate) === today).map((completion) => [completion.taskId, completion]),
  );

  const todayTasks =
    status === 'training'
      ? tasksOn(schedule, today).map((task) => {
          const completion = todaysCompletions.get(task.id);
          return {
            ...serializeTask(task),
            completion: completion ? serializeCompletion(completion) : null,
          };
        })
      : [];

  const nextTrainingDay = days.find((day) => day.isTrainingDay && day.date > today)?.date ?? null;

  return {
    today,
    timezone: patient.timezone,
    status,
    plan: serializePlan(plan, today),
    todayTasks,
    nextTrainingDay,
    days,
    streak: isActive ? computeStreak(days, today) : 0,
    stats: sessionStats(days, today),
    ...totals,
  };
}

export function serializeCompletion(completion: {
  id: string;
  taskId: string;
  sessionDate: Date;
  status: string;
  painLevel: number;
  difficulty: string | null;
  notes: string | null;
  xpAwarded: number;
  needsReview: boolean;
  reviewedAt: Date | null;
  completedAt: Date;
  prescribedSets: number;
  prescribedReps: number;
  prescribedDurationSecs: number;
  task?: { exercise: { id: string; title: string } };
}) {
  return {
    id: completion.id,
    taskId: completion.taskId,
    sessionDate: fromDbDate(completion.sessionDate),
    status: completion.status,
    painLevel: completion.painLevel,
    difficulty: completion.difficulty,
    notes: completion.notes,
    xpAwarded: completion.xpAwarded,
    needsReview: completion.needsReview,
    reviewedAt: completion.reviewedAt,
    completedAt: completion.completedAt,
    prescribed: {
      sets: completion.prescribedSets,
      reps: completion.prescribedReps,
      durationSeconds: completion.prescribedDurationSecs,
    },
    exercise: completion.task?.exercise,
  };
}

export type CompletionInput = {
  status: 'COMPLETED' | 'STOPPED';
  painLevel: number;
  difficulty?: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD' | null;
  notes?: string | null;
};

/**
 * Records today's completion of one prescribed task and awards rewards.
 *
 * Consistency guarantees:
 * - The patient's User row is locked (SELECT ... FOR UPDATE) for the whole
 *   transaction, so concurrent completions by the same patient run one after
 *   another. This also makes the "was this the last task of the day?" check
 *   for the session bonus race-free.
 * - TaskCompletion is unique per (taskId, sessionDate) and XpEvent.sourceKey is
 *   unique, so even without the lock a reward cannot be written twice.
 * - Repeating the request returns the existing record with xpAwarded = 0.
 */
export async function completeTask(patient: { id: string; timezone: string }, taskId: string, input: CompletionInput, now = new Date()) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${patient.id} FOR UPDATE`;

        const today = localDateKey(patient.timezone, now);
        const task = await tx.rehabTask.findUnique({ where: { id: taskId }, select: { id: true, planId: true } });
        // Same 404 whether the task does not exist or belongs to someone else.
        const plan = task ? await loadPlan(tx, { id: task.planId, patientId: patient.id }) : null;

        if (!task || !plan) {
          throw notFound('Exercise not found in your plan');
        }

        if (plan.status !== PlanStatus.ACTIVE) {
          throw conflict('This plan is not active right now', 'plan_not_active');
        }

        const schedule = toSchedule(plan);
        const prescribedToday = tasksOn(schedule, today);
        const prescribed = prescribedToday.find((candidate) => candidate.id === taskId);

        if (!isInPlan(schedule, today) || !isTrainingDay(schedule, today) || !prescribed) {
          throw conflict('This exercise is not scheduled for today', 'not_scheduled_today');
        }

        const existing = await tx.taskCompletion.findUnique({
          where: { taskId_sessionDate: { taskId, sessionDate: toDbDate(today) } },
          include: { task: { select: { exercise: { select: { id: true, title: true } } } } },
        });

        const loadDays = async () =>
          buildDays(
            schedule,
            toLite(await tx.taskCompletion.findMany({ where: { task: { planId: plan.id } }, select: { taskId: true, sessionDate: true, status: true } })),
            today,
          );

        if (existing) {
          const days = await loadDays();
          const sessionComplete = days.find((day) => day.date === today)?.state === 'done';
          return { alreadyRecorded: true, completion: existing, xpAwarded: 0, sessionComplete, newBadgeIds: [] as string[], today, planId: plan.id };
        }

        const xp = input.status === 'COMPLETED' ? TASK_XP : 0;
        const completion = await tx.taskCompletion.create({
          data: {
            taskId,
            patientId: patient.id,
            sessionDate: toDbDate(today),
            status: input.status,
            painLevel: input.painLevel,
            difficulty: input.difficulty ?? null,
            notes: input.notes ?? null,
            prescribedSets: prescribed.sets,
            prescribedReps: prescribed.reps,
            prescribedDurationSecs: prescribed.durationSeconds,
            xpAwarded: xp,
            needsReview: needsReview(input),
            completedAt: now,
          },
          include: { task: { select: { exercise: { select: { id: true, title: true } } } } },
        });

        let xpAwarded = 0;

        if (xp > 0) {
          const created = await tx.xpEvent.createMany({
            data: [{ userId: patient.id, amount: xp, reason: XpReason.TASK_COMPLETED, sourceKey: `task:${taskId}:${today}`, sessionDate: toDbDate(today) }],
            skipDuplicates: true,
          });
          xpAwarded += created.count * xp;
        }

        const days = await loadDays();
        const todayInfo = days.find((day) => day.date === today);
        const sessionComplete = todayInfo?.state === 'done';

        if (sessionComplete) {
          const bonus = await tx.xpEvent.createMany({
            data: [{ userId: patient.id, amount: SESSION_BONUS_XP, reason: XpReason.SESSION_COMPLETED, sourceKey: `session:${plan.id}:${today}`, sessionDate: toDbDate(today) }],
            skipDuplicates: true,
          });
          xpAwarded += bonus.count * SESSION_BONUS_XP;
        }

        const qualifying = qualifyingBadges(days, today);
        const alreadyEarned = new Set(
          (await tx.userBadge.findMany({ where: { userId: patient.id }, select: { badgeId: true } })).map((badge) => badge.badgeId),
        );
        const newBadgeIds = qualifying.filter((id) => !alreadyEarned.has(id));

        if (newBadgeIds.length > 0) {
          await tx.userBadge.createMany({
            data: newBadgeIds.map((badgeId) => ({ userId: patient.id, badgeId, earnedAt: now })),
            skipDuplicates: true,
          });
        }

        return { alreadyRecorded: false, completion, xpAwarded, sessionComplete, newBadgeIds, today, planId: plan.id };
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    // Defence in depth: if a unique constraint still fires, report the existing record.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const today = localDateKey(patient.timezone, now);
      const existing = await prisma.taskCompletion.findUnique({
        where: { taskId_sessionDate: { taskId, sessionDate: toDbDate(today) } },
        include: { task: { select: { exercise: { select: { id: true, title: true } } } } },
      });

      if (existing && existing.patientId === patient.id) {
        return { alreadyRecorded: true, completion: existing, xpAwarded: 0, sessionComplete: false, newBadgeIds: [] as string[], today, planId: '' };
      }
    }

    throw error;
  }
}

export async function listBadges(db: Client, userId: string) {
  const [badges, earned] = await Promise.all([
    db.badge.findMany({ where: { id: { in: [...BADGE_IDS] } } }),
    db.userBadge.findMany({ where: { userId } }),
  ]);
  const earnedAt = new Map(earned.map((entry) => [entry.badgeId, entry.earnedAt]));

  return BADGE_IDS.map((id) => badges.find((badge) => badge.id === id))
    .filter((badge): badge is NonNullable<typeof badge> => Boolean(badge))
    .map((badge) => ({ id: badge.id, name: badge.name, description: badge.description, icon: badge.icon, earnedAt: earnedAt.get(badge.id) ?? null }));
}
