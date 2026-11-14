import { CalendarDays, Flame, Gem, Moon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { errorMessage } from '../../app/api';
import { usePreferences } from '../../app/preferences';
import type { PatientOverview } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { difficultyLabel, outcomeLabel, relativeDay } from '../../ui/format';
import { Mascot } from '../../ui/Mascot';
import { Chip } from '../../ui/Pills';
import { ErrorState, LoadingBlock } from '../../ui/States';
import type { SessionSummary } from './SessionPage';

const CONFETTI_COLORS = ['#12A58B', '#FFC81A', '#FF8A5B', '#2E8FE0', '#A67CFF'];

export function Confetti() {
  return (
    <div className="calm-hidden pointer-events-none absolute left-1/2 top-16 motion-reduce:hidden" aria-hidden="true">
      {Array.from({ length: 22 }, (_, index) => {
        const angle = (index / 22) * Math.PI * 2;
        const distance = 90 + (index % 4) * 30;
        return (
          <span
            key={index}
            className="absolute h-2.5 w-2 animate-confetti rounded-sm"
            style={
              {
                background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                '--dx': `${Math.cos(angle) * distance}px`,
                '--dy': `${Math.sin(angle) * distance}px`,
                '--rot': `${(index % 2 ? 1 : -1) * (180 + index * 20)}deg`,
                animationDelay: `${(index % 5) * 30}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

const OUTCOME_TONE = { COMPLETED: 'brand', PARTIAL: 'sky', SKIPPED: 'neutral', STOPPED: 'coral' } as const;

export function SessionCompletePage() {
  const { t } = useI18n();
  const { calm } = usePreferences();
  const location = useLocation();
  const summary = (location.state as SessionSummary | null) ?? null;
  const { data, error, loading, reload } = useApi<PatientOverview>('/patient/overview');

  if (loading && !data) return <LoadingBlock label={t('Loading your summary')} rows={3} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const results = summary ? Object.entries(summary.results) : [];
  const stoppedAny = results.some(([, result]) => result.status === 'STOPPED');
  const next = data.nextTrainingDay ?? null;
  const restDaysBefore = next ? data.days.filter((day) => !day.isTrainingDay && day.date > data.today && day.date < next).length : 0;
  const when = next ? relativeDay(next, data.today) : null;
  const nextText = !next
    ? t('That was the last session in this plan. Your therapist will plan the next step with you.')
    : restDaysBefore > 0
      ? t('{count} rest days, then your next session: {when}.', { count: restDaysBefore, when: when! })
      : t('Your next session: {when}.', { when: when! });

  return (
    <div className="mx-auto grid max-w-xl gap-5 text-center">
      <div className="relative flex flex-col items-center">
        {calm ? null : <Confetti />}
        <Mascot mood={stoppedAny ? 'care' : 'cheer'} size={150} className={calm ? '' : 'animate-pop'} />
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight text-brand-700">{t('Session complete!')}</h1>
        <p className="mt-1 max-w-md text-ink-700">
          {stoppedAny
            ? t('You did what felt right and told your therapist about the rest. That is exactly how rehab should go.')
            : t('Every planned exercise for today has a result. Your therapist can see how it went.')}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card border-sun-300 p-3">
          <p className="eyebrow text-sun-700">{t('XP confirmed')}</p>
          <p className="tabular mt-1 flex items-center justify-center gap-1 font-display text-3xl font-bold text-sun-700">
            <Gem className="h-6 w-6" aria-hidden="true" />
            {summary ? summary.xpEarned : '—'}
          </p>
        </div>
        <div className="card border-coral-300 p-3">
          <p className="eyebrow text-coral-700">{t('Streak')}</p>
          <p className="tabular mt-1 flex items-center justify-center gap-1 font-display text-3xl font-bold text-coral-600">
            <Flame className="h-6 w-6" aria-hidden="true" />
            {data.streak}
          </p>
        </div>
        <div className="card border-brand-200 p-3">
          <p className="eyebrow text-brand-700">{t('Plan')}</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-brand-700" dir="ltr">
            {data.stats?.doneSessions ?? 0}/{data.stats?.totalSessions ?? 0}
          </p>
        </div>
      </div>

      {results.length > 0 ? (
        <section className="card grid gap-2 p-4 text-start" aria-labelledby="done-title">
          <h2 id="done-title" className="font-display text-xl font-bold">
            {t('What you recorded')}
          </h2>
          <ul className="grid gap-2">
            {results.map(([taskId, result]) => (
              <li key={taskId} className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink-50 pt-2 first:border-0 first:pt-0">
                <span className="font-bold">{result.title}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Chip tone={OUTCOME_TONE[result.status]}>{outcomeLabel(result.status)}</Chip>
                  <Chip>{result.painLevel === null ? t('Pain not reported') : t('Pain {n}/10', { n: result.painLevel })}</Chip>
                  {result.difficulty ? <Chip tone="sky">{difficultyLabel(result.difficulty)}</Chip> : null}
                  <Chip tone="sun">{result.alreadyRecorded ? t('Saved earlier') : `+${result.xpAwarded} XP`}</Chip>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-500">{t('XP shown here was confirmed by the server, including the session bonus.')}</p>
        </section>
      ) : null}

      {summary?.weeklyGoalMet ? (
        <section className="card grid gap-1 bg-brand-50 p-5" aria-labelledby="weekly-goal-met">
          <h2 id="weekly-goal-met" className="font-display text-2xl font-bold text-brand-700">
            {t('Weekly goal reached')}
          </h2>
          <p className="text-ink-700">{t('{done} of {target} sessions this week. Consistency matters more than intensity.', { done: summary.weeklyGoalMet.done, target: summary.weeklyGoalMet.target })}</p>
        </section>
      ) : null}

      {summary && summary.newBadges.length > 0 ? (
        <section className="card grid gap-3 bg-grape-50 p-5" aria-labelledby="new-badges">
          <h2 id="new-badges" className="font-display text-2xl font-bold text-grape-700">
            {t('New achievement!')}
          </h2>
          {summary.newBadges.map((badge) => (
            <div key={badge.id} className="flex items-center gap-4 text-start">
              <BadgeMedal badge={badge} size={64} animate={!calm} />
              <div>
                <p className="font-extrabold">{badge.name}</p>
                <p className="text-sm text-ink-700">{badge.description}</p>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card flex items-center gap-4 p-5 text-start" aria-labelledby="up-next">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
          {restDaysBefore > 0 ? <Moon className="h-6 w-6" aria-hidden="true" /> : <CalendarDays className="h-6 w-6" aria-hidden="true" />}
        </span>
        <div>
          <h2 id="up-next" className="eyebrow">
            {t('Up next')}
          </h2>
          <p className="font-extrabold">{nextText}</p>
        </div>
      </section>

      <Link to="/patient" className="btn btn-primary btn-lg w-full">
        {t('Back to my path')}
      </Link>
    </div>
  );
}
