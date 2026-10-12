import { Sparkles } from 'lucide-react';

type GeneratedSummaryCardProps = {
  summary: string;
};

export function GeneratedSummaryCard({ summary }: GeneratedSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-primary-container/40 bg-primary-container/10 p-6 shadow-ambient">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary">
          <Sparkles className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Generated Summary</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Generated Summary</h2>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">{summary}</p>
        </div>
      </div>
    </section>
  );
}
