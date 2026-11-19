import { BookOpenText, Check, Dumbbell, HeartPulse, Minus, Moon, PauseCircle, Play, Quote, SkipForward } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../app/api';
import { useCurrentUser } from '../../app/AuthProvider';
import type { CardAssignment, Day, PatientOverview } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { estimateMinutes, formatLongDay, formatShort, relativeDay } from '../../ui/format';
import { Mascot } from '../../ui/Mascot';
import { StreakPill, XpPill } from '../../ui/Pills';
import { ProgressBar } from '../../ui/Progress';
import { ErrorState, LoadingBlock } from '../../ui/States';
import { WeeklyGoalCard } from './progress/WeeklyGoalCard';

function TodayCard({ overview }: { overview: PatientOverview }) {
  const { t } = useI18n();
  const total = overview.todayTasks.length;
  const done = overview.todayTasks.filter((task) => task.completion).length;
  const next = overview.nextTrainingDay ? relativeDay(overview.nextTrainingDay, overview.today) : null;

  let mood: 'wave' | 'cheer' | 'calm' | 'think' = 'wave';
  let title: string;
  let body: string;
  let action: ReactNode = null;

  switch (overview.status) {
    case 'training':
      if (done === total) {
        mood = 'cheer';
        title = t('Today’s session is done');
        body = next ? t('Nice work. Your next session: {when}.', { when: next }) : t('Nice work. That was the last planned session.');
        action = (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to={`/patient/sessions/${overview.today}`} className="btn btn-primary btn-lg w-full sm:w-auto">
              {t('See what you did')}
            </Link>
            <Link to="/patient/progress" className="btn btn-secondary btn-lg w-full sm:w-auto">
              {t('See your progress')}
            </Link>
          </div>
        );
      } else {
        title = done === 0 ? t('Today’s session is ready') : t('Pick up where you left off');
        body = t('{count} exercises from your therapist', { count: total }) + ' · ' + t('about {minutes} min (estimate)', { minutes: estimateMinutes(overview.todayTasks) });
        action = (
          <Link to="/patient/session" className="btn btn-primary btn-lg w-full sm:w-auto">
            <Play className="h-5 w-5 fill-white rtl:rotate-180" aria-hidden="true" />
            {done === 0 ? t('Start session') : t('Continue ({done} of {total} saved)', { done, total })}
          </Link>
        );
      }
      break;
    case 'rest':
      mood = 'calm';
      title = t('Rest day');
      body = t('Rest is part of your plan. Recovery happens between sessions, and your streak stays safe.') + (next ? ` ${t('Next session: {when}.', { when: next })}` : '');
      break;
    case 'not-started':
      title = t('Your plan starts soon');
      body = t('Your first session is on {date}.', { date: formatLongDay(overview.plan!.startDate) });
      break;
    case 'finished':
    case 'completed':
      mood = 'cheer';
      title = t('You reached the end of this plan');
      body = t('Your therapist will decide the next step with you.');
      break;
    case 'paused':
      mood = 'calm';
      if (!overview.careActive) {
        title = t('Your care relationship has ended');
        body = t('This plan is paused and nobody is following it now. Your history is kept. To continue, share your care code with a therapist.');
        action = (
          <Link to="/patient/profile" className="btn btn-secondary btn-lg w-full sm:w-auto">
            {t('Show my care code')}
          </Link>
        );
        break;
      }
      title = t('Your plan is paused');
      body = t('Your therapist paused this plan. Nothing is expected from you right now, and your streak is safe.');
      action = (
        <Link to="/patient/messages" className="btn btn-secondary btn-lg w-full sm:w-auto">
          {t('Message your therapist')}
        </Link>
      );
      break;
    default:
      mood = 'think';
      title = t('No plan yet');
      body = t('Your therapist adds your exercises. Share your care code with them so they can link your account.');
      action = (
        <Link to="/patient/profile" className="btn btn-primary btn-lg w-full sm:w-auto">
          {t('Show my care code')}
        </Link>
      );
  }

  return (
    <section aria-labelledby="today-title" className="card-raised relative overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Mascot mood={mood} cosmetic={overview.mascotCosmetic} size={104} className="shrink-0 animate-float self-center motion-reduce:animate-none" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{formatLongDay(overview.today)}</p>
          <h1 id="today-title" className="font-display text-3xl font-bold leading-tight">
            {title}
          </h1>
          <p className="mt-1 text-ink-700">{body}</p>
          {overview.returnAfterBreak && overview.status === 'training' && done < total ? (
            <p className="mt-3 rounded-2xl bg-sky-50 p-3 font-semibold text-ink-900">
              {t('Welcome back. Breaks happen, and your progress is still here. Today is a fresh start: even one exercise counts.')}
            </p>
          ) : null}
          {overview.status === 'training' && total > 0 ? (
            <div className="mt-3 max-w-sm">
              <ProgressBar value={done} max={total} label={t('{done} of {total} exercises saved today', { done, total })} />
            </div>
          ) : null}
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}

const WEEK_THEMES = [
  { band: 'bg-brand-600', edge: '#075449' },
  { band: 'bg-sky-600', edge: '#155A96' },
  { band: 'bg-grape-600', edge: '#5B34C2' },
  { band: 'bg-coral-600', edge: '#9C3B14' },
];
const ZIGZAG = [0, 44, 70, 44, 0, -44, -70, -44];

function useStationLabel() {
  const { t } = useI18n();
  return (day: Day, today: string) => {
    const when = relativeDay(day.date, today);
    switch (day.state) {
      case 'done':
        return day.stoppedCount ? t('{when}: session finished (stopped early because of discomfort)', { when }) : t('{when}: session finished', { when });
      case 'today':
        return t("{when}: today's session, {done} of {total} saved", { when, done: day.completedCount + day.partialCount + day.skippedCount + day.stoppedCount, total: day.taskCount });
      case 'missed':
        return t('{when}: not done', { when });
      case 'skipped':
        return t('{when}: skipped', { when });
      default:
        return t('{when}: upcoming session', { when });
    }
  };
}

function Station({ day, today, index }: { day: Day; today: string; index: number }) {
  const { t } = useI18n();
  const stationLabel = useStationLabel();
  const offset = ZIGZAG[index % ZIGZAG.length];
  const label = stationLabel(day, today);
  const isToday = day.date === today;
  // Any day with a saved result opens its record (finished, skipped, or missed with some exercises saved).
  const hasRecords = day.completedCount + day.partialCount + day.skippedCount + day.stoppedCount > 0;
  const base = 'relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full transition-transform';
  const visual =
    day.state === 'done'
      ? { cls: `${base} bg-brand-500 text-white`, edge: '#076B5F', icon: <Check className="h-9 w-9" strokeWidth={3.5} aria-hidden="true" /> }
      : day.state === 'today'
        ? { cls: `${base} bg-sun-400 text-ink-900 hover:scale-105`, edge: '#B88700', icon: <HeartPulse className="h-9 w-9" strokeWidth={2.6} aria-hidden="true" /> }
        : day.state === 'missed'
          ? { cls: `${base} bg-ink-100 text-ink-400`, edge: '#D3DDDD', icon: <Minus className="h-7 w-7" strokeWidth={3} aria-hidden="true" /> }
          : day.state === 'skipped'
            ? { cls: `${base} bg-coral-50 text-coral-600`, edge: '#FFE1D5', icon: <SkipForward className="h-7 w-7" aria-hidden="true" /> }
            : { cls: `${base} bg-ink-100 text-ink-400`, edge: '#D3DDDD', icon: <Dumbbell className="h-7 w-7" aria-hidden="true" /> };

  const circle = (
    <span className={visual.cls} style={{ boxShadow: `0 6px 0 0 ${visual.edge}` }}>
      {day.state === 'today' ? <span className="absolute inset-0 animate-ring rounded-full border-4 border-sun-400 motion-reduce:hidden" aria-hidden="true" /> : null}
      {visual.icon}
    </span>
  );

  return (
    <li className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      {isToday ? (
        <span className="mb-2 animate-float rounded-xl border-2 border-ink-100 bg-white px-3 py-1 text-sm font-extrabold text-brand-700 motion-reduce:animate-none" aria-hidden="true">
          {day.state === 'done' ? t('Done today') : t('Today')}
        </span>
      ) : null}
      {day.state === 'today' ? (
        <Link to="/patient/session" aria-label={label} className="rounded-full">
          {circle}
        </Link>
      ) : hasRecords ? (
        <Link to={`/patient/sessions/${day.date}`} aria-label={t('{label}. See what you did', { label })} className="rounded-full transition-transform hover:scale-105">
          {circle}
        </Link>
      ) : (
        <span role="img" aria-label={label}>
          {circle}
        </span>
      )}
      <span className="mt-2 text-xs font-bold text-ink-500" aria-hidden="true">
        {formatShort(day.date)}
      </span>
    </li>
  );
}

function PlanPath({ overview }: { overview: PatientOverview }) {
  const { t } = useI18n();
  // Start at last week instead of auto-scrolling: scrolling on load would also move the
  // keyboard focus starting point past the header.
  const [showAll, setShowAll] = useState(false);
  const weeks = new Map<number, Day[]>();
  for (const day of overview.days) weeks.set(day.week, [...(weeks.get(day.week) ?? []), day]);
  const lastWeek = Math.max(...weeks.keys());
  const currentWeek = overview.days.find((day) => day.date === overview.today)?.week ?? (overview.today < overview.days[0].date ? 1 : lastWeek);
  const firstVisible = showAll ? 1 : Math.max(1, currentWeek - 1);
  let trainingIndex = 0;

  return (
    <section aria-labelledby="path-title" className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="path-title" className="font-display text-2xl font-bold">
          {t('Your path')}
        </h2>
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink-500">
          <Moon className="h-4 w-4 text-grape-500" aria-hidden="true" /> {t('Rest days are planned and never break your streak')}
        </p>
      </div>

      {firstVisible > 1 ? (
        <button type="button" className="btn btn-secondary btn-sm justify-self-center" onClick={() => setShowAll(true)}>
          {t('Show earlier weeks')}
        </button>
      ) : null}

      {[...weeks.entries()].map(([week, days]) => {
        const theme = WEEK_THEMES[(week - 1) % WEEK_THEMES.length];
        const training = days.filter((day) => day.isTrainingDay);
        const done = training.filter((day) => day.state === 'done').length;
        if (week < firstVisible) {
          trainingIndex += training.length; // keep the zigzag stable when earlier weeks are revealed
          return null;
        }
        return (
          <div key={week} className="grid gap-5">
            <div className={`flex items-center justify-between gap-3 rounded-3xl px-5 py-4 text-white ${theme.band}`} style={{ boxShadow: `0 5px 0 0 ${theme.edge}` }}>
              <div>
                <p className="font-display text-xl font-bold leading-tight">{t('Week {n}', { n: week })}</p>
                <p className="text-sm font-semibold opacity-90">
                  {formatShort(days[0].date)} – {formatShort(days[days.length - 1].date)}
                </p>
              </div>
              <p className="tabular rounded-2xl bg-white/20 px-3 py-1.5 text-sm font-extrabold">
                {training.length ? t('{done}/{total} sessions', { done, total: training.length }) : t('Rest week')}
              </p>
            </div>
            <ol className="flex flex-col items-center gap-3" aria-label={t('Week {n} sessions', { n: week })}>
              {days.map((day) => {
                if (!day.isTrainingDay) {
                  const paused = day.state === 'paused';
                  return (
                    <li key={day.date} className="flex items-center gap-2 text-xs font-bold text-grape-600">
                      <span className={`grid h-7 w-7 place-items-center rounded-full ${paused ? 'bg-ink-100 text-ink-500' : 'bg-grape-50'}`} role="img" aria-label={paused ? t('{when}: paused', { when: relativeDay(day.date, overview.today) }) : t('{when}: rest day', { when: relativeDay(day.date, overview.today) })}>
                        {paused ? <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                      </span>
                    </li>
                  );
                }
                const index = trainingIndex++;
                return <Station key={day.date} day={day} today={overview.today} index={index} />;
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

/** A short prompt when the therapist shared cards that are unread or were updated. */
function CardsToRead() {
  const { t } = useI18n();
  const { data } = useApi<{ cards: CardAssignment[] }>('/patient/education');
  const open = data?.cards.filter((card) => card.state !== 'read').length ?? 0;
  if (open === 0) return null;
  return (
    <Link to="/patient/learn" className="card flex min-h-11 items-center gap-3 p-4 font-extrabold text-brand-700 hover:border-brand-200">
      <BookOpenText className="h-6 w-6 shrink-0" aria-hidden="true" />
      {t('{count} cards from your therapist to read', { count: open })}
    </Link>
  );
}

export function PatientHome() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const { data, error, loading, reload } = useApi<PatientOverview>('/patient/overview');

  if (loading && !data) return <LoadingBlock label={t('Loading your plan')} rows={3} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;
  const plan = data.plan;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl font-bold text-ink-700">{t('Hi, {name}', { name: user.name.split(' ')[0] })}</p>
        <div className="flex gap-2">
          <StreakPill days={data.streak} />
          <XpPill xp={data.xpTotal} />
        </div>
      </div>

      <TodayCard overview={data} />

      {plan ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div className="order-2 lg:order-1">{data.days.length > 0 ? <PlanPath overview={data} /> : null}</div>
          <aside className="order-1 grid gap-4 lg:sticky lg:top-24 lg:order-2">
            {data.weeklyGoal && data.status !== 'paused' && data.status !== 'completed' ? <WeeklyGoalCard goal={data.weeklyGoal} compact /> : null}
            <CardsToRead />
            <section className="card p-5" aria-labelledby="plan-title">
              <p className="eyebrow">{t('Your plan')}</p>
              <h2 id="plan-title" className="font-display text-xl font-bold leading-tight">
                {plan.title}
              </h2>
              <p className="text-sm text-ink-500">
                {plan.condition} · {formatShort(plan.startDate)} – {formatShort(plan.endDate)}
              </p>
              {data.stats ? (
                <div className="mt-3 grid gap-1.5">
                  <ProgressBar value={data.stats.doneSessions} max={data.stats.totalSessions} label={t('Sessions finished in this plan')} tone="sun" size="sm" />
                  <p className="tabular text-sm font-bold text-ink-700">{t('{done} of {total} sessions finished', { done: data.stats.doneSessions, total: data.stats.totalSessions })}</p>
                </div>
              ) : null}
            </section>
            {plan.therapistNotes ? (
              <section className="card bg-sky-50 p-5" aria-label={t('Note from your therapist')}>
                <Quote className="h-5 w-5 text-sky-500 rtl:-scale-x-100" aria-hidden="true" />
                <p className="mt-1 text-ink-900">{plan.therapistNotes}</p>
                <p className="mt-2 text-sm font-bold text-sky-700">— {plan.therapist.name}</p>
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
