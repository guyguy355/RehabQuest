/** Loads the data for weekly analytics (rules in analytics.ts). Used by the patient and therapist views. */
import { prisma } from '../db.js';
import { addDays, fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import { weeklyAnalytics } from './analytics.js';
import { weekStartOf } from './gamification.js';
import { listDefinitions, listGoals } from './goals.js';
import { allPlanDays } from './motivation.js';

export async function getAnalytics(patient: { id: string; timezone: string }, weeks: number, now = new Date()) {
  const today = localDateKey(patient.timezone, now);
  const from = addDays(weekStartOf(today), -7 * (weeks - 1));
  const [days, completions, checkIns] = await Promise.all([
    allPlanDays(prisma, patient.id, today),
    prisma.taskCompletion.findMany({ where: { patientId: patient.id, sessionDate: { gte: toDbDate(from) } }, select: { sessionDate: true, painLevel: true } }),
    prisma.weeklyCheckIn.findMany({ where: { patientId: patient.id, weekStart: { gte: toDbDate(from) } } }),
  ]);
  const result = weeklyAnalytics({
    days,
    pain: completions.map((completion) => ({ date: fromDbDate(completion.sessionDate), painLevel: completion.painLevel })),
    checkIns: checkIns.map((checkIn) => ({ weekStart: fromDbDate(checkIn.weekStart), painTypical: checkIn.painTypical, painWorst: checkIn.painWorst, activityLimit: checkIn.activityLimit, confidence: checkIn.confidence })),
    today,
    weeks,
  });
  return { today, ...result };
}

export async function getGoalsAndMeasurements(patientId: string, options: { includeArchived?: boolean } = {}) {
  const [goals, measurements] = await Promise.all([listGoals(prisma, patientId, options), listDefinitions(prisma, patientId, options)]);
  return { goals, measurements };
}
