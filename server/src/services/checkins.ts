/**
 * Weekly check-ins: a few optional questions once per week (Sunday–Saturday, patient timezone).
 *
 * - One check-in per week; sending again updates it (the latest answer wins, `submittedAt` is kept).
 * - The current week and the previous week can be answered or corrected; older weeks are closed so
 *   analytics for past weeks stay stable.
 * - Every question is optional. An unanswered question is stored as null and shown as "no answer",
 *   never as 0.
 * - The same idempotency key returns the stored check-in (safe retries and offline replays).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { badRequest, conflict } from '../http.js';
import { addDays, type DateKey, fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import { weekStartOf } from './gamification.js';
import { awardCountAchievements } from './motivation.js';

export type CheckInInput = {
  painTypical: number | null;
  painWorst: number | null;
  activityLimit: number | null;
  confidence: number | null;
  note: string | null;
  idempotencyKey: string | null;
};

type CheckInRow = Prisma.WeeklyCheckInGetPayload<object>;

export function serializeCheckIn(row: CheckInRow) {
  return {
    id: row.id,
    weekStart: fromDbDate(row.weekStart),
    painTypical: row.painTypical,
    painWorst: row.painWorst,
    activityLimit: row.activityLimit,
    confidence: row.confidence,
    note: row.note,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function openWeeks(today: DateKey) {
  const current = weekStartOf(today);
  return [current, addDays(current, -7)];
}

export async function listCheckIns(patientId: string, limit = 26) {
  const rows = await prisma.weeklyCheckIn.findMany({ where: { patientId }, orderBy: { weekStart: 'desc' }, take: limit });
  return rows.map(serializeCheckIn);
}

export async function submitCheckIn(patient: { id: string; timezone: string }, weekStart: DateKey, input: CheckInInput, now = new Date()) {
  const today = localDateKey(patient.timezone, now);
  if (!openWeeks(today).includes(weekStart)) throw badRequest('You can answer the check-in for this week or last week only');
  if (input.painTypical !== null && input.painWorst !== null && input.painWorst < input.painTypical) {
    throw badRequest('Worst pain cannot be lower than typical pain');
  }
  if ([input.painTypical, input.painWorst, input.activityLimit, input.confidence].every((value) => value === null) && !input.note) {
    throw badRequest('Answer at least one question');
  }

  if (input.idempotencyKey) {
    const existing = await prisma.weeklyCheckIn.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.patientId !== patient.id || fromDbDate(existing.weekStart) !== weekStart) throw conflict('This retry key was already used.', 'idempotency_key_conflict');
      return { checkIn: serializeCheckIn(existing), created: false, newBadgeIds: [] as string[] };
    }
  }

  const answers = { painTypical: input.painTypical, painWorst: input.painWorst, activityLimit: input.activityLimit, confidence: input.confidence, note: input.note };
  return prisma.$transaction(async (tx) => {
    const before = await tx.weeklyCheckIn.findUnique({ where: { patientId_weekStart: { patientId: patient.id, weekStart: toDbDate(weekStart) } } });
    const row = await tx.weeklyCheckIn.upsert({
      where: { patientId_weekStart: { patientId: patient.id, weekStart: toDbDate(weekStart) } },
      create: { patientId: patient.id, weekStart: toDbDate(weekStart), ...answers, idempotencyKey: input.idempotencyKey, submittedAt: now },
      update: { ...answers },
    });
    const newBadgeIds = await awardCountAchievements(tx, patient.id, now);
    return { checkIn: serializeCheckIn(row), created: before === null, newBadgeIds };
  });
}
