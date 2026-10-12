import { prisma } from '../../db.js';
import { addDays, type DateKey, fromDbDate, toDbDate } from '../../lib/dates.js';
import { buildDays, sessionStats } from '../progress.js';
import { toSchedule } from '../plans.js';

export type SummaryRecord = {
  ref: string; // short reference ("R1") used in model prompts and citations
  completionId: string;
  date: DateKey;
  exercise: string;
  status: 'COMPLETED' | 'STOPPED';
  painLevel: number;
  difficulty: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD' | null;
  note: string | null;
  needsReview: boolean;
  reviewed: boolean;
};

export type SummaryDataset = {
  period: { start: DateKey; end: DateKey; days: number };
  plans: { title: string; condition: string; status: string }[];
  sessions: { scheduled: number; done: number; missed: number; upcoming: number };
  records: SummaryRecord[];
};

const NOTE_LIMIT = 280;

/**
 * Collects only the records the requesting therapist is authorized to see:
 * completions of tasks in plans that this therapist created for this patient.
 * The caller must already have checked the therapist–patient link.
 */
export async function buildSummaryDataset(therapistId: string, patientId: string, end: DateKey, days: number): Promise<SummaryDataset> {
  const start = addDays(end, -(days - 1));

  const plans = await prisma.rehabPlan.findMany({
    where: {
      therapistId,
      patientId,
      startDate: { lte: toDbDate(end) },
      endDate: { gte: toDbDate(start) },
    },
    include: {
      tasks: { orderBy: { orderIndex: 'asc' }, include: { exercise: { select: { id: true, title: true, description: true, instructions: true, safetyNotes: true, bodyPart: true, difficulty: true, videoUrl: true, imageUrl: true } } } },
      therapist: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  const completions = await prisma.taskCompletion.findMany({
    where: {
      patientId,
      sessionDate: { gte: toDbDate(start), lte: toDbDate(end) },
      task: { plan: { therapistId, patientId } },
    },
    orderBy: [{ sessionDate: 'asc' }, { completedAt: 'asc' }],
    include: { task: { select: { planId: true, exercise: { select: { title: true } } } } },
  });

  const sessions = { scheduled: 0, done: 0, missed: 0, upcoming: 0 };

  for (const plan of plans) {
    const schedule = toSchedule(plan);
    const planCompletions = completions
      .filter((completion) => completion.task.planId === plan.id)
      .map((completion) => ({ taskId: completion.taskId, sessionDate: fromDbDate(completion.sessionDate), status: completion.status }));
    const inPeriod = buildDays(schedule, planCompletions, end).filter((day) => day.date >= start && day.date <= end);
    const stats = sessionStats(inPeriod, end);
    sessions.scheduled += stats.totalSessions;
    sessions.done += stats.doneSessions;
    sessions.missed += stats.missedSessions;
    sessions.upcoming += inPeriod.filter((day) => day.state === 'today').length;
  }

  return {
    period: { start, end, days },
    plans: plans.map((plan) => ({ title: plan.title, condition: plan.condition, status: plan.status })),
    sessions,
    records: completions.map((completion, index) => ({
      ref: `R${index + 1}`,
      completionId: completion.id,
      date: fromDbDate(completion.sessionDate),
      exercise: completion.task.exercise.title,
      status: completion.status,
      painLevel: completion.painLevel,
      difficulty: completion.difficulty,
      note: completion.notes ? completion.notes.slice(0, NOTE_LIMIT) : null,
      needsReview: completion.needsReview,
      reviewed: completion.reviewedAt !== null,
    })),
  };
}
