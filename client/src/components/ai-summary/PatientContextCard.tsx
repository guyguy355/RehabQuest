import { Flame, HeartPulse, ListChecks, TrendingUp } from 'lucide-react';
import type { aiProgressSummary } from '../../services/mockAISummary';

type PatientContext = typeof aiProgressSummary.patient;

type PatientContextCardProps = {
  patient: PatientContext;
};

export function PatientContextCard({ patient }: PatientContextCardProps) {
  const facts = [
    { label: 'Completion rate', value: patient.completionRate, icon: TrendingUp },
    { label: 'Average pain', value: patient.averagePain, icon: HeartPulse },
    { label: 'Current streak', value: patient.currentStreak, icon: Flame },
    { label: 'Missed tasks', value: patient.missedTasksThisWeek, icon: ListChecks },
  ];

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Patient context</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">{patient.name}</h2>
      <p className="mt-2 text-sm font-semibold text-on-surface-variant">{patient.injury}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{patient.currentPlan}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{patient.currentStage}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-xl bg-surface-container-low px-4 py-3">
            <fact.icon className="h-5 w-5 text-primary" strokeWidth={2.1} />
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{fact.label}</p>
            <p className="mt-1 font-display text-lg font-semibold text-on-surface">{fact.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
