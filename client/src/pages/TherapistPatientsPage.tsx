import { Link2, Loader2, RefreshCw, UserPlus, UsersRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { PhysioShell } from '../components/PhysioShell';

const apiBaseUrl = 'http://localhost:3000';

type LinkedPatient = {
  linkId: string;
  id: string;
  name: string;
  email: string;
  linkedAt: string;
};

export function TherapistPatientsPage() {
  const [patientEmail, setPatientEmail] = useState('');
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadPatients() {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/therapist/patients`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not load linked patients');
        return;
      }

      setPatients(data.patients ?? []);
    } catch {
      setMessage('Could not reach the RehabQuest API');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPatients();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/therapist/patients/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ patientEmail }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not link patient');
        return;
      }

      setPatientEmail('');
      setMessage('Patient linked successfully');
      await loadPatients();
    } catch {
      setMessage('Could not reach the RehabQuest API');
    } finally {
      setIsSubmitting(false);
    }
  }

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

          <form onSubmit={handleSubmit} className="mt-7 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Patient email</span>
              <Link2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="email"
                value={patientEmail}
                onChange={(event) => setPatientEmail(event.target.value)}
                placeholder="patient@rehabquest.com"
                className="h-12 w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest pl-12 pr-4 text-on-surface shadow-ambient outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              Link Patient
            </button>
          </form>

          {message ? (
            <p className="mt-4 rounded-xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">
              {message}
            </p>
          ) : null}
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Roster</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">
                {patients.length} linked {patients.length === 1 ? 'patient' : 'patients'}
              </h2>
            </div>
            <button
              type="button"
              onClick={loadPatients}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant/60 px-4 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 font-semibold text-on-surface-variant">Loading linked patients</p>
            </div>
          ) : patients.length > 0 ? (
            <div className="grid gap-4">
              {patients.map((patient) => (
                <article
                  key={patient.linkId}
                  className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl font-semibold text-on-surface">{patient.name}</h3>
                      <p className="mt-1 break-words text-sm font-semibold text-on-surface-variant">
                        {patient.email}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">
                      Linked {new Date(patient.linkedAt).toLocaleDateString()}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
              <UsersRound className="mx-auto h-9 w-9 text-primary" />
              <h3 className="mt-3 font-display text-2xl font-semibold text-on-surface">No linked patients yet</h3>
              <p className="mt-2 text-on-surface-variant">Link a patient by entering their email above.</p>
            </div>
          )}
        </section>
      </main>
    </PhysioShell>
  );
}

function getAuthHeaders(): Record<string, string> {
  const token =
    localStorage.getItem('rehabquestToken') ?? localStorage.getItem('authToken') ?? localStorage.getItem('token');

  return token ? { Authorization: `Bearer ${token}` } : {};
}
