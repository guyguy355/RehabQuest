import { Flame } from 'lucide-react';

type StreakCardProps = {
  days: number;
};

export function StreakCard({ days }: StreakCardProps) {
  return (
    <div className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-tertiary-fixed px-5 py-4 text-on-tertiary-fixed shadow-ambient sm:w-auto">
      <Flame className="h-7 w-7 text-tertiary-container" fill="currentColor" strokeWidth={1.8} />
      <span className="font-display text-2xl font-semibold">{days} Day Streak</span>
    </div>
  );
}
