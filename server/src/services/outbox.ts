/**
 * Database-backed job queue (ADR-003).
 *
 * - enqueue() is idempotent: the dedupeKey is unique, so enqueueing the same job twice
 *   (e.g. the scheduler running again) is a no-op.
 * - claimJobs() takes due jobs with UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED),
 *   so several worker processes never process the same job at the same time.
 * - A job stuck in PROCESSING (worker crashed) is reclaimed after LOCK_TIMEOUT.
 * - Failures are retried with exponential backoff up to maxAttempts, then marked FAILED.
 * Delivery to external services is therefore at-least-once; duplicates are prevented where
 * we control the target (in-app notifications have a unique dedupeKey).
 */
import type { OutboxJob, Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';

export const LOCK_TIMEOUT_MS = 5 * 60_000;

export async function enqueue(db: Tx | typeof prisma, job: { kind: string; userId?: string | null; dedupeKey: string; runAt: Date; payload?: Prisma.InputJsonValue; maxAttempts?: number }) {
  const result = await db.outboxJob.createMany({
    data: [{ kind: job.kind, userId: job.userId ?? null, dedupeKey: job.dedupeKey, runAt: job.runAt, payload: job.payload ?? undefined, maxAttempts: job.maxAttempts ?? 5 }],
    skipDuplicates: true,
  });
  return result.count === 1;
}

export async function claimJobs(workerId: string, limit: number, now = new Date()): Promise<OutboxJob[]> {
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  return prisma.$queryRaw<OutboxJob[]>`
    UPDATE "OutboxJob"
    SET "status" = 'PROCESSING', "lockedBy" = ${workerId}, "lockedAt" = ${now}, "attempts" = "attempts" + 1, "updatedAt" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "OutboxJob"
      WHERE ("status" = 'QUEUED' AND "runAt" <= ${now})
         OR ("status" = 'PROCESSING' AND "lockedAt" < ${staleBefore})
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

/** Finishes a job only if this worker still holds it. */
export async function finishJob(job: OutboxJob, workerId: string, status: 'DONE' | 'SUPPRESSED', result: string, now = new Date()) {
  await prisma.outboxJob.updateMany({ where: { id: job.id, lockedBy: workerId, status: 'PROCESSING' }, data: { status, result, completedAt: now, lockedBy: null, lockedAt: null } });
}

export async function rescheduleJob(job: OutboxJob, workerId: string, runAt: Date, result: string) {
  await prisma.outboxJob.updateMany({ where: { id: job.id, lockedBy: workerId }, data: { status: 'QUEUED', runAt, result, lockedBy: null, lockedAt: null, attempts: { decrement: 1 } } });
}

export async function failJob(job: OutboxJob, workerId: string, error: string, now = new Date()) {
  const attempts = job.attempts;
  const final = attempts >= job.maxAttempts;
  const backoffMs = Math.min(60 * 60_000, 2 ** attempts * 30_000);
  await prisma.outboxJob.updateMany({
    where: { id: job.id, lockedBy: workerId },
    data: final
      ? { status: 'FAILED', lastError: error.slice(0, 300), completedAt: now, lockedBy: null, lockedAt: null }
      : { status: 'QUEUED', lastError: error.slice(0, 300), runAt: new Date(now.getTime() + backoffMs), lockedBy: null, lockedAt: null },
  });
}
