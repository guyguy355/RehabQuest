import { AlertCircle, ChevronRight, Flame, UserPlus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { DayState, PlanStatus, SessionStats } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { TextField } from '../../ui/Field';
import { formatDateTime, formatShort } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { usePlanStatusChip } from './patient/PlanTab';

export type PatientRow = {
  id: string;
  name: string;
  email: string;
  linkedAt: string;
  today: string;
  plan: { id: string; title: string; status: PlanStatus; startDate: string; endDate: string; versionNumber: number | null } | null;
  draftId: string | null;
  openReviews: number;
  lastActivityAt: string | null;
  streak: number;
  last7Days: SessionStats | null;
  stats: SessionStats | null;
  todayState: DayState | null;
};

function useTodayLabel() {
  const { t } = useI18n();
  return (state: DayState) =>
    ({
      done: { tone: 'brand' as const, label: t('Done today') },
      today: { tone: 'sky' as const, label: t('Due today') },
      rest: { tone: 'grape' as const, label: t('Rest day') },
      paused: { tone: 'neutral' as const, label: t('Paused') },
      upcoming: { tone: 'neutral' as const, label: t('Not started') },
      missed: { tone: 'neutral' as const, label: t('Not done') },
      skipped: { tone: 'neutral' as const, label: t('Skipped today') },
    })[state];
}

function LinkPatientDialog({ open, onClose, onLinked }: { open: boolean; onClose: () => void; onLinked: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setFields({});
    try {
      const result = await api<{ patient: { name: string } }>('/therapist/patients/link', { method: 'POST', body: { patientEmail: email, careCode: code } });
      toast(t('{name} was added to your patients', { name: result.patient.name }));
      setEmail('');
      setCode('');
      onLinked();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length) setFields(caught.fields);
      else setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('Add a patient')}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <p className="text-ink-500">{t('Ask the patient for the email they registered with and the 8-character care code shown on their Profile screen. The code confirms they agree to share their records with you.')}</p>
        <TextField label={t('Patient email')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={fields.patientEmail} required autoComplete="off" />
        <TextField label={t('Care code')} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} error={fields.careCode} maxLength={8} placeholder="C0FFEE42" className="tabular tracking-[0.2em]" dir="ltr" required autoComplete="off" />
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <button type="submit" className="btn btn-primary" disabled={submitting || !email || code.length !== 8}>
          {submitting ? <Spinner /> : <UserPlus className="h-5 w-5" aria-hidden="true" />} {t('Add patient')}
        </button>
      </form>
    </Dialog>
  );
}

export function TherapistHome() {
  const { t } = useI18n();
  const statusChip = usePlanStatusChip();
  const todayLabel = useTodayLabel();
  const { data, error, loading, reload } = useApi<{ patients: PatientRow[] }>('/therapist/patients');
  const [linkOpen, setLinkOpen] = useState(false);

  const patients = data?.patients ?? [];
  const reviews = patients.reduce((sum, patient) => sum + patient.openReviews, 0);
  const dueToday = patients.filter((patient) => patient.todayState === 'today').length;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Therapist')}
        title={t('Patients')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setLinkOpen(true)}>
            <UserPlus className="h-5 w-5" aria-hidden="true" /> {t('Add patient')}
          </button>
        }
      >
        {t('Who needs attention, and how each plan is going.')}
      </PageHeader>

      <LinkPatientDialog open={linkOpen} onClose={() => setLinkOpen(false)} onLinked={reload} />

      {loading && !data ? <LoadingBlock rows={4} label={t('Loading patients')} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link to="/therapist/reviews" className={`card-raised flex items-center gap-4 p-4 transition hover:-translate-y-0.5 ${reviews ? 'border-rose-200 bg-rose-50' : ''}`}>
              <AlertCircle className={`h-8 w-8 ${reviews ? 'text-rose-600' : 'text-ink-300'}`} aria-hidden="true" />
              <div>
                <p className="tabular font-display text-3xl font-bold leading-none">{reviews}</p>
                <p className="text-sm font-bold text-ink-700">{t('items to review')}</p>
              </div>
            </Link>
            <div className="card flex items-center gap-4 p-4">
              <p className="tabular font-display text-3xl font-bold leading-none text-sky-700">{dueToday}</p>
              <p className="text-sm font-bold text-ink-700">{t('sessions still open today')}</p>
            </div>
            <div className="card flex items-center gap-4 p-4">
              <p className="tabular font-display text-3xl font-bold leading-none text-brand-700">{patients.length}</p>
              <p className="text-sm font-bold text-ink-700">{t('linked patients')}</p>
            </div>
          </div>

          {patients.length === 0 ? (
            <EmptyState title={t('No patients yet')} action={<button className="btn btn-primary" onClick={() => setLinkOpen(true)}>{t('Add your first patient')}</button>}>
              {t('Add a patient with their email and care code, then create their plan.')}
            </EmptyState>
          ) : (
            <ul className="grid gap-3" aria-label={t('Patients')}>
              {patients.map((patient) => {
                const week = patient.last7Days;
                const done = week?.doneSessions ?? 0;
                const planned = week?.sessionsToDate ?? 0;
                const chip = patient.plan ? statusChip(patient.plan.status) : null;
                return (
                  <li key={patient.id}>
                    <Link to={`/therapist/patients/${patient.id}`} className="card-raised grid gap-3 p-4 transition hover:border-brand-200 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-xl font-bold leading-tight">{patient.name}</p>
                          {patient.openReviews ? <Chip tone="rose">{t('{count} to review', { count: patient.openReviews })}</Chip> : null}
                          {patient.draftId ? <Chip tone="sun">{t('Draft')}</Chip> : null}
                        </div>
                        <p className="truncate text-sm text-ink-500">
                          {patient.plan ? patient.plan.title : t('No plan yet')}
                          {chip ? ` · ${chip.label}` : ''}
                        </p>
                      </div>
                      <div className="grid gap-1.5">
                        {patient.plan && week ? (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-bold text-ink-700">{t('Last 7 days')}</span>
                              <span className="tabular font-extrabold">
                                {planned ? `${done}/${planned}` : patient.plan.startDate > patient.today ? t('starts {date}', { date: formatShort(patient.plan.startDate) }) : t('none planned')}
                              </span>
                            </div>
                            <div className="flex gap-1" aria-hidden="true">
                              {Array.from({ length: Math.max(planned, 1) }, (_, index) => (
                                <span key={index} className={`h-2.5 flex-1 rounded-full ${index < done ? 'bg-brand-500' : 'bg-ink-100'}`} />
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-ink-500">{patient.plan ? t('Plan not published yet') : t('Create a plan to get started')}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {patient.todayState ? <Chip tone={todayLabel(patient.todayState).tone}>{todayLabel(patient.todayState).label}</Chip> : null}
                        {patient.streak > 0 ? (
                          <Chip tone="coral" icon={<Flame className="h-3.5 w-3.5" aria-hidden="true" />}>
                            {patient.streak}
                          </Chip>
                        ) : null}
                        <span className="hidden text-xs text-ink-500 md:inline">{patient.lastActivityAt ? t('Active {date}', { date: formatDateTime(patient.lastActivityAt) }) : t('No activity yet')}</span>
                        <ChevronRight className="h-5 w-5 text-ink-300 rtl:rotate-180" aria-hidden="true" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
