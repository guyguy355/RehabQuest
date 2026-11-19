/**
 * Self-service data export ("give me a copy of my data").
 *
 * A patient receives everything RehabQuest stores about them, as plain JSON, in one request.
 * A therapist receives their own account data and care links; clinical records about patients
 * belong to the clinic's record-keeping and are exported per patient by the therapist UI, not here.
 * Every export is written to the audit trail (who, when; never the content).
 */
import type { Db } from '../db.js';
import { audit } from './audit.js';

export const EXPORT_FORMAT_VERSION = 1;

export async function exportOwnData(db: Db, userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      timezone: true,
      careCode: true,
      createdAt: true,
      updatedAt: true,
      passwordChangedAt: true,
      preference: true,
      notificationPreference: true,
      patientLinks: { select: { id: true, therapistId: true, createdAt: true, endedAt: true, therapist: { select: { name: true } } } },
      therapistLinks: { select: { id: true, patientId: true, createdAt: true, endedAt: true } },
    },
  });

  const base = {
    format: 'rehabquest-data-export',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordChangedAt: user.passwordChangedAt,
    },
    preferences: user.preference,
  };

  if (user.role !== 'PATIENT') {
    await audit(db, { actorId: userId, action: 'EXPORT_CREATED', subjectType: 'User', subjectId: userId, metadata: { scope: 'own-account' } });
    return { ...base, careLinks: user.therapistLinks };
  }

  const [plans, completions, xpEvents, badges, messages, goals, measurements, checkIns, weeklyGoals, education, notifications] = await Promise.all([
    db.rehabPlan.findMany({
      where: { patientId: userId },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        title: true,
        condition: true,
        startDate: true,
        endDate: true,
        trainingWeekdays: true,
        therapistNotes: true,
        status: true,
        revision: true,
        createdAt: true,
        updatedAt: true,
        therapist: { select: { name: true } },
        tasks: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            sets: true,
            reps: true,
            durationSeconds: true,
            orderIndex: true,
            notes: true,
            activeFrom: true,
            activeUntil: true,
            exercise: { select: { id: true, title: true } },
          },
        },
        pauses: true,
      },
    }),
    db.taskCompletion.findMany({
      where: { patientId: userId },
      orderBy: [{ sessionDate: 'asc' }, { completedAt: 'asc' }],
      select: {
        id: true,
        taskId: true,
        sessionDate: true,
        status: true,
        painLevel: true,
        difficulty: true,
        reason: true,
        setsCompleted: true,
        repsPerSet: true,
        activeSeconds: true,
        occurredAt: true,
        source: true,
        prescribedSets: true,
        prescribedReps: true,
        prescribedDurationSecs: true,
        prescribedHoldSecs: true,
        prescribedRestSecs: true,
        notes: true,
        xpAwarded: true,
        needsReview: true,
        reviewedAt: true,
        completedAt: true,
        task: { select: { exercise: { select: { title: true } } } },
      },
    }),
    db.xpEvent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { amount: true, reason: true, sessionDate: true, createdAt: true } }),
    db.userBadge.findMany({ where: { userId }, orderBy: { earnedAt: 'asc' }, select: { earnedAt: true, badge: true } }),
    db.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'asc' },
      select: { id: true, senderId: true, receiverId: true, text: true, contextType: true, contextId: true, readAt: true, createdAt: true },
    }),
    db.goal.findMany({
      where: { patientId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        baselineValue: true,
        targetValue: true,
        targetDate: true,
        status: true,
        achievedAt: true,
        createdAt: true,
        updatedAt: true,
        definition: { select: { id: true, name: true, unit: true } },
        milestones: { orderBy: { orderIndex: 'asc' }, select: { title: true, orderIndex: true, targetDate: true, achievedAt: true, note: true } },
      },
    }),
    db.measurement.findMany({
      where: { patientId: userId },
      orderBy: { measuredOn: 'asc' },
      select: { id: true, value: true, measuredOn: true, note: true, source: true, createdAt: true, definition: { select: { id: true, name: true, unit: true } } },
    }),
    db.weeklyCheckIn.findMany({ where: { patientId: userId }, orderBy: { weekStart: 'asc' } }),
    db.weeklyGoalWeek.findMany({ where: { userId }, orderBy: { weekStart: 'asc' } }),
    db.educationAssignment.findMany({
      where: { patientId: userId },
      orderBy: { assignedAt: 'asc' },
      select: {
        id: true,
        note: true,
        assignedAt: true,
        removedAt: true,
        card: { select: { id: true, versions: { orderBy: { number: 'desc' }, take: 1, select: { number: true, title: true } } } },
        acknowledgments: true,
      },
    }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, take: 1000 }),
  ]);

  await audit(db, {
    actorId: userId,
    action: 'EXPORT_CREATED',
    patientId: userId,
    subjectType: 'User',
    subjectId: userId,
    metadata: { scope: 'own-data', plans: plans.length, completions: completions.length, messages: messages.length },
  });

  return {
    ...base,
    careCode: user.careCode,
    notificationPreferences: user.notificationPreference,
    careTeam: user.patientLinks,
    plans,
    exerciseRecords: completions,
    xp: xpEvents,
    achievements: badges,
    messages,
    goals,
    measurements,
    weeklyCheckIns: checkIns,
    weeklyGoals,
    education,
    notifications,
  };
}
