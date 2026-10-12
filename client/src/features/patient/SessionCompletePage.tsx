import { CalendarDays, Flame, Gem, Moon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { errorMessage } from '../../app/api';
import type { PatientOverview } from '../../app/types';
import { useApi } from '../../app/useApi';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { relativeDay } from '../../ui/format';
import { Mascot } from '../../ui/Mascot';
import { ErrorState, LoadingBlock } from '../../ui/States';
import type { SessionSummary } from './SessionPage';

const CONFETTI_COLORS = ['#12A58B', '#FFC81A', '#FF8A5B', '#2E8FE0', '#A67CFF'];

function Confetti() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 motion-reduce:hidden" aria-hidden="true">
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

export function SessionCompletePage() {
  const location = useLocation();
  const summary = (location.state as SessionSummary | null) ?? null;
  const { data, error, loading, reload } = useApi<PatientOverview>('/patient/overview');

  if (loading && !data) return <LoadingBlock label="Saving your session" rows={3} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const next = data.nextTrainingDay ?? null;
  const restDaysBefore = next ? data.days.filter((day) => !day.isTrainingDay && day.date > data.today && day.date < next).length : 0;
  const stoppedAny = (summary?.stopped ?? 0) > 0;
  const when = next ? relativeDay(next, data.today) : null;
  const whenText = when === 'Tomorrow' ? 'tomorrow' : `on ${when}`;
  const nextText = !next
    ? 'That was the last session in this plan. Your therapist will plan the next step with you.'
    : restDaysBefore > 0
      ? `${restDaysBefore} rest day${restDaysBefore > 1 ? 's' : ''}, then your next session ${whenText}.`
      : `Your next session is ${whenText}.`;

  return (
    <div className="mx-auto grid max-w-xl gap-5 text-center">
      <div className="relative flex flex-col items-center">
        <Confetti />
        <Mascot mood={stoppedAny ? 'care' : 'cheer'} size={150} className="animate-pop" />
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight text-brand-700">Session complete!</h1>
        <p className="mt-1 max-w-md text-ink-700">
          {stoppedAny
            ? 'You finished what felt right and told your therapist about the rest. That is exactly how rehab should go.'
            : 'Every planned exercise for today is done. Your therapist can see how it went.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card border-sun-300 p-3">
          <p className="eyebrow text-sun-700">XP earned</p>
          <p className="tabular mt-1 flex items-center justify-center gap-1 font-display text-3xl font-bold text-sun-700">
            <Gem className="h-6 w-6" aria-hidden="true" />
            {summary ? summary.xpEarned : '—'}
          </p>
        </div>
        <div className="card border-coral-300 p-3">
          <p className="eyebrow text-coral-700">Streak</p>
          <p className="tabular mt-1 flex items-center justify-center gap-1 font-display text-3xl font-bold text-coral-600">
            <Flame className="h-6 w-6" aria-hidden="true" />
            {data.streak}
          </p>
        </div>
        <div className="card border-brand-200 p-3">
          <p className="eyebrow text-brand-700">Plan</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-brand-700">
            {data.stats?.doneSessions ?? 0}/{data.stats?.totalSessions ?? 0}
          </p>
        </div>
      </div>

      {summary && summary.newBadges.length > 0 ? (
        <section className="card grid gap-3 bg-grape-50 p-5" aria-labelledby="new-badges">
          <h2 id="new-badges" className="font-display text-2xl font-bold text-grape-700">
            New achievement{summary.newBadges.length > 1 ? 's' : ''}!
          </h2>
          {summary.newBadges.map((badge) => (
            <div key={badge.id} className="flex items-center gap-4 text-left">
              <BadgeMedal badge={badge} size={64} animate />
              <div>
                <p className="font-extrabold">{badge.name}</p>
                <p className="text-sm text-ink-700">{badge.description}</p>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card flex items-center gap-4 p-5 text-left" aria-labelledby="up-next">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
          {restDaysBefore > 0 ? <Moon className="h-6 w-6" aria-hidden="true" /> : <CalendarDays className="h-6 w-6" aria-hidden="true" />}
        </span>
        <div>
          <h2 id="up-next" className="eyebrow">
            Up next
          </h2>
          <p className="font-extrabold">
            {nextText}
          </p>
        </div>
      </section>

      <Link to="/patient" className="btn btn-primary btn-lg w-full">
        Back to my path
      </Link>
    </div>
  );
}
