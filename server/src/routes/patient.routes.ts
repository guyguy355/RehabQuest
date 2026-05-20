import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requirePatient } from '../middleware/auth.middleware.js';

const prisma = new PrismaClient();
const router = Router();

const patientExerciseSelect = {
  id: true,
  status: true,
  dueDate: true,
  notes: true,
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
    },
  },
} as const;

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
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        ...assignment.exercise,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
