import { ClipboardList } from 'lucide-react';

type InstructionCardProps = {
  instructions: string;
};

export function InstructionCard({ instructions }: InstructionCardProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-container-low text-primary">
          <ClipboardList className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <h2 className="font-display text-2xl font-semibold text-on-surface">Instructions</h2>
      </div>
      <p className="mt-5 text-base leading-7 text-on-surface-variant">{instructions}</p>
    </section>
  );
}
