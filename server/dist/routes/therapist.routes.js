import { Prisma, PrismaClient, Role } from '@prisma/client';
import { Router } from 'express';
import { getAuthenticatedUser } from '../auth.js';
const prisma = new PrismaClient();
const router = Router();
const linkedPatientSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
    updatedAt: true,
};
router.post('/patients/link', async (request, response, next) => {
    try {
        const therapist = await getTherapistUser(request.headers.authorization, response);
        if (!therapist) {
            return;
        }
        const { patientEmail } = request.body;
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
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            response.status(409).json({ message: 'Patient is already linked to this therapist' });
            return;
        }
        next(error);
    }
});
router.get('/patients', async (request, response, next) => {
    try {
        const therapist = await getTherapistUser(request.headers.authorization, response);
        if (!therapist) {
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
    }
    catch (error) {
        next(error);
    }
});
async function getTherapistUser(authorization, response) {
    const user = await getAuthenticatedUser(prisma, authorization);
    if (!user) {
        response.status(401).json({ message: 'Missing or invalid Authorization header' });
        return null;
    }
    if (user.role !== Role.THERAPIST) {
        response.status(403).json({ message: 'Only therapists can manage linked patients' });
        return null;
    }
    return user;
}
export default router;
