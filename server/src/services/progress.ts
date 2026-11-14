/**
 * Pure schedule and progress rules (no database access) so they are easy to test.
 *
 * Schedule
 * - A plan is a list of published versions. The version that applies to a date is
 *   the one with the latest effectiveFrom <= date (ties: higher number). Publishing a
 *   revision therefore never changes what applied on earlier dates.
 * - Within its version, a date is a training day when its weekday is in
 *   trainingWeekdays, it is not an explicit rest date, it is on or before the
 *   version's endDate, and the version has items. Other dates are rest days.
 * - Dates inside an approved pause are "paused": they never count for or against
 *   the patient (streak, adherence, reminders).
 *
 * Outcomes per prescribed item and day: COMPLETED, PARTIAL, SKIPPED, STOPPED.
 * - A training day is "done" when every item has an outcome and at least one item
 *   was performed (COMPLETED or PARTIAL) or stopped because of symptoms (STOPPED).
 *   Stopping for symptoms therefore never costs a streak or the session bonus.
 * - A day where every item was SKIPPED is "skipped": recorded honestly, it does not
 *   extend the streak and breaks it like a missed day.
 * - Streak = consecutive done training days counting back from today. Rest and paused
 *   days are skipped over; today's unfinished session does not break the streak.
 * - XP is earned only for prescribed items: never for extra activity.
 */
import { addDays, diffDays, type DateKey, weekday } from '../lib/dates.js';

export const TASK_XP = { COMPLETED: 10, PARTIAL: 5, SKIPPED: 0, STOPPED: 0 } as const;
export const SESSION_BONUS_XP = 20;

export type Outcome = keyof typeof TASK_XP;

export type ScheduleItem = { taskId: string; orderIndex: number };

export type VersionSchedule<I extends ScheduleItem = ScheduleItem> = {
  id: string;
  number: number;
  effectiveFrom: DateKey;
  endDate: DateKey;
  trainingWeekdays: number[];
  restDates: DateKey[];
  items: I[];
};

export type PauseRange = { startDate: DateKey; endDate: DateKey | null };

export type PlanTimeline<I extends ScheduleItem = ScheduleItem> = {
  versions: VersionSchedule<I>[]; // published versions only
  pauses: PauseRange[];
};

export type CompletionLite = { taskId: string; sessionDate: DateKey; status: Outcome };

export type DayKind = 'outside' | 'paused' | 'rest' | 'training';
export type DayState = 'done' | 'skipped' | 'missed' | 'today' | 'upcoming' | 'rest' | 'paused';

export type DayInfo = {
  date: DateKey;
  week: number; // 1-based plan week
  versionNumber: number;
  isTrainingDay: boolean;
  state: DayState;
  taskCount: number;
  completedCount: number;
  partialCount: number;
  skippedCount: number;
  stoppedCount: number;
};

function sortedVersions<I extends ScheduleItem>(timeline: PlanTimeline<I>) {
  return [...timeline.versions].sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? a.number - b.number : a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

export function planStart(timeline: PlanTimeline) {
  return sortedVersions(timeline)[0]?.effectiveFrom ?? null;
}

/** Last date covered by any version (the end of the latest-starting version). */
export function planEnd(timeline: PlanTimeline) {
  const versions = sortedVersions(timeline);
  return versions.at(-1)?.endDate ?? null;
}

export function versionOn<I extends ScheduleItem>(timeline: PlanTimeline<I>, date: DateKey): VersionSchedule<I> | null {
  let found: VersionSchedule<I> | null = null;
  for (const version of sortedVersions(timeline)) {
    if (version.effectiveFrom <= date) found = version;
  }
  return found && date <= found.endDate ? found : null;
}

export function isPaused(timeline: PlanTimeline, date: DateKey) {
  return timeline.pauses.some((pause) => pause.startDate <= date && (pause.endDate === null || pause.endDate >= date));
}

export function dayKind<I extends ScheduleItem>(timeline: PlanTimeline<I>, date: DateKey): { kind: DayKind; version: VersionSchedule<I> | null; items: I[] } {
  const version = versionOn(timeline, date);
  if (!version) return { kind: 'outside', version: null, items: [] };
  if (isPaused(timeline, date)) return { kind: 'paused', version, items: [] };
  const training = version.items.length > 0 && version.trainingWeekdays.includes(weekday(date)) && !version.restDates.includes(date);
  if (!training) return { kind: 'rest', version, items: [] };
  return { kind: 'training', version, items: [...version.items].sort((a, b) => a.orderIndex - b.orderIndex) };
}

export function itemsOn<I extends ScheduleItem>(timeline: PlanTimeline<I>, date: DateKey): I[] {
  return dayKind(timeline, date).items;
}

export function planWeek(start: DateKey, date: DateKey) {
  return Math.floor(diffDays(start, date) / 7) + 1;
}

export function resolveDayState(isPast: boolean, isToday: boolean, taskCount: number, outcomes: Outcome[]): DayState {
  const resolved = outcomes.length >= taskCount;
  const performedOrStopped = outcomes.some((outcome) => outcome !== 'SKIPPED');
  if (resolved && performedOrStopped) return 'done';
  if (resolved) return 'skipped';
  if (isPast) return 'missed';
  if (isToday) return 'today';
  return 'upcoming';
}

export function buildDays(timeline: PlanTimeline, completions: CompletionLite[], today: DateKey): DayInfo[] {
  const start = planStart(timeline);
  const end = planEnd(timeline);
  if (!start || !end) return [];

  const byDate = new Map<DateKey, CompletionLite[]>();
  for (const completion of completions) {
    byDate.set(completion.sessionDate, [...(byDate.get(completion.sessionDate) ?? []), completion]);
  }

  const days: DayInfo[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const { kind, version, items } = dayKind(timeline, date);
    if (kind === 'outside' || !version) continue;
    const base = { date, week: planWeek(start, date), versionNumber: version.number, completedCount: 0, partialCount: 0, skippedCount: 0, stoppedCount: 0 };

    if (kind !== 'training') {
      days.push({ ...base, isTrainingDay: false, state: kind === 'paused' ? 'paused' : 'rest', taskCount: 0 });
      continue;
    }

    const taskIds = new Set(items.map((item) => item.taskId));
    const records = (byDate.get(date) ?? []).filter((record) => taskIds.has(record.taskId));
    const count = (status: Outcome) => records.filter((record) => record.status === status).length;

    days.push({
      ...base,
      isTrainingDay: true,
      taskCount: taskIds.size,
      completedCount: count('COMPLETED'),
      partialCount: count('PARTIAL'),
      skippedCount: count('SKIPPED'),
      stoppedCount: count('STOPPED'),
      state: resolveDayState(date < today, date === today, taskIds.size, records.map((record) => record.status)),
    });
  }

  return days;
}

export function computeStreak(days: DayInfo[], today: DateKey) {
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (!day.isTrainingDay || day.date > today) continue;
    if (day.date === today && day.state === 'today') continue;
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
    missedSessions: training.filter((day) => day.state === 'missed' || day.state === 'skipped').length,
    restDays: days.filter((day) => day.state === 'rest').length,
    pausedDays: days.filter((day) => day.state === 'paused').length,
  };
}

/**
 * Achievement rules. Each is checked after a recorded outcome; all are based on
 * finished planned sessions only.
 * - first-session: at least one done session.
 * - steady-three: current streak >= 3.
 * - full-week: every training day of the plan week containing `today` is done.
 * - halfway: done sessions >= half of all planned sessions (plan has >= 2).
 * - plan-complete: the last planned session of the plan is done.
 */
export const BADGE_IDS = ['first-session', 'steady-three', 'full-week', 'halfway', 'plan-complete'] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

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

export type ReviewRuleSettings = { painThreshold: number; flagTooHard: boolean };
export const DEFAULT_REVIEW_RULES: ReviewRuleSettings = { painThreshold: 7, flagTooHard: true };

type FeedbackLike = { status: string; painLevel: number | null; difficulty?: string | null; reason?: string | null };

/** Review rules (workflow rules, not clinical conclusions). */
export function reviewReasons(input: FeedbackLike, rules: ReviewRuleSettings = DEFAULT_REVIEW_RULES) {
  const reasons: string[] = [];
  if (input.status === 'STOPPED') reasons.push('Stopped because of discomfort');
  if (input.status === 'SKIPPED' && input.reason === 'PAIN_OR_DISCOMFORT') reasons.push('Skipped because of pain or discomfort');
  if (input.painLevel !== null && input.painLevel >= rules.painThreshold) reasons.push(`Pain ${input.painLevel}/10 is at or above the review threshold (${rules.painThreshold})`);
  if (rules.flagTooHard && input.difficulty === 'TOO_HARD') reasons.push('Reported as too hard');
  return reasons;
}

export function needsReview(input: FeedbackLike, rules: ReviewRuleSettings = DEFAULT_REVIEW_RULES) {
  return reviewReasons(input, rules).length > 0;
}
