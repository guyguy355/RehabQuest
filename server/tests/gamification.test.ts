import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays } from '../src/lib/dates.js';
import { BADGE_RULES } from '../src/services/achievement-rules.js';
import { COSMETICS, cosmeticsFor, countAchievements, isCosmeticUnlocked, isWelcomeBack, returnAfterBreak, weeklyGoalProgress, weekStartOf } from '../src/services/gamification.js';
import { BADGE_IDS, buildDays, type CompletionLite, type Outcome, type PlanTimeline } from '../src/services/progress.js';

// 2026-10-04 is a Sunday. Training on Sun, Tue, Thu (3 planned sessions per week).
const START = '2026-10-04';
const items = [{ taskId: 'a', orderIndex: 0 }];

function timeline(overrides: Partial<PlanTimeline> = {}): PlanTimeline {
  return { versions: [{ id: 'v1', number: 1, effectiveFrom: START, endDate: addDays(START, 27), trainingWeekdays: [0, 2, 4], restDates: [], items }], pauses: [], ...overrides };
}
const record = (date: string, status: Outcome = 'COMPLETED'): CompletionLite => ({ taskId: 'a', sessionDate: date, status });

describe('weeks', () => {
  test('weeks start on Sunday', () => {
    assert.equal(weekStartOf('2026-10-04'), '2026-10-04');
    assert.equal(weekStartOf('2026-10-10'), '2026-10-04'); // Saturday
    assert.equal(weekStartOf('2026-10-11'), '2026-10-11');
  });
});

describe('weekly consistency goal', () => {
  test('target is the chosen goal, capped by the planned sessions of the week', () => {
    const days = buildDays(timeline(), [record('2026-10-04'), record('2026-10-06')], '2026-10-07');
    const withGoal = weeklyGoalProgress(days, '2026-10-07', 2);
    assert.deepEqual({ planned: withGoal.planned, target: withGoal.target, done: withGoal.done, met: withGoal.met, remaining: withGoal.remaining }, { planned: 3, target: 2, done: 2, met: true, remaining: 1 });
    const tooHigh = weeklyGoalProgress(days, '2026-10-07', 6);
    assert.equal(tooHigh.target, 3, 'never asks for more than the plan');
    assert.equal(tooHigh.met, false);
    const noGoal = weeklyGoalProgress(days, '2026-10-07', null);
    assert.equal(noGoal.target, 3, 'no chosen goal = every planned session');
  });

  test('a rest-only or fully paused week is not applicable and never "missed"', () => {
    const paused = timeline({ pauses: [{ startDate: '2026-10-11', endDate: '2026-10-17' }] });
    const progress = weeklyGoalProgress(buildDays(paused, [], '2026-10-15'), '2026-10-15', 2);
    assert.deepEqual({ applicable: progress.applicable, planned: progress.planned, met: progress.met }, { applicable: false, planned: 0, met: false });
    const restOnly = timeline({ versions: [{ id: 'v1', number: 1, effectiveFrom: START, endDate: addDays(START, 27), trainingWeekdays: [0, 2, 4], restDates: ['2026-10-11', '2026-10-13', '2026-10-15'], items }] });
    assert.equal(weeklyGoalProgress(buildDays(restOnly, [], '2026-10-15'), '2026-10-15', 2).applicable, false);
  });

  test('a stopped-for-discomfort session counts as done; an all-skipped day does not', () => {
    const days = buildDays(timeline(), [record('2026-10-04', 'STOPPED'), record('2026-10-06', 'SKIPPED')], '2026-10-07');
    assert.equal(weeklyGoalProgress(days, '2026-10-07', 2).done, 1);
  });
});

describe('return after a break', () => {
  test('two or more missed planned sessions before today show the message; rest days are ignored', () => {
    // Done Sun 4th, missed Tue 6th and Thu 8th; today Sun 11th (training).
    const days = buildDays(timeline(), [record('2026-10-04')], '2026-10-11');
    assert.deepEqual(returnAfterBreak(days, '2026-10-11'), { missedInRow: 2, lastDoneDate: '2026-10-04' });
  });

  test('one missed session, or a done session today, shows nothing', () => {
    const oneMissed = buildDays(timeline(), [record('2026-10-04'), record('2026-10-06')], '2026-10-11');
    assert.equal(returnAfterBreak(oneMissed, '2026-10-11'), null);
    const doneToday = buildDays(timeline(), [record('2026-10-04'), record('2026-10-11')], '2026-10-11');
    assert.equal(returnAfterBreak(doneToday, '2026-10-11'), null);
  });

  test('paused days never count as missed', () => {
    const paused = timeline({ pauses: [{ startDate: '2026-10-05', endDate: '2026-10-10' }] });
    assert.equal(returnAfterBreak(buildDays(paused, [record('2026-10-04')], '2026-10-11'), '2026-10-11'), null);
  });
});

describe('achievement rules', () => {
  test('every achievement has a written rule', () => {
    const ids = [...BADGE_IDS, 'weekly-goal', 'weekly-goal-4', 'welcome-back', 'first-check-in', 'check-in-4', 'first-milestone'];
    for (const id of ids) assert.ok(BADGE_RULES[id], `missing rule for ${id}`);
  });

  test('welcome-back: a done session after 3+ missed or skipped planned sessions in a row', () => {
    // Missed Tue 6th, Thu 8th, skipped Sun 11th, done Tue 13th.
    const completions = [record('2026-10-04'), record('2026-10-11', 'SKIPPED'), record('2026-10-13')];
    const days = buildDays(timeline(), completions, '2026-10-13');
    assert.equal(isWelcomeBack(days, '2026-10-13'), true);
    const shortBreak = buildDays(timeline(), [record('2026-10-04'), record('2026-10-08'), record('2026-10-13')], '2026-10-13');
    assert.equal(isWelcomeBack(shortBreak, '2026-10-13'), false, 'only one missed session before');
  });

  test('welcome-back is not triggered by a long approved pause', () => {
    const paused = timeline({ pauses: [{ startDate: '2026-10-05', endDate: '2026-10-12' }] });
    assert.equal(isWelcomeBack(buildDays(paused, [record('2026-10-04'), record('2026-10-13')], '2026-10-13'), '2026-10-13'), false);
  });

  test('count rules: weekly goal 1 and 4 weeks, check-ins 1 and 4 weeks, first confirmed milestone', () => {
    assert.deepEqual(countAchievements({ weeksGoalMet: 0, checkInWeeks: 0, confirmedMilestones: 0 }), []);
    assert.deepEqual(countAchievements({ weeksGoalMet: 1, checkInWeeks: 1, confirmedMilestones: 1 }), ['weekly-goal', 'first-check-in', 'first-milestone']);
    assert.deepEqual(countAchievements({ weeksGoalMet: 3, checkInWeeks: 3, confirmedMilestones: 0 }), ['weekly-goal', 'first-check-in']);
    assert.deepEqual(countAchievements({ weeksGoalMet: 4, checkInWeeks: 4, confirmedMilestones: 2 }), ['weekly-goal', 'weekly-goal-4', 'first-check-in', 'check-in-4', 'first-milestone']);
  });
});

describe('mascot cosmetics', () => {
  test('classic is always available; others unlock with their achievement and every unlock is a real achievement', () => {
    assert.deepEqual(
      cosmeticsFor([]).filter((cosmetic) => cosmetic.unlocked).map((cosmetic) => cosmetic.id),
      ['classic'],
    );
    assert.equal(isCosmeticUnlocked('scarf', ['steady-three']), true);
    assert.equal(isCosmeticUnlocked('scarf', ['first-session']), false);
    assert.equal(isCosmeticUnlocked('unknown', ['first-session']), false);
    for (const cosmetic of COSMETICS) if (cosmetic.unlockedBy) assert.ok(BADGE_RULES[cosmetic.unlockedBy]);
  });
});
