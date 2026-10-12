type AdherenceStatsCardProps = {
  items: Array<{ label: string; value: string }>;
};

export function AdherenceStatsCard({ items }: AdherenceStatsCardProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Adherence</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Weekly adherence</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-surface-container-low px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{item.label}</p>
            <p className="mt-1 font-display text-xl font-semibold text-on-surface">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
