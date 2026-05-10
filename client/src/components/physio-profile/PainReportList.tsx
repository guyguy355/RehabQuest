import { HeartPulse } from 'lucide-react';
import type { patientProfiles } from '../../services/mockPhysioPatientProfile';

type PatientProfile = (typeof patientProfiles)[number];

type PainReportListProps = {
  reports: PatientProfile['painReports'];
};

export function PainReportList({ reports }: PainReportListProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Pain reports</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Recent Pain Reports</h2>
      </div>
      <div className="grid gap-3">
        {reports.map((report) => (
          <article key={`${report.exercise}-${report.date}-${report.note}`} className="rounded-2xl bg-surface-container-low p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-container/20 text-primary">
                <HeartPulse className="h-5 w-5" strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold text-on-surface">{report.exercise}</p>
                  <span className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold text-primary">
                    Pain {report.pain}
                  </span>
                  <span className="text-sm font-semibold text-on-surface-variant">{report.date}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{report.note}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
