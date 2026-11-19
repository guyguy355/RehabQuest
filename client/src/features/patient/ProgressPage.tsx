import { Flame, Gem, HandHeart } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { Analytics, Badge, Completion, GoalsResponse, MeasurementDefinition, Motivation, SessionStats } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { SelectField, TextField } from '../../ui/Field';
import { difficultyLabel, formatDay, formatNumber, formatShort, outcomeLabel } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { ProgressBar } from '../../ui/Progress';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { TabPanel, Tabs, useTabState } from '../../ui/Tabs';
import { useToast } from '../../ui/Toast';
import { GoalCard } from '../shared/GoalCard';
import { WeeklyTrends } from '../shared/WeeklyTrends';
import { AchievementsPanel } from './progress/AchievementsPanel';
import { CheckInCard } from './progress/CheckInCard';
import { WeeklyGoalCard } from './progress/WeeklyGoalCard';

type Progress = {
  today: string;
  streak: number;
  xpTotal: number;
  xpLast7Days: number;
  stats: SessionStats | null;
  plan: { id: string; title: string; startDate: string; endDate: string } | null;
  badges: Badge[];
  history: Completion[];
};

function WeeklyGoalSetting({ value, onSaved }: { value: number | null; onSaved: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  async function change(next: string) {
    setSaving(true);
    try {
      await api('/me/preferences', { method: 'PATCH', body: { weeklySessionGoal: next === 'all' ? null : Number(next) } });
      toast(t('Weekly goal saved'), 'success');
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <SelectField label={t('My weekly goal')} hint={t('Never more than the sessions your therapist planned for that week.')} value={value === null ? 'all' : String(value)} onChange={(event) => void change(event.target.value)} disabled={saving}>
      <option value="all">{t('Every planned session')}</option>
      {[1, 2, 3, 4, 5, 6, 7].map((count) => (
        <option key={count} value={count}>
          {t('{count} sessions a week', { count })}
        </option>
      ))}
    </SelectField>
  );
}

function RecordMeasurement({ definition, today, onSaved }: { definition: MeasurementDefinition; today: string; onSaved: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const id = useId();
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const number = Number(value);
    if (value.trim() === '' || Number.isNaN(number)) {
      setError(t('Enter a number'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`/patient/measurements/${definition.id}`, { method: 'POST', body: { value: number, measuredOn: date, idempotencyKey: crypto.randomUUID() } });
      toast(t('Measurement saved'), 'success');
      setValue('');
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-2 rounded-2xl border-2 border-ink-100 p-3" onSubmit={submit} aria-labelledby={id} noValidate>
      <p id={id} className="font-extrabold">
        {t('Record {name}', { name: definition.name })}
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField label={t('Value ({unit})', { unit: definition.unit })} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} hint={t('Between {min} and {max}', { min: definition.minValue, max: definition.maxValue })} />
        <TextField label={t('Date')} type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
        <button type="submit" className="btn btn-secondary" disabled={saving}>
          {saving ? <Spinner /> : null} {t('Save')}
        </button>
      </div>
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
    </form>
  );
}

function GoalsTab({ motivation, reloadMotivation, onBadges }: { motivation: Motivation; reloadMotivation: () => void; onBadges: (badges: Badge[]) => void }) {
  const { t } = useI18n();
  const goals = useApi<GoalsResponse>('/patient/goals');
  const recordable = goals.data?.measurements.filter((definition) => definition.patientCanRecord && !definition.archived) ?? [];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <WeeklyGoalCard goal={motivation.weeklyGoal} chosen={motivation.preference.weeklySessionGoal} />
        <div className="card p-5">
          <WeeklyGoalSetting value={motivation.preference.weeklySessionGoal} onSaved={reloadMotivation} />
        </div>
      </div>

      <CheckInCard onBadges={onBadges} />

      <section id="goals" aria-labelledby="goals-title" className="grid gap-3">
        <h2 id="goals-title" className="font-display text-2xl font-bold">
          {t('Goals with your therapist')}
        </h2>
        {goals.loading && !goals.data ? <LoadingBlock rows={2} label={t('Loading goals')} /> : null}
        {goals.error && !goals.data ? <ErrorState message={errorMessage(goals.error)} onRetry={goals.reload} /> : null}
        {goals.data && goals.data.goals.length === 0 ? <EmptyState title={t('No goals yet')} mood="calm">{t('Your therapist can add goals you agree on together. They will appear here.')}</EmptyState> : null}
        <div className="grid gap-3">
          {goals.data?.goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
        </div>
        {recordable.length > 0 ? (
          <div className="card grid gap-3 p-5">
            <h3 className="font-display text-lg font-bold">{t('Measurements you can record')}</h3>
            {recordable.map((definition) => (
              <RecordMeasurement key={definition.id} definition={definition} today={motivation.today} onSaved={goals.reload} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TrendsTab() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi<Analytics>('/patient/analytics?weeks=12');
  if (loading && !data) return <LoadingBlock rows={3} label={t('Loading trends')} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;
  const { summary } = data;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="eyebrow">{t('Due sessions done, 12 weeks')}</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-brand-700">{summary.adherencePercent === null ? t('Not applicable') : `${summary.adherencePercent}%`}</p>
          <p className="text-xs font-bold text-ink-500">{t('{done} of {due} due sessions', { done: summary.done, due: summary.due })}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t('Average reported pain')}</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-coral-600">{summary.painAverage === null ? t('No reports') : formatNumber(summary.painAverage, 1)}</p>
          <p className="text-xs font-bold text-ink-500">{t('{count} reports', { count: summary.painReports })}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t('Rest or paused weeks')}</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-ink-700">{summary.notApplicableWeeks}</p>
          <p className="text-xs font-bold text-ink-500">{t('not counted')}</p>
        </div>
      </div>
      <WeeklyTrends rows={data.weeks} />
    </div>
  );
}

function ActivityTab({ history }: { history: Completion[] }) {
  const { t } = useI18n();
  const byDate = new Map<string, Completion[]>();
  for (const item of history) byDate.set(item.sessionDate, [...(byDate.get(item.sessionDate) ?? []), item]);
  if (byDate.size === 0) return <EmptyState title={t('No activity yet')}>{t('Finished exercises and how they felt will appear here.')}</EmptyState>;
  return (
    <ul className="grid gap-3">
      {[...byDate.entries()].map(([date, items]) => (
        <li key={date} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">{formatDay(date)}</p>
            <Link to={`/patient/sessions/${date}`} className="text-sm font-extrabold text-brand-700 underline-offset-2 hover:underline" aria-label={t('See the session on {date}', { date: formatDay(date) })}>
              {t('See session')}
            </Link>
          </div>
          <ul className="mt-2 grid gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{item.exercise?.title}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {item.status === 'STOPPED' ? (
                    <Chip tone="coral" icon={<HandHeart className="h-3.5 w-3.5" aria-hidden="true" />}>
                      {t('Stopped safely')}
                    </Chip>
                  ) : (
                    <Chip tone={item.status === 'SKIPPED' ? 'neutral' : 'brand'}>{outcomeLabel(item.status)}</Chip>
                  )}
                  {item.xpAwarded > 0 ? <Chip tone="sun">+{item.xpAwarded} XP</Chip> : null}
                  {item.painLevel !== null ? <Chip tone="neutral">{t('Pain {level}/10', { level: item.painLevel })}</Chip> : <Chip tone="neutral">{t('No pain score')}</Chip>}
                  {item.difficulty ? <Chip tone="sky">{difficultyLabel(item.difficulty)}</Chip> : null}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function ProgressPage() {
  const { t } = useI18n();
  const toast = useToast();
  const progress = useApi<Progress>('/patient/progress?days=30');
  const motivation = useApi<Motivation>('/patient/motivation');
  const tabs = [
    { id: 'goals', label: t('Goals & check-in') },
    { id: 'trends', label: t('Trends') },
    { id: 'achievements', label: t('Achievements') },
    { id: 'activity', label: t('Activity') },
  ];
  const [tab, setTab] = useTabState(tabs);

  if ((progress.loading && !progress.data) || (motivation.loading && !motivation.data)) return <LoadingBlock label={t('Loading your progress')} rows={4} />;
  const failed = progress.error ?? motivation.error;
  if (failed && (!progress.data || !motivation.data)) return <ErrorState message={errorMessage(failed)} onRetry={() => void Promise.all([progress.reload(), motivation.reload()])} />;
  if (!progress.data || !motivation.data) return null;
  const data = progress.data;

  function celebrate(badges: Badge[]) {
    toast(t('New achievement: {name}', { name: badges.map((badge) => badge.name).join(', ') }), 'success');
    void motivation.reload();
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Progress')} title={t('Your progress')}>
        {t('XP and achievements come only from the exercises your therapist planned.')}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4">
          <p className="eyebrow">{t('Total XP')}</p>
          <p className="tabular mt-1 flex items-center gap-1.5 font-display text-3xl font-bold text-sun-700">
            <Gem className="h-6 w-6" aria-hidden="true" /> {data.xpTotal}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t('XP, last 7 days')}</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-sun-700">{data.xpLast7Days}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t('Session streak')}</p>
          <p className="tabular mt-1 flex items-center gap-1.5 font-display text-3xl font-bold text-coral-600">
            <Flame className="h-6 w-6" aria-hidden="true" /> {data.streak}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t('Sessions finished')}</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-brand-700">{data.stats ? `${data.stats.doneSessions}/${data.stats.sessionsToDate}` : '—'}</p>
          <p className="text-xs font-bold text-ink-500">{t('planned so far, including today')}</p>
        </div>
      </div>

      {data.plan && data.stats ? (
        <section className="card grid gap-2 p-5" aria-labelledby="plan-progress">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="plan-progress" className="font-display text-xl font-bold">
              {data.plan.title}
            </h2>
            <span className="text-sm font-bold text-ink-500">
              {formatShort(data.plan.startDate)} – {formatShort(data.plan.endDate)}
            </span>
          </div>
          <ProgressBar value={data.stats.doneSessions} max={data.stats.totalSessions} label={t('Plan progress')} tone="brand" size="lg" />
          <p className="tabular text-sm font-bold text-ink-700">{t('{done} of {total} planned sessions finished · {rest} rest days planned', { done: data.stats.doneSessions, total: data.stats.totalSessions, rest: data.stats.restDays })}</p>
        </section>
      ) : null}

      <Tabs tabs={tabs} current={tab} onSelect={setTab} label={t('Progress sections')} />
      <TabPanel id="goals" current={tab}>
        <GoalsTab motivation={motivation.data} reloadMotivation={() => void motivation.reload()} onBadges={celebrate} />
      </TabPanel>
      <TabPanel id="trends" current={tab}>
        <TrendsTab />
      </TabPanel>
      <TabPanel id="achievements" current={tab}>
        <AchievementsPanel motivation={motivation.data} onChanged={() => void motivation.reload()} />
      </TabPanel>
      <TabPanel id="activity" current={tab}>
        <ActivityTab history={data.history} />
      </TabPanel>
    </div>
  );
}
