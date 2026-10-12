import { Medal, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

type QuestCardProps = {
  plan: string;
  quest: string;
  progressPercent: number;
  completedExercises: number;
  totalExercises: number;
};

export function QuestCard({ plan, quest, progressPercent, completedExercises, totalExercises }: QuestCardProps) {
  const completion = Math.round((completedExercises / totalExercises) * 100);

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:col-span-8 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full bg-secondary-container px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-on-secondary-container">
            Active Quest
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-on-surface">{plan}</h2>
          <p className="mt-2 text-base text-on-surface-variant">{quest}</p>
        </div>
        <Medal className="h-11 w-11 shrink-0 text-primary" strokeWidth={2.1} />
      </div>

      <div className="mt-7 space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm font-semibold tracking-wide text-on-surface-variant">
          <span>Daily Completion</span>
          <span>
            {completedExercises}/{totalExercises} Exercises
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-surface-container-low px-4 py-3">
        <div className="flex items-center justify-between text-sm font-semibold text-on-surface-variant">
          <span>Plan Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-primary-container" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          to="/patient/quest"
          className="flex h-14 items-center justify-center gap-3 rounded-xl bg-primary px-6 font-display text-lg font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
        >
          Start Today’s Rehab
          <Play className="h-5 w-5" fill="currentColor" />
        </Link>
        <Link
          to="/patient/progress"
          className="flex h-14 items-center justify-center rounded-xl border border-primary px-6 font-display text-lg font-semibold text-primary transition hover:bg-primary/5"
        >
          View Plan
        </Link>
      </div>
    </section>
  );
}
