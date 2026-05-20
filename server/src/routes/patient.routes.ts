import { PatientExerciseStatus, PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requirePatient } from '../middleware/auth.middleware.js';

const prisma = new PrismaClient();
const router = Router();

const patientExerciseSelect = {
  id: true,
  status: true,
  dueDate: true,
  notes: true,
  completedAt: true,
  painLevel: true,
  difficultyFeedback: true,
  patientNote: true,
  feedbackAt: true,
  createdAt: true,
  updatedAt: true,
  exercise: {
    select: {
      id: true,
      title: true,
      description: true,
      bodyPart: true,
      difficulty: true,
      sets: true,
      reps: true,
      durationSeconds: true,
      videoUrl: true,
      imageUrl: true,
    },
  },
} as const;

router.get('/daily-summary', requireAuth, requirePatient, async (request, response, next) => {
  try {
    const patient = request.user;

    if (!patient) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const today = new Date();
    const todayRange = getDayRange(today);

    const dueToday = await prisma.patientExercise.findMany({
      where: {
        patientId: patient.id,
        dueDate: {
          gte: todayRange.start,
          lt: todayRange.end,
        },
      },
      select: {
        status: true,
      },
    });

    const totalDueToday = dueToday.length;
    const completedDueToday = dueToday.filter((assignment) => assignment.status === PatientExerciseStatus.COMPLETED).length;
    const completionPercentage = totalDueToday === 0 ? 0 : Math.round((completedDueToday / totalDueToday) * 100);
    const streakDays = await calculateStreak(patient.id, today);

    response.json({
      totalDueToday,
      completedDueToday,
      completionPercentage,
      streakDays,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/therapists', requireAuth, requirePatient, async (request, response, next) => {
  try {
    const patient = request.user;

    if (!patient) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const links = await prisma.therapistPatient.findMany({
      where: {
        patientId: patient.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        therapist: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    response.json({
      therapists: links.map((link) => link.therapist),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/exercises', requireAuth, requirePatient, async (request, response, next) => {
  try {
    const patient = request.user;

    if (!patient) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const assignments = await prisma.patientExercise.findMany({
      where: {
        patientId: patient.id,
      },
      orderBy: [
        {
          dueDate: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: patientExerciseSelect,
    });

    response.json({
      exercises: assignments.map((assignment) => ({
        assignmentId: assignment.id,
        status: assignment.status,
        dueDate: assignment.dueDate,
        notes: assignment.notes,
        completedAt: assignment.completedAt,
        painLevel: assignment.painLevel,
        difficultyFeedback: assignment.difficultyFeedback,
        patientNote: assignment.patientNote,
        feedbackAt: assignment.feedbackAt,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        ...assignment.exercise,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/exercises/:assignmentId/complete', requireAuth, requirePatient, async (request, response, next) => {
  try {
    const patient = request.user;
    const assignmentId = getRouteParam(request.params.assignmentId);

    if (!patient) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!assignmentId) {
      response.status(400).json({ message: 'Assignment id is required' });
      return;
    }

    const assignment = await prisma.patientExercise.findFirst({
      where: {
        id: assignmentId,
        patientId: patient.id,
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      response.status(404).json({ message: 'Assigned exercise not found' });
      return;
    }

    const completedAssignment = await prisma.patientExercise.update({
      where: {
        id: assignment.id,
      },
      data: {
        status: PatientExerciseStatus.COMPLETED,
        completedAt: new Date(),
      },
      select: patientExerciseSelect,
    });

    response.json({
      exercise: {
        assignmentId: completedAssignment.id,
        status: completedAssignment.status,
        dueDate: completedAssignment.dueDate,
        notes: completedAssignment.notes,
        completedAt: completedAssignment.completedAt,
        painLevel: completedAssignment.painLevel,
        difficultyFeedback: completedAssignment.difficultyFeedback,
        patientNote: completedAssignment.patientNote,
        feedbackAt: completedAssignment.feedbackAt,
        createdAt: completedAssignment.createdAt,
        updatedAt: completedAssignment.updatedAt,
        ...completedAssignment.exercise,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/exercises/:assignmentId/feedback', requireAuth, requirePatient, async (request, response, next) => {
  try {
    const patient = request.user;
    const assignmentId = getRouteParam(request.params.assignmentId);

    if (!patient) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!assignmentId) {
      response.status(400).json({ message: 'Assignment id is required' });
      return;
    }

    const { painLevel, difficultyFeedback, patientNote } = request.body as {
      painLevel?: number;
      difficultyFeedback?: string;
      patientNote?: string;
    };

    if (!isValidPainLevel(painLevel)) {
      response.status(400).json({ message: 'painLevel must be a number from 1 to 10' });
      return;
    }

    const assignment = await prisma.patientExercise.findFirst({
      where: {
        id: assignmentId,
        patientId: patient.id,
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      response.status(404).json({ message: 'Assigned exercise not found' });
      return;
    }

    const updatedAssignment = await prisma.patientExercise.update({
      where: {
        id: assignment.id,
      },
      data: {
        painLevel,
        difficultyFeedback: normalizeText(difficultyFeedback) || null,
        patientNote: normalizeText(patientNote) || null,
        feedbackAt: new Date(),
      },
      select: patientExerciseSelect,
    });

    response.json({
      exercise: {
        assignmentId: updatedAssignment.id,
        status: updatedAssignment.status,
        dueDate: updatedAssignment.dueDate,
        notes: updatedAssignment.notes,
        completedAt: updatedAssignment.completedAt,
        painLevel: updatedAssignment.painLevel,
        difficultyFeedback: updatedAssignment.difficultyFeedback,
        patientNote: updatedAssignment.patientNote,
        feedbackAt: updatedAssignment.feedbackAt,
        createdAt: updatedAssignment.createdAt,
        updatedAt: updatedAssignment.updatedAt,
        ...updatedAssignment.exercise,
      },
    });
  } catch (error) {
    next(error);
  }
});

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isValidPainLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function getDayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

async function calculateStreak(patientId: string, fromDate: Date) {
  let streak = 0;
  const cursor = new Date(fromDate);

  for (let dayOffset = 0; dayOffset < 365; dayOffset += 1) {
    const { start, end } = getDayRange(cursor);
    const assignments = await prisma.patientExercise.findMany({
      where: {
        patientId,
        dueDate: {
          gte: start,
          lt: end,
        },
      },
      select: {
        status: true,
      },
    });

    if (assignments.length === 0) {
      break;
    }

    const allCompleted = assignments.every((assignment) => assignment.status === PatientExerciseStatus.COMPLETED);

    if (!allCompleted) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export default router;
