import type { LucideIcon } from 'lucide-react';

type BadgeCardProps = {
  name: string;
  description: string;
  status: 'Earned';
  icon: LucideIcon;
};

export function BadgeCard({ name, description, status, icon: Icon }: BadgeCardProps) {
  return (
    <article className="rounded-2xl border border-secondary-container bg-secondary-container/60 p-5 shadow-ambient">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-on-secondary shadow-ambient">
          <Icon className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <span className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold text-on-secondary-container">
          {status}
        </span>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-on-surface">{name}</h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
    </article>
  );
}
