import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { Completion, Day, Plan, PlanStatus, SessionStats } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { formatShort } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, LoadingBlock } from '../../ui/States';
import { Tabs, TabPanel, useTabState } from '../../ui/Tabs';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { type MessageContext, MessageThread } from '../shared/MessageThread';
import { EducationTab } from './patient/EducationTab';
import { GoalsTab } from './patient/GoalsTab';
import { PlanTab } from './patient/PlanTab';
import { RecordsTable } from './patient/RecordsTable';
import { SessionCalendar } from './patient/SessionCalendar';
import { TrendsTab } from './patient/TrendsTab';
import { SummaryPanel } from './SummaryPanel';

export type PatientDetail = {
  patient: { id: string; name: string; email: string; timezone: string; linkedAt: string };
  snapshot: {
    today: string;
    plan: { id: string; title: string; status: PlanStatus; revision: number; startDate: string; endDate: string; versionNumber: number | null } | null;
    draftId: string | null;
    openReviews: number;
    lastActivityAt: string | null;
    streak: number;
    last7Days: SessionStats | null;
    stats: SessionStats | null;
    todayState: Day['state'] | null;
    days: Day[];
  };
  currentPlan: Plan | null;
  plans: { id: string; title: string; status: PlanStatus; startDate: string; endDate: string; publishedVersions: number }[];
  completions: Completion[];
};

function StatTile({ label, value, sub, tone = 'brand' }: { label: string; value: string | number; sub?: string; tone?: 'brand' | 'coral' | 'rose' | 'ink' }) {
  const color = { brand: 'text-brand-700', coral: 'text-coral-600', rose: 'text-rose-700', ink: 'text-ink-500' }[tone];
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className={`tabular font-display text-3xl font-bold ${color}`}>{value}</p>
      {sub ? <p className="text-xs font-bold text-ink-500">{sub}</p> : null}
    </div>
  );
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi<PatientDetail>(`/therapist/patients/${patientId}`);
  const [params] = useSearchParams();
  const [highlight, setHighlight] = useState<string | null>(params.get('record'));
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const contextParam = params.get('context');
  const messageContext: MessageContext | null = contextParam
    ? { type: contextParam.split(':')[0] as MessageContext['type'], id: contextParam.split(':')[1], label: params.get('label') }
    : null;

  useEffect(() => {
    const record = params.get('record');
    if (!record || !data) return;
    setHighlight(record);
    window.setTimeout(() => document.getElementById(`record-${record}`)?.scrollIntoView({ block: 'center' }), 50);
  }, [params, data]);

  async function endCare() {
    setEnding(true);
    try {
      await api(`/therapist/patients/${patientId}/end-care`, { method: 'POST' });
      toast(t('Care relationship ended'));
      navigate('/therapist', { replace: true });
    } catch (caught) {
      toast(errorMessage(caught), 'error');
      setEnding(false);
    }
  }
  const tabs = [
    { id: 'overview', label: t('Overview') },
    { id: 'plan', label: t('Plan') },
    { id: 'goals', label: t('Goals') },
    { id: 'trends', label: t('Trends') },
    { id: 'records', label: t('Records'), badge: data?.snapshot.openReviews ? <Chip tone="rose">{data.snapshot.openReviews}</Chip> : undefined },
    { id: 'summary', label: t('Summary draft') },
    { id: 'messages', label: t('Messages') },
    { id: 'education', label: t('Education') },
  ];
  const [tab, setTab] = useTabState(tabs);

  if (loading && !data) return <LoadingBlock rows={4} label={t('Loading patient')} />;
  if (error && !data) {
    return error.status === 404 ? (
      <EmptyState title={t('Patient not found')} action={<Link to="/therapist" className="btn btn-primary">{t('Back to patients')}</Link>}>
        {t('This patient is not in your list, or the link is wrong.')}
      </EmptyState>
    ) : (
      <ErrorState message={errorMessage(error)} onRetry={reload} />
    );
  }
  if (!data) return null;

  const { patient, snapshot } = data;

  function selectRecord(completionId: string) {
    setHighlight(completionId);
    setTab('records');
    window.setTimeout(() => document.getElementById(`record-${completionId}`)?.scrollIntoView({ block: 'center' }), 50);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Patient')}
        title={patient.name}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEndOpen(true)}>
            {t('End care relationship')}
          </button>
        }
      >
        <bdi>{patient.email}</bdi> · {t('linked {date}', { date: formatShort(patient.linkedAt.slice(0, 10)) })} · <bdi>{patient.timezone}</bdi>
      </PageHeader>

      <Tabs tabs={tabs} current={tab} onSelect={setTab} label={t('Patient sections')} />

      <TabPanel id="overview" current={tab}>
        {snapshot.stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={t('Finished')} value={`${snapshot.stats.doneSessions}/${snapshot.stats.sessionsToDate}`} sub={t('sessions planned so far')} />
            <StatTile label={t('Last 7 days')} value={snapshot.last7Days ? `${snapshot.last7Days.doneSessions}/${snapshot.last7Days.sessionsToDate}` : '—'} />
            <StatTile label={t('Streak')} value={snapshot.streak} tone="coral" />
            <StatTile label={t('Open reports')} value={snapshot.openReviews} tone={snapshot.openReviews ? 'rose' : 'ink'} />
          </div>
        ) : (
          <p className="rounded-2xl bg-ink-50 p-4 text-ink-500">{t('No published plan yet, so there is no progress to show.')}</p>
        )}
        {snapshot.days.length > 0 ? <SessionCalendar days={snapshot.days} /> : null}
      </TabPanel>

      <TabPanel id="plan" current={tab}>
        <PlanTab plan={data.currentPlan} draftId={snapshot.draftId} planId={snapshot.plan?.id ?? null} planStatus={snapshot.plan?.status ?? null} patientId={patient.id} onChanged={reload} />
        {data.plans.length > 1 ? (
          <section className="card grid gap-2 p-5" aria-labelledby="history-title">
            <h2 id="history-title" className="font-display text-xl font-bold">
              {t('Other plans')}
            </h2>
            <ul className="grid gap-1">
              {data.plans
                .filter((plan) => plan.id !== snapshot.plan?.id)
                .map((plan) => (
                  <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link to={`/therapist/plans/${plan.id}/versions`} className="font-bold text-brand-700 underline-offset-4 hover:underline">
                      {plan.title}
                    </Link>
                    <span className="text-ink-500">
                      {formatShort(plan.startDate)} – {formatShort(plan.endDate)} · {t('{count} versions', { count: plan.publishedVersions })}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
      </TabPanel>

      <TabPanel id="goals" current={tab}>
        <GoalsTab patientId={patient.id} today={snapshot.today} />
      </TabPanel>

      <TabPanel id="trends" current={tab}>
        <TrendsTab patientId={patient.id} />
      </TabPanel>

      <TabPanel id="education" current={tab}>
        <EducationTab patientId={patient.id} tasks={data.currentPlan?.tasks ?? []} />
      </TabPanel>

      <TabPanel id="records" current={tab}>
        <RecordsTable completions={data.completions} highlight={highlight} patientId={patient.id} />
      </TabPanel>

      <TabPanel id="summary" current={tab}>
        <SummaryPanel patientId={patient.id} onSelectRecord={selectRecord} />
      </TabPanel>

      <TabPanel id="messages" current={tab}>
        <section className="card grid gap-3 p-5" aria-label={t('Messages')}>
          <MessageThread otherUserId={patient.id} otherName={patient.name.split(' ')[0]} initialContext={messageContext} />
        </section>
      </TabPanel>

      <Dialog open={endOpen} onClose={() => setEndOpen(false)} title={t('End the care relationship?')}>
        <p className="text-ink-700">
          {t('You will immediately lose access to {name}’s records and conversation. Your active plan for them is paused and open review items are closed. To work together again, the patient must share their care code.', { name: patient.name })}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setEndOpen(false)}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-soft-danger" onClick={endCare} disabled={ending}>
            {t('End care relationship')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
