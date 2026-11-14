/**
 * Supportive motivation rules (pure functions, no database access). See docs/ACHIEVEMENTS.md.
 *
 * Principles
 * - Rewards come only from the plan the therapist prescribed, from check-ins and from milestones the
 *   therapist confirmed. Extra activity, pain scores and stopping early never earn or cost anything.
 * - Nothing is ever taken away: no lost achievements, no expiring rewards, no penalties for breaks.
 * - Weeks run Sunday–Saturday in the patient's timezone.
 */
import { addDays, type DateKey, weekday } from '../lib/dates.js';
import type { DayInfo } from './progress.js';

export function weekStartOf(date: DateKey): DateKey {
  return addDays(date, -weekday(date));
}

export type WeeklyGoalProgress = {
  weekStart: DateKey;
  weekEnd: DateKey;
  /** False when the week has no planned sessions (rest-only, paused or no plan): nothing to aim for. */
  applicable: boolean;
  planned: number;
  /** min(chosen goal, planned sessions); the chosen goal never asks for more than the plan. */
  target: number;
  done: number;
  met: boolean;
  /** Planned sessions in this week that can still be done (today unfinished or later). */
  remaining: number;
};

/**
 * Weekly consistency goal.
 * - planned = training days of the week (rest and paused days are not planned sessions).
 * - target  = goal === null ? planned : min(goal, planned).
 * - done    = training days of the week whose state is "done".
 * - met     = applicable && done >= target.
 */
export function weeklyGoalProgress(days: DayInfo[], date: DateKey, goal: number | null): WeeklyGoalProgress {
  const weekStart = weekStartOf(date);
  const weekEnd = addDays(weekStart, 6);
  const training = days.filter((day) => day.isTrainingDay && day.date >= weekStart && day.date <= weekEnd);
  const planned = training.length;
  const target = goal === null ? planned : Math.min(goal, planned);
  const done = training.filter((day) => day.state === 'done').length;
  const remaining = training.filter((day) => day.state === 'today' || day.state === 'upcoming').length;
  return { weekStart, weekEnd, applicable: planned > 0, planned, target, done, met: planned > 0 && done >= target, remaining };
}

/** Elapsed training days (ignoring rest, paused and future days) immediately before `date`, newest first. */
function trainingDaysBefore(days: DayInfo[], date: DateKey) {
  return days.filter((day) => day.isTrainingDay && day.date < date).reverse();
}

function missedRunBefore(days: DayInfo[], date: DateKey) {
  let run = 0;
  for (const day of trainingDaysBefore(days, date)) {
    if (day.state !== 'missed' && day.state !== 'skipped') break;
    run += 1;
  }
  return run;
}

export const WELCOME_BACK_MIN_MISSED = 3;
export const RETURN_MESSAGE_MIN_MISSED = 2;

/**
 * "Welcome back": the session on `date` is done and the planned sessions right before it
 * (rest and paused days ignored) include a run of at least 3 missed or skipped sessions.
 */
export function isWelcomeBack(days: DayInfo[], date: DateKey) {
  const day = days.find((entry) => entry.date === date);
  if (!day?.isTrainingDay || day.state !== 'done') return false;
  return missedRunBefore(days, date) >= WELCOME_BACK_MIN_MISSED;
}

/**
 * Return-after-break message for the home screen: shown when the last 2+ planned sessions before
 * today were missed or skipped and today's session is not done yet. Paused and rest days never count.
 */
export function returnAfterBreak(days: DayInfo[], today: DateKey): { missedInRow: number; lastDoneDate: DateKey | null } | null {
  const todayInfo = days.find((day) => day.date === today);
  if (todayInfo?.state === 'done') return null;
  const missedInRow = missedRunBefore(days, today);
  if (missedInRow < RETURN_MESSAGE_MIN_MISSED) return null;
  const lastDone = trainingDaysBefore(days, today).find((day) => day.state === 'done');
  return { missedInRow, lastDoneDate: lastDone?.date ?? null };
}

export type CountAchievementInput = { weeksGoalMet: number; checkInWeeks: number; confirmedMilestones: number };

/** Achievements based on counts (each documented in docs/ACHIEVEMENTS.md). */
export function countAchievements(input: CountAchievementInput) {
  const earned: string[] = [];
  if (input.weeksGoalMet >= 1) earned.push('weekly-goal');
  if (input.weeksGoalMet >= 4) earned.push('weekly-goal-4');
  if (input.checkInWeeks >= 1) earned.push('first-check-in');
  if (input.checkInWeeks >= 4) earned.push('check-in-4');
  if (input.confirmedMilestones >= 1) earned.push('first-milestone');
  return earned;
}

/**
 * The mascot's cosmetic collection. Purely visual; unlocked by achievements, never bought,
 * never lost. "classic" is always available.
 */
export const COSMETICS = [
  { id: 'classic', unlockedBy: null },
  { id: 'sunband', unlockedBy: 'first-session' },
  { id: 'scarf', unlockedBy: 'steady-three' },
  { id: 'cap', unlockedBy: 'full-week' },
  { id: 'headphones', unlockedBy: 'weekly-goal' },
  { id: 'flower', unlockedBy: 'welcome-back' },
  { id: 'glasses', unlockedBy: 'first-check-in' },
  { id: 'medal', unlockedBy: 'plan-complete' },
] as const;

export type CosmeticId = (typeof COSMETICS)[number]['id'];

export function cosmeticsFor(earnedBadgeIds: Iterable<string>) {
  const earned = new Set(earnedBadgeIds);
  return COSMETICS.map((cosmetic) => ({ id: cosmetic.id, unlockedBy: cosmetic.unlockedBy, unlocked: cosmetic.unlockedBy === null || earned.has(cosmetic.unlockedBy) }));
}

export function isCosmeticUnlocked(id: string, earnedBadgeIds: Iterable<string>) {
  return cosmeticsFor(earnedBadgeIds).some((cosmetic) => cosmetic.id === id && cosmetic.unlocked);
}
