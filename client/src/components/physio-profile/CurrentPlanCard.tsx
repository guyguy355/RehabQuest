import { Link } from 'react-router-dom';
import type { patientProfiles } from '../../services/mockPhysioPatientProfile';

type PatientProfile = (typeof patientProfiles)[number];

type CurrentPlanCardProps = {
  plan: PatientProfile['plan'];
};

export function CurrentPlanCard({ plan }: CurrentPlanCardProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Current plan</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">{plan.title}</h2>
        </div>
        <Link
          to="/physio/plans/new"
          className="flex h-11 items-center justify-center rounded-xl border border-primary px-4 text-sm font-bold text-primary transition hover:bg-primary/5"
        >
          Edit Rehab Plan
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PlanFact label="Start date" value={plan.startDate} />
        <PlanFact label="End date" value={plan.endDate} />
        <PlanFact label="Tasks completed" value={plan.tasksCompleted} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm font-semibold text-on-surface-variant">
          <span>Plan progress</span>
          <span>{plan.progress}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-secondary" style={{ width: `${plan.progress}%` }} />
        </div>
      </div>
    </section>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-on-surface">{value}</p>
    </div>
  );
}
