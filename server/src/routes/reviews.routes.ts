import { ReviewKind, ReviewStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { handle, notFound, param, parse, requireUser } from '../http.js';
import { requireTherapist } from '../middleware/auth.middleware.js';
import { activeLinkWhere } from '../services/access.js';
import { evaluateMissedActivity, getReviewSettings, listReviewItems, setReviewStatus } from '../services/reviews.js';

const listSchema = z.object({
  status: z.enum(['ACTIVE', ReviewStatus.OPEN, ReviewStatus.ACKNOWLEDGED, ReviewStatus.RESOLVED]).default('ACTIVE'),
  kind: z.nativeEnum(ReviewKind).optional(),
  patientId: z.string().min(1).max(60).optional(),
  q: z.string().trim().max(80).optional().transform((value) => value || undefined),
  cursor: z.string().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const resolveSchema = z.object({ note: z.string().trim().max(500).nullish().transform((value) => value || null) });
const settingsSchema = z.object({ painThreshold: z.number().int().min(1).max(10), flagTooHard: z.boolean(), missedSessionsThreshold: z.number().int().min(1).max(14) });

export function createReviewsRouter() {
  const router = Router();
  router.use(requireTherapist);

  router.get(
    '/review-items',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const filter = parse(listSchema, request.query);
      await evaluateMissedActivity(therapist.id); // keep the missed-activity rule current (also run by the worker)
      response.json(await listReviewItems(therapist.id, filter));
    }),
  );

  for (const action of ['acknowledge', 'resolve', 'reopen'] as const) {
    router.post(
      `/review-items/:itemId/${action}`,
      handle(async (request, response) => {
        const therapist = requireUser(request);
        const { note } = parse(resolveSchema, request.body ?? {});
        const item = await setReviewStatus(therapist.id, param(request, 'itemId'), action, note);
        response.json({ item });
      }),
    );
  }

  /** Compatibility: marking an exercise record as reviewed resolves its review item. */
  router.post(
    '/completions/:completionId/review',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const item = await prisma.reviewItem.findFirst({
        where: { dedupeKey: `completion:${param(request, 'completionId')}`, therapistId: therapist.id, patient: { patientLinks: { some: activeLinkWhere(therapist.id) } } },
      });
      if (!item) throw notFound('Record not found');
      response.json({ item: await setReviewStatus(therapist.id, item.id, 'resolve', 'Marked reviewed') });
    }),
  );

  router.get(
    '/review-settings',
    handle(async (request, response) => {
      response.json({ settings: await getReviewSettings(prisma, requireUser(request).id) });
    }),
  );

  router.put(
    '/review-settings',
    handle(async (request, response) => {
      const therapist = requireUser(request);
      const input = parse(settingsSchema, request.body);
      const settings = await prisma.reviewSettings.upsert({ where: { therapistId: therapist.id }, create: { therapistId: therapist.id, ...input }, update: input });
      response.json({ settings });
    }),
  );

  return router;
}
