import { Flame, HeartPulse, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PhysioPatient } from '../../services/mockPhysioPatients';
import { PatientStatusBadge } from './PatientStatusBadge';

type PatientListCardProps = {
  patient: PhysioPatient;
};

export function PatientListCard({ patient }: PatientListCardProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient transition hover:shadow-ambient-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-semibold text-on-surface">{patient.name}</h2>
            <PatientStatusBadge status={patient.status} />
          </div>
          <p className="mt-2 text-sm font-semibold text-on-surface-variant">{patient.injury}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{patient.currentPlan}</p>
        </div>

        <Link
          to={`/physio/patients/${patient.id}`}
          className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
        >
          View Profile
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric icon={TrendingUp} label="Completion" value={patient.completionRate} />
        <Metric icon={HeartPulse} label="Avg pain" value={patient.averagePain} />
        <Metric icon={Flame} label="Streak" value={patient.currentStreak} />
      </div>

      <div className="mt-4 rounded-xl bg-surface-container-low px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">Last activity</p>
        <p className="mt-1 text-sm font-semibold text-on-surface">{patient.lastActivity}</p>
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-4 py-3">
      <Icon className="h-5 w-5 text-primary" strokeWidth={2.1} />
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-on-surface">{value}</p>
    </div>
  );
}
