import { AppShell } from '../components/AppShell';
import { BadgeCard } from '../components/badges/BadgeCard';
import { BadgeSummaryCard } from '../components/badges/BadgeSummaryCard';
import { LockedBadgeCard } from '../components/badges/LockedBadgeCard';
import { badgeSummary, earnedBadgeDetails, lockedBadgeDetails } from '../services/mockBadges';

export function BadgesPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Badges</p>
          <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background md:text-[2.9rem]">
            Your Recovery Badges
          </h1>
          <p className="mt-2 max-w-2xl text-lg font-semibold text-on-surface-variant">
            Celebrate consistency, progress, and healthy rehab habits.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {badgeSummary.map((summary) => (
              <BadgeSummaryCard key={summary.label} {...summary} />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Earned</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Earned badges</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {earnedBadgeDetails.map((badge) => (
              <BadgeCard key={badge.name} {...badge} />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Locked</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Locked badges</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lockedBadgeDetails.map((badge) => (
              <LockedBadgeCard key={badge.name} {...badge} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
