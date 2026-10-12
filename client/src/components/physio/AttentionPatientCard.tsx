import { AlertTriangle, HeartPulse, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

type AttentionPatientCardProps = {
  id: string;
  name: string;
  injury: string;
  averagePain: string;
  completionRate: string;
  reason: string;
};

export function AttentionPatientCard({ id, name, injury, averagePain, completionRate, reason }: AttentionPatientCardProps) {
  return (
    <article className="rounded-2xl border border-tertiary-container/30 bg-surface-container-lowest p-5 shadow-ambient">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tertiary-fixed text-on-tertiary-fixed">
          <AlertTriangle className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold text-on-surface">{name}</h3>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">{injury}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-container-low px-4 py-3">
          <HeartPulse className="h-5 w-5 text-primary" strokeWidth={2.1} />
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Avg pain</p>
          <p className="mt-1 font-display text-xl font-semibold text-on-surface">{averagePain}</p>
        </div>
        <div className="rounded-xl bg-surface-container-low px-4 py-3">
          <TrendingUp className="h-5 w-5 text-primary" strokeWidth={2.1} />
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Completion</p>
          <p className="mt-1 font-display text-xl font-semibold text-on-surface">{completionRate}</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-tertiary-fixed px-4 py-3 text-sm font-semibold text-on-tertiary-fixed">
        {reason}
      </p>

      <Link
        to={`/physio/patients/${id}`}
        className="mt-5 flex h-12 items-center justify-center rounded-xl bg-primary px-5 font-display text-base font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
      >
        View Patient
      </Link>
    </article>
  );
}
