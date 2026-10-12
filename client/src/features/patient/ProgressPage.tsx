import { Flame, Gem, HandHeart } from 'lucide-react';
import { errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { Badge, Completion, SessionStats } from '../../app/types';
import { useApi } from '../../app/useApi';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { DIFFICULTY_LABEL, formatDay, formatShort } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { ProgressBar } from '../../ui/Progress';
import { EmptyState, ErrorState, LoadingBlock } from '../../ui/States';
import { PainChart } from './PainChart';

type Progress = {
  today: string;
  streak: number;
  xpTotal: number;
  xpLast7Days: number;
  stats: SessionStats | null;
  plan: { id: string; title: string; startDate: string; endDate: string } | null;
  badges: Badge[];
  history: Completion[];
  dailyPain: { date: string; averagePain: number; completed: number; stopped: number }[];
};

export function ProgressPage() {
  const { data, error, loading, reload } = useApi<Progress>('/patient/progress?days=30');

  if (loading && !data) return <LoadingBlock label="Loading your progress" rows={4} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const byDate = new Map<string, Completion[]>();
  for (const item of data.history) byDate.set(item.sessionDate, [...(byDate.get(item.sessionDate) ?? []), item]);
  const earned = data.badges.filter((badge) => badge.earnedAt).length;

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Last 30 days" title="Your progress">
        XP and achievements come only from the exercises your therapist planned.
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4">
          <p className="eyebrow">Total XP</p>
          <p className="tabular mt-1 flex items-center gap-1.5 font-display text-3xl font-bold text-sun-700">
            <Gem className="h-6 w-6" aria-hidden="true" /> {data.xpTotal}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">XP, last 7 days</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-sun-700">{data.xpLast7Days}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Session streak</p>
          <p className="tabular mt-1 flex items-center gap-1.5 font-display text-3xl font-bold text-coral-600">
            <Flame className="h-6 w-6" aria-hidden="true" /> {data.streak}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Sessions finished</p>
          <p className="tabular mt-1 font-display text-3xl font-bold text-brand-700">
            {data.stats ? `${data.stats.doneSessions}/${data.stats.sessionsToDate}` : '—'}
          </p>
          <p className="text-xs font-bold text-ink-500">planned so far</p>
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
          <ProgressBar value={data.stats.doneSessions} max={data.stats.totalSessions} label="Plan progress" tone="brand" size="lg" />
          <p className="tabular text-sm font-bold text-ink-700">
            {data.stats.doneSessions} of {data.stats.totalSessions} planned sessions finished · {data.stats.restDays} rest days planned
          </p>
        </section>
      ) : null}

      <section aria-labelledby="achievements" className="grid gap-3">
        <h2 id="achievements" className="font-display text-2xl font-bold">
          Achievements <span className="tabular text-lg text-ink-500">({earned}/{data.badges.length})</span>
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.badges.map((badge) => (
            <li key={badge.id} className={`card flex items-center gap-4 p-4 ${badge.earnedAt ? '' : 'bg-ink-50'}`}>
              <BadgeMedal badge={badge} size={60} />
              <div className="min-w-0">
                <p className={`font-extrabold ${badge.earnedAt ? 'text-ink-900' : 'text-ink-500'}`}>{badge.name}</p>
                <p className="text-sm text-ink-500">{badge.description}</p>
                <p className="mt-1 text-xs font-bold text-ink-500">{badge.earnedAt ? `Earned ${new Date(badge.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Not yet'}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {data.dailyPain.length > 0 ? (
        <section className="card p-5">
          <PainChart points={data.dailyPain} />
        </section>
      ) : null}

      <section aria-labelledby="history" className="grid gap-3">
        <h2 id="history" className="font-display text-2xl font-bold">
          Activity
        </h2>
        {byDate.size === 0 ? (
          <EmptyState title="No activity yet">Finished exercises and how they felt will appear here.</EmptyState>
        ) : (
          <ul className="grid gap-3">
            {[...byDate.entries()].map(([date, items]) => (
              <li key={date} className="card p-4">
                <p className="eyebrow">{formatDay(date)}</p>
                <ul className="mt-2 grid gap-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">{item.exercise?.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {item.status === 'STOPPED' ? (
                          <Chip tone="coral" icon={<HandHeart className="h-3.5 w-3.5" aria-hidden="true" />}>
                            Stopped safely
                          </Chip>
                        ) : (
                          <Chip tone="sun">+{item.xpAwarded} XP</Chip>
                        )}
                        <Chip tone="neutral">Pain {item.painLevel}/10</Chip>
                        {item.difficulty ? <Chip tone="sky">{DIFFICULTY_LABEL[item.difficulty]}</Chip> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
