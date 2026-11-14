/**
 * Database side of the supportive motivation features: preferences, weekly goal records,
 * achievement awards, cosmetics. The rules themselves live in gamification.ts (pure, tested).
 */
import { PlanStatus } from '@prisma/client';
import { type Db, type Tx } from '../db.js';
import { type DateKey, fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import { countAchievements, cosmeticsFor, isWelcomeBack, returnAfterBreak, weeklyGoalProgress } from './gamification.js';
import { listBadges, loadCompletions, loadCurrentPlan, loadPlan, toLite, toTimeline } from './plans.js';
import { buildDays, type DayInfo } from './progress.js';
import { BADGE_RULES } from './achievement-rules.js';

type Client = Db | Tx;

export async function getPreferences(db: Client, userId: string) {
  // Insert-if-missing without a race (two first requests at once).
  await db.userPreference.createMany({ data: [{ userId }], skipDuplicates: true });
  return db.userPreference.findUniqueOrThrow({ where: { userId }, select: { calmMode: true, soundEnabled: true, weeklySessionGoal: true, mascotCosmetic: true } });
}

/** Days of the plan the patient currently follows (same source as the home screen). */
export async function currentPlanDays(db: Client, patientId: string, today: DateKey): Promise<DayInfo[]> {
  const plan = await loadCurrentPlan(db, patientId);
  if (!plan || plan.versions.length === 0) return [];
  return buildDays(toTimeline(plan), toLite(await loadCompletions(db, plan.id)), today);
}

/** Days of every non-draft plan of the patient, for analytics across plan changes. */
export async function allPlanDays(db: Client, patientId: string, today: DateKey): Promise<DayInfo[]> {
  const plans = await db.rehabPlan.findMany({ where: { patientId, status: { not: PlanStatus.DRAFT } }, select: { id: true }, orderBy: { createdAt: 'asc' } });
  const days: DayInfo[] = [];
  for (const { id } of plans) {
    const plan = await loadPlan(db, { id });
    if (!plan || plan.versions.length === 0) continue;
    days.push(...buildDays(toTimeline(plan), toLite(await loadCompletions(db, plan.id)), today));
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

async function grant(tx: Client, userId: string, badgeIds: string[], now: Date) {
  if (badgeIds.length === 0) return [];
  const already = new Set((await tx.userBadge.findMany({ where: { userId, badgeId: { in: badgeIds } }, select: { badgeId: true } })).map((row) => row.badgeId));
  const fresh = badgeIds.filter((id) => !already.has(id));
  if (fresh.length > 0) await tx.userBadge.createMany({ data: fresh.map((badgeId) => ({ userId, badgeId, earnedAt: now })), skipDuplicates: true });
  return fresh;
}

/** Re-evaluates count-based achievements (weekly goals, check-ins, milestones). Idempotent. */
export async function awardCountAchievements(tx: Client, userId: string, now = new Date()) {
  const [weeksGoalMet, checkInWeeks, confirmedMilestones] = await Promise.all([
    tx.weeklyGoalWeek.count({ where: { userId } }),
    tx.weeklyCheckIn.count({ where: { patientId: userId } }),
    tx.milestone.count({ where: { goal: { patientId: userId }, achievedAt: { not: null } } }),
  ]);
  return grant(tx, userId, countAchievements({ weeksGoalMet, checkInWeeks, confirmedMilestones }), now);
}

/**
 * Called inside the completion transaction once a session is done: records the week when the weekly
 * goal is reached (once per week) and awards the related achievements.
 */
export async function awardAfterSession(tx: Tx, input: { patientId: string; days: DayInfo[]; date: DateKey; now: Date }) {
  const preference = await getPreferences(tx, input.patientId);
  const week = weeklyGoalProgress(input.days, input.date, preference.weeklySessionGoal);
  let weeklyGoalJustMet = false;
  if (week.met) {
    const created = await tx.weeklyGoalWeek.createMany({ data: [{ userId: input.patientId, weekStart: toDbDate(week.weekStart), goal: week.target, done: week.done, metAt: input.now }], skipDuplicates: true });
    weeklyGoalJustMet = created.count > 0;
  }
  const newBadgeIds = [...(isWelcomeBack(input.days, input.date) ? await grant(tx, input.patientId, ['welcome-back'], input.now) : []), ...(await awardCountAchievements(tx, input.patientId, input.now))];
  return { weeklyGoal: { ...week, justMet: weeklyGoalJustMet }, newBadgeIds };
}

/** Everything the motivation UI needs. */
export async function getMotivation(db: Client, patient: { id: string; timezone: string }, now = new Date()) {
  const today = localDateKey(patient.timezone, now);
  const [preference, days, badges, weeks] = await Promise.all([
    getPreferences(db, patient.id),
    currentPlanDays(db, patient.id, today),
    listBadges(db, patient.id),
    db.weeklyGoalWeek.findMany({ where: { userId: patient.id }, orderBy: { weekStart: 'desc' }, take: 52 }),
  ]);
  const earned = badges.filter((badge) => badge.earnedAt);
  const cosmetics = cosmeticsFor(earned.map((badge) => badge.id));
  return {
    today,
    preference,
    weeklyGoal: weeklyGoalProgress(days, today, preference.weeklySessionGoal),
    returnAfterBreak: returnAfterBreak(days, today),
    badges: badges.map((badge) => ({ ...badge, rule: BADGE_RULES[badge.id] ?? badge.description })),
    history: [
      ...earned.map((badge) => ({ type: 'achievement' as const, id: badge.id, name: badge.name, at: badge.earnedAt!.toISOString() })),
      ...weeks.map((week) => ({ type: 'weekly-goal' as const, id: week.id, weekStart: fromDbDate(week.weekStart), goal: week.goal, done: week.done, at: week.metAt.toISOString() })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1)),
    cosmetics,
    equipped: cosmetics.some((cosmetic) => cosmetic.id === preference.mascotCosmetic && cosmetic.unlocked) ? preference.mascotCosmetic : 'classic',
  };
}

