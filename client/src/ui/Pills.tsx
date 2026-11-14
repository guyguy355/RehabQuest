import { Flame, Gem } from 'lucide-react';
import type { ReactNode } from 'react';

export function StreakPill({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-coral-100 bg-coral-50 px-3 py-1.5 font-extrabold text-coral-700" title="Planned sessions finished in a row. Rest days never break it.">
      <Flame className="h-5 w-5 fill-coral-400 text-coral-500" aria-hidden="true" />
      <span className="tabular">{days}</span>
      <span className="sr-only sm:not-sr-only sm:text-sm sm:font-bold">session streak</span>
    </span>
  );
}

export function XpPill({ xp }: { xp: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-sun-100 bg-sun-50 px-3 py-1.5 font-extrabold text-sun-700" title="XP earned for planned exercises">
      <Gem className="h-5 w-5 fill-sun-300 text-sun-600" aria-hidden="true" />
      <span className="tabular">{xp}</span>
      <span className="text-sm font-bold">XP</span>
    </span>
  );
}

const CHIP_TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-800',
  coral: 'bg-coral-100 text-coral-700',
  sun: 'bg-sun-100 text-sun-700',
  grape: 'bg-grape-100 text-grape-700',
  sky: 'bg-sky-100 text-sky-700',
  rose: 'bg-rose-100 text-rose-700',
} as const;

export function Chip({ tone = 'neutral', children, icon }: { tone?: keyof typeof CHIP_TONES; children: ReactNode; icon?: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-extrabold ${CHIP_TONES[tone]}`}>{icon}{children}</span>;
}
