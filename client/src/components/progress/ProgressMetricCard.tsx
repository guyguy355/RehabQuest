import type { LucideIcon } from 'lucide-react';

type ProgressMetricCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: 'blue' | 'mint' | 'amber';
};

const toneClasses = {
  blue: 'bg-primary-container/20 text-primary',
  mint: 'bg-secondary-container text-on-secondary-container',
  amber: 'bg-tertiary-fixed text-on-tertiary-fixed',
};

export function ProgressMetricCard({ title, value, description, icon: Icon, tone = 'blue' }: ProgressMetricCardProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
      <div className={`grid h-12 w-12 place-items-center rounded-2xl ${toneClasses[tone]}`}>
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <p className="mt-4 text-sm font-bold text-on-surface-variant">{title}</p>
      <p className="mt-1 break-words font-display text-2xl font-semibold text-on-surface sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-5 text-on-surface-variant">{description}</p>
    </article>
  );
}
