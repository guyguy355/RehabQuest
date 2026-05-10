type DiscussionPointsCardProps = {
  points: string[];
};

export function DiscussionPointsCard({ points }: DiscussionPointsCardProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Discussion points</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Suggested discussion points</h2>
      <ol className="mt-5 grid gap-3">
        {points.map((point, index) => (
          <li key={point} className="flex gap-3 rounded-xl bg-surface-container-low px-4 py-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">
              {index + 1}
            </span>
            <p className="text-sm font-semibold leading-6 text-on-surface">{point}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
