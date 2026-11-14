import { ArrowLeft, Moon, Send, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { DraftPreview } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { formatDay, formatLongDay, formatShort } from '../../ui/format';
import { Mascot } from '../../ui/Mascot';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { SessionOverview } from '../patient/SessionOverview';

export function PlanPreviewPage() {
  const { versionId = '' } = useParams();
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi<{ preview: DraftPreview }>(`/therapist/plan-versions/${versionId}/preview`);
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  if (loading && !data) return <LoadingBlock rows={4} label={t('Preparing preview')} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const { preview } = data;
  const version = preview.version;
  if (version.status !== 'DRAFT') {
    return (
      <EmptyState title={t('This draft is no longer open')} action={<Link className="btn btn-primary" to={`/therapist/patients/${version.patient.id}`}>{t('Back to patient')}</Link>}>
        {t('It was published or discarded.')}
      </EmptyState>
    );
  }

  async function publish() {
    if (publishing) return;
    setPublishing(true);
    setPublishError('');
    try {
      await api(`/therapist/plan-versions/${versionId}/publish`, { method: 'POST', body: { lockVersion: version.lockVersion } });
      toast(t('Published. {name} will see it from {date}.', { name: version.patient.name, date: formatShort(version.effectiveFrom) }));
      navigate(`/therapist/patients/${version.patient.id}`);
    } catch (caught) {
      setPublishError(errorMessage(caught));
      if (caught instanceof ApiError && caught.code === 'stale_draft') void reload();
      setPublishing(false);
    }
  }

  const changeCount = preview.changes.added.length + preview.changes.removed.length + preview.changes.changed.length;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Preview for {name}', { name: version.patient.name })}
        title={preview.isRevision ? t('Version {number}: patient preview', { number: preview.versionNumber }) : t('New plan: patient preview')}
        actions={
          <Link to={`/therapist/plan-versions/${versionId}`} className="btn btn-secondary">
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" /> {t('Back to editing')}
          </Link>
        }
      >
        {t('This is what the patient will see. Nothing is shared until you publish.')}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <section aria-label={t('Patient view')} className="rounded-[2.5rem] border-[10px] border-ink-900 bg-canvas p-4 shadow-xl">
          <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-extrabold text-ink-500">
            <Smartphone className="h-4 w-4" aria-hidden="true" /> {t('Patient view (preview)')}
          </p>
          <div className="card mb-4 flex items-center gap-3 p-4">
            <Mascot mood="wave" size={64} />
            <div>
              <p className="eyebrow">{preview.firstSessionDate ? formatLongDay(preview.firstSessionDate) : '—'}</p>
              <p className="font-display text-xl font-bold leading-tight">{t('Today’s session is ready')}</p>
              <p className="text-sm text-ink-500">{version.title}</p>
            </div>
          </div>
          <SessionOverview tasks={preview.sessionItems} />
          {version.therapistNotes ? <p className="mt-4 rounded-2xl bg-sky-50 p-3 text-sm">{version.therapistNotes}</p> : null}
        </section>

        <div className="grid content-start gap-4">
          <section className="card grid gap-3 p-5" aria-labelledby="schedule-title">
            <h2 id="schedule-title" className="font-display text-xl font-bold">
              {t('First two weeks')}
            </h2>
            <ul className="grid grid-cols-7 gap-1.5" aria-label={t('First two weeks')}>
              {preview.days.map((day) => (
                <li
                  key={day.date}
                  className={`grid min-h-14 place-items-center rounded-xl p-1 text-center text-xs font-bold ${day.kind === 'training' ? 'bg-brand-100 text-brand-800' : day.kind === 'paused' ? 'bg-ink-100 text-ink-500' : 'bg-grape-50 text-grape-700'}`}
                >
                  <span>{formatDay(day.date)}</span>
                  <span className="flex items-center gap-0.5">
                    {day.kind === 'training' ? t('Session') : day.kind === 'paused' ? t('Paused') : (<><Moon className="h-3 w-3" aria-hidden="true" />{t('Rest')}</>)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {preview.isRevision ? (
            <section className="card grid gap-2 p-5" aria-labelledby="changes-title">
              <h2 id="changes-title" className="font-display text-xl font-bold">
                {t('What changes from {date}', { date: formatShort(version.effectiveFrom) })}
              </h2>
              {changeCount === 0 ? <p className="text-ink-500">{t('No exercise changes. Schedule or text changes may still apply.')}</p> : null}
              {preview.changes.added.length ? <p><span className="font-extrabold text-brand-700">{t('Added:')}</span> {preview.changes.added.join(', ')}</p> : null}
              {preview.changes.changed.length ? <p><span className="font-extrabold text-sky-700">{t('Changed:')}</span> {preview.changes.changed.join(', ')}</p> : null}
              {preview.changes.removed.length ? <p><span className="font-extrabold text-rose-700">{t('Removed:')}</span> {preview.changes.removed.join(', ')}</p> : null}
              <p className="text-sm text-ink-500">{t('Records before this date keep the version that applied then.')}</p>
            </section>
          ) : null}

          {publishError ? <InlineMessage tone="error">{publishError}</InlineMessage> : null}
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setConfirm(true)}>
            <Send className="h-5 w-5 rtl:rotate-180" aria-hidden="true" /> {t('Publish to {name}', { name: version.patient.name })}
          </button>
        </div>
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t('Publish this plan?')}>
        <p className="text-ink-700">
          {preview.isRevision
            ? t('Version {number} applies from {date}. Earlier days and records are not changed.', { number: preview.versionNumber, date: formatShort(version.effectiveFrom) })
            : t('{name} will see this plan from {date}.', { name: version.patient.name, date: formatShort(version.effectiveFrom) })}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={publish} disabled={publishing}>
            {publishing ? <Spinner /> : null} {t('Publish')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
