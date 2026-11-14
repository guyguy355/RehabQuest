import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays, localDateKey, weekday } from '../src/lib/dates.js';
import {
  buildDays,
  type CompletionLite,
  computeStreak,
  needsReview,
  type Outcome,
  type PlanTimeline,
  qualifyingBadges,
  reviewReasons,
  sessionStats,
  versionOn,
} from '../src/services/progress.js';

// 2026-10-04 is a Sunday.
const START = '2026-10-04';
const items = [
  { taskId: 'a', orderIndex: 0 },
  { taskId: 'b', orderIndex: 1 },
];

function timeline(overrides: Partial<PlanTimeline> = {}): PlanTimeline {
  return {
    versions: [{ id: 'v1', number: 1, effectiveFrom: START, endDate: addDays(START, 13), trainingWeekdays: [0, 2, 4], restDates: [], items }],
    pauses: [],
    ...overrides,
  };
}

function day(date: string, a: Outcome = 'COMPLETED', b: Outcome = 'COMPLETED'): CompletionLite[] {
  return [
    { taskId: 'a', sessionDate: date, status: a },
    { taskId: 'b', sessionDate: date, status: b },
  ];
}

describe('schedule and streak rules', () => {
  test('non-training weekdays are rest days', () => {
    assert.equal(weekday(START), 0);
    assert.deepEqual(
      buildDays(timeline(), [], START).slice(0, 7).map((entry) => entry.state),
      ['today', 'rest', 'upcoming', 'rest', 'upcoming', 'rest', 'rest'],
    );
  });

  test('explicit rest dates override a training weekday', () => {
    const plan = timeline({ versions: [{ ...timeline().versions[0], restDates: ['2026-10-06'] }] });
    const days = buildDays(plan, [], START);
    assert.equal(days.find((entry) => entry.date === '2026-10-06')?.state, 'rest');
  });

  test('scheduled rest days do not break a streak', () => {
    const today = '2026-10-11';
    const days = buildDays(timeline(), [...day('2026-10-04'), ...day('2026-10-06'), ...day('2026-10-08')], today);
    assert.equal(computeStreak(days, today), 3, "rest days and today's open session must not break the streak");
  });

  test('a missed training day breaks the streak; earlier history still counts', () => {
    const today = '2026-10-09';
    const days = buildDays(timeline(), [...day('2026-10-04'), ...day('2026-10-08')], today);
    assert.equal(days.find((entry) => entry.date === '2026-10-06')?.state, 'missed');
    assert.equal(computeStreak(days, today), 1);
    assert.deepEqual([sessionStats(days, today).doneSessions, sessionStats(days, today).missedSessions], [2, 1]);
  });

  test('stopping because of discomfort finishes the session and keeps the streak', () => {
    const days = buildDays(timeline(), [...day('2026-10-04'), ...day('2026-10-06', 'STOPPED', 'COMPLETED')], '2026-10-07');
    assert.equal(days.find((entry) => entry.date === '2026-10-06')?.state, 'done');
    assert.equal(computeStreak(days, '2026-10-07'), 2);
  });

  test('partial counts as performed; a fully skipped day is "skipped" and breaks the streak', () => {
    const days = buildDays(timeline(), [...day('2026-10-04', 'PARTIAL', 'SKIPPED'), ...day('2026-10-06', 'SKIPPED', 'SKIPPED')], '2026-10-07');
    assert.equal(days.find((entry) => entry.date === '2026-10-04')?.state, 'done');
    assert.equal(days.find((entry) => entry.date === '2026-10-06')?.state, 'skipped');
    assert.equal(computeStreak(days, '2026-10-07'), 0);
  });

  test('a partially recorded past day counts as missed', () => {
    const days = buildDays(timeline(), [{ taskId: 'a', sessionDate: '2026-10-04', status: 'COMPLETED' }], '2026-10-05');
    assert.equal(days[0].state, 'missed');
  });

  test('approved pauses are neither missed nor counted, and do not break the streak', () => {
    const plan = timeline({ pauses: [{ startDate: '2026-10-06', endDate: '2026-10-08' }] });
    const today = '2026-10-12';
    const days = buildDays(plan, [...day('2026-10-04'), ...day('2026-10-11')], today);
    assert.equal(days.find((entry) => entry.date === '2026-10-06')?.state, 'paused');
    assert.equal(days.find((entry) => entry.date === '2026-10-08')?.state, 'paused');
    assert.equal(computeStreak(days, today), 2);
    const stats = sessionStats(days, today);
    assert.equal(stats.missedSessions, 0);
    assert.equal(stats.pausedDays, 3);
  });
});

describe('plan versions', () => {
  const v2 = { id: 'v2', number: 2, effectiveFrom: '2026-10-11', endDate: '2026-10-24', trainingWeekdays: [1, 3, 5], restDates: [], items: [{ taskId: 'a', orderIndex: 0 }, { taskId: 'c', orderIndex: 1 }] };

  test('each date resolves to the version that was effective on it', () => {
    const plan = timeline({ versions: [timeline().versions[0], v2] });
    assert.equal(versionOn(plan, '2026-10-10')?.id, 'v1');
    assert.equal(versionOn(plan, '2026-10-11')?.id, 'v2');
    assert.equal(versionOn(plan, '2026-10-24')?.id, 'v2');
    assert.equal(versionOn(plan, '2026-10-25'), null);
  });

  test('publishing a revision does not change past days or their denominators', () => {
    const before = buildDays(timeline(), day('2026-10-04'), '2026-10-12').filter((entry) => entry.date < '2026-10-11');
    const after = buildDays(timeline({ versions: [timeline().versions[0], v2] }), day('2026-10-04'), '2026-10-12').filter((entry) => entry.date < '2026-10-11');
    assert.deepEqual(after, before);
    // New weekdays apply only from the revision date: Monday 2026-10-12 is now a training day.
    const later = buildDays(timeline({ versions: [timeline().versions[0], v2] }), [], '2026-10-12');
    assert.equal(later.find((entry) => entry.date === '2026-10-12')?.isTrainingDay, true);
    assert.equal(later.find((entry) => entry.date === '2026-10-12')?.versionNumber, 2);
  });

  test('when two versions start the same day, the higher number wins', () => {
    const same = { ...v2, id: 'v3', number: 3, effectiveFrom: '2026-10-11', trainingWeekdays: [0] };
    assert.equal(versionOn(timeline({ versions: [timeline().versions[0], v2, same] }), '2026-10-11')?.id, 'v3');
  });
});

describe('achievements and review rules', () => {
  test('achievements follow finished sessions, never extra activity', () => {
    const today = '2026-10-08';
    const badges = qualifyingBadges(buildDays(timeline(), [...day('2026-10-04'), ...day('2026-10-06'), ...day('2026-10-08')], today), today);
    assert.ok(badges.includes('first-session'));
    assert.ok(badges.includes('steady-three'));
    assert.ok(badges.includes('full-week'));
    assert.ok(!badges.includes('plan-complete'));
    const extra = buildDays(timeline(), [{ taskId: 'zzz', sessionDate: '2026-10-04', status: 'COMPLETED' }], '2026-10-04');
    assert.equal(extra[0].state, 'today');
  });

  test('review rules', () => {
    assert.equal(needsReview({ status: 'STOPPED', painLevel: 2 }), true);
    assert.equal(needsReview({ status: 'COMPLETED', painLevel: 7 }), true);
    assert.equal(needsReview({ status: 'COMPLETED', painLevel: 3, difficulty: 'TOO_HARD' }), true);
    assert.equal(needsReview({ status: 'SKIPPED', painLevel: null, reason: 'PAIN_OR_DISCOMFORT' }), true);
    assert.equal(needsReview({ status: 'SKIPPED', painLevel: null, reason: 'NO_TIME' }), false);
    assert.equal(needsReview({ status: 'COMPLETED', painLevel: 6, difficulty: 'JUST_RIGHT' }), false);
    // Thresholds are configurable review rules.
    assert.equal(needsReview({ status: 'COMPLETED', painLevel: 5 }, { painThreshold: 5, flagTooHard: false }), true);
    assert.deepEqual(reviewReasons({ status: 'COMPLETED', painLevel: 3, difficulty: 'TOO_HARD' }, { painThreshold: 7, flagTooHard: false }), []);
  });
});

describe('patient-local dates', () => {
  test('the day is decided in the patient timezone', () => {
    const instant = new Date('2026-10-11T22:30:00Z'); // 01:30 on Oct 12 in Israel (UTC+3)
    assert.equal(localDateKey('Asia/Jerusalem', instant), '2026-10-12');
    assert.equal(localDateKey('UTC', instant), '2026-10-11');
    assert.equal(localDateKey('America/New_York', instant), '2026-10-11');
  });
});
