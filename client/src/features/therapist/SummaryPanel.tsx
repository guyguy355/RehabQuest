import { Bot, FileText, Info, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../../app/api';
import { formatDateTime, formatShort } from '../../ui/format';
import { InlineMessage, Spinner } from '../../ui/States';

type Reference = { ref: string; completionId: string; date: string; exercise: string; status: string; painLevel: number };
type Finding = { text: string; references: Reference[] };

export type Summary = {
  source: 'MODEL' | 'RULE_BASED';
  label: string;
  model: string | null;
  fallbackReason: string | null;
  generatedAt: string;
  period: { start: string; end: string; days: number };
  sessions: { scheduled: number; done: number; missed: number; upcoming: number };
  recordCount: number;
  summary: { overview: string; adherence: string; observations: Finding[]; itemsForReview: Finding[] };
};

const FALLBACK_TEXT: Record<string, string> = {
  not_configured: 'No AI provider is configured on the server, so this summary was calculated with fixed rules.',
  no_records: 'There are no records in this period, so no AI model was called.',
  usage_limit: 'The hourly limit for AI drafts was reached, so this summary was calculated with fixed rules.',
  timeout: 'The AI provider did not answer in time, so this summary was calculated with fixed rules.',
  refusal: 'The AI provider declined the request, so this summary was calculated with fixed rules.',
  truncated: 'The AI draft was incomplete and was discarded.',
  provider_error: 'The AI provider returned an error, so this summary was calculated with fixed rules.',
  invalid_json: 'The AI draft was not valid and was discarded.',
  invalid_output: 'The AI draft did not pass validation (for example, it cited records that do not exist) and was discarded.',
  unsafe_output: 'The AI draft contained wording that is not allowed here (diagnosis or advice to change the plan) and was discarded.',
};

function ReferenceChips({ references, onSelect }: { references: Reference[]; onSelect: (completionId: string) => void }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {references.slice(0, 8).map((reference) => (
        <button
          key={reference.ref}
          type="button"
          onClick={() => onSelect(reference.completionId)}
          className="tabular rounded-full border-2 border-ink-200 bg-white px-2 py-0.5 text-xs font-extrabold text-ink-700 hover:border-brand-300 hover:text-brand-700"
          title="Show this record in the table"
        >
          {reference.ref} · {formatShort(reference.date)} · {reference.exercise} · pain {reference.painLevel}
        </button>
      ))}
      {references.length > 8 ? <span className="text-xs font-bold text-ink-500">+{references.length - 8} more</span> : null}
    </span>
  );
}

export function SummaryPanel({ patientId, onSelectRecord }: { patientId: string; onSelectRecord: (completionId: string) => void }) {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await api<{ summary: Summary }>(`/therapist/patients/${patientId}/summary`, { method: 'POST', body: { days } });
      setSummary(result.summary);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  const isModel = summary?.source === 'MODEL';

  return (
    <section className="card grid gap-4 p-5" aria-labelledby="summary-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="summary-title" className="flex items-center gap-2 font-display text-xl font-bold">
            <Sparkles className="h-5 w-5 text-grape-500" aria-hidden="true" /> Progress summary draft
          </h2>
          <p className="text-sm text-ink-500">Drafts a summary from this patient’s recorded sessions in your plans. You review it; nothing changes automatically.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <fieldset className="flex rounded-2xl border-2 border-ink-200 p-0.5">
            <legend className="sr-only">Period</legend>
            {([7, 14, 30] as const).map((option) => (
              <label key={option}>
                <input type="radio" name="summary-days" className="peer sr-only" checked={days === option} onChange={() => setDays(option)} />
                <span className="block cursor-pointer rounded-xl px-3 py-1.5 text-sm font-extrabold text-ink-500 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-sky-500">
                  {option} days
                </span>
              </label>
            ))}
          </fieldset>
          <button type="button" className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
            {loading ? 'Drafting…' : summary ? 'Draft again' : 'Draft summary'}
          </button>
        </div>
      </div>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

      {summary ? (
        <div className="grid gap-4" aria-live="polite">
          <div className={`flex flex-wrap items-start gap-3 rounded-2xl border-2 p-3 ${isModel ? 'border-grape-300 bg-grape-50' : 'border-ink-200 bg-ink-50'}`}>
            {isModel ? <Bot className="h-6 w-6 shrink-0 text-grape-600" aria-hidden="true" /> : <Info className="h-6 w-6 shrink-0 text-ink-500" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className={`font-extrabold ${isModel ? 'text-grape-700' : 'text-ink-900'}`}>{summary.label}</p>
              <p className="text-sm text-ink-700">
                {formatShort(summary.period.start)} – {formatShort(summary.period.end)} · {summary.recordCount} record{summary.recordCount === 1 ? '' : 's'} · generated {formatDateTime(summary.generatedAt)}
                {summary.model ? ` · ${summary.model}` : ''}
              </p>
              {summary.fallbackReason ? <p className="mt-1 text-sm text-ink-700">{FALLBACK_TEXT[summary.fallbackReason] ?? 'Calculated with fixed rules.'}</p> : null}
            </div>
          </div>

          <div className="grid gap-2">
            <p>{summary.summary.overview}</p>
            <p className="text-ink-700">{summary.summary.adherence}</p>
          </div>

          {summary.summary.observations.length > 0 ? (
            <div>
              <h3 className="eyebrow">Observations</h3>
              <ul className="mt-2 grid gap-3">
                {summary.summary.observations.map((finding, index) => (
                  <li key={index}>
                    <p>{finding.text}</p>
                    <ReferenceChips references={finding.references} onSelect={onSelectRecord} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.summary.itemsForReview.length > 0 ? (
            <div>
              <h3 className="eyebrow text-rose-700">Worth a look</h3>
              <ul className="mt-2 grid gap-3">
                {summary.summary.itemsForReview.map((finding, index) => (
                  <li key={index}>
                    <p>{finding.text}</p>
                    <ReferenceChips references={finding.references} onSelect={onSelectRecord} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t-2 border-ink-100 pt-3 text-xs font-bold text-ink-500">
            Draft for the treating therapist only. It describes recorded data, does not diagnose, and does not change the plan or exercise intensity. Check each statement against the cited records.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-ink-50 p-4 text-sm text-ink-500">Choose a period and select “Draft summary”. Patient names and emails are never sent to an AI provider.</p>
      )}
    </section>
  );
}
