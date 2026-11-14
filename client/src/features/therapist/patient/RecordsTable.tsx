import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Completion } from '../../../app/types';
import { useI18n } from '../../../i18n';
import { difficultyLabel, formatDay, outcomeLabel, reasonLabel } from '../../../ui/format';
import { Chip } from '../../../ui/Pills';

const OUTCOME_TONE = { COMPLETED: 'brand', PARTIAL: 'sky', SKIPPED: 'neutral', STOPPED: 'coral' } as const;

/** Exercise records as a table (dates, outcome, pain, difficulty, note). Highlights a record linked from elsewhere. */
export function RecordsTable({ completions, highlight, patientId }: { completions: Completion[]; highlight?: string | null; patientId: string }) {
  const { t } = useI18n();
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const rows = onlyFlagged ? completions.filter((item) => item.needsReview) : completions;

  return (
    <section className="card grid gap-3 p-5" aria-labelledby="records-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="records-title" className="font-display text-xl font-bold">
          {t('Exercise records')}
        </h2>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink-700">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={onlyFlagged} onChange={(event) => setOnlyFlagged(event.target.checked)} />
          {t('Only records that matched a review rule')}
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-ink-50 p-4 text-ink-500">{t('No records yet.')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-start text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="py-2 pe-3 text-start font-extrabold">{t('Date')}</th>
                <th className="py-2 pe-3 text-start font-extrabold">{t('Exercise')}</th>
                <th className="py-2 pe-3 text-start font-extrabold">{t('Result')}</th>
                <th className="py-2 pe-3 text-start font-extrabold">{t('Pain (0–10)')}</th>
                <th className="py-2 pe-3 text-start font-extrabold">{t('Difficulty')}</th>
                <th className="py-2 text-start font-extrabold">{t('Note')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} id={`record-${item.id}`} className={`border-t-2 border-ink-100 align-top transition-colors ${highlight === item.id ? 'bg-sun-100' : ''}`}>
                  <td className="tabular whitespace-nowrap py-2 pe-3 font-bold">
                    {formatDay(item.sessionDate)}
                    {item.source === 'OFFLINE_SYNC' ? <span className="block text-xs font-semibold text-ink-500">{t('synced later')}</span> : null}
                  </td>
                  <td className="py-2 pe-3">
                    {item.exercise?.title}
                    <span className="block text-xs text-ink-500" dir="ltr">
                      {item.setsCompleted ?? '—'}/{item.prescribed.sets} × {item.prescribed.reps}
                    </span>
                  </td>
                  <td className="py-2 pe-3">
                    <Chip tone={OUTCOME_TONE[item.status]}>{outcomeLabel(item.status)}</Chip>
                    {item.reason ? <span className="mt-1 block text-xs text-ink-500">{reasonLabel(item.reason)}</span> : null}
                    {item.needsReview ? <span className="mt-1 block text-xs font-bold text-rose-700">{t('Matched a review rule')}</span> : null}
                  </td>
                  <td className={`tabular py-2 pe-3 font-extrabold ${item.painLevel !== null && item.painLevel >= 7 ? 'text-rose-700' : ''}`}>
                    {item.painLevel === null ? <span className="font-semibold text-ink-500">{t('Not reported')}</span> : `${item.painLevel}/10`}
                  </td>
                  <td className="py-2 pe-3">{item.difficulty ? difficultyLabel(item.difficulty) : '—'}</td>
                  <td className="max-w-[16rem] whitespace-pre-wrap break-words py-2 text-ink-700">
                    {item.notes ?? '—'}
                    <Link
                      to={`/therapist/patients/${patientId}?tab=messages&context=${encodeURIComponent(`COMPLETION:${item.id}`)}&label=${encodeURIComponent(`${item.exercise?.title ?? ''} · ${item.sessionDate}`)}`}
                      className="mt-1 flex min-h-11 items-center gap-1 text-xs font-extrabold text-brand-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t('Message about this')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
