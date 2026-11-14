/**
 * Record-level authorization for therapists (ADR-004).
 *
 * - A therapist can read or change a patient's data only while an active
 *   TherapistPatient link exists.
 * - A therapist can only see and edit plans they created themselves.
 *
 * Unauthorized records answer 404 (not 403), so a therapist cannot probe which
 * patient or plan ids exist by changing ids in the URL. A wrong *role* gets 403.
 */
import { prisma } from '../db.js';
import { notFound } from '../http.js';

/** Prisma condition for an active (not ended) care link with this therapist. */
export function activeLinkWhere(therapistId: string) {
  return { therapistId, endedAt: null };
}

export async function getLinkedPatient(therapistId: string, patientId: string) {
  const link = await prisma.therapistPatient.findFirst({
    where: { patientId, ...activeLinkWhere(therapistId) },
    select: {
      createdAt: true,
      patient: { select: { id: true, name: true, email: true, timezone: true, role: true, createdAt: true } },
    },
  });

  if (!link) {
    throw notFound('Patient not found');
  }

  return { ...link.patient, linkedAt: link.createdAt };
}

export async function getOwnedPlanId(therapistId: string, planId: string) {
  const plan = await prisma.rehabPlan.findFirst({
    where: {
      id: planId,
      therapistId,
      patient: { patientLinks: { some: activeLinkWhere(therapistId) } },
    },
    select: { id: true, patientId: true },
  });

  if (!plan) {
    throw notFound('Plan not found');
  }

  return plan;
}
