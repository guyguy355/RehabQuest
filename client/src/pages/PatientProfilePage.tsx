import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PhysioShell } from '../components/PhysioShell';
import { AISummaryPromptCard } from '../components/physio-profile/AISummaryPromptCard';
import { AssignedExerciseList } from '../components/physio-profile/AssignedExerciseList';
import { CurrentPlanCard } from '../components/physio-profile/CurrentPlanCard';
import { PainReportList } from '../components/physio-profile/PainReportList';
import { PatientMetricCard } from '../components/physio-profile/PatientMetricCard';
import { PatientProfileHeader } from '../components/physio-profile/PatientProfileHeader';
import { getPatientProfileById } from '../services/mockPhysioPatientProfile';

export function PatientProfilePage() {
  const { patientId } = useParams();
  const patient = getPatientProfileById(patientId);

  if (!patient) {
    return (
      <PhysioShell>
        <main className="mx-auto max-w-[760px] px-5 py-7">
          <Link to="/physio/patients" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to patients
          </Link>
          <section className="mt-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-ambient">
            <h1 className="font-display text-3xl font-bold text-on-surface">Patient profile not found</h1>
            <p className="mt-2 text-on-surface-variant">Choose a patient from the roster to view details.</p>
          </section>
        </main>
      </PhysioShell>
    );
  }

  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <PatientProfileHeader patient={patient} />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {patient.metrics.map((metric) => (
            <PatientMetricCard key={metric.title} {...metric} />
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            <CurrentPlanCard plan={patient.plan} />
            <PainReportList reports={patient.painReports} />
          </div>
          <div className="grid content-start gap-6">
            <AssignedExerciseList exercises={patient.assignedExercises} />
            <AISummaryPromptCard patientId={patient.id} />
          </div>
        </div>
      </main>
    </PhysioShell>
  );
}
