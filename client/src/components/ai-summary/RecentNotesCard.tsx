type RecentNotesCardProps = {
  notes: Array<{ exercise: string; note: string }>;
};

export function RecentNotesCard({ notes }: RecentNotesCardProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Recent notes</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Recent patient notes</h2>
      <div className="mt-5 grid gap-3">
        {notes.map((note) => (
          <article key={`${note.exercise}-${note.note}`} className="rounded-xl bg-surface-container-low px-4 py-3">
            <p className="font-display text-lg font-semibold text-on-surface">{note.exercise}</p>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">&ldquo;{note.note}&rdquo;</p>
          </article>
        ))}
      </div>
    </section>
  );
}
