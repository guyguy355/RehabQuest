import { Prisma, PrismaClient, Role } from '@prisma/client';
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

router.post('/patients/link', requireAuth, requireTherapist, async (request, response, next) => {
  try {
    const therapist = request.user;

    if (!therapist) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { patientEmail } = request.body as { patientEmail?: string };
    const normalizedEmail = patientEmail?.trim().toLowerCase();

    if (!normalizedEmail) {
      response.status(400).json({ message: 'patientEmail is required' });
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

export default router;
