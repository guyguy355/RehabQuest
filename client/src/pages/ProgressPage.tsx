import { AppShell } from '../components/AppShell';
import { CompletedExerciseRow } from '../components/progress/CompletedExerciseRow';
import { EarnedBadgeCard } from '../components/progress/EarnedBadgeCard';
import { PainTrendCard } from '../components/progress/PainTrendCard';
import { ProgressMetricCard } from '../components/progress/ProgressMetricCard';
import { completedExercises, earnedBadges, painTrend, progressMetrics } from '../services/mockProgress';
import { Link } from 'react-router-dom';

export function ProgressPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-[1140px] px-4 py-6 sm:px-5 sm:py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Progress</p>
          <h1 className="mt-2 break-words font-display text-[2rem] font-bold leading-tight text-on-background sm:text-[2.3rem] md:text-[2.9rem]">
            Your Recovery Progress
          </h1>
          <p className="mt-2 text-lg font-semibold text-on-surface">Knee Stability Phase 1</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {progressMetrics.map((metric) => (
              <ProgressMetricCard key={metric.title} {...metric} />
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <PainTrendCard points={painTrend} />

          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Exercises</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Completed exercises</h2>
            </div>
            <div className="grid gap-3">
              {completedExercises.map((exercise) => (
                <CompletedExerciseRow key={exercise.name} {...exercise} />
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Badges</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Earned badges</h2>
            </div>
            <Link
              to="/patient/badges"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-primary px-4 text-sm font-bold text-primary transition hover:bg-primary/5 sm:w-auto"
            >
              View all badges
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {earnedBadges.map((badge) => (
              <EarnedBadgeCard key={badge.name} {...badge} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
