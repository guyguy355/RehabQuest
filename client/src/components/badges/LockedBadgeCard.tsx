import { LockKeyhole } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type LockedBadgeCardProps = {
  name: string;
  description: string;
  progress: string;
  icon: LucideIcon;
};

export function LockedBadgeCard({ name, description, progress, icon: Icon }: LockedBadgeCardProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient">
      <div className="flex items-start justify-between gap-4">
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-surface-container-high text-on-surface-variant">
          <Icon className="h-7 w-7 opacity-55" strokeWidth={2.2} />
          <LockKeyhole className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-surface-container-lowest p-0.5 text-primary" />
        </div>
        <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">
          Locked
        </span>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-on-surface">{name}</h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
      <div className="mt-4 rounded-xl bg-surface-container-low px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">Progress</p>
        <p className="mt-1 font-display text-lg font-semibold text-on-surface">{progress}</p>
      </div>
    </article>
  );
}
