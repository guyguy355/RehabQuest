import { Link2, Loader2, RefreshCw, UserPlus, UsersRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, getAuthHeaders } from '../../auth/session';
import { apiBaseUrl } from '../../config/api';

type LinkedPatient = {
  linkId: string;
  id: string;
  name?: string | null;
  email: string;
  linkedAt?: string;
  createdAt?: string;
};

type LinkedPatientsPanelProps = {
  title?: string;
  description?: string;
  compact?: boolean;
};

export function LinkedPatientsPanel({
  title = 'Linked Patients',
  description = 'Add patients to your therapist roster by using the email address on their RehabQuest account.',
  compact = false,
}: LinkedPatientsPanelProps) {
  const [patientEmail, setPatientEmail] = useState('');
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadPatients() {
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await apiFetch(`${apiBaseUrl}/therapist/patients`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not load linked patients');
        setIsError(true);
        return;
      }

      setPatients(data.patients ?? []);
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
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
    setIsError(false);
    setIsSubmitting(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/therapist/patients/link`, {
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
        setIsError(true);
        return;
      }

      setPatientEmail('');
      setMessage('Patient linked successfully');
      await loadPatients();
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Patient links</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">{title}</h2>
          {description ? <p className="mt-2 text-sm font-semibold text-on-surface-variant">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={loadPatients}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/60 px-4 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
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
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
          Link Patient
        </button>
      </form>

      {message ? (
        <p
          className={[
            'mt-4 rounded-xl px-4 py-3 text-sm font-semibold',
            isError
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'bg-surface-container-low text-on-surface-variant',
          ].join(' ')}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-5">
        {isLoading ? (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 font-semibold text-on-surface-variant">Loading linked patients</p>
          </div>
        ) : patients.length > 0 ? (
          <div className="grid gap-4">
            {patients.slice(0, compact ? 4 : patients.length).map((patient) => (
              <LinkedPatientRow key={patient.linkId} patient={patient} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-8 text-center">
            <UsersRound className="mx-auto h-9 w-9 text-primary" />
            <h3 className="mt-3 font-display text-2xl font-semibold text-on-surface">No patients linked yet</h3>
            <p className="mt-2 text-on-surface-variant">Link a patient by entering their email above.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function LinkedPatientRow({ patient }: { patient: LinkedPatient }) {
  const linkDate = patient.linkedAt ?? patient.createdAt;

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words font-display text-xl font-semibold text-on-surface sm:text-2xl">{patient.name || 'Unnamed patient'}</h3>
          <p className="mt-1 break-words text-sm font-semibold text-on-surface-variant">{patient.email}</p>
        </div>
        {linkDate ? (
          <div className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant sm:w-auto">
            Linked {new Date(linkDate).toLocaleDateString()}
          </div>
        ) : null}
      </div>
    </article>
  );
}

