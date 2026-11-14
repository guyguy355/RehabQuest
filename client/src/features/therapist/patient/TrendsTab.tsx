import { errorMessage } from '../../../app/api';
import type { Analytics, CheckIn } from '../../../app/types';
import { useApi } from '../../../app/useApi';
import { useI18n } from '../../../i18n';
import { formatDateTime, formatNumber, formatShort } from '../../../ui/format';
import { ErrorState, LoadingBlock } from '../../../ui/States';
import { WeeklyTrends } from '../../shared/WeeklyTrends';

export function TrendsTab({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi<Analytics & { checkIns: CheckIn[] }>(`/therapist/patients/${patientId}/analytics?weeks=12`);
  if (loading && !data) return <LoadingBlock rows={3} label={t('Loading trends')} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;
  const { summary } = data;
  const answer = (value: number | null, max: number) => (value === null ? t('No answer') : `${value}/${max}`);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-500">{t('Last 12 weeks. Workflow figures only; they do not assess the patient’s condition.')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="eyebrow">{t('Due sessions done')}</p>
          <p className="tabular font-display text-3xl font-bold text-brand-700">{summary.adherencePercent === null ? t('Not applicable') : `${summary.adherencePercent}%`}</p>
          <p className="text-xs font-bold text-ink-500">{t('{done} of {due} due sessions', { done: summary.done, due: summary.due })}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t('Average reported pain')}</p>
          <p className="tabular font-display text-3xl font-bold text-coral-600">{summary.painAverage === null ? t('No reports') : formatNumber(summary.painAverage, 1)}</p>
          <p className="text-xs font-bold text-ink-500">{t('{count} reports', { count: summary.painReports })}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t('Rest or paused weeks')}</p>
          <p className="tabular font-display text-3xl font-bold text-ink-700">{summary.notApplicableWeeks}</p>
          <p className="text-xs font-bold text-ink-500">{t('not counted')}</p>
        </div>
      </div>
      <WeeklyTrends rows={data.weeks} />
      <section className="card grid gap-3 p-5" aria-labelledby="checkin-notes">
        <h2 id="checkin-notes" className="font-display text-xl font-bold">
          {t('Check-in notes')}
        </h2>
        {data.checkIns.length === 0 ? (
          <p className="text-ink-500">{t('No check-ins yet.')}</p>
        ) : (
          <ul className="grid gap-2">
            {data.checkIns.map((checkIn) => (
              <li key={checkIn.id} className="grid gap-1 border-b border-ink-100 pb-2">
                <p className="font-bold">
                  {t('Week of {date}', { date: formatShort(checkIn.weekStart) })} <span className="text-sm font-normal text-ink-500">· {t('sent {date}', { date: formatDateTime(checkIn.updatedAt) })}</span>
                </p>
                <p className="tabular text-sm text-ink-700">
                  {t('Typical pain')} {answer(checkIn.painTypical, 10)} · {t('Worst pain')} {answer(checkIn.painWorst, 10)} · {t('Activity limits')} {answer(checkIn.activityLimit, 10)} · {t('Confidence')} {answer(checkIn.confidence, 5)}
                </p>
                {checkIn.note ? <p className="text-ink-900">“{checkIn.note}”</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
