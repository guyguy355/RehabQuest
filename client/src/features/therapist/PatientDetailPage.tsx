import { CalendarRange, Check, Minus, Moon, Pause, Pencil, Play, Plus, Square } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { Completion, Day, Plan, PlanStatus } from '../../app/types';
import { useApi } from '../../app/useApi';
import { Dialog } from '../../ui/Dialog';
import { DIFFICULTY_LABEL, formatDay, formatDuration, formatShort, weekdayList } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { MessageThread } from '../shared/MessageThread';
import { SummaryPanel } from './SummaryPanel';
import { PLAN_STATUS_CHIP, type PatientRow } from './TherapistHome';

type Detail = {
  patient: { id: string; name: string; email: string; timezone: string; linkedAt: string };
  snapshot: Omit<PatientRow, 'id' | 'name' | 'email' | 'linkedAt'> & { days?: Day[] };
  currentPlan: Plan | null;
  plans: { id: string; title: string; condition: string; status: PlanStatus; startDate: string; endDate: string }[];
  completions: Completion[];
};

const DAY_STYLE: Record<Day['state'], { cls: string; label: string }> = {
  done: { cls: 'bg-brand-500 text-white', label: 'Finished' },
  missed: { cls: 'bg-ink-200 text-ink-500', label: 'Not done' },
  today: { cls: 'bg-white text-sky-700 ring-4 ring-sky-300', label: 'Today' },
  upcoming: { cls: 'bg-white text-ink-300 border-2 border-ink-200', label: 'Upcoming' },
  rest: { cls: 'bg-grape-50 text-grape-400', label: 'Rest day' },
};

function DayIcon({ day }: { day: Day }) {
  if (day.state === 'done') return <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />;
  if (day.state === 'missed') return <Minus className="h-4 w-4" aria-hidden="true" />;
  if (day.state === 'rest') return <Moon className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Square className="h-2 w-2" aria-hidden="true" />;
}

function SessionCalendar({ days }: { days: Day[] }) {
  const weeks = new Map<number, Day[]>();
  for (const day of days) weeks.set(day.week, [...(weeks.get(day.week) ?? []), day]);

  return (
    <section className="card grid gap-3 p-5" aria-labelledby="calendar-title">
      <h2 id="calendar-title" className="flex items-center gap-2 font-display text-xl font-bold">
        <CalendarRange className="h-5 w-5 text-brand-600" aria-hidden="true" /> Session calendar
      </h2>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1.5">
          <tbody>
            {[...weeks.entries()].map(([week, list]) => (
              <tr key={week}>
                <th scope="row" className="pr-2 text-left text-xs font-extrabold text-ink-500">
                  Wk {week}
                </th>
                {list.map((day) => (
                  <td key={day.date}>
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg ${DAY_STYLE[day.state].cls}`}
                      title={`${formatDay(day.date)}: ${DAY_STYLE[day.state].label}${day.stoppedCount ? ' (stopped for symptoms)' : ''}`}
                      role="img"
                      aria-label={`${formatDay(day.date)}: ${DAY_STYLE[day.state].label}`}
                    >
                      <DayIcon day={day} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink-500" aria-label="Legend">
        {(['done', 'missed', 'today', 'upcoming', 'rest'] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={`grid h-4 w-4 place-items-center rounded ${DAY_STYLE[state].cls}`} aria-hidden="true" />
            {DAY_STYLE[state].label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanCard({ plan, patientId, onChanged }: { plan: Plan; patientId: string; onChanged: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<PlanStatus | null>(null);
  const [saving, setSaving] = useState(false);

  async function setStatus(status: PlanStatus) {
    setSaving(true);
    try {
      await api(`/therapist/plans/${plan.id}/status`, { method: 'PATCH', body: { status } });
      toast(status === 'ACTIVE' ? 'Plan resumed' : status === 'PAUSED' ? 'Plan paused' : 'Plan marked as completed');
      setConfirm(null);
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  }

  const chip = PLAN_STATUS_CHIP[plan.status];

  return (
    <section className="card grid gap-4 p-5" aria-labelledby="plan-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="plan-heading" className="font-display text-2xl font-bold leading-tight">
              {plan.title}
            </h2>
            <Chip tone={chip.tone}>{chip.label}</Chip>
          </div>
          <p className="text-sm text-ink-500">
            {plan.condition} · {formatShort(plan.startDate)} – {formatShort(plan.endDate)} · trains {weekdayList(plan.trainingWeekdays)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.status !== 'COMPLETED' ? (
            <Link to={`/therapist/plans/${plan.id}/edit`} className="btn btn-secondary btn-sm">
              <Pencil className="h-4 w-4" aria-hidden="true" /> Edit plan
            </Link>
          ) : (
            <Link to={`/therapist/patients/${patientId}/plans/new`} className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> New plan
            </Link>
          )}
          {plan.status === 'ACTIVE' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm('PAUSED')}>
              <Pause className="h-4 w-4" aria-hidden="true" /> Pause
            </button>
          ) : null}
          {plan.status === 'PAUSED' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus('ACTIVE')} disabled={saving}>
              <Play className="h-4 w-4" aria-hidden="true" /> Resume
            </button>
          ) : null}
          {plan.status !== 'COMPLETED' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm('COMPLETED')}>
              Mark completed
            </button>
          ) : null}
        </div>
      </div>

      {plan.therapistNotes ? <p className="rounded-2xl bg-sky-50 p-3 text-ink-900">{plan.therapistNotes}</p> : null}

      <ol className="grid gap-2">
        {plan.tasks.map((task, index) => (
          <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink-100 p-3">
            <span className="tabular grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-black text-brand-800">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{task.exercise.title}</p>
              {task.notes ? <p className="text-sm text-ink-500">{task.notes}</p> : null}
            </div>
            <span className="tabular text-sm font-extrabold text-ink-700">
              {task.sets} × {task.reps} · {formatDuration(task.durationSeconds)}/set
            </span>
          </li>
        ))}
      </ol>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'PAUSED' ? 'Pause this plan?' : 'Mark this plan as completed?'}>
        <p className="text-ink-700">
          {confirm === 'PAUSED'
            ? 'The patient will not see sessions while the plan is paused. You can resume it later.'
            : 'The patient will see that the plan has ended. A completed plan cannot be reopened; you can create a new plan afterwards.'}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => confirm && setStatus(confirm)} disabled={saving}>
            {saving ? <Spinner /> : null} {confirm === 'PAUSED' ? 'Pause plan' : 'Mark completed'}
          </button>
        </div>
      </Dialog>
    </section>
  );
}

function RecordsTable({ completions, highlight, onReviewed }: { completions: Completion[]; highlight: string | null; onReviewed: (id: string) => void }) {
  const toast = useToast();
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const rows = onlyOpen ? completions.filter((item) => item.needsReview && !item.reviewedAt) : completions;

  async function review(id: string) {
    setSavingId(id);
    try {
      await api(`/therapist/completions/${id}/review`, { method: 'POST' });
      onReviewed(id);
      toast('Marked as reviewed');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="card grid gap-3 p-5" aria-labelledby="records-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="records-title" className="font-display text-xl font-bold">
          Exercise records
        </h2>
        <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} />
          Only open reports
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-ink-50 p-4 text-ink-500">{onlyOpen ? 'No open reports.' : 'No records yet.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="py-2 pr-3 font-extrabold">Date</th>
                <th className="py-2 pr-3 font-extrabold">Exercise</th>
                <th className="py-2 pr-3 font-extrabold">Result</th>
                <th className="py-2 pr-3 font-extrabold">Pain</th>
                <th className="py-2 pr-3 font-extrabold">Difficulty</th>
                <th className="py-2 pr-3 font-extrabold">Note</th>
                <th className="py-2 font-extrabold">Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} id={`record-${item.id}`} className={`border-t-2 border-ink-100 align-top transition-colors ${highlight === item.id ? 'bg-sun-100' : ''}`}>
                  <td className="tabular whitespace-nowrap py-2 pr-3 font-bold">{formatDay(item.sessionDate)}</td>
                  <td className="py-2 pr-3">{item.exercise?.title}</td>
                  <td className="py-2 pr-3">{item.status === 'STOPPED' ? <Chip tone="coral">Stopped</Chip> : <Chip tone="brand">Done</Chip>}</td>
                  <td className={`tabular py-2 pr-3 font-extrabold ${item.painLevel >= 7 ? 'text-rose-700' : ''}`}>{item.painLevel}/10</td>
                  <td className="py-2 pr-3">{item.difficulty ? DIFFICULTY_LABEL[item.difficulty] : '—'}</td>
                  <td className="max-w-[16rem] py-2 pr-3 text-ink-700">{item.notes ?? '—'}</td>
                  <td className="py-2">
                    {!item.needsReview ? (
                      <span className="text-ink-300">—</span>
                    ) : item.reviewedAt ? (
                      <Chip tone="brand">Reviewed</Chip>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm whitespace-nowrap" onClick={() => review(item.id)} disabled={savingId === item.id} title={(item.reviewReasons ?? []).join(', ')}>
                        {savingId === item.id ? <Spinner className="h-4 w-4" /> : null} Mark reviewed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const { data, error, loading, reload, setData } = useApi<Detail>(`/therapist/patients/${patientId}`);
  const [highlight, setHighlight] = useState<string | null>(null);

  if (loading && !data) return <LoadingBlock rows={4} label="Loading patient" />;
  if (error && !data) {
    return error.status === 404 ? (
      <EmptyState title="Patient not found" action={<Link to="/therapist" className="btn btn-primary">Back to patients</Link>}>
        This patient is not in your list, or the link is wrong.
      </EmptyState>
    ) : (
      <ErrorState message={errorMessage(error)} onRetry={reload} />
    );
  }
  if (!data) return null;

  const { patient, snapshot, currentPlan } = data;

  function selectRecord(completionId: string) {
    setHighlight(completionId);
    document.getElementById(`record-${completionId}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Patient"
        title={patient.name}
        actions={
          !currentPlan || currentPlan.status === 'COMPLETED' ? (
            <Link to={`/therapist/patients/${patient.id}/plans/new`} className="btn btn-primary">
              <Plus className="h-5 w-5" aria-hidden="true" /> Create plan
            </Link>
          ) : null
        }
      >
        {patient.email} · linked {formatShort(patient.linkedAt.slice(0, 10))} · {patient.timezone}
      </PageHeader>

      {snapshot.stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <p className="eyebrow">Finished</p>
            <p className="tabular font-display text-3xl font-bold text-brand-700">
              {snapshot.stats.doneSessions}/{snapshot.stats.sessionsToDate}
            </p>
            <p className="text-xs font-bold text-ink-500">sessions planned so far</p>
          </div>
          <div className="card p-4">
            <p className="eyebrow">Last 7 days</p>
            <p className="tabular font-display text-3xl font-bold text-brand-700">
              {snapshot.last7Days ? `${snapshot.last7Days.doneSessions}/${snapshot.last7Days.sessionsToDate}` : '—'}
            </p>
          </div>
          <div className="card p-4">
            <p className="eyebrow">Streak</p>
            <p className="tabular font-display text-3xl font-bold text-coral-600">{snapshot.streak}</p>
          </div>
          <div className={`card p-4 ${snapshot.openReviews ? 'border-rose-200 bg-rose-50' : ''}`}>
            <p className="eyebrow">Open reports</p>
            <p className={`tabular font-display text-3xl font-bold ${snapshot.openReviews ? 'text-rose-700' : 'text-ink-500'}`}>{snapshot.openReviews}</p>
          </div>
        </div>
      ) : null}

      {currentPlan ? (
        <PlanCard plan={currentPlan} patientId={patient.id} onChanged={reload} />
      ) : (
        <EmptyState title="No plan yet" mood="wave" action={<Link to={`/therapist/patients/${patient.id}/plans/new`} className="btn btn-primary">Create the first plan</Link>}>
          Choose exercises from your library, set sets and reps, and pick the training days.
        </EmptyState>
      )}

      {snapshot.days && snapshot.days.length > 0 ? <SessionCalendar days={snapshot.days} /> : null}

      <SummaryPanel patientId={patient.id} onSelectRecord={selectRecord} />

      <RecordsTable
        completions={data.completions}
        highlight={highlight}
        onReviewed={(id) =>
          setData({
            ...data,
            snapshot: { ...snapshot, openReviews: Math.max(0, snapshot.openReviews - 1) },
            completions: data.completions.map((item) => (item.id === id ? { ...item, reviewedAt: new Date().toISOString() } : item)),
          })
        }
      />

      <section className="card grid gap-3 p-5" aria-labelledby="messages-title">
        <h2 id="messages-title" className="font-display text-xl font-bold">
          Messages
        </h2>
        <MessageThread otherUserId={patient.id} otherName={patient.name.split(' ')[0]} />
      </section>

      {data.plans.length > 1 ? (
        <section className="card grid gap-2 p-5" aria-labelledby="history-title">
          <h2 id="history-title" className="font-display text-xl font-bold">
            Earlier plans
          </h2>
          <ul className="grid gap-1">
            {data.plans
              .filter((plan) => plan.id !== currentPlan?.id)
              .map((plan) => (
                <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold">{plan.title}</span>
                  <span className="text-ink-500">
                    {formatShort(plan.startDate)} – {formatShort(plan.endDate)} · {PLAN_STATUS_CHIP[plan.status].label}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
