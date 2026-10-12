/**
 * Pure progress rules (no database access) so they are easy to test.
 *
 * Rules
 * - A plan prescribes its active tasks on every training weekday between
 *   startDate and endDate. Other days in that range are scheduled rest days.
 * - A training day is "done" when every task prescribed that day has a
 *   completion record, either COMPLETED or STOPPED (stopped because of symptoms).
 *   Stopping for symptoms therefore never costs a streak or the session bonus.
 * - Streak = consecutive done training days, counting back from today.
 *   Rest days are skipped (they neither break nor extend a streak) and today's
 *   unfinished session does not break it. A past training day that is not
 *   done breaks it.
 * - XP is only ever earned for prescribed tasks: extra activity is not rewarded.
 */
import { addDays, diffDays, type DateKey, weekday } from '../lib/dates.js';

export const TASK_XP = 10;
export const SESSION_BONUS_XP = 20;

export type TaskWindow = {
  id: string;
  orderIndex: number;
  activeFrom: DateKey;
  activeUntil: DateKey | null;
};

export type PlanSchedule = {
  startDate: DateKey;
  endDate: DateKey;
  trainingWeekdays: number[];
  tasks: TaskWindow[];
};

export type CompletionLite = {
  taskId: string;
  sessionDate: DateKey;
  status: 'COMPLETED' | 'STOPPED';
};

export type DayState = 'done' | 'missed' | 'today' | 'upcoming' | 'rest';

export type DayInfo = {
  date: DateKey;
  week: number; // 1-based plan week
  isTrainingDay: boolean;
  state: DayState;
  taskCount: number;
  completedCount: number;
  stoppedCount: number;
};

export function tasksOn<T extends TaskWindow>(plan: { tasks: T[] }, date: DateKey): T[] {
  return plan.tasks
    .filter((task) => task.activeFrom <= date && (task.activeUntil === null || task.activeUntil >= date))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function isInPlan(plan: PlanSchedule, date: DateKey) {
  return date >= plan.startDate && date <= plan.endDate;
}

export function isTrainingDay(plan: PlanSchedule, date: DateKey) {
  return isInPlan(plan, date) && plan.trainingWeekdays.includes(weekday(date)) && tasksOn(plan, date).length > 0;
}

export function planWeek(plan: PlanSchedule, date: DateKey) {
  return Math.floor(diffDays(plan.startDate, date) / 7) + 1;
}

export function buildDays(plan: PlanSchedule, completions: CompletionLite[], today: DateKey): DayInfo[] {
  const byDate = new Map<DateKey, CompletionLite[]>();

  for (const completion of completions) {
    const list = byDate.get(completion.sessionDate) ?? [];
    list.push(completion);
    byDate.set(completion.sessionDate, list);
  }

  const days: DayInfo[] = [];

  for (let date = plan.startDate; date <= plan.endDate; date = addDays(date, 1)) {
    const week = planWeek(plan, date);

    if (!isTrainingDay(plan, date)) {
      days.push({ date, week, isTrainingDay: false, state: 'rest', taskCount: 0, completedCount: 0, stoppedCount: 0 });
      continue;
    }

    const taskIds = new Set(tasksOn(plan, date).map((task) => task.id));
    const records = (byDate.get(date) ?? []).filter((record) => taskIds.has(record.taskId));
    const completedCount = records.filter((record) => record.status === 'COMPLETED').length;
    const stoppedCount = records.length - completedCount;
    const resolved = records.length >= taskIds.size;

    let state: DayState;
    if (resolved) state = 'done';
    else if (date < today) state = 'missed';
    else if (date === today) state = 'today';
    else state = 'upcoming';

    days.push({ date, week, isTrainingDay: true, state, taskCount: taskIds.size, completedCount, stoppedCount });
  }

  return days;
}

export function computeStreak(days: DayInfo[], today: DateKey) {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];

    if (!day.isTrainingDay || day.date > today) continue;
    if (day.date === today && day.state !== 'done') continue;
    if (day.state !== 'done') break;

    streak += 1;
  }

  return streak;
}

export function sessionStats(days: DayInfo[], today: DateKey) {
  const training = days.filter((day) => day.isTrainingDay);

  return {
    totalSessions: training.length,
    sessionsToDate: training.filter((day) => day.date <= today).length,
    doneSessions: training.filter((day) => day.state === 'done').length,
    missedSessions: training.filter((day) => day.state === 'missed').length,
    restDays: days.length - training.length,
  };
}

export const BADGE_IDS = ['first-session', 'steady-three', 'full-week', 'halfway', 'plan-complete'] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

/** Achievements the patient qualifies for after the session on `today`. */
export function qualifyingBadges(days: DayInfo[], today: DateKey): BadgeId[] {
  const training = days.filter((day) => day.isTrainingDay);
  const done = training.filter((day) => day.state === 'done');
  const earned: BadgeId[] = [];

  if (done.length >= 1) earned.push('first-session');
  if (computeStreak(days, today) >= 3) earned.push('steady-three');

  const todayInfo = days.find((day) => day.date === today);
  if (todayInfo?.isTrainingDay && todayInfo.state === 'done') {
    const weekDays = training.filter((day) => day.week === todayInfo.week);
    if (weekDays.length > 0 && weekDays.every((day) => day.state === 'done')) earned.push('full-week');
  }

  if (training.length >= 2 && done.length >= Math.ceil(training.length / 2)) earned.push('halfway');

  const last = training.at(-1);
  if (last && last.state === 'done') earned.push('plan-complete');

  return earned;
}

export function needsReview(input: { status: 'COMPLETED' | 'STOPPED'; painLevel: number; difficulty?: string | null }) {
  return input.status === 'STOPPED' || input.painLevel >= 7 || input.difficulty === 'TOO_HARD';
}

export function reviewReasons(input: { status: string; painLevel: number; difficulty?: string | null }) {
  const reasons: string[] = [];
  if (input.status === 'STOPPED') reasons.push('Stopped because of symptoms');
  if (input.painLevel >= 7) reasons.push(`High pain reported (${input.painLevel}/10)`);
  if (input.difficulty === 'TOO_HARD') reasons.push('Reported as too hard');
  return reasons;
}
