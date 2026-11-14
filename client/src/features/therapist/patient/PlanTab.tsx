import { FileStack, PauseCircle, Pencil, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../../app/api';
import type { Plan, PlanStatus, PlanVersion } from '../../../app/types';
import { useI18n } from '../../../i18n';
import { Dialog } from '../../../ui/Dialog';
import { TextField } from '../../../ui/Field';
import { formatShort, weekdayList } from '../../../ui/format';
import { Chip } from '../../../ui/Pills';
import { EmptyState, Spinner } from '../../../ui/States';
import { useToast } from '../../../ui/Toast';
import { Prescription } from '../../patient/SessionOverview';

export function usePlanStatusChip() {
  const { t } = useI18n();
  return (status: PlanStatus) =>
    ({
      ACTIVE: { tone: 'brand' as const, label: t('Active') },
      PAUSED: { tone: 'sun' as const, label: t('Paused') },
      COMPLETED: { tone: 'neutral' as const, label: t('Completed') },
      DRAFT: { tone: 'sky' as const, label: t('Draft – not published') },
      ARCHIVED: { tone: 'neutral' as const, label: t('Archived') },
    })[status];
}

export function PlanTab({ plan, draftId, planId, planStatus, patientId, onChanged }: { plan: Plan | null; draftId: string | null; planId: string | null; planStatus: PlanStatus | null; patientId: string; onChanged: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const statusChip = usePlanStatusChip();
  const [confirm, setConfirm] = useState<PlanStatus | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function revise() {
    if (!planId) return;
    setBusy(true);
    try {
      const result = await api<{ draft: PlanVersion }>(`/therapist/plans/${planId}/drafts`, { method: 'POST' });
      navigate(`/therapist/plan-versions/${result.draft.id}`);
    } catch (caught) {
      toast(errorMessage(caught), 'error');
      setBusy(false);
    }
  }

  async function setStatus(status: PlanStatus) {
    if (!plan) return;
    setBusy(true);
    try {
      await api(`/therapist/plans/${plan.id}/status`, { method: 'PATCH', body: { status, expectedRevision: plan.revision, reason: reason.trim() || null } });
      toast(status === 'ACTIVE' ? t('Plan resumed') : status === 'PAUSED' ? t('Plan paused') : status === 'ARCHIVED' ? t('Plan archived') : t('Plan marked as completed'));
      setConfirm(null);
      setReason('');
      onChanged();
    } catch (caught) {
      toast(caught instanceof ApiError && caught.code === 'stale_plan' ? t('The plan changed in the meantime. The page was refreshed; try again.') : errorMessage(caught), 'error');
      if (caught instanceof ApiError && caught.code === 'stale_plan') onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (!plan) {
    return draftId ? (
      <EmptyState title={t('A draft plan is waiting')} mood="wave" action={<Link to={`/therapist/plan-versions/${draftId}`} className="btn btn-primary">{t('Continue the draft')}</Link>}>
        {t('It is not visible to the patient until you publish it.')}
      </EmptyState>
    ) : (
      <EmptyState title={t('No plan yet')} mood="wave" action={<Link to={`/therapist/patients/${patientId}/plans/new`} className="btn btn-primary">{t('Create the first plan')}</Link>}>
        {t('Start from a template or from scratch. You can preview it before publishing.')}
      </EmptyState>
    );
  }

  const chip = statusChip(planStatus ?? plan.status);
  const closed = plan.status === 'COMPLETED' || plan.status === 'ARCHIVED';

  return (
    <section className="card grid gap-4 p-5" aria-labelledby="plan-heading">
      {draftId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sun-50 p-3">
          <p className="text-sm font-bold text-ink-900">{t('There is an unpublished draft revision of this plan.')}</p>
          <Link to={`/therapist/plan-versions/${draftId}`} className="btn btn-sun btn-sm">
            {t('Continue the draft')}
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="plan-heading" className="font-display text-2xl font-bold leading-tight">
              {plan.title}
            </h2>
            <Chip tone={chip.tone}>{chip.label}</Chip>
            {plan.versionNumber ? <Chip tone="neutral">{t('Version {number}', { number: plan.versionNumber })}</Chip> : null}
          </div>
          <p className="text-sm text-ink-500">
            {plan.condition} · {formatShort(plan.startDate)} – {formatShort(plan.endDate)} · {t('Trains {days}', { days: weekdayList(plan.trainingWeekdays) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!closed && !draftId ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={revise} disabled={busy}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> {t('Revise plan')}
            </button>
          ) : null}
          <Link to={`/therapist/plans/${plan.id}/versions`} className="btn btn-secondary btn-sm">
            <FileStack className="h-4 w-4" aria-hidden="true" /> {t('Version history')}
          </Link>
          {plan.status === 'ACTIVE' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm('PAUSED')}>
              <PauseCircle className="h-4 w-4" aria-hidden="true" /> {t('Pause')}
            </button>
          ) : null}
          {plan.status === 'PAUSED' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus('ACTIVE')} disabled={busy}>
              <Play className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t('Resume')}
            </button>
          ) : null}
          {!closed ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm('COMPLETED')}>
              {t('Mark completed')}
            </button>
          ) : (
            <Link to={`/therapist/patients/${patientId}/plans/new`} className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('New plan')}
            </Link>
          )}
        </div>
      </div>

      {plan.therapistNotes ? <p className="rounded-2xl bg-sky-50 p-3 text-ink-900">{plan.therapistNotes}</p> : null}
      {plan.restDates.length ? <p className="text-sm text-ink-500">{t('Extra rest days: {dates}', { dates: plan.restDates.map(formatShort).join(', ') })}</p> : null}
      {plan.pauses.length ? (
        <p className="text-sm text-ink-500">
          {t('Approved pauses: {ranges}', { ranges: plan.pauses.map((pause) => `${formatShort(pause.startDate)} – ${pause.endDate ? formatShort(pause.endDate) : t('ongoing')}`).join(', ') })}
        </p>
      ) : null}

      <ol className="grid gap-2">
        {plan.tasks.map((task, index) => (
          <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink-100 p-3">
            <span className="tabular grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-black text-brand-800">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{task.exercise.title}</p>
              {task.notes ? <p className="text-sm text-ink-500">{task.notes}</p> : null}
            </div>
            <Prescription task={task} />
          </li>
        ))}
      </ol>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'PAUSED' ? t('Pause this plan?') : t('Mark this plan as completed?')}>
        <p className="text-ink-700">
          {confirm === 'PAUSED'
            ? t('Paused days are not counted as missed, reminders stop, and the patient sees that the plan is paused. You can resume it later.')
            : t('The patient will see that the plan has ended. A completed plan cannot be reopened; you can create a new plan afterwards.')}
        </p>
        {confirm === 'PAUSED' ? <TextField id="pause-reason" label={t('Reason (optional, visible to you only)')} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => confirm && setStatus(confirm)} disabled={busy}>
            {busy ? <Spinner /> : null} {confirm === 'PAUSED' ? t('Pause plan') : t('Mark completed')}
          </button>
        </div>
      </Dialog>
    </section>
  );
}
