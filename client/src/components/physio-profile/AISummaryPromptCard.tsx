import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

type AISummaryPromptCardProps = {
  patientId: string;
};

export function AISummaryPromptCard({ patientId }: AISummaryPromptCardProps) {
  return (
    <section className="rounded-2xl border border-primary-container/40 bg-primary-container/10 p-6 shadow-ambient">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary">
          <Sparkles className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">AI support</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">AI Progress Summary</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Generate a concise summary of this patient's adherence, pain trends, and suggested discussion points.
          </p>
          <p className="mt-4 rounded-xl bg-surface-container-lowest px-4 py-3 text-xs font-semibold leading-5 text-on-surface-variant">
            AI-generated summaries are for informational support only and do not replace professional medical judgment.
          </p>
          <Link
            to={`/physio/patients/${patientId}/ai-summary`}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 font-display text-base font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
          >
            Generate AI Summary
          </Link>
        </div>
      </div>
    </section>
  );
}
