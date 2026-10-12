import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays, localDateKey, weekday } from '../src/lib/dates.js';
import { buildDays, type CompletionLite, computeStreak, needsReview, type PlanSchedule, qualifyingBadges, sessionStats } from '../src/services/progress.js';

// 2026-10-04 is a Sunday.
const START = '2026-10-04';

function plan(overrides: Partial<PlanSchedule> = {}): PlanSchedule {
  return {
    startDate: START,
    endDate: addDays(START, 13),
    trainingWeekdays: [0, 2, 4], // Sun, Tue, Thu
    tasks: [
      { id: 'a', orderIndex: 0, activeFrom: START, activeUntil: null },
      { id: 'b', orderIndex: 1, activeFrom: START, activeUntil: null },
    ],
    ...overrides,
  };
}

function done(date: string, status: 'COMPLETED' | 'STOPPED' = 'COMPLETED'): CompletionLite[] {
  return [
    { taskId: 'a', sessionDate: date, status },
    { taskId: 'b', sessionDate: date, status: 'COMPLETED' },
  ];
}

describe('schedule and streak rules', () => {
  test('non-training weekdays are rest days', () => {
    const days = buildDays(plan(), [], START);
    assert.equal(weekday(START), 0);
    assert.deepEqual(
      days.slice(0, 7).map((day) => day.state),
      ['today', 'rest', 'upcoming', 'rest', 'upcoming', 'rest', 'rest'],
    );
  });

  test('scheduled rest days do not break a streak', () => {
    // Sun, Tue, Thu done; today is the following Sunday, not done yet.
    const completions = [...done('2026-10-04'), ...done('2026-10-06'), ...done('2026-10-08')];
    const today = '2026-10-11';
    const days = buildDays(plan(), completions, today);

    assert.equal(computeStreak(days, today), 3, "Fri/Sat rest days and today's open session must not break the streak");
  });

  test('a missed training day breaks the streak; earlier history still counts as done', () => {
    const completions = [...done('2026-10-04'), ...done('2026-10-08')]; // Tue 10-06 missed
    const today = '2026-10-09';
    const days = buildDays(plan(), completions, today);

    assert.equal(days.find((day) => day.date === '2026-10-06')?.state, 'missed');
    assert.equal(computeStreak(days, today), 1);
    assert.equal(sessionStats(days, today).doneSessions, 2);
    assert.equal(sessionStats(days, today).missedSessions, 1);
  });

  test('stopping because of symptoms finishes the session and keeps the streak', () => {
    const completions = [...done('2026-10-04'), ...done('2026-10-06', 'STOPPED')];
    const days = buildDays(plan(), completions, '2026-10-07');

    assert.equal(days.find((day) => day.date === '2026-10-06')?.state, 'done');
    assert.equal(computeStreak(days, '2026-10-07'), 2);
  });

  test('a partially finished past day counts as missed', () => {
    const days = buildDays(plan(), [{ taskId: 'a', sessionDate: '2026-10-04', status: 'COMPLETED' }], '2026-10-05');
    assert.equal(days[0].state, 'missed');
  });

  test('tasks follow their active window (added later / removed later)', () => {
    const schedule = plan({
      tasks: [
        { id: 'a', orderIndex: 0, activeFrom: START, activeUntil: '2026-10-06' },
        { id: 'c', orderIndex: 1, activeFrom: '2026-10-08', activeUntil: null },
      ],
    });
    const days = buildDays(schedule, [], START);

    assert.equal(days.find((day) => day.date === '2026-10-06')?.taskCount, 1);
    assert.equal(days.find((day) => day.date === '2026-10-08')?.taskCount, 1);
    // No tasks prescribed on Tue 10-07? (not a training weekday anyway) and none between windows:
    assert.equal(buildDays(plan({ tasks: [{ id: 'a', orderIndex: 0, activeFrom: '2026-10-08', activeUntil: null }] }), [], START)[0].isTrainingDay, false);
  });

  test('achievements follow finished sessions, never extra activity', () => {
    const today = '2026-10-08';
    const completions = [...done('2026-10-04'), ...done('2026-10-06'), ...done('2026-10-08')];
    const days = buildDays(plan(), completions, today);
    const badges = qualifyingBadges(days, today);

    assert.ok(badges.includes('first-session'));
    assert.ok(badges.includes('steady-three'));
    assert.ok(badges.includes('full-week'), 'Sun/Tue/Thu is every planned session of week 1');
    assert.ok(!badges.includes('plan-complete'));
    // Records for tasks not prescribed that day (extra activity) do not count.
    const extra = buildDays(plan(), [{ taskId: 'zzz', sessionDate: '2026-10-04', status: 'COMPLETED' }], '2026-10-04');
    assert.equal(extra[0].state, 'today');
  });

  test('records needing therapist review', () => {
    assert.equal(needsReview({ status: 'STOPPED', painLevel: 2 }), true);
    assert.equal(needsReview({ status: 'COMPLETED', painLevel: 7 }), true);
    assert.equal(needsReview({ status: 'COMPLETED', painLevel: 3, difficulty: 'TOO_HARD' }), true);
    assert.equal(needsReview({ status: 'COMPLETED', painLevel: 6, difficulty: 'JUST_RIGHT' }), false);
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
