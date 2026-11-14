/**
 * Patient–therapist messaging (ADR-004).
 *
 * - A conversation exists between a patient and a therapist who are (or were) linked.
 * - Sending requires an active link. After the link ends, the patient can still read their own
 *   message history but nobody can send; the therapist loses all access (404).
 * - A message may point to a record (task, exercise record, plan, review item). The link is
 *   checked when sending and again on every read; if it no longer belongs to this pair it is
 *   shown as unavailable.
 * - clientMessageId makes sending idempotent: a retried send returns the original message.
 * - Message text is stored and returned as plain text. The client renders it as text only.
 */
import { MessageContextType, Prisma, Role } from '@prisma/client';
import { prisma } from '../db.js';
import { forbidden, HttpError, notFound } from '../http.js';
import { fromDbDate, localDateKey, toDbDate } from '../lib/dates.js';
import { audit } from './audit.js';
import { notify } from './notifications.js';
import { recordPatientMessage, resolveUnansweredOnReply } from './reviews.js';

type Viewer = { id: string; role: Role; name: string };
type Pair = { therapistId: string; patientId: string };

export async function findConversation(viewer: Viewer, otherUserId: string) {
  const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true, name: true, role: true } });
  if (!other) throw notFound('Conversation not found');
  const pair: Pair | null =
    viewer.role === Role.THERAPIST && other.role === Role.PATIENT
      ? { therapistId: viewer.id, patientId: other.id }
      : viewer.role === Role.PATIENT && other.role === Role.THERAPIST
        ? { therapistId: other.id, patientId: viewer.id }
        : null;
  if (!pair) throw notFound('Conversation not found');

  const link = await prisma.therapistPatient.findUnique({ where: { therapistId_patientId: pair }, select: { endedAt: true, createdAt: true } });
  // Therapists lose access when the link ends. Patients keep read access to their own history.
  if (!link || (link.endedAt && viewer.role === Role.THERAPIST)) throw notFound('Conversation not found');
  return { other, pair, active: link.endedAt === null, endedAt: link.endedAt };
}

type ContextInput = { type: MessageContextType; id: string };

/** Returns a short description of the linked record if it belongs to this pair, else null. */
async function resolveContext(pair: Pair, context: ContextInput, viewerRole: Role) {
  const linkFor = (path: string) => (viewerRole === Role.THERAPIST ? `/therapist/patients/${pair.patientId}?${path}` : '/patient');
  switch (context.type) {
    case MessageContextType.TASK: {
      const task = await prisma.rehabTask.findFirst({
        where: { id: context.id, plan: { patientId: pair.patientId, therapistId: pair.therapistId } },
        select: { id: true, versionItems: { orderBy: { version: { effectiveFrom: 'desc' } }, take: 1, select: { exerciseTitle: true } } },
      });
      return task ? { type: context.type, id: task.id, label: task.versionItems[0]?.exerciseTitle ?? 'Exercise', link: linkFor('tab=plan') } : null;
    }
    case MessageContextType.COMPLETION: {
      const completion = await prisma.taskCompletion.findFirst({
        where: { id: context.id, patientId: pair.patientId, task: { plan: { therapistId: pair.therapistId } } },
        select: { id: true, sessionDate: true, task: { select: { exercise: { select: { title: true } } } } },
      });
      return completion
        ? { type: context.type, id: completion.id, label: `${completion.task.exercise.title} · ${fromDbDate(completion.sessionDate)}`, link: viewerRole === Role.THERAPIST ? linkFor(`tab=records&record=${completion.id}`) : '/patient/progress' }
        : null;
    }
    case MessageContextType.PLAN: {
      const plan = await prisma.rehabPlan.findFirst({ where: { id: context.id, patientId: pair.patientId, therapistId: pair.therapistId }, select: { id: true, title: true } });
      return plan ? { type: context.type, id: plan.id, label: plan.title, link: linkFor('tab=plan') } : null;
    }
    case MessageContextType.REVIEW_ITEM: {
      // Review items are therapist workflow records; patients never see them.
      if (viewerRole !== Role.THERAPIST) return null;
      const item = await prisma.reviewItem.findFirst({ where: { id: context.id, therapistId: pair.therapistId, patientId: pair.patientId }, select: { id: true, reasons: true } });
      return item ? { type: context.type, id: item.id, label: item.reasons[0] ?? 'Review item', link: `/therapist/reviews?item=${item.id}` } : null;
    }
  }
}

const messageSelect = { id: true, senderId: true, receiverId: true, text: true, contextType: true, contextId: true, readAt: true, createdAt: true, clientMessageId: true } satisfies Prisma.MessageSelect;
type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

async function serialize(rows: MessageRow[], pair: Pair, viewerRole: Role) {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      text: row.text,
      readAt: row.readAt,
      createdAt: row.createdAt,
      clientMessageId: row.clientMessageId,
      context:
        row.contextType && row.contextId
          ? (await resolveContext(pair, { type: row.contextType, id: row.contextId }, viewerRole)) ?? { type: row.contextType, id: row.contextId, label: null, link: null, unavailable: true }
          : null,
    })),
  );
}

export async function sendMessage(viewer: Viewer, input: { receiverId: string; text: string; clientMessageId: string; context?: ContextInput | null }) {
  const conversation = await findConversation(viewer, input.receiverId);
  if (!conversation.active) throw new HttpError(403, 'This care relationship has ended. You can still read your messages, but new messages cannot be sent.', 'care_ended');

  const duplicate = await prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: viewer.id, clientMessageId: input.clientMessageId } }, select: messageSelect });
  if (duplicate) return { message: (await serialize([duplicate], conversation.pair, viewer.role))[0], alreadySent: true };

  if (input.context) {
    if (input.context.type === MessageContextType.REVIEW_ITEM && viewer.role !== Role.THERAPIST) throw forbidden('Patients cannot link review items');
    const resolved = await resolveContext(conversation.pair, input.context, viewer.role);
    if (!resolved) throw notFound('The linked record was not found');
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { senderId: viewer.id, receiverId: conversation.other.id, text: input.text, clientMessageId: input.clientMessageId, contextType: input.context?.type ?? null, contextId: input.context?.id ?? null },
        select: messageSelect,
      });
      // Notification text never contains the message body.
      await notify(tx, {
        userId: conversation.other.id,
        kind: 'MESSAGE',
        title: `New message from ${viewer.name}`,
        body: input.context ? 'About a specific record' : 'Open the conversation to read it',
        link: viewer.role === Role.PATIENT ? `/therapist/patients/${viewer.id}?tab=messages` : '/patient/messages',
        dedupeKey: `message:${created.id}`,
      });
      if (viewer.role === Role.PATIENT) await recordPatientMessage(tx, { ...conversation.pair, messageId: created.id, at: created.createdAt });
      else await resolveUnansweredOnReply(tx, { ...conversation.pair, at: created.createdAt });
      return created;
    });
    return { message: (await serialize([message], conversation.pair, viewer.role))[0], alreadySent: false };
  } catch (error) {
    // Two identical retries racing: the unique (senderId, clientMessageId) keeps one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.message.findUniqueOrThrow({ where: { senderId_clientMessageId: { senderId: viewer.id, clientMessageId: input.clientMessageId } }, select: messageSelect });
      return { message: (await serialize([existing], conversation.pair, viewer.role))[0], alreadySent: true };
    }
    throw error;
  }
}

/** Newest-first pages; `before` is a message id cursor. */
export async function listMessages(viewer: Viewer, otherUserId: string, before: string | null, limit: number) {
  const conversation = await findConversation(viewer, otherUserId);
  const where: Prisma.MessageWhereInput = {
    OR: [
      { senderId: viewer.id, receiverId: conversation.other.id },
      { senderId: conversation.other.id, receiverId: viewer.id },
    ],
  };
  const rows = await prisma.message.findMany({
    where,
    select: messageSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    with: { id: conversation.other.id, name: conversation.other.name },
    active: conversation.active,
    endedAt: conversation.endedAt,
    messages: (await serialize(page, conversation.pair, viewer.role)).reverse(),
    nextBefore: rows.length > limit ? page.at(-1)!.id : null,
  };
}

export async function markRead(viewer: Viewer, otherUserId: string) {
  const conversation = await findConversation(viewer, otherUserId);
  const now = new Date();
  const unread = await prisma.message.findMany({ where: { senderId: conversation.other.id, receiverId: viewer.id, readAt: null }, select: { id: true } });
  await prisma.message.updateMany({ where: { id: { in: unread.map((message) => message.id) } }, data: { readAt: now } });
  await prisma.notification.updateMany({ where: { userId: viewer.id, readAt: null, dedupeKey: { in: unread.map((message) => `message:${message.id}`) } }, data: { readAt: now } });
  return { marked: unread.length };
}

export async function listConversations(viewer: Viewer) {
  const links = await prisma.therapistPatient.findMany({
    where: viewer.role === Role.THERAPIST ? { therapistId: viewer.id, endedAt: null } : { patientId: viewer.id },
    select: { endedAt: true, createdAt: true, therapist: { select: { id: true, name: true } }, patient: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return Promise.all(
    links.map(async (link) => {
      const other = viewer.role === Role.THERAPIST ? link.patient : link.therapist;
      const [unread, last] = await Promise.all([
        prisma.message.count({ where: { senderId: other.id, receiverId: viewer.id, readAt: null } }),
        prisma.message.findFirst({ where: { OR: [{ senderId: viewer.id, receiverId: other.id }, { senderId: other.id, receiverId: viewer.id }] }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      ]);
      return { with: other, active: link.endedAt === null, endedAt: link.endedAt, unread, lastMessageAt: last?.createdAt ?? null };
    }),
  );
}

/**
 * Ends a care relationship (either side). The therapist loses access immediately; that
 * therapist's active plan is paused so no reminders or expectations continue; open review
 * items for the pair are closed. Re-linking requires the patient's care code again.
 */
export async function endCareRelationship(actor: Viewer, pair: Pair) {
  const link = await prisma.therapistPatient.findUnique({ where: { therapistId_patientId: pair } });
  if (!link || link.endedAt) throw notFound('Care relationship not found');
  const now = new Date();
  const patient = await prisma.user.findUniqueOrThrow({ where: { id: pair.patientId }, select: { timezone: true, name: true } });
  const therapist = await prisma.user.findUniqueOrThrow({ where: { id: pair.therapistId }, select: { name: true } });
  const today = localDateKey(patient.timezone, now);

  await prisma.$transaction(async (tx) => {
    await tx.therapistPatient.update({ where: { id: link.id }, data: { endedAt: now, endedById: actor.id } });
    const activePlans = await tx.rehabPlan.findMany({ where: { ...pair, status: 'ACTIVE' }, select: { id: true } });
    for (const plan of activePlans) {
      await tx.planPause.create({ data: { planId: plan.id, startDate: toDbDate(today), createdById: actor.id, reason: 'Care relationship ended' } });
      await tx.rehabPlan.update({ where: { id: plan.id }, data: { status: 'PAUSED', revision: { increment: 1 } } });
    }
    await tx.reviewItem.updateMany({ where: { ...pair, status: { not: 'RESOLVED' } }, data: { status: 'RESOLVED', resolvedAt: now, resolvedById: actor.id, resolutionNote: 'Care relationship ended' } });
    await notify(tx, {
      userId: actor.role === Role.THERAPIST ? pair.patientId : pair.therapistId,
      kind: 'CARE',
      title: 'Care relationship ended',
      body: actor.role === Role.THERAPIST ? `${therapist.name} ended the care relationship.` : `${patient.name} ended the care relationship.`,
      link: actor.role === Role.THERAPIST ? '/patient/profile' : '/therapist',
      dedupeKey: `care-ended:${link.id}:${now.getTime()}`,
    });
    await audit(tx, { actorId: actor.id, action: 'CARE_LINK_ENDED', patientId: pair.patientId, subjectType: 'TherapistPatient', subjectId: link.id, metadata: { pausedPlans: activePlans.length } });
  });
  return { endedAt: now };
}
