import { z } from 'zod';
import type { SummaryDataset } from './dataset.js';

const finding = z.object({
  text: z.string().trim().min(1).max(400),
  refs: z.array(z.string().regex(/^R\d+$/)).min(1).max(15),
});

/** The only shape accepted from the model (and produced by the rule-based fallback). */
export const summaryContentSchema = z.object({
  overview: z.string().trim().min(1).max(700),
  adherence: z.string().trim().min(1).max(500),
  observations: z.array(finding).max(6),
  itemsForReview: z.array(finding).max(8),
});

export type SummaryContent = z.infer<typeof summaryContentSchema>;

/** JSON schema sent to the model as a structured-output format. */
export const summaryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['overview', 'adherence', 'observations', 'itemsForReview'],
  properties: {
    overview: { type: 'string', description: '2-3 neutral sentences describing what was recorded in the period.' },
    adherence: { type: 'string', description: 'One or two sentences about planned vs. finished sessions, using the given counts.' },
    observations: {
      type: 'array',
      description: 'Factual patterns in the records (pain values, difficulty ratings, patient notes). Each cites record refs.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'refs'],
        properties: { text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } },
      },
    },
    itemsForReview: {
      type: 'array',
      description: 'Records the therapist may want to look at (stopped sessions, high pain, "too hard", notable notes). Each cites record refs.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'refs'],
        properties: { text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } },
      },
    },
  },
} as const;

export interface SummaryModel {
  readonly name: string;
  generate(dataset: SummaryDataset, signal: AbortSignal): Promise<unknown>;
}

export class SummaryModelError extends Error {
  constructor(public readonly reason: 'timeout' | 'refusal' | 'truncated' | 'provider_error' | 'invalid_json', message?: string) {
    super(message ?? reason);
  }
}
