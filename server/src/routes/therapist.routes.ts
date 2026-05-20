import { Difficulty, PatientExerciseStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireTherapist } from '../middleware/auth.middleware.js';

const prisma = new PrismaClient();
const router = Router();

const linkedPatientSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

const exerciseSelect = {
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
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

const assignedExerciseSelect = {
  id: true,
  patientId: true,
  exerciseId: true,
  assignedById: true,
  status: true,
  dueDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  exercise: {
    select: exerciseSelect,
  },
} as const;

const patientProgressSelect = {
  id: true,
  status: true,
  dueDate: true,
  completedAt: true,
  painLevel: true,
  difficultyFeedback: true,
  patientNote: true,
  createdAt: true,
  exercise: {
    select: {
      title: true,
      bodyPart: true,
    },
  },
} as const;

router.post('/patients/link', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { patientEmail } = request.body as { patientEmail?: string };
    const normalizedEmail = normalizeText(patientEmail)?.toLowerCase();

    if (!normalizedEmail) {
      response.status(400).json({ message: 'patientEmail is required' });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      response.status(400).json({ message: 'patientEmail must be a valid email address' });
      return;
    }

    const patient = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: linkedPatientSelect,
    });

    if (!patient) {
      response.status(404).json({ message: 'Patient not found' });
      return;
    }

    if (patient.id === therapist.id) {
      response.status(400).json({ message: 'Therapists cannot link themselves as patients' });
      return;
    }

    if (patient.role !== Role.PATIENT) {
      response.status(400).json({ message: 'Linked user must have role PATIENT' });
      return;
    }

    const existingLink = await prisma.therapistPatient.findUnique({
      where: {
        therapistId_patientId: {
          therapistId: therapist.id,
          patientId: patient.id,
        },
      },
    });

    if (existingLink) {
      response.status(409).json({ message: 'Patient is already linked to this therapist' });
      return;
    }

    const link = await prisma.therapistPatient.create({
      data: {
        therapistId: therapist.id,
        patientId: patient.id,
      },
      include: {
        patient: {
          select: linkedPatientSelect,
        },
      },
    });

    response.status(201).json({
      patient: link.patient,
      linkedAt: link.createdAt,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({ message: 'Patient is already linked to this therapist' });
      return;
    }

    next(error);
  }
});

router.post('/exercises', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { title, description, bodyPart, difficulty, sets, reps, durationSeconds, videoUrl, imageUrl } = request.body as {
      title?: string;
      description?: string;
      bodyPart?: string;
      difficulty?: DifficultyInput;
      sets?: number;
      reps?: number;
      durationSeconds?: number;
      videoUrl?: string;
      imageUrl?: string;
    };

    const normalizedTitle = normalizeText(title);
    const normalizedDescription = normalizeText(description);
    const normalizedBodyPart = normalizeText(bodyPart);
    const normalizedVideoUrl = normalizeText(videoUrl);
    const normalizedImageUrl = normalizeText(imageUrl);

    if (!normalizedTitle) {
      response.status(400).json({ message: 'title is required' });
      return;
    }

    if (!normalizedDescription) {
      response.status(400).json({ message: 'description is required' });
      return;
    }

    if (!normalizedBodyPart || !difficulty) {
      response.status(400).json({ message: 'bodyPart and difficulty are required' });
      return;
    }

    if (!Object.values(Difficulty).includes(difficulty)) {
      response.status(400).json({ message: 'difficulty must be EASY, MEDIUM, or HARD' });
      return;
    }

    const exerciseNumbers = parseExerciseNumbers(sets, reps, durationSeconds);

    if ('error' in exerciseNumbers) {
      response.status(400).json({ message: exerciseNumbers.error });
      return;
    }

    const exercise = await prisma.exercise.create({
      data: {
        title: normalizedTitle,
        description: normalizedDescription,
        bodyPart: normalizedBodyPart,
        difficulty,
        sets: exerciseNumbers.data.sets,
        reps: exerciseNumbers.data.reps,
        durationSeconds: exerciseNumbers.data.durationSeconds,
        videoUrl: normalizedVideoUrl || null,
        imageUrl: normalizedImageUrl || null,
        createdById: therapist.id,
      },
      select: exerciseSelect,
    });

    response.status(201).json({ exercise });
  } catch (error) {
    next(error);
  }
});

router.get('/exercises', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const exercises = await prisma.exercise.findMany({
      where: {
        createdById: therapist.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: exerciseSelect,
    });

    response.json({ exercises });
  } catch (error) {
    next(error);
  }
});

router.put('/exercises/:id', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;
    const exerciseId = getRouteParam(request.params.id);

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!exerciseId) {
      response.status(400).json({ message: 'Exercise id is required' });
      return;
    }

    const exercise = await prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        createdById: therapist.id,
      },
      select: {
        id: true,
      },
    });

    if (!exercise) {
      response.status(404).json({ message: 'Exercise not found' });
      return;
    }

    const exerciseData = parseExerciseInput(request.body);

    if ('error' in exerciseData) {
      response.status(400).json({ message: exerciseData.error });
      return;
    }

    const updatedExercise = await prisma.exercise.update({
      where: {
        id: exercise.id,
      },
      data: exerciseData.data,
      select: exerciseSelect,
    });

    response.json({ exercise: updatedExercise });
  } catch (error) {
    next(error);
  }
});

router.delete('/exercises/:id', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;
    const exerciseId = getRouteParam(request.params.id);

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!exerciseId) {
      response.status(400).json({ message: 'Exercise id is required' });
      return;
    }

    const exercise = await prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        createdById: therapist.id,
      },
      select: {
        id: true,
      },
    });

    if (!exercise) {
      response.status(404).json({ message: 'Exercise not found' });
      return;
    }

    await prisma.exercise.delete({
      where: {
        id: exercise.id,
      },
    });

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/patients/:patientId/exercises', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;
    const patientId = getRouteParam(request.params.patientId);

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!patientId) {
      response.status(400).json({ message: 'Patient id is required' });
      return;
    }

    const linkedPatient = await findLinkedPatient(therapist.id, patientId);

    if (!linkedPatient) {
      response.status(404).json({ message: 'Linked patient not found' });
      return;
    }

    const { exerciseId, dueDate, notes } = request.body as {
      exerciseId?: string;
      dueDate?: string;
      notes?: string;
    };

    if (!exerciseId) {
      response.status(400).json({ message: 'exerciseId is required' });
      return;
    }

    const exercise = await prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        createdById: therapist.id,
      },
      select: {
        id: true,
      },
    });

    if (!exercise) {
      response.status(404).json({ message: 'Exercise not found' });
      return;
    }

    const parsedDueDate = parseOptionalDate(dueDate);

    if (parsedDueDate === 'invalid') {
      response.status(400).json({ message: 'dueDate must be a valid date' });
      return;
    }

    const assignment = await prisma.patientExercise.create({
      data: {
        patientId: linkedPatient.patientId,
        exerciseId: exercise.id,
        assignedById: therapist.id,
        status: PatientExerciseStatus.ASSIGNED,
        dueDate: parsedDueDate,
        notes: notes?.trim() || null,
      },
      select: assignedExerciseSelect,
    });

    response.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
});

router.get('/patients/:patientId/exercises', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;
    const patientId = getRouteParam(request.params.patientId);

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!patientId) {
      response.status(400).json({ message: 'Patient id is required' });
      return;
    }

    const linkedPatient = await findLinkedPatient(therapist.id, patientId);

    if (!linkedPatient) {
      response.status(404).json({ message: 'Linked patient not found' });
      return;
    }

    const assignments = await prisma.patientExercise.findMany({
      where: {
        patientId: linkedPatient.patientId,
        assignedById: therapist.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: assignedExerciseSelect,
    });

    response.json({ assignments });
  } catch (error) {
    next(error);
  }
});

router.get('/patients/:patientId/progress', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;
    const patientId = getRouteParam(request.params.patientId);

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!patientId) {
      response.status(400).json({ message: 'Patient id is required' });
      return;
    }

    const linkedPatient = await findLinkedPatient(therapist.id, patientId);

    if (!linkedPatient) {
      response.status(404).json({ message: 'Linked patient not found' });
      return;
    }

    const progress = await prisma.patientExercise.findMany({
      where: {
        patientId: linkedPatient.patientId,
        assignedById: therapist.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: patientProgressSelect,
    });

    response.json({
      progress: progress.map((assignment) => ({
        id: assignment.id,
        status: assignment.status,
        dueDate: assignment.dueDate,
        completedAt: assignment.completedAt,
        painLevel: assignment.painLevel,
        difficultyFeedback: assignment.difficultyFeedback,
        patientNote: assignment.patientNote,
        exerciseTitle: assignment.exercise.title,
        exerciseBodyPart: assignment.exercise.bodyPart,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/patients', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const links = await prisma.therapistPatient.findMany({
      where: {
        therapistId: therapist.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        patient: {
          select: linkedPatientSelect,
        },
      },
    });

    response.json({
      patients: links.map((link) => ({
        linkId: link.id,
        linkedAt: link.createdAt,
        ...link.patient,
      })),
    });
  } catch (error) {
    next(error);
  }
});

type DifficultyInput = (typeof Difficulty)[keyof typeof Difficulty];

type ExerciseInput = {
  title?: string;
  description?: string;
  bodyPart?: string;
  difficulty?: DifficultyInput;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  videoUrl?: string;
  imageUrl?: string;
};

function parseExerciseInput(body: unknown) {
  const { title, description, bodyPart, difficulty, sets, reps, durationSeconds, videoUrl, imageUrl } = body as ExerciseInput;
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description);
  const normalizedBodyPart = normalizeText(bodyPart);
  const normalizedVideoUrl = normalizeText(videoUrl);
  const normalizedImageUrl = normalizeText(imageUrl);

  if (!normalizedTitle) {
    return { error: 'title is required' };
  }

  if (!normalizedDescription) {
    return { error: 'description is required' };
  }

  if (!normalizedBodyPart || !difficulty) {
    return { error: 'bodyPart and difficulty are required' };
  }

  if (!Object.values(Difficulty).includes(difficulty)) {
    return { error: 'difficulty must be EASY, MEDIUM, or HARD' };
  }

  const exerciseNumbers = parseExerciseNumbers(sets, reps, durationSeconds);

  if ('error' in exerciseNumbers) {
    return { error: exerciseNumbers.error };
  }

  return {
    data: {
      title: normalizedTitle,
      description: normalizedDescription,
      bodyPart: normalizedBodyPart,
      difficulty,
      sets: exerciseNumbers.data.sets,
      reps: exerciseNumbers.data.reps,
      durationSeconds: exerciseNumbers.data.durationSeconds,
      videoUrl: normalizedVideoUrl || null,
      imageUrl: normalizedImageUrl || null,
    },
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseExerciseNumbers(sets: unknown, reps: unknown, durationSeconds: unknown) {
  if (!isPositiveInteger(sets)) {
    return { error: 'sets must be a positive number' };
  }

  if (!isPositiveInteger(reps)) {
    return { error: 'reps must be a positive number' };
  }

  if (!isPositiveInteger(durationSeconds)) {
    return { error: 'durationSeconds must be a positive number' };
  }

  return {
    data: {
      sets,
      reps,
      durationSeconds,
    },
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseOptionalDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'invalid' : parsed;
}

function findLinkedPatient(therapistId: string, patientId: string) {
  return prisma.therapistPatient.findUnique({
    where: {
      therapistId_patientId: {
        therapistId,
        patientId,
      },
    },
    select: {
      patientId: true,
    },
  });
}

export default router;
