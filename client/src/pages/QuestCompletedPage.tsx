import { Flame, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { BadgeEarnedCard } from '../components/quest-completed/BadgeEarnedCard';
import { CelebrationCard } from '../components/quest-completed/CelebrationCard';
import { CompletionStatsCard } from '../components/quest-completed/CompletionStatsCard';

const completionStats = [
  {
    label: 'Updated streak',
    value: '6 days',
    icon: Flame,
    tone: 'amber' as const,
  },
  {
    label: 'Progress gained',
    value: '+8% plan progress',
    icon: TrendingUp,
    tone: 'blue' as const,
  },
  {
    label: 'Today’s completion',
    value: '3 of 3 exercises completed',
    icon: Target,
    tone: 'mint' as const,
  },
];

export function QuestCompletedPage() {
  return (
    <AppShell>
      <main className="mx-auto grid max-w-[920px] gap-6 px-5 py-7">
        <CelebrationCard
          title="Quest Completed!"
          subtitle="Great job staying consistent with your recovery."
          message="Small steps every day build a stronger recovery."
        />

        <CompletionStatsCard stats={completionStats} />

        <BadgeEarnedCard
          name="Consistency Hero"
          description="Completed today’s rehab quest and kept your streak alive."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/patient/dashboard"
            className="flex h-14 items-center justify-center rounded-xl bg-primary px-6 font-display text-lg font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
          >
            Back to Dashboard
          </Link>
          <Link
            to="/patient/progress"
            className="flex h-14 items-center justify-center rounded-xl border border-primary px-6 font-display text-lg font-semibold text-primary transition hover:bg-primary/5"
          >
            View Progress
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
