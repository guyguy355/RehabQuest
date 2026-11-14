/**
 * Builds a versioned demo plan with fictional history, using the same rules as the API
 * (schedule, session bonus, achievements). Used only by the demo seed.
 */
import { PlanStatus, type PrismaClient, VersionStatus, XpReason } from '@prisma/client';
import { addDays, type DateKey, toDbDate } from '../src/lib/dates.js';
import { isWelcomeBack, weeklyGoalProgress } from '../src/services/gamification.js';
import { buildDays, type CompletionLite, itemsOn, needsReview, type Outcome, type PlanTimeline, qualifyingBadges, reviewReasons, SESSION_BONUS_XP, TASK_XP } from '../src/services/progress.js';

export type LibraryEntry = {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  safetyNotes: string | null;
  bodyPart: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
};

export type DemoEvent = 'missed' | 'stop' | 'hard' | 'pain' | 'partial' | 'skip';

export type PlanSeed = {
  title: string;
  condition: string;
  startOffset: number; // days from today
  lengthDays: number;
  trainingWeekdays: number[];
  restDateOffsets?: number[]; // explicit rest days, days from plan start
  notes: string;
  tasks: { key: string; sets: number; reps: number; durationSeconds: number; holdSeconds?: number; restSeconds?: number; notes?: string; startOffsetInPlan?: number }[];
  history?: { adherence: number; painBase: number; painTrend: number; events?: Record<number, DemoEvent> };
  reviewedBefore?: number; // flagged records older than this many days are already reviewed
  pauses?: { startOffset: number; endOffset: number }[]; // past approved pauses (offsets from plan start)
  weeklyGoal?: number | null; // the patient's weekly session goal (null = every planned session)
};

type Item = { taskId: string; orderIndex: number; versionItemId: string; sets: number; reps: number; durationSeconds: number; holdSeconds: number | null; restSeconds: number | null };

export async function createVersionedPlan(prisma: PrismaClient, therapistId: string, patientId: string, library: Map<string, LibraryEntry>, seed: PlanSeed, random: () => number, today: DateKey) {
  const startDate = addDays(today, seed.startOffset);
  const endDate = addDays(startDate, seed.lengthDays - 1);
  const restDates = (seed.restDateOffsets ?? []).map((offset) => addDays(startDate, offset));

  const plan = await prisma.rehabPlan.create({
    data: {
      patientId,
      therapistId,
      title: seed.title,
      condition: seed.condition,
      startDate: toDbDate(startDate),
      endDate: toDbDate(endDate),
      trainingWeekdays: seed.trainingWeekdays,
      therapistNotes: seed.notes,
      status: PlanStatus.ACTIVE,
      createdAt: new Date(`${addDays(startDate, -1)}T09:00:00Z`),
    },
  });

  // One stable slot per prescribed exercise.
  const slots: { id: string }[] = [];
  for (const [index, task] of seed.tasks.entries()) {
    const entry = library.get(task.key)!;
    slots.push(
      await prisma.rehabTask.create({
        data: { planId: plan.id, exerciseId: entry.id, sets: task.sets, reps: task.reps, durationSeconds: task.durationSeconds, notes: task.notes ?? null, orderIndex: index, activeFrom: toDbDate(addDays(startDate, task.startOffsetInPlan ?? 0)) },
      }),
    );
  }

  // A new published version wherever the set of exercises changed (e.g. step-ups added in week 3).
  const boundaries = [...new Set(seed.tasks.map((task) => task.startOffsetInPlan ?? 0))].sort((a, b) => a - b);
  const timeline: PlanTimeline<Item> = { versions: [], pauses: [] };

  for (const [index, offset] of boundaries.entries()) {
    const effectiveFrom = addDays(startDate, offset);
    const version = await prisma.planVersion.create({
      data: {
        planId: plan.id,
        number: index + 1,
        status: VersionStatus.PUBLISHED,
        title: seed.title,
        condition: seed.condition,
        therapistNotes: seed.notes,
        trainingWeekdays: seed.trainingWeekdays,
        restDates: restDates.filter((date) => date >= effectiveFrom).map(toDbDate),
        effectiveFrom: toDbDate(effectiveFrom),
        endDate: toDbDate(endDate),
        changeNote: index === 0 ? null : 'Added exercises after review',
        createdById: therapistId,
        publishedById: therapistId,
        publishedAt: new Date(`${addDays(effectiveFrom, -1)}T10:00:00Z`),
      },
    });

    const items: Item[] = [];
    for (const [order, task] of seed.tasks.entries()) {
      if ((task.startOffsetInPlan ?? 0) > offset) continue;
      const entry = library.get(task.key)!;
      const created = await prisma.planVersionItem.create({
        data: {
          versionId: version.id,
          taskId: slots[order].id,
          exerciseId: entry.id,
          orderIndex: order,
          sets: task.sets,
          reps: task.reps,
          holdSeconds: task.holdSeconds ?? null,
          restSeconds: task.restSeconds ?? null,
          durationSeconds: task.durationSeconds,
          notes: task.notes ?? null,
          exerciseTitle: entry.title,
          exerciseDescription: entry.description,
          instructions: entry.instructions,
          safetyNotes: entry.safetyNotes,
          bodyPart: entry.bodyPart,
          difficulty: entry.difficulty,
        },
      });
      items.push({ taskId: slots[order].id, orderIndex: order, versionItemId: created.id, sets: task.sets, reps: task.reps, durationSeconds: task.durationSeconds, holdSeconds: task.holdSeconds ?? null, restSeconds: task.restSeconds ?? null });
    }

    timeline.versions.push({ id: version.id, number: index + 1, effectiveFrom, endDate, trainingWeekdays: seed.trainingWeekdays, restDates: restDates.filter((date) => date >= effectiveFrom), items });
  }

  for (const pause of seed.pauses ?? []) {
    const range = { startDate: addDays(startDate, pause.startOffset), endDate: addDays(startDate, pause.endOffset) };
    await prisma.planPause.create({ data: { planId: plan.id, startDate: toDbDate(range.startDate), endDate: toDbDate(range.endDate), reason: 'Travel (approved pause)', createdById: therapistId } });
    timeline.pauses.push(range);
  }

  const result = { plan, taskIds: new Map(seed.tasks.map((task, index) => [task.key, slots[index].id])) };
  if (!seed.history) return result;

  const lite: CompletionLite[] = [];
  const earned = new Set<string>();
  let trainingIndex = 0;

  for (let date = startDate; date < today; date = addDays(date, 1)) {
    const items = itemsOn(timeline, date);
    if (items.length === 0) continue;
    trainingIndex += 1;

    const event = seed.history.events?.[trainingIndex];
    if (event === 'missed' || (!event && random() > seed.history.adherence)) continue;

    const daysAgo = Math.round((toDbDate(today).getTime() - toDbDate(date).getTime()) / 86_400_000);
    const progress = trainingIndex / 20;

    for (const [index, item] of items.entries()) {
      const basePain = Math.max(0, Math.min(10, Math.round(seed.history.painBase + seed.history.painTrend * progress + (random() * 2 - 1))));
      let status: Outcome = 'COMPLETED';
      let painLevel: number | null = basePain;
      let difficulty: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD' | null = random() > 0.85 ? 'TOO_EASY' : 'JUST_RIGHT';
      let reason: 'PAIN_OR_DISCOMFORT' | 'TIRED' | 'NO_TIME' | null = null;
      let notes: string | null = null;
      let setsCompleted: number | null = item.sets;

      if (event === 'stop' && index === items.length - 1) {
        status = 'STOPPED';
        painLevel = 7;
        difficulty = null;
        reason = 'PAIN_OR_DISCOMFORT';
        setsCompleted = 1;
        notes = 'Sharp pain on the outside of the knee, so I stopped.';
      } else if (event === 'hard' && index === 0) {
        difficulty = 'TOO_HARD';
        painLevel = Math.max(basePain, 5);
        notes = 'Hard to finish the last set.';
      } else if (event === 'pain' && index === 0) {
        painLevel = 7;
        notes = 'Shoulder ached afterwards for about an hour.';
      } else if (event === 'partial' && index === 0) {
        status = 'PARTIAL';
        setsCompleted = Math.max(1, item.sets - 1);
        reason = null;
        notes = 'Ran out of time for the last set.';
      } else if (event === 'skip' && index === items.length - 1) {
        status = 'SKIPPED';
        painLevel = null;
        difficulty = null;
        reason = 'TIRED';
        setsCompleted = 0;
      } else if (random() > 0.8) {
        notes = ['Felt easier than last time.', 'A bit stiff in the morning.', 'Did it after a short walk.'][Math.floor(random() * 3)];
      }

      const xp = TASK_XP[status];
      const flagged = needsReview({ status, painLevel, difficulty, reason });
      const completedAt = new Date(`${date}T${String(14 + index).padStart(2, '0')}:${String(Math.floor(random() * 50) + 5).padStart(2, '0')}:00Z`);
      const reviewed = flagged && seed.reviewedBefore !== undefined && daysAgo > seed.reviewedBefore;

      const created = await prisma.taskCompletion.create({
        data: {
          taskId: item.taskId,
          patientId,
          sessionDate: toDbDate(date),
          status,
          painLevel,
          difficulty,
          reason,
          notes,
          setsCompleted,
          repsPerSet: status === 'SKIPPED' ? [] : Array.from({ length: setsCompleted ?? 0 }, () => item.reps),
          activeSeconds: status === 'SKIPPED' ? 0 : (setsCompleted ?? 0) * item.durationSeconds,
          occurredAt: completedAt,
          planVersionItemId: item.versionItemId,
          prescribedSets: item.sets,
          prescribedReps: item.reps,
          prescribedDurationSecs: item.durationSeconds,
          prescribedHoldSecs: item.holdSeconds,
          prescribedRestSecs: item.restSeconds,
          xpAwarded: xp,
          needsReview: flagged,
          reviewedAt: reviewed ? new Date(completedAt.getTime() + 86_400_000) : null,
          reviewedById: reviewed ? therapistId : null,
          completedAt,
          createdAt: completedAt,
        },
      });

      if (flagged) {
        // Same review rules as the API (default thresholds).
        await prisma.reviewItem.create({
          data: {
            therapistId,
            patientId,
            kind: status === 'STOPPED' || (status === 'SKIPPED' && reason === 'PAIN_OR_DISCOMFORT') ? 'STOPPED' : 'FEEDBACK',
            sourceType: 'COMPLETION',
            sourceId: created.id,
            dedupeKey: `completion:${created.id}`,
            reasons: reviewReasons({ status, painLevel, difficulty, reason }),
            status: reviewed ? 'RESOLVED' : 'OPEN',
            resolvedAt: reviewed ? new Date(completedAt.getTime() + 86_400_000) : null,
            resolvedById: reviewed ? therapistId : null,
            resolutionNote: reviewed ? 'Discussed at the last appointment.' : null,
            firstEventAt: completedAt,
            lastEventAt: completedAt,
          },
        });
      }

      if (xp > 0) {
        await prisma.xpEvent.create({ data: { userId: patientId, amount: xp, reason: XpReason.TASK_COMPLETED, sourceKey: `task:${item.taskId}:${date}`, sessionDate: toDbDate(date), createdAt: completedAt } });
      }
      lite.push({ taskId: item.taskId, sessionDate: date, status });
    }

    // Same rules as the API: session bonus once the day is finished, then achievements.
    const days = buildDays(timeline, lite, date);
    if (days.find((day) => day.date === date)?.state === 'done') {
      await prisma.xpEvent.create({ data: { userId: patientId, amount: SESSION_BONUS_XP, reason: XpReason.SESSION_COMPLETED, sourceKey: `session:${plan.id}:${date}`, sessionDate: toDbDate(date) } });
      // Same weekly-goal and welcome-back rules as the API (services/motivation.ts).
      const week = weeklyGoalProgress(days, date, seed.weeklyGoal ?? null);
      if (week.met) {
        await prisma.weeklyGoalWeek.createMany({ data: [{ userId: patientId, weekStart: toDbDate(week.weekStart), goal: week.target, done: week.done, metAt: new Date(`${date}T16:00:00Z`) }], skipDuplicates: true });
      }
      const sessionBadges = [...qualifyingBadges(days, date), ...(isWelcomeBack(days, date) ? ['welcome-back'] : [])];
      for (const badgeId of sessionBadges) {
        if (earned.has(badgeId)) continue;
        earned.add(badgeId);
        await prisma.userBadge.create({ data: { userId: patientId, badgeId, earnedAt: new Date(`${date}T16:00:00Z`) } });
      }
    }
  }

  return result;
}
