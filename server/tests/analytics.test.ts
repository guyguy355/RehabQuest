import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays } from '../src/lib/dates.js';
import { mean1, measurementGoalProgress, percent, weeklyAnalytics } from '../src/services/analytics.js';
import { buildDays, type CompletionLite, type Outcome, type PlanTimeline } from '../src/services/progress.js';

// 2026-10-04 is a Sunday. Plan: 3 weeks, training Sun/Tue/Thu.
const START = '2026-10-04';
const items = [{ taskId: 'a', orderIndex: 0 }];
const plan = (overrides: Partial<PlanTimeline> = {}): PlanTimeline => ({
  versions: [{ id: 'v1', number: 1, effectiveFrom: START, endDate: addDays(START, 20), trainingWeekdays: [0, 2, 4], restDates: [], items }],
  pauses: [],
  ...overrides,
});
const record = (date: string, status: Outcome = 'COMPLETED'): CompletionLite => ({ taskId: 'a', sessionDate: date, status });

describe('weekly analytics (fixtures)', () => {
  test('counts, adherence and pending sessions for a week in progress', () => {
    const today = '2026-10-13'; // Tuesday of week 2, session not done yet
    const completions = [record('2026-10-04'), record('2026-10-06', 'SKIPPED'), record('2026-10-11', 'STOPPED')];
    const { weeks, summary } = weeklyAnalytics({ days: buildDays(plan(), completions, today), pain: [], checkIns: [], today, weeks: 4 });

    assert.deepEqual(
      weeks.map((week) => week.weekStart),
      ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11'],
    );
    assert.equal(weeks[0].status, 'no-plan');
    assert.equal(weeks[0].adherencePercent, null, 'no plan is not 0 %');

    const week1 = weeks[2];
    assert.deepEqual({ status: week1.status, planned: week1.planned, due: week1.due, done: week1.done, skipped: week1.skipped, missed: week1.missed, adherence: week1.adherencePercent }, { status: 'measured', planned: 3, due: 3, done: 1, skipped: 1, missed: 1, adherence: 33 });

    const week2 = weeks[3];
    assert.deepEqual({ planned: week2.planned, due: week2.due, done: week2.done, pending: week2.pending, adherence: week2.adherencePercent }, { planned: 3, due: 1, done: 1, pending: 2, adherence: 100 }, 'today and Thursday are pending, not missed');

    assert.deepEqual({ due: summary.due, done: summary.done, adherence: summary.adherencePercent }, { due: 4, done: 2, adherence: 50 });
  });

  test('a week with only rest or paused days is "not-applicable" with null adherence, and does not count', () => {
    const paused = plan({ pauses: [{ startDate: '2026-10-11', endDate: '2026-10-17' }] });
    const { weeks, summary } = weeklyAnalytics({ days: buildDays(paused, [record('2026-10-04'), record('2026-10-06'), record('2026-10-08')], '2026-10-20'), pain: [], checkIns: [], today: '2026-10-20', weeks: 3 });
    const pausedWeek = weeks.find((week) => week.weekStart === '2026-10-11')!;
    assert.deepEqual({ status: pausedWeek.status, adherence: pausedWeek.adherencePercent, pausedDays: pausedWeek.pausedDays, due: pausedWeek.due }, { status: 'not-applicable', adherence: null, pausedDays: 7, due: 0 });
    assert.equal(summary.notApplicableWeeks, 1);
    assert.equal(summary.due, 4, 'week 1 (3) + Sunday of week 3 (1); the paused week adds nothing');

    const restOnly = plan({ versions: [{ id: 'v1', number: 1, effectiveFrom: START, endDate: addDays(START, 20), trainingWeekdays: [0, 2, 4], restDates: ['2026-10-11', '2026-10-13', '2026-10-15'], items }] });
    const rest = weeklyAnalytics({ days: buildDays(restOnly, [], '2026-10-18'), pain: [], checkIns: [], today: '2026-10-18', weeks: 2 });
    assert.equal(rest.weeks[0].status, 'not-applicable');
    assert.equal(rest.weeks[0].restDays, 7);
  });

  test('missing pain reports are null, never 0; averages use reported scores only', () => {
    const today = '2026-10-20';
    const days = buildDays(plan(), [record('2026-10-04'), record('2026-10-06'), record('2026-10-11')], today);
    const pain = [
      { date: '2026-10-04', painLevel: 3 },
      { date: '2026-10-06', painLevel: 4 },
      { date: '2026-10-06', painLevel: null }, // skipped exercise: no score
      { date: '2026-10-11', painLevel: null },
    ];
    const { weeks, summary } = weeklyAnalytics({ days, pain, checkIns: [], today, weeks: 3 });
    assert.deepEqual({ reports: weeks[0].painReports, average: weeks[0].painAverage, max: weeks[0].painMax }, { reports: 2, average: 3.5, max: 4 });
    assert.deepEqual({ reports: weeks[1].painReports, average: weeks[1].painAverage, max: weeks[1].painMax }, { reports: 0, average: null, max: null });
    assert.equal(summary.painAverage, 3.5);
  });

  test('range pain average is the mean of all reports, not the mean of weekly means', () => {
    const today = '2026-10-20';
    const days = buildDays(plan(), [], today);
    const pain = [
      { date: '2026-10-04', painLevel: 2 },
      { date: '2026-10-11', painLevel: 6 },
      { date: '2026-10-13', painLevel: 6 },
      { date: '2026-10-15', painLevel: 6 },
    ];
    const { weeks, summary } = weeklyAnalytics({ days, pain, checkIns: [], today, weeks: 3 });
    assert.equal(weeks[0].painAverage, 2);
    assert.equal(weeks[1].painAverage, 6);
    assert.equal(summary.painAverage, 5, '(2+6+6+6)/4 = 5, not (2+6)/2 = 4');
  });

  test('check-in answers are attached to their week as given (unanswered stay null)', () => {
    const today = '2026-10-13';
    const { weeks } = weeklyAnalytics({
      days: buildDays(plan(), [], today),
      pain: [],
      checkIns: [{ weekStart: '2026-10-04', painTypical: 3, painWorst: null, activityLimit: 0, confidence: null }],
      today,
      weeks: 2,
    });
    assert.deepEqual(weeks[0].checkIn, { painTypical: 3, painWorst: null, activityLimit: 0, confidence: null });
    assert.equal(weeks[1].checkIn, null);
  });

  test('rounding: percentages half up to whole numbers, averages to one decimal', () => {
    assert.equal(percent(1, 3), 33);
    assert.equal(percent(2, 3), 67);
    assert.equal(percent(1, 8), 13); // 12.5 -> 13
    assert.equal(percent(0, 0), null);
    assert.equal(mean1([1, 2, 2]), 1.7);
    assert.equal(mean1([]), null);
  });
});

describe('measurement goal progress', () => {
  test('higher is better: share of the distance from baseline to target, clamped', () => {
    const points = [
      { measuredOn: '2026-10-01', value: 90 },
      { measuredOn: '2026-10-08', value: 105 },
    ];
    assert.deepEqual(measurementGoalProgress({ baseline: 90, target: 120, direction: 'HIGHER_IS_BETTER', points }), { latest: points[1], baseline: 90, percent: 50, targetReached: false });
    const regressed = measurementGoalProgress({ baseline: 90, target: 120, direction: 'HIGHER_IS_BETTER', points: [{ measuredOn: '2026-10-08', value: 80 }] });
    assert.equal(regressed.percent, 0);
    const beyond = measurementGoalProgress({ baseline: 90, target: 120, direction: 'HIGHER_IS_BETTER', points: [{ measuredOn: '2026-10-08', value: 125 }] });
    assert.deepEqual({ percent: beyond.percent, reached: beyond.targetReached }, { percent: 100, reached: true });
  });

  test('lower is better, baseline defaults to the first measurement, no data stays null', () => {
    const points = [
      { measuredOn: '2026-10-08', value: 14 },
      { measuredOn: '2026-10-01', value: 20 },
    ];
    const result = measurementGoalProgress({ baseline: null, target: 10, direction: 'LOWER_IS_BETTER', points });
    assert.deepEqual({ baseline: result.baseline, latest: result.latest?.value, percent: result.percent, reached: result.targetReached }, { baseline: 20, latest: 14, percent: 60, reached: false });
    assert.deepEqual(measurementGoalProgress({ baseline: 5, target: 10, direction: 'HIGHER_IS_BETTER', points: [] }), { latest: null, baseline: 5, percent: null, targetReached: false });
  });
});
