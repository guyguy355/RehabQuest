import { PhysioShell } from '../components/PhysioShell';
import { LinkedPatientsPanel } from '../components/physio/LinkedPatientsPanel';

export function TherapistPatientsPage() {
  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Patient linking</p>
          <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background md:text-[2.9rem]">
            Linked Patients
          </h1>
          <p className="mt-2 max-w-2xl text-lg font-semibold text-on-surface-variant">
            Add patients to your therapist roster by using the email address on their RehabQuest account.
          </p>

        </section>

        <div className="mt-6">
          <LinkedPatientsPanel />
        </div>
      </main>
    </PhysioShell>
  );
}
