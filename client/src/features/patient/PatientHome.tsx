import { CalendarClock, Check, Dumbbell, HeartPulse, Minus, Moon, Play, Quote } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../app/api';
import { useCurrentUser } from '../../app/AuthProvider';
import type { Day, PatientOverview } from '../../app/types';
import { useApi } from '../../app/useApi';
import { formatLongDay, formatShort, relativeDay } from '../../ui/format';
import { Mascot } from '../../ui/Mascot';
import { StreakPill, XpPill } from '../../ui/Pills';
import { ProgressBar } from '../../ui/Progress';
import { ErrorState, LoadingBlock } from '../../ui/States';

export function estimateMinutes(tasks: { sets: number; durationSeconds: number }[]) {
  return Math.max(1, Math.ceil(tasks.reduce((sum, task) => sum + task.sets * task.durationSeconds, 0) / 60));
}

function TodayCard({ overview }: { overview: PatientOverview }) {
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
        title = 'Today’s session is done';
        body = next ? `Nice work. Your next session is ${next.toLowerCase() === 'tomorrow' ? 'tomorrow' : `on ${next}`}.` : 'Nice work. That was the last planned session.';
        action = (
          <Link to="/patient/progress" className="btn btn-secondary btn-lg w-full sm:w-auto">
            See your progress
          </Link>
        );
      } else {
        title = done === 0 ? 'Today’s session is ready' : 'Pick up where you left off';
        body = `${total} exercise${total === 1 ? '' : 's'} from your therapist · about ${estimateMinutes(overview.todayTasks)} min`;
        action = (
          <Link to="/patient/session" className="btn btn-primary btn-lg w-full sm:w-auto">
            <Play className="h-5 w-5 fill-white" aria-hidden="true" />
            {done === 0 ? 'Start session' : `Continue (${done} of ${total} done)`}
          </Link>
        );
      }
      break;
    case 'rest':
      mood = 'calm';
      title = 'Rest day';
      body = `Rest is part of your plan. Recovery happens between sessions, and your streak stays safe.${next ? ` Next session: ${next}.` : ''}`;
      break;
    case 'not-started':
      mood = 'wave';
      title = 'Your plan starts soon';
      body = `Your first session is on ${formatLongDay(overview.plan!.startDate)}.`;
      break;
    case 'finished':
    case 'completed':
      mood = 'cheer';
      title = 'You reached the end of this plan';
      body = 'Your therapist will decide the next step with you.';
      break;
    case 'paused':
      mood = 'think';
      title = 'Your plan is paused';
      body = 'Your therapist paused this plan. Message them if you are unsure what to do next.';
      action = (
        <Link to="/patient/messages" className="btn btn-secondary btn-lg w-full sm:w-auto">
          Message your therapist
        </Link>
      );
      break;
    default:
      mood = 'think';
      title = 'No plan yet';
      body = 'Your therapist adds your exercises. Share your care code with them so they can link your account.';
      action = (
        <Link to="/patient/profile" className="btn btn-primary btn-lg w-full sm:w-auto">
          Show my care code
        </Link>
      );
  }

  return (
    <section aria-labelledby="today-title" className="card-raised relative overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Mascot mood={mood} size={104} className="shrink-0 self-center animate-float motion-reduce:animate-none" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{formatLongDay(overview.today)}</p>
          <h1 id="today-title" className="font-display text-3xl font-bold leading-tight">
            {title}
          </h1>
          <p className="mt-1 text-ink-700">{body}</p>
          {overview.status === 'training' && total > 0 ? (
            <div className="mt-3 max-w-sm">
              <ProgressBar value={done} max={total} label={`${done} of ${total} exercises done today`} />
            </div>
          ) : null}
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}

const WEEK_THEMES = [
  { band: 'bg-brand-600', edge: '#075449', text: 'text-white' },
  { band: 'bg-sky-600', edge: '#155A96', text: 'text-white' },
  { band: 'bg-grape-600', edge: '#5B34C2', text: 'text-white' },
  { band: 'bg-coral-600', edge: '#9C3B14', text: 'text-white' },
];
const ZIGZAG = [0, 44, 70, 44, 0, -44, -70, -44];

function stationLabel(day: Day, today: string) {
  const when = relativeDay(day.date, today);
  switch (day.state) {
    case 'done':
      return `${when}: session finished${day.stoppedCount ? ' (stopped early for symptoms)' : ''}`;
    case 'today':
      return `${when}: today's session, ${day.completedCount + day.stoppedCount} of ${day.taskCount} done`;
    case 'missed':
      return `${when}: not done`;
    default:
      return `${when}: upcoming session`;
  }
}

function Station({ day, today, index, isToday }: { day: Day; today: string; index: number; isToday: boolean }) {
  const offset = ZIGZAG[index % ZIGZAG.length];
  const label = stationLabel(day, today);
  const base = 'relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full transition-transform';
  const visual =
    day.state === 'done'
      ? { cls: `${base} bg-brand-500 text-white`, edge: '#076B5F', icon: <Check className="h-9 w-9" strokeWidth={3.5} aria-hidden="true" /> }
      : day.state === 'today'
        ? { cls: `${base} bg-sun-400 text-ink-900 hover:scale-105`, edge: '#B88700', icon: <HeartPulse className="h-9 w-9" strokeWidth={2.6} aria-hidden="true" /> }
        : day.state === 'missed'
          ? { cls: `${base} bg-ink-100 text-ink-300`, edge: '#D3DDDD', icon: <Minus className="h-7 w-7" strokeWidth={3} aria-hidden="true" /> }
          : { cls: `${base} bg-ink-100 text-ink-300`, edge: '#D3DDDD', icon: <Dumbbell className="h-7 w-7" aria-hidden="true" /> };

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
          {day.state === 'done' ? 'Done today' : 'Today'}
        </span>
      ) : null}
      {day.state === 'today' ? (
        <Link to="/patient/session" aria-label={label} className="rounded-full">
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
  // Start the path at last week instead of auto-scrolling to today: scrolling on load
  // would also move the keyboard focus starting point past the page header.
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
          Your path
        </h2>
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink-500">
          <Moon className="h-4 w-4 text-grape-500" aria-hidden="true" /> Rest days are planned and never break your streak
        </p>
      </div>

      {firstVisible > 1 ? (
        <button type="button" className="btn btn-secondary btn-sm justify-self-center" onClick={() => setShowAll(true)}>
          Show {firstVisible - 1} earlier week{firstVisible - 1 === 1 ? '' : 's'}
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
            <div className={`flex items-center justify-between gap-3 rounded-3xl px-5 py-4 ${theme.band} ${theme.text}`} style={{ boxShadow: `0 5px 0 0 ${theme.edge}` }}>
              <div>
                <p className="font-display text-xl font-bold leading-tight">Week {week}</p>
                <p className="text-sm font-semibold opacity-90">
                  {formatShort(days[0].date)} – {formatShort(days[days.length - 1].date)}
                </p>
              </div>
              <p className="tabular rounded-2xl bg-white/20 px-3 py-1.5 text-sm font-extrabold">
                {done}/{training.length} sessions
              </p>
            </div>
            <ol className="flex flex-col items-center gap-3" aria-label={`Week ${week} sessions`}>
              {days.map((day) => {
                if (!day.isTrainingDay) {
                  return (
                    <li key={day.date} className="flex items-center gap-2 text-xs font-bold text-grape-600">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-grape-50" role="img" aria-label={`${relativeDay(day.date, overview.today)}: rest day`}>
                        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </li>
                  );
                }
                const index = trainingIndex++;
                return <Station key={day.date} day={day} today={overview.today} index={index} isToday={day.date === overview.today} />;
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

export function PatientHome() {
  const user = useCurrentUser();
  const { data, error, loading, reload } = useApi<PatientOverview>('/patient/overview');

  if (loading && !data) return <LoadingBlock label="Loading your plan" rows={3} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const plan = data.plan;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl font-bold text-ink-700">Hi, {user.name.split(' ')[0]}</p>
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
            <section className="card p-5" aria-labelledby="plan-title">
              <p className="eyebrow">Your plan</p>
              <h2 id="plan-title" className="font-display text-xl font-bold leading-tight">
                {plan.title}
              </h2>
              <p className="text-sm text-ink-500">
                {plan.condition} · {formatShort(plan.startDate)} – {formatShort(plan.endDate)}
              </p>
              {data.stats ? (
                <div className="mt-3 grid gap-1.5">
                  <ProgressBar value={data.stats.doneSessions} max={data.stats.totalSessions} label="Sessions finished in this plan" tone="sun" size="sm" />
                  <p className="tabular text-sm font-bold text-ink-700">
                    {data.stats.doneSessions} of {data.stats.totalSessions} sessions finished
                  </p>
                </div>
              ) : null}
            </section>
            {plan.therapistNotes ? (
              <section className="card bg-sky-50 p-5" aria-label="Note from your therapist">
                <Quote className="h-5 w-5 text-sky-500" aria-hidden="true" />
                <p className="mt-1 text-ink-900">{plan.therapistNotes}</p>
                <p className="mt-2 text-sm font-bold text-sky-700">— {plan.therapist.name}</p>
              </section>
            ) : null}
            {data.status === 'not-started' ? (
              <p className="flex items-center gap-2 text-sm font-bold text-ink-500">
                <CalendarClock className="h-4 w-4" aria-hidden="true" /> Starts {relativeDay(plan.startDate, data.today).toLowerCase()} ({formatShort(plan.startDate)})
              </p>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
