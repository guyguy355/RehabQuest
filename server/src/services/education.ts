/**
 * Educational cards.
 *
 * - A card belongs to the therapist who wrote it. Every save creates a new immutable version
 *   (optimistic `lockVersion`, 409 `stale_card` on a lost update).
 * - A card is shared with a patient through an assignment, optionally next to one exercise of the
 *   patient's plan (the stable RehabTask slot, so it survives plan revisions).
 * - Patients always see the latest version. "Read" is recorded per version: when the card changes,
 *   the patient sees "Updated since you read it" and can confirm again. Old confirmations are kept.
 * - Card text is plain text (paragraphs and "- " bullet lines). It is never rendered as HTML.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { badRequest, conflict, notFound } from '../http.js';
import { activeLinkWhere } from './access.js';
import { audit } from './audit.js';
import { notify } from './notifications.js';

export type CardInput = { title: string; body: string; readingMinutes: number };

const latestVersion = { versions: { orderBy: { number: 'desc' }, take: 1 } } satisfies Prisma.EducationCardInclude;

function serializeVersion(version: Prisma.EducationCardVersionGetPayload<object>) {
  return { id: version.id, number: version.number, title: version.title, body: version.body, readingMinutes: version.readingMinutes, createdAt: version.createdAt.toISOString() };
}

export async function listCards(ownerId: string, options: { includeArchived?: boolean } = {}) {
  const cards = await prisma.educationCard.findMany({
    where: { ownerId, ...(options.includeArchived ? {} : { archivedAt: null }) },
    include: { ...latestVersion, _count: { select: { assignments: { where: { removedAt: null } } } } },
    orderBy: { updatedAt: 'desc' },
  });
  return cards.map((card) => ({ id: card.id, lockVersion: card.lockVersion, archived: card.archivedAt !== null, activeAssignments: card._count.assignments, latest: serializeVersion(card.versions[0]) }));
}

async function ownedCard(ownerId: string, cardId: string) {
  const card = await prisma.educationCard.findFirst({ where: { id: cardId, ownerId } });
  if (!card) throw notFound('Card not found');
  return card;
}

export async function getCard(ownerId: string, cardId: string) {
  const card = await ownedCard(ownerId, cardId);
  const versions = await prisma.educationCardVersion.findMany({ where: { cardId }, orderBy: { number: 'desc' } });
  return { id: card.id, lockVersion: card.lockVersion, archived: card.archivedAt !== null, versions: versions.map(serializeVersion) };
}

export async function createCard(ownerId: string, input: CardInput) {
  const card = await prisma.$transaction(async (tx) => {
    const created = await tx.educationCard.create({ data: { ownerId, versions: { create: [{ number: 1, ...input, createdById: ownerId }] } } });
    await audit(tx, { actorId: ownerId, action: 'CARD_PUBLISHED', subjectType: 'EducationCard', subjectId: created.id, metadata: { version: 1 } });
    return created;
  });
  return getCard(ownerId, card.id);
}

/** Publishes a new version. Patients with the card see the change and are asked to read it again. */
export async function updateCard(ownerId: string, cardId: string, input: CardInput & { lockVersion: number }) {
  const card = await ownedCard(ownerId, cardId);
  if (card.archivedAt) throw conflict('This card is archived. Restore it before editing.', 'card_archived');
  await prisma.$transaction(async (tx) => {
    const bumped = await tx.educationCard.updateMany({ where: { id: cardId, lockVersion: input.lockVersion }, data: { lockVersion: { increment: 1 }, latestVersion: { increment: 1 } } });
    if (bumped.count === 0) throw conflict('This card was changed somewhere else. Reload to see the latest version.', 'stale_card');
    const { latestVersion: number } = await tx.educationCard.findUniqueOrThrow({ where: { id: cardId }, select: { latestVersion: true } });
    await tx.educationCardVersion.create({ data: { cardId, number, title: input.title, body: input.body, readingMinutes: input.readingMinutes, createdById: ownerId } });
    await audit(tx, { actorId: ownerId, action: 'CARD_PUBLISHED', subjectType: 'EducationCard', subjectId: cardId, metadata: { version: number } });
    const assignments = await tx.educationAssignment.findMany({ where: { cardId, removedAt: null }, select: { patientId: true } });
    for (const assignment of assignments) {
      await notify(tx, { userId: assignment.patientId, kind: 'PLAN', title: 'An information card was updated', body: input.title, link: '/patient/learn', dedupeKey: `card-updated:${cardId}:${number}:${assignment.patientId}` });
    }
  });
  return getCard(ownerId, cardId);
}

export async function setCardArchived(ownerId: string, cardId: string, archived: boolean) {
  await ownedCard(ownerId, cardId);
  await prisma.$transaction(async (tx) => {
    await tx.educationCard.update({ where: { id: cardId }, data: { archivedAt: archived ? new Date() : null } });
    if (archived) await audit(tx, { actorId: ownerId, action: 'CARD_ARCHIVED', subjectType: 'EducationCard', subjectId: cardId });
  });
  return getCard(ownerId, cardId);
}

const assignmentInclude = {
  card: { include: latestVersion },
  acknowledgments: { include: { version: { select: { number: true } } }, orderBy: { acknowledgedAt: 'desc' } },
  task: { select: { id: true, exercise: { select: { title: true } } } },
} satisfies Prisma.EducationAssignmentInclude;
type AssignmentRow = Prisma.EducationAssignmentGetPayload<{ include: typeof assignmentInclude }>;

/** Read state relative to the latest version: unread, read, or updated since it was read. */
export function readState(latestNumber: number, acknowledgedNumbers: number[]): 'unread' | 'read' | 'updated' {
  if (acknowledgedNumbers.length === 0) return 'unread';
  return acknowledgedNumbers.includes(latestNumber) ? 'read' : 'updated';
}

function serializeAssignment(row: AssignmentRow) {
  const latest = row.card.versions[0];
  const numbers = row.acknowledgments.map((ack) => ack.version.number);
  const lastRead = row.acknowledgments[0] ?? null;
  return {
    id: row.id,
    cardId: row.cardId,
    note: row.note,
    assignedAt: row.assignedAt.toISOString(),
    task: row.task ? { id: row.task.id, title: row.task.exercise.title } : null,
    latest: serializeVersion(latest),
    state: readState(latest.number, numbers),
    lastRead: lastRead ? { versionNumber: lastRead.version.number, at: lastRead.acknowledgedAt.toISOString() } : null,
  };
}

export async function listAssignments(patientId: string, therapistId?: string) {
  const rows = await prisma.educationAssignment.findMany({
    // Patients keep their cards after care ends (read-only history); a therapist sees only their own.
    where: { patientId, removedAt: null, ...(therapistId ? { therapistId } : {}) },
    include: assignmentInclude,
    orderBy: { assignedAt: 'asc' },
  });
  return rows.map(serializeAssignment);
}

export async function assignCard(therapistId: string, patientId: string, input: { cardId: string; taskId: string | null; note: string | null }) {
  const card = await prisma.educationCard.findFirst({ where: { id: input.cardId, ownerId: therapistId, archivedAt: null } });
  if (!card) throw badRequest('Choose one of your active cards');
  if (input.taskId) {
    const task = await prisma.rehabTask.findFirst({ where: { id: input.taskId, plan: { patientId, therapistId } } });
    if (!task) throw badRequest('Choose an exercise from this patient’s plan');
  }
  const linked = await prisma.therapistPatient.findFirst({ where: { patientId, ...activeLinkWhere(therapistId) } });
  if (!linked) throw notFound('Patient not found');
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.educationAssignment.create({ data: { cardId: input.cardId, patientId, therapistId, taskId: input.taskId, note: input.note }, include: assignmentInclude });
      await audit(tx, { actorId: therapistId, action: 'CARD_ASSIGNED', patientId, subjectType: 'EducationAssignment', subjectId: created.id, metadata: { cardId: input.cardId } });
      await notify(tx, { userId: patientId, kind: 'PLAN', title: 'New information card from your therapist', body: created.card.versions[0].title, link: '/patient/learn', dedupeKey: `card-assigned:${created.id}` });
      return created;
    });
    return serializeAssignment(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw conflict('This card is already shared with this patient.', 'already_assigned');
    throw error;
  }
}

export async function unassignCard(therapistId: string, assignmentId: string) {
  const row = await prisma.educationAssignment.findFirst({ where: { id: assignmentId, therapistId, removedAt: null, patient: { patientLinks: { some: activeLinkWhere(therapistId) } } } });
  if (!row) throw notFound('Card not found');
  await prisma.$transaction(async (tx) => {
    await tx.educationAssignment.update({ where: { id: assignmentId }, data: { removedAt: new Date() } });
    await audit(tx, { actorId: therapistId, action: 'CARD_UNASSIGNED', patientId: row.patientId, subjectType: 'EducationAssignment', subjectId: assignmentId });
  });
}

/** The patient confirms reading the latest version. Re-confirming the same version is a no-op. */
export async function acknowledge(patientId: string, assignmentId: string, versionId: string) {
  const row = await prisma.educationAssignment.findFirst({ where: { id: assignmentId, patientId, removedAt: null }, include: assignmentInclude });
  if (!row) throw notFound('Card not found');
  if (row.card.versions[0].id !== versionId) throw conflict('This card was updated. Read the new version first.', 'card_version_changed');
  await prisma.educationAcknowledgment.createMany({ data: [{ assignmentId, versionId }], skipDuplicates: true });
  const updated = await prisma.educationAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: assignmentInclude });
  return serializeAssignment(updated);
}
