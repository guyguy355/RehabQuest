import { SummarySource } from '@prisma/client';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { HttpError } from '../../http.js';
import { localDateKey, toDbDate } from '../../lib/dates.js';
import { createAnthropicSummaryModel } from './anthropicModel.js';
import { buildSummaryDataset, type SummaryDataset } from './dataset.js';
import { buildRuleBasedSummary } from './ruleBased.js';
import { type SummaryContent, summaryContentSchema, type SummaryModel, SummaryModelError } from './types.js';

export type { SummaryModel } from './types.js';

export type FallbackReason =
  | 'not_configured'
  | 'no_records'
  | 'usage_limit'
  | 'timeout'
  | 'refusal'
  | 'truncated'
  | 'provider_error'
  | 'invalid_json'
  | 'invalid_output'
  | 'unsafe_output';

/** Phrases the draft must never contain: diagnosis or intensity/plan-change advice. */
const UNSAFE_PATTERNS: RegExp[] = [
  /\bdiagnos/i,
  /\b(increas\w*|rais\w*|progress\w*|advanc\w*|step\w* up|ramp\w* up|boost\w*|intensif\w*)\b[^.]{0,50}\b(intensity|load|weight|reps|repetitions|sets|difficulty|resistance|volume|duration)\b/i,
  /\b(add\w*|more)\b[^.]{0,25}\b(reps|repetitions|sets|weight|load|resistance)\b/i,
  /\b(should|must|recommend\w*|suggest\w*|consider\w*|advis\w*)\b[^.]{0,60}\b(chang\w*|modif\w*|updat\w*|adjust\w*|switch\w*)\b[^.]{0,40}\b(plan|exercise|program|programme)\b/i,
];

export function validateModelSummary(raw: unknown, dataset: SummaryDataset): { ok: true; content: SummaryContent } | { ok: false; reason: FallbackReason } {
  const parsed = summaryContentSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, reason: 'invalid_output' };
  }

  const knownRefs = new Set(dataset.records.map((record) => record.ref));
  const findings = [...parsed.data.observations, ...parsed.data.itemsForReview];

  if (findings.some((finding) => finding.refs.some((ref) => !knownRefs.has(ref)))) {
    return { ok: false, reason: 'invalid_output' };
  }

  const allText = [parsed.data.overview, parsed.data.adherence, ...findings.map((finding) => finding.text)].join('\n');

  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(allText))) {
    return { ok: false, reason: 'unsafe_output' };
  }

  return { ok: true, content: parsed.data };
}

function defaultModel(): SummaryModel | null {
  if (config.ai.provider !== 'anthropic' || !process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  return createAnthropicSummaryModel({ model: config.ai.model, timeoutMs: config.ai.timeoutMs });
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new SummaryModelError('timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

type SummaryRequest = {
  therapistId: string;
  patient: { id: string; timezone: string };
  days: number;
  model?: SummaryModel | null; // injected in tests; undefined = use environment configuration
  now?: Date;
};

export async function createProgressSummary({ therapistId, patient, days, model, now = new Date() }: SummaryRequest) {
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [totalRecent, modelRecent] = await Promise.all([
    prisma.aiSummaryRequest.count({ where: { therapistId, createdAt: { gte: hourAgo } } }),
    prisma.aiSummaryRequest.count({ where: { therapistId, createdAt: { gte: hourAgo }, source: SummarySource.MODEL } }),
  ]);

  if (totalRecent >= config.ai.totalHourlyLimit) {
    throw new HttpError(429, 'Summary limit reached. Please try again later.', 'rate_limited');
  }

  const end = localDateKey(patient.timezone, now);
  const dataset = await buildSummaryDataset(therapistId, patient.id, end, days);
  const activeModel = model === undefined ? defaultModel() : model;

  let content: SummaryContent | null = null;
  let fallbackReason: FallbackReason | null = null;

  if (!activeModel) fallbackReason = 'not_configured';
  else if (dataset.records.length === 0) fallbackReason = 'no_records';
  else if (modelRecent >= config.ai.modelHourlyLimit) fallbackReason = 'usage_limit';
  else {
    try {
      const raw = await withTimeout((signal) => activeModel.generate(dataset, signal), config.ai.timeoutMs);
      const validated = validateModelSummary(raw, dataset);
      if (validated.ok) content = validated.content;
      else fallbackReason = validated.reason;
    } catch (error) {
      fallbackReason = error instanceof SummaryModelError ? error.reason : 'provider_error';
      console.warn(`[summary] model failed (${fallbackReason})`);
    }
  }

  const source = content ? SummarySource.MODEL : SummarySource.RULE_BASED;
  const finalContent = content ?? buildRuleBasedSummary(dataset);

  await prisma.aiSummaryRequest.create({
    data: {
      therapistId,
      patientId: patient.id,
      periodStart: toDbDate(dataset.period.start),
      periodEnd: toDbDate(dataset.period.end),
      source,
      fallbackReason,
    },
  });

  const byRef = new Map(dataset.records.map((record) => [record.ref, record]));
  const expand = (finding: { text: string; refs: string[] }) => ({
    text: finding.text,
    references: finding.refs.map((ref) => {
      const record = byRef.get(ref)!;
      return {
        ref,
        completionId: record.completionId,
        date: record.date,
        exercise: record.exercise,
        status: record.status,
        painLevel: record.painLevel,
      };
    }),
  });

  return {
    source,
    label: source === SummarySource.MODEL ? 'AI-generated draft — requires therapist review' : 'Rule-based summary — no AI model was used',
    model: source === SummarySource.MODEL ? activeModel?.name ?? null : null,
    fallbackReason,
    generatedAt: now.toISOString(),
    period: dataset.period,
    sessions: dataset.sessions,
    recordCount: dataset.records.length,
    summary: {
      overview: finalContent.overview,
      adherence: finalContent.adherence,
      observations: finalContent.observations.map(expand),
      itemsForReview: finalContent.itemsForReview.map(expand),
    },
    records: dataset.records,
  };
}
