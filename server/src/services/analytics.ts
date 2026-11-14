/**
 * Weekly analytics (pure). The chart and the table in the UI both render these rows, so they cannot
 * disagree. Rules (also in docs/ANALYTICS.md):
 *
 * - Weeks run Sunday–Saturday in the patient's timezone.
 * - "Due" sessions are planned training days that have passed, plus today once it is finished.
 *   Today's unfinished session and future sessions are "pending" and never count as missed.
 * - Adherence = done / due, as a whole percentage (rounded half up). With no due sessions it is
 *   null and shown as "not applicable", never 0 %.
 * - A week whose plan days are all rest or paused days is "not-applicable"; a week with no plan
 *   days at all is "no-plan". Neither counts toward totals.
 * - Pain average = mean of the pain scores reported that week (any outcome with a score), rounded
 *   to one decimal. Weeks without a report have null, not 0. The range average is the mean of all
 *   reports in the range (not the mean of weekly means).
 * - Check-in answers are copied as given; unanswered questions stay null.
 */
import { addDays, type DateKey } from '../lib/dates.js';
import type { DayInfo } from './progress.js';
import { weekStartOf } from './gamification.js';

export type PainReport = { date: DateKey; painLevel: number | null };
export type CheckInLite = { weekStart: DateKey; painTypical: number | null; painWorst: number | null; activityLimit: number | null; confidence: number | null };

export type WeekStatus = 'no-plan' | 'not-applicable' | 'upcoming' | 'measured';

export type WeekRow = {
  weekStart: DateKey;
  weekEnd: DateKey;
  status: WeekStatus;
  planned: number;
  due: number;
  done: number;
  skipped: number;
  missed: number;
  pending: number;
  restDays: number;
  pausedDays: number;
  adherencePercent: number | null;
  painReports: number;
  painAverage: number | null;
  painMax: number | null;
  checkIn: Omit<CheckInLite, 'weekStart'> | null;
};

export type AnalyticsSummary = {
  due: number;
  done: number;
  adherencePercent: number | null;
  painReports: number;
  painAverage: number | null;
  measuredWeeks: number;
  notApplicableWeeks: number;
};

export function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function mean1(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

/** Rows for `weeks` weeks ending with the week that contains `today` (oldest first). */
export function weeklyAnalytics(input: { days: DayInfo[]; pain: PainReport[]; checkIns: CheckInLite[]; today: DateKey; weeks: number }) {
  const lastWeek = weekStartOf(input.today);
  const firstWeek = addDays(lastWeek, -7 * (input.weeks - 1));
  const checkIns = new Map(input.checkIns.map((checkIn) => [checkIn.weekStart, checkIn]));
  const rows: WeekRow[] = [];
  const painInRange: number[] = [];

  for (let weekStart = firstWeek; weekStart <= lastWeek; weekStart = addDays(weekStart, 7)) {
    const weekEnd = addDays(weekStart, 6);
    const inWeek = (date: DateKey) => date >= weekStart && date <= weekEnd;
    const days = input.days.filter((day) => inWeek(day.date));
    const training = days.filter((day) => day.isTrainingDay);
    const count = (...states: DayInfo['state'][]) => training.filter((day) => states.includes(day.state)).length;

    const done = count('done');
    const skipped = count('skipped');
    const missed = count('missed');
    const pending = count('today', 'upcoming');
    const due = done + skipped + missed;

    const scores = input.pain.filter((report) => inWeek(report.date) && report.painLevel !== null).map((report) => report.painLevel as number);
    painInRange.push(...scores);

    let status: WeekStatus;
    if (days.length === 0) status = 'no-plan';
    else if (training.length === 0) status = 'not-applicable';
    else if (due === 0) status = 'upcoming';
    else status = 'measured';

    const checkIn = checkIns.get(weekStart);
    rows.push({
      weekStart,
      weekEnd,
      status,
      planned: training.length,
      due,
      done,
      skipped,
      missed,
      pending,
      restDays: days.filter((day) => day.state === 'rest').length,
      pausedDays: days.filter((day) => day.state === 'paused').length,
      adherencePercent: percent(done, due),
      painReports: scores.length,
      painAverage: mean1(scores),
      painMax: scores.length ? Math.max(...scores) : null,
      checkIn: checkIn ? { painTypical: checkIn.painTypical, painWorst: checkIn.painWorst, activityLimit: checkIn.activityLimit, confidence: checkIn.confidence } : null,
    });
  }

  const due = rows.reduce((sum, row) => sum + row.due, 0);
  const done = rows.reduce((sum, row) => sum + row.done, 0);
  const summary: AnalyticsSummary = {
    due,
    done,
    adherencePercent: percent(done, due),
    painReports: painInRange.length,
    painAverage: mean1(painInRange),
    measuredWeeks: rows.filter((row) => row.status === 'measured').length,
    notApplicableWeeks: rows.filter((row) => row.status === 'not-applicable').length,
  };
  return { weeks: rows, summary };
}

export type MeasurementPoint = { measuredOn: DateKey; value: number };

/**
 * Progress of a measurement goal: share of the distance from baseline to target covered by the
 * latest measurement, clamped to 0–100. Null without a baseline, a measurement, or when
 * baseline equals target. `targetReached` respects the direction (higher or lower is better).
 */
export function measurementGoalProgress(input: { baseline: number | null; target: number; direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER'; points: MeasurementPoint[] }) {
  const latest = [...input.points].sort((a, b) => (a.measuredOn < b.measuredOn ? -1 : a.measuredOn > b.measuredOn ? 1 : 0)).at(-1) ?? null;
  const baseline = input.baseline ?? (input.points.length ? [...input.points].sort((a, b) => (a.measuredOn < b.measuredOn ? -1 : 1))[0].value : null);
  if (!latest) return { latest: null, baseline, percent: null, targetReached: false };
  const targetReached = input.direction === 'HIGHER_IS_BETTER' ? latest.value >= input.target : latest.value <= input.target;
  if (baseline === null || baseline === input.target) return { latest, baseline, percent: null, targetReached };
  const share = (latest.value - baseline) / (input.target - baseline);
  return { latest, baseline, percent: Math.max(0, Math.min(100, Math.round(share * 100))), targetReached };
}
