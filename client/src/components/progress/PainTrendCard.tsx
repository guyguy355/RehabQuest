type PainTrendPoint = {
  day: string;
  value: number;
};

type PainTrendCardProps = {
  points: PainTrendPoint[];
};

export function PainTrendCard({ points }: PainTrendCardProps) {
  const maxPain = 10;

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Pain Trend</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Last 7 days</h2>
        </div>
        <span className="text-sm font-semibold text-on-surface-variant">Lower is better</span>
      </div>

      <div className="mt-6 grid gap-3">
        {points.map((point) => (
          <div key={point.day} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_2rem] sm:gap-3">
            <span className="text-sm font-semibold text-on-surface-variant">{point.day}</span>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary-container"
                style={{ width: `${(point.value / maxPain) * 100}%` }}
              />
            </div>
            <span className="text-right font-display text-base font-semibold text-on-surface">{point.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
