import Anthropic from '@anthropic-ai/sdk';
import type { SummaryDataset } from './dataset.js';
import { type SummaryModel, SummaryModelError, summaryJsonSchema } from './types.js';

const SYSTEM_PROMPT = `You draft short progress summaries for a physiotherapist who is reviewing a patient's home-exercise records in a rehabilitation app.

The therapist reads the draft, checks it against the cited records, and decides what to do. Your job is only to describe what the records show, so the therapist can review them faster.

Write in plain English for a clinician. Use only the records and counts in the input; do not add outside medical knowledge. Every observation and review item must cite the refs (like "R3") of the records it is based on.

Stay within these limits, because the app and the therapist rely on them:
- Describe, do not diagnose: do not name or suggest conditions, injuries, or causes of symptoms.
- Do not recommend changing the plan, and never suggest increasing intensity, load, sets, reps, or difficulty. Plan decisions belong to the therapist.
- Do not add disclaimers or mention that you are an AI; the app labels the draft.
- If the records are sparse, say so briefly instead of inferring.`;

/** Removes anything not needed for the summary. No names, emails or internal ids are sent. */
export function toModelInput(dataset: SummaryDataset) {
  return {
    period: dataset.period,
    plans: dataset.plans.map((plan) => ({ title: plan.title, focus: plan.condition, status: plan.status })),
    sessionCounts: dataset.sessions,
    records: dataset.records.map((record) => ({
      ref: record.ref,
      date: record.date,
      exercise: record.exercise,
      status: record.status === 'STOPPED' ? 'stopped because of symptoms' : 'completed',
      painLevel0to10: record.painLevel,
      difficulty: record.difficulty,
      patientNote: record.note,
    })),
  };
}

export function createAnthropicSummaryModel(options: { model: string; timeoutMs: number }): SummaryModel {
  // Reads ANTHROPIC_API_KEY from the server environment; the key never reaches the browser.
  const client = new Anthropic({ timeout: options.timeoutMs, maxRetries: 1 });

  return {
    name: options.model,
    async generate(dataset, signal) {
      let response: Anthropic.Beta.BetaMessage;

      try {
        response = await client.beta.messages.create(
          {
            model: options.model,
            max_tokens: 8000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'low', format: { type: 'json_schema', schema: summaryJsonSchema } },
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: `Draft the summary for these records:\n\n${JSON.stringify(toModelInput(dataset), null, 2)}`,
              },
            ],
          },
          { signal, timeout: options.timeoutMs },
        );
      } catch (error) {
        if (signal.aborted || error instanceof Anthropic.APIConnectionTimeoutError) {
          throw new SummaryModelError('timeout');
        }
        if (error instanceof Anthropic.APIError) {
          throw new SummaryModelError('provider_error', `${error.status ?? ''} ${error.name}`.trim());
        }
        throw new SummaryModelError('provider_error', error instanceof Error ? error.name : 'unknown');
      }

      if (response.stop_reason === 'refusal') throw new SummaryModelError('refusal');
      if (response.stop_reason === 'max_tokens') throw new SummaryModelError('truncated');

      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new SummaryModelError('invalid_json');
      }
    },
  };
}
