import { PhysioShell } from '../components/PhysioShell';
import { ExerciseAssignmentPanel } from '../components/physio/ExerciseAssignmentPanel';
import { LinkedPatientsPanel } from '../components/physio/LinkedPatientsPanel';
import { AttentionPatientCard } from '../components/physio/AttentionPatientCard';
import { PatientActivityCard } from '../components/physio/PatientActivityCard';
import { PhysioMetricCard } from '../components/physio/PhysioMetricCard';
import { QuickActionCard } from '../components/physio/QuickActionCard';
import {
  attentionPatients,
  physioMetrics,
  physioQuickActions,
  recentPatientActivity,
} from '../services/mockPhysioDashboard';

export function PhysioDashboardPage() {
  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-4 py-6 sm:px-5 sm:py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Clinical overview</p>
          <h1 className="mt-2 break-words font-display text-[2rem] font-bold leading-tight text-on-background sm:text-[2.3rem] md:text-[2.9rem]">
            Physiotherapist Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-base font-semibold text-on-surface-variant sm:text-lg">
            Monitor patient progress, adherence, and pain trends.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {physioMetrics.map((metric) => (
              <PhysioMetricCard key={metric.title} {...metric} />
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Activity</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Recent Patient Activity</h2>
            </div>
            <div className="grid gap-3">
              {recentPatientActivity.map((activity) => (
                <PatientActivityCard key={`${activity.message}-${activity.time}`} {...activity} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Attention</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Patients Needing Attention</h2>
            </div>
            <div className="grid gap-4">
              {attentionPatients.map((patient) => (
                <AttentionPatientCard key={patient.id} {...patient} />
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6">
          <LinkedPatientsPanel
            title="Your Linked Patients"
            description="Patients connected to your therapist account."
            compact
          />
        </div>

        <div className="mt-6">
          <ExerciseAssignmentPanel />
        </div>

        <section className="mt-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Quick actions</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Manage care plans</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {physioQuickActions.map((action) => (
              <QuickActionCard key={action.title} {...action} />
            ))}
          </div>
        </section>
      </main>
    </PhysioShell>
  );
}
