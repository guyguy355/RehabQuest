import type { LucideIcon } from 'lucide-react';

type ProgressCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'plain' | 'blue';
};

export function ProgressCard({ icon: Icon, label, value, tone = 'plain' }: ProgressCardProps) {
  return (
    <section
      className={[
        'flex min-h-36 flex-col items-center justify-center rounded-2xl p-6 text-center shadow-ambient',
        tone === 'blue'
          ? 'border border-primary-container/40 bg-primary-container/20'
          : 'bg-surface-container-low',
      ].join(' ')}
    >
      <Icon className="mb-3 h-8 w-8 text-primary" strokeWidth={2.1} />
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">{label}</span>
      <p className="mt-2 font-display text-3xl font-semibold text-on-surface">{value}</p>
    </section>
  );
}
