import type { LucideIcon } from 'lucide-react';

type PatientMetricCardProps = {
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

export function PatientMetricCard({ title, value, description, icon: Icon, tone = 'blue' }: PatientMetricCardProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient">
      <div className={`grid h-12 w-12 place-items-center rounded-2xl ${toneClasses[tone]}`}>
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <p className="mt-4 text-sm font-bold text-on-surface-variant">{title}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-on-surface">{value}</p>
      <p className="mt-2 text-sm leading-5 text-on-surface-variant">{description}</p>
    </article>
  );
}
