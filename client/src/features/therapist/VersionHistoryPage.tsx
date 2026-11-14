import { ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { Plan, VersionSummary } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { formatDateTime, formatShort } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { ErrorState, LoadingBlock } from '../../ui/States';

export function VersionHistoryPage() {
  const { planId = '' } = useParams();
  const { t } = useI18n();
  const plan = useApi<{ plan: Plan; patient: { id: string; name: string } }>(`/therapist/plans/${planId}`);
  const versions = useApi<{ versions: VersionSummary[] }>(`/therapist/plans/${planId}/versions`);

  if (plan.error || versions.error) return <ErrorState message={errorMessage(plan.error ?? versions.error)} onRetry={() => { void plan.reload(); void versions.reload(); }} />;
  if (!plan.data || !versions.data) return <LoadingBlock rows={3} label={t('Loading history')} />;

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Plan for {name}', { name: plan.data.patient.name })} title={t('Version history')}>
        {t('Every published version is kept unchanged. Each one applies from its start date until the next one.')}
      </PageHeader>
      <ol className="grid gap-3">
        {versions.data.versions.map((version) => (
          <li key={version.id}>
            <Link to={`/therapist/plan-versions/${version.id}`} className="card-raised flex flex-wrap items-center gap-3 p-4 hover:border-brand-200">
              <span className="tabular grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 font-display text-lg font-bold text-brand-800">{version.number ?? '✎'}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-extrabold">
                  {version.title}
                  {version.status === 'DRAFT' ? <Chip tone="sun">{t('Draft')}</Chip> : null}
                  {plan.data!.plan.versionId === version.id ? <Chip tone="brand">{t('Current')}</Chip> : null}
                </p>
                <p className="text-sm text-ink-500">
                  {t('From {from} to {to}', { from: formatShort(version.effectiveFrom), to: formatShort(version.endDate) })} · {t('{count} exercises', { count: version.itemCount })}
                  {version.publishedAt ? ` · ${t('published {date} by {name}', { date: formatDateTime(version.publishedAt), name: version.publishedBy?.name ?? '—' })}` : ''}
                </p>
                {version.changeNote ? <p className="text-sm italic text-ink-700">{version.changeNote}</p> : null}
              </div>
              <ChevronRight className="h-5 w-5 text-ink-300 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
      <Link to={`/therapist/patients/${plan.data.patient.id}`} className="justify-self-start font-extrabold text-brand-700 underline-offset-4 hover:underline">
        {t('Back to {name}', { name: plan.data.patient.name })}
      </Link>
    </div>
  );
}
