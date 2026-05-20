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
};
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
                createdAt: assignment.createdAt,
                updatedAt: assignment.updatedAt,
                ...assignment.exercise,
            })),
        });
    }
    catch (error) {
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
                createdAt: completedAssignment.createdAt,
                updatedAt: completedAssignment.updatedAt,
                ...completedAssignment.exercise,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
function getRouteParam(value) {
    return Array.isArray(value) ? value[0] : value;
}
export default router;
