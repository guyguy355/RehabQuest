import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PatientStatusBadge } from '../physio/PatientStatusBadge';
import type { patientProfiles } from '../../services/mockPhysioPatientProfile';

type PatientProfile = (typeof patientProfiles)[number];

type PatientProfileHeaderProps = {
  patient: PatientProfile;
};

export function PatientProfileHeader({ patient }: PatientProfileHeaderProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
      <Link
        to="/physio/patients"
        className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary transition hover:text-on-primary-container"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to patients
      </Link>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Patient profile</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[2.3rem] font-bold leading-tight text-on-background md:text-[2.9rem]">
              {patient.name}
            </h1>
            <PatientStatusBadge status={patient.status} />
          </div>
          <p className="mt-2 text-lg font-semibold text-on-surface">{patient.injury}</p>
          <p className="mt-1 text-base text-on-surface-variant">{patient.currentStage}</p>
          <p className="mt-1 text-base text-on-surface-variant">{patient.currentPlan}</p>
        </div>

        <div className="rounded-2xl bg-surface-container-low px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">Last activity</p>
          <p className="mt-1 max-w-xs text-sm font-semibold text-on-surface">{patient.lastActivity}</p>
        </div>
      </div>
    </section>
  );
}
