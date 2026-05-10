import type { LucideIcon } from 'lucide-react';

type EarnedBadgeCardProps = {
  name: string;
  icon: LucideIcon;
};

export function EarnedBadgeCard({ name, icon: Icon }: EarnedBadgeCardProps) {
  return (
    <article className="rounded-2xl border border-secondary-container bg-secondary-container/60 p-4 shadow-ambient">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-on-secondary">
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold leading-6 text-on-surface">{name}</h3>
    </article>
  );
}
