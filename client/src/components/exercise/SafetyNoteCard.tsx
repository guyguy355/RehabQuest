import { ShieldAlert } from 'lucide-react';

type SafetyNoteCardProps = {
  note: string;
};

export function SafetyNoteCard({ note }: SafetyNoteCardProps) {
  return (
    <section className="rounded-2xl border border-tertiary-container/30 bg-tertiary-fixed p-6 text-on-tertiary-fixed shadow-ambient">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/45 text-tertiary">
          <ShieldAlert className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <h2 className="font-display text-2xl font-semibold">Safety note</h2>
      </div>
      <p className="mt-5 text-base leading-7">{note}</p>
    </section>
  );
}
