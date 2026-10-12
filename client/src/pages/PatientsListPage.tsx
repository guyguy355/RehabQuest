import { useMemo, useState } from 'react';
import { PhysioShell } from '../components/PhysioShell';
import { PatientListCard } from '../components/physio/PatientListCard';
import { PatientSearchBar } from '../components/physio/PatientSearchBar';
import { PatientStatusFilter } from '../components/physio/PatientStatusFilter';
import { patientStatusFilters, physioPatients } from '../services/mockPhysioPatients';
import type { PatientStatus } from '../services/mockPhysioPatients';

export function PatientsListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<PatientStatus>('All');

  const filteredPatients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return physioPatients.filter((patient) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        patient.name.toLowerCase().includes(normalizedSearch) ||
        patient.injury.toLowerCase().includes(normalizedSearch);
      const matchesStatus = activeFilter === 'All' || patient.status === activeFilter;

      return matchesSearch && matchesStatus;
    });
  }, [activeFilter, searchTerm]);

  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Patient roster</p>
          <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background md:text-[2.9rem]">
            Patients
          </h1>
          <p className="mt-2 max-w-2xl text-lg font-semibold text-on-surface-variant">
            Track rehabilitation progress, adherence, and pain reports.
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <PatientSearchBar value={searchTerm} onChange={setSearchTerm} />
            <PatientStatusFilter
              filters={patientStatusFilters}
              activeFilter={activeFilter}
              onChange={setActiveFilter}
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Results</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">
                {filteredPatients.length} active {filteredPatients.length === 1 ? 'patient' : 'patients'}
              </h2>
            </div>
          </div>

          {filteredPatients.length > 0 ? (
            <div className="grid gap-4">
              {filteredPatients.map((patient) => (
                <PatientListCard key={patient.id} patient={patient} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
              <h3 className="font-display text-2xl font-semibold text-on-surface">No patients found</h3>
              <p className="mt-2 text-on-surface-variant">Try another search term or status filter.</p>
            </div>
          )}
        </section>
      </main>
    </PhysioShell>
  );
}
