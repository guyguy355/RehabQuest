import { Award } from 'lucide-react';

type BadgeEarnedCardProps = {
  name: string;
  description: string;
};

export function BadgeEarnedCard({ name, description }: BadgeEarnedCardProps) {
  return (
    <section className="rounded-2xl border border-secondary-container bg-secondary-container/60 p-6 shadow-ambient">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-secondary text-on-secondary shadow-ambient">
          <Award className="h-11 w-11" strokeWidth={2.1} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-secondary-container">Badge earned</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-on-surface">{name}</h2>
          <p className="mt-2 text-base leading-7 text-on-surface-variant">{description}</p>
        </div>
      </div>
    </section>
  );
}
