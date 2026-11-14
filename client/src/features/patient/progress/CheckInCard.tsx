import { ClipboardCheck } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { api, errorMessage } from '../../../app/api';
import type { Badge, CheckIn } from '../../../app/types';
import { useApi } from '../../../app/useApi';
import { useI18n } from '../../../i18n';
import { TextArea } from '../../../ui/Field';
import { formatShort } from '../../../ui/format';
import { InlineMessage, LoadingBlock, Spinner } from '../../../ui/States';
import { useToast } from '../../../ui/Toast';

type Answers = { painTypical: number | null; painWorst: number | null; activityLimit: number | null; confidence: number | null; note: string };
const EMPTY: Answers = { painTypical: null, painWorst: null, activityLimit: null, confidence: null, note: '' };

/** A 0–10 or 1–5 question. Optional: "Clear" returns it to "no answer" (stored as null, never 0). */
function ScaleQuestion({ legend, min, max, low, high, value, onChange }: { legend: string; min: number; max: number; low: string; high: string; value: number | null; onChange: (value: number | null) => void }) {
  const { t } = useI18n();
  const name = useId();
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return (
    <fieldset className="grid gap-2">
      <legend className="field-label mb-1 flex w-full flex-wrap items-center justify-between gap-2">
        <span>
          {legend} <span className="font-semibold text-ink-500">{t('(optional)')}</span>
        </span>
        {value !== null ? (
          <button type="button" className="min-h-11 text-sm font-extrabold text-brand-700 underline-offset-4 hover:underline" onClick={() => onChange(null)}>
            {t('Clear answer')}
          </button>
        ) : null}
      </legend>
      <div dir="ltr" className={`grid gap-1.5 ${options.length > 6 ? 'grid-cols-6 sm:grid-cols-11' : 'grid-cols-5'}`}>
        {options.map((option) => (
          <label key={option} className="relative">
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="peer sr-only" aria-label={`${option}${option === min ? ` – ${low}` : option === max ? ` – ${high}` : ''}`} />
            <span className="tabular grid min-h-11 cursor-pointer place-items-center rounded-xl border-2 border-ink-100 bg-white font-black transition peer-checked:border-ink-900 peer-checked:bg-brand-100 peer-checked:shadow-[0_3px_0_0_#152A2C] peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-500">
              {option}
            </span>
          </label>
        ))}
      </div>
      <div dir="ltr" className="flex justify-between gap-2 text-xs font-bold text-ink-500" aria-hidden="true">
        <span>
          {min} · {low}
        </span>
        <span className="text-end">
          {max} · {high}
        </span>
      </div>
    </fieldset>
  );
}

export function CheckInCard({ onBadges }: { onBadges?: (badges: Badge[]) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { data, loading, reload } = useApi<{ today: string; openWeeks: string[]; checkIns: CheckIn[] }>('/patient/check-ins');
  const [week, setWeek] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedWeek = week ?? data?.openWeeks[0] ?? null;
  const existing = data?.checkIns.find((checkIn) => checkIn.weekStart === selectedWeek) ?? null;

  useEffect(() => {
    setAnswers(existing ? { painTypical: existing.painTypical, painWorst: existing.painWorst, activityLimit: existing.activityLimit, confidence: existing.confidence, note: existing.note ?? '' } : EMPTY);
    setError('');
  }, [existing, selectedWeek]);

  if (loading && !data) return <LoadingBlock rows={2} label={t('Loading your check-in')} />;
  if (!data || !selectedWeek) return null;

  const set = (patch: Partial<Answers>) => setAnswers((current) => ({ ...current, ...patch }));
  const nothing = answers.painTypical === null && answers.painWorst === null && answers.activityLimit === null && answers.confidence === null && !answers.note.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (nothing) {
      setError(t('Answer at least one question'));
      return;
    }
    if (answers.painTypical !== null && answers.painWorst !== null && answers.painWorst < answers.painTypical) {
      setError(t('Worst pain cannot be lower than typical pain'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await api<{ checkIn: CheckIn; newBadges: Badge[] }>(`/patient/check-ins/${selectedWeek}`, { method: 'PUT', body: { ...answers, note: answers.note.trim() || null, idempotencyKey: crypto.randomUUID() } });
      toast(existing ? t('Check-in updated') : t('Check-in sent'), 'success');
      if (result.newBadges.length) onBadges?.(result.newBadges);
      await reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card grid gap-4 p-5" aria-labelledby="checkin-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="checkin-title" className="flex items-center gap-2 font-display text-xl font-bold">
            <ClipboardCheck className="h-5 w-5 text-brand-600" aria-hidden="true" /> {t('Weekly check-in')}
          </h2>
          <p className="text-sm text-ink-500">{t('A minute, once a week. Every question is optional; your therapist sees your answers.')}</p>
        </div>
        <div role="group" aria-label={t('Week')} className="flex flex-wrap gap-1 rounded-2xl bg-ink-50 p-1">
          {data.openWeeks.map((weekStart, index) => (
            <button key={weekStart} type="button" aria-pressed={selectedWeek === weekStart} onClick={() => setWeek(weekStart)} className={`min-h-11 rounded-xl px-3 text-sm font-extrabold ${selectedWeek === weekStart ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500'}`}>
              {index === 0 ? t('This week') : t('Last week')} · {formatShort(weekStart)}
            </button>
          ))}
        </div>
      </div>

      {existing ? <InlineMessage tone="info">{t('Sent. You can change your answers until the end of next week.')}</InlineMessage> : null}

      <form className="grid gap-5" onSubmit={submit} noValidate>
        <ScaleQuestion legend={t('Typical pain this week')} min={0} max={10} low={t('No pain')} high={t('Worst imaginable')} value={answers.painTypical} onChange={(value) => set({ painTypical: value })} />
        <ScaleQuestion legend={t('Worst pain this week')} min={0} max={10} low={t('No pain')} high={t('Worst imaginable')} value={answers.painWorst} onChange={(value) => set({ painWorst: value })} />
        <ScaleQuestion legend={t('How much did it limit everyday activities?')} min={0} max={10} low={t('Not at all')} high={t('Could not do them')} value={answers.activityLimit} onChange={(value) => set({ activityLimit: value })} />
        <ScaleQuestion legend={t('How confident are you managing on your own?')} min={1} max={5} low={t('Not confident')} high={t('Very confident')} value={answers.confidence} onChange={(value) => set({ confidence: value })} />
        <TextArea label={t('Anything else for your therapist? (optional)')} value={answers.note} onChange={(event) => set({ note: event.target.value })} maxLength={500} rows={2} />
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <p className="text-xs text-ink-500">{t('Check-ins are not monitored around the clock. For urgent problems, call your clinic.')}</p>
        <button type="submit" className="btn btn-primary justify-self-start" disabled={saving}>
          {saving ? <Spinner /> : null} {existing ? t('Update check-in') : t('Send check-in')}
        </button>
      </form>
    </section>
  );
}
