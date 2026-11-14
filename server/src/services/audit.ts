import type { Prisma } from '@prisma/client';
import { prisma, type Db, type Tx } from '../db.js';

export type AuditAction =
  | 'PLAN_DRAFT_CREATED'
  | 'PLAN_PUBLISHED'
  | 'PLAN_DRAFT_DISCARDED'
  | 'PLAN_PAUSED'
  | 'PLAN_RESUMED'
  | 'PLAN_COMPLETED'
  | 'PLAN_ARCHIVED'
  | 'TEMPLATE_CREATED'
  | 'TEMPLATE_UPDATED'
  | 'TEMPLATE_ARCHIVED'
  | 'CARE_LINK_CREATED'
  | 'CARE_LINK_ENDED'
  | 'REVIEW_ACKNOWLEDGED'
  | 'REVIEW_RESOLVED'
  | 'REVIEW_REOPENED'
  | 'GOAL_CREATED'
  | 'GOAL_UPDATED'
  | 'GOAL_CONFIRMED'
  | 'MILESTONE_REOPENED'
  | 'MEASUREMENT_DEFINED'
  | 'MEASUREMENT_RECORDED'
  | 'CARD_ARCHIVED'
  | 'CARD_ASSIGNED'
  | 'CARD_UNASSIGNED'
  | 'MILESTONE_CONFIRMED'
  | 'CARD_PUBLISHED'
  | 'BRIEF_APPROVED'
  | 'BRIEF_SHARED'
  | 'EXPORT_CREATED';

/**
 * Writes an audit event. Metadata must never contain message bodies, free-text health
 * notes, passwords, tokens or care codes: only ids, counts, dates and status values.
 */
export function audit(
  db: Db | Tx,
  event: { actorId: string | null; action: AuditAction; patientId?: string | null; subjectType?: string; subjectId?: string; metadata?: Prisma.InputJsonValue },
) {
  return db.auditEvent.create({
    data: {
      actorId: event.actorId,
      action: event.action,
      patientId: event.patientId ?? null,
      subjectType: event.subjectType ?? null,
      subjectId: event.subjectId ?? null,
      metadata: event.metadata ?? undefined,
    },
  });
}

export function listAudit(where: Prisma.AuditEventWhereInput, take = 100) {
  return prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
}
