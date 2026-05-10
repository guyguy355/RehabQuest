import type { LucideIcon } from 'lucide-react';

type CompletionStatsCardProps = {
  stats: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    tone?: 'mint' | 'blue' | 'amber';
  }>;
};

const toneClasses = {
  mint: 'bg-secondary-container text-on-secondary-container',
  blue: 'bg-primary-container/20 text-primary',
  amber: 'bg-tertiary-fixed text-on-tertiary-fixed',
};

export function CompletionStatsCard({ stats }: CompletionStatsCardProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 text-center shadow-ambient"
        >
          <div className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${toneClasses[stat.tone ?? 'blue']}`}>
            <stat.icon className="h-6 w-6" strokeWidth={2.2} />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{stat.label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-on-surface">{stat.value}</p>
        </article>
      ))}
    </section>
  );
}
