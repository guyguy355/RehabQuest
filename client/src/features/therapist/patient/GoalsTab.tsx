import { Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api, ApiError, errorMessage } from '../../../app/api';
import type { Goal, GoalsResponse, MeasurementDefinition } from '../../../app/types';
import { useApi } from '../../../app/useApi';
import { useI18n } from '../../../i18n';
import { Dialog } from '../../../ui/Dialog';
import { SelectField, TextArea, TextField } from '../../../ui/Field';
import { formatMeasure, formatShort } from '../../../ui/format';
import { Chip } from '../../../ui/Pills';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../../ui/States';
import { useToast } from '../../../ui/Toast';
import { GoalCard } from '../../shared/GoalCard';

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

function GoalDialog({ patientId, measurements, open, onClose, onCreated }: { patientId: string; measurements: MeasurementDefinition[]; open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const active = measurements.filter((definition) => !definition.archived);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'FUNCTIONAL' | 'MEASUREMENT'>('FUNCTIONAL');
  const [definitionId, setDefinitionId] = useState('');
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFields({});
    try {
      await api(`/therapist/patients/${patientId}/goals`, {
        method: 'POST',
        body: {
          title,
          description: description || null,
          kind,
          definitionId: kind === 'MEASUREMENT' ? definitionId || null : null,
          baselineValue: kind === 'MEASUREMENT' ? toNumber(baseline) : null,
          targetValue: kind === 'MEASUREMENT' ? toNumber(target) : null,
          targetDate: targetDate || null,
          milestones: milestones.map((value) => value.trim()).filter(Boolean).map((value) => ({ title: value })),
        },
      });
      toast(t('Goal added'), 'success');
      setTitle('');
      setDescription('');
      setMilestones(['']);
      onCreated();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof ApiError) setFields(caught.fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('New goal')} wide>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <TextField label={t('Goal, in the patient’s words')} hint={t('For example: Climb the stairs at home without holding the rail.')} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} error={fields.title} required />
        <TextArea label={t('Details (optional)')} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} />
        <fieldset className="grid gap-2">
          <legend className="field-label">{t('How progress is followed')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['FUNCTIONAL', 'MEASUREMENT'] as const).map((option) => (
              <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 font-bold ${kind === option ? 'border-brand-500 bg-brand-50' : 'border-ink-100'}`}>
                <input type="radio" name="goal-kind" checked={kind === option} onChange={() => setKind(option)} />
                {option === 'FUNCTIONAL' ? t('Milestones you confirm') : t('A measurement target')}
              </label>
            ))}
          </div>
        </fieldset>
        {kind === 'MEASUREMENT' ? (
          active.length === 0 ? (
            <InlineMessage tone="info">{t('Add a measurement first (below the goals), then create the goal.')}</InlineMessage>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField label={t('Measurement')} value={definitionId} onChange={(event) => setDefinitionId(event.target.value)}>
                <option value="">{t('Choose…')}</option>
                {active.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name} ({definition.unit})
                  </option>
                ))}
              </SelectField>
              <TextField label={t('Starting value (optional)')} inputMode="decimal" value={baseline} onChange={(event) => setBaseline(event.target.value)} />
              <TextField label={t('Target value')} inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
            </div>
          )
        ) : null}
        <TextField label={t('Target date (optional)')} type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <fieldset className="grid gap-2">
          <legend className="field-label">{t('Milestones (optional)')}</legend>
          {milestones.map((value, index) => (
            <div key={index} className="flex gap-2">
              <TextField label={t('Milestone {n}', { n: index + 1 })} className="flex-1" value={value} onChange={(event) => setMilestones(milestones.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} maxLength={120} />
              {milestones.length > 1 ? (
                <button type="button" className="btn btn-ghost self-end" aria-label={t('Remove milestone {n}', { n: index + 1 })} onClick={() => setMilestones(milestones.filter((_, itemIndex) => itemIndex !== index))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
          {milestones.length < 10 ? (
            <button type="button" className="btn btn-ghost btn-sm justify-self-start" onClick={() => setMilestones([...milestones, ''])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('Add milestone')}
            </button>
          ) : null}
        </fieldset>
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner /> : null} {t('Add goal')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function MeasurementDialog({ patientId, open, onClose, onCreated }: { patientId: string; open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', unit: '', direction: 'HIGHER_IS_BETTER', minValue: '0', maxValue: '', patientCanRecord: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(`/therapist/patients/${patientId}/measurements`, { method: 'POST', body: { ...form, minValue: Number(form.minValue), maxValue: Number(form.maxValue) } });
      toast(t('Measurement added'), 'success');
      onCreated();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('New measurement')}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <TextField label={t('Name')} hint={t('For example: Knee bend (right)')} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('Unit')} hint={t('For example: degrees, seconds, metres')} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} maxLength={20} />
          <SelectField label={t('Better when')} value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}>
            <option value="HIGHER_IS_BETTER">{t('Higher is better')}</option>
            <option value="LOWER_IS_BETTER">{t('Lower is better')}</option>
          </SelectField>
          <TextField label={t('Lowest allowed value')} inputMode="decimal" value={form.minValue} onChange={(event) => setForm({ ...form, minValue: event.target.value })} />
          <TextField label={t('Highest allowed value')} inputMode="decimal" value={form.maxValue} onChange={(event) => setForm({ ...form, maxValue: event.target.value })} />
        </div>
        <label className="flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" className="h-5 w-5" checked={form.patientCanRecord} onChange={(event) => setForm({ ...form, patientCanRecord: event.target.checked })} />
          {t('The patient can record this at home')}
        </label>
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner /> : null} {t('Add measurement')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function MeasurementCard({ definition, today, onChanged }: { definition: MeasurementDefinition; today: string; onChanged: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function record(event: FormEvent) {
    event.preventDefault();
    if (value.trim() === '' || Number.isNaN(Number(value))) {
      setError(t('Enter a number'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`/therapist/measurements/${definition.id}/values`, { method: 'POST', body: { value: Number(value), measuredOn: date, idempotencyKey: crypto.randomUUID() } });
      setValue('');
      toast(t('Measurement saved'), 'success');
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function patch(body: { patientCanRecord?: boolean; archived?: boolean }) {
    try {
      await api(`/therapist/measurements/${definition.id}`, { method: 'PATCH', body });
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  }

  return (
    <article className={`card grid gap-3 p-5 ${definition.archived ? 'bg-ink-50' : ''}`} aria-labelledby={`measure-${definition.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id={`measure-${definition.id}`} className="font-display text-lg font-bold">
            {definition.name} <span className="text-ink-500">({definition.unit})</span>
          </h4>
          <p className="text-sm text-ink-500">
            {definition.direction === 'HIGHER_IS_BETTER' ? t('Higher is better') : t('Lower is better')} · {t('allowed {min}–{max}', { min: definition.minValue, max: definition.maxValue })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {definition.archived ? <Chip>{t('Archived')}</Chip> : null}
          {definition.patientCanRecord ? <Chip tone="sky">{t('Patient can record')}</Chip> : null}
        </div>
      </div>

      {definition.values.length === 0 ? (
        <p className="text-sm text-ink-500">{t('No values yet.')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabular w-full text-start text-sm">
            <caption className="sr-only">{t('Values for {name}', { name: definition.name })}</caption>
            <thead className="text-ink-500">
              <tr>
                <th scope="col" className="py-1 pe-3 text-start font-extrabold">{t('Date')}</th>
                <th scope="col" className="py-1 pe-3 text-start font-extrabold">{t('Value')}</th>
                <th scope="col" className="py-1 pe-3 text-start font-extrabold">{t('Recorded by')}</th>
              </tr>
            </thead>
            <tbody>
              {[...definition.values].reverse().map((point) => (
                <tr key={point.id} className="border-t border-ink-100">
                  <td className="py-1 pe-3">{formatShort(point.measuredOn)}</td>
                  <td className="py-1 pe-3 font-bold">
                    {formatMeasure(point.value)} {definition.unit}
                  </td>
                  <td className="py-1 pe-3">{point.source === 'PATIENT' ? t('Patient') : t('Therapist')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!definition.archived ? (
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={record} noValidate>
          <TextField label={t('New value ({unit})', { unit: definition.unit })} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
          <TextField label={t('Date')} type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
          <button type="submit" className="btn btn-secondary" disabled={saving}>
            {saving ? <Spinner /> : null} {t('Record')}
          </button>
        </form>
      ) : null}
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      <div className="flex flex-wrap gap-2">
        {!definition.archived ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void patch({ patientCanRecord: !definition.patientCanRecord })}>
            {definition.patientCanRecord ? t('Stop patient recording') : t('Let the patient record this')}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void patch({ archived: !definition.archived })}>
          {definition.archived ? t('Restore') : t('Archive')}
        </button>
      </div>
    </article>
  );
}

export function GoalsTab({ patientId, today }: { patientId: string; today: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<GoalsResponse>(`/therapist/patients/${patientId}/goals`);
  const [goalOpen, setGoalOpen] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, string>>({});

  if (loading && !data) return <LoadingBlock rows={3} label={t('Loading goals')} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      toast(success, 'success');
    } catch (caught) {
      toast(caught instanceof ApiError && caught.code === 'stale_goal' ? t('This goal changed in another window. The latest version is shown now.') : errorMessage(caught), 'error');
    } finally {
      setBusy(null);
      await reload();
    }
  }

  const setStatus = (goal: Goal, status: Goal['status'], success: string) => run(goal.id, () => api(`/therapist/goals/${goal.id}`, { method: 'PATCH', body: { status, lockVersion: goal.lockVersion } }), success);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3" aria-labelledby="therapist-goals">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="therapist-goals" className="font-display text-2xl font-bold">
            {t('Goals')}
          </h2>
          <button type="button" className="btn btn-primary" onClick={() => setGoalOpen(true)}>
            <Plus className="h-5 w-5" aria-hidden="true" /> {t('New goal')}
          </button>
        </div>
        <p className="text-sm text-ink-500">{t('Goals are confirmed by you. A measurement reaching its target is shown, never confirmed automatically.')}</p>
        {data.goals.length === 0 ? <EmptyState title={t('No goals yet')} mood="calm">{t('Agree on one or two goals with the patient and add them here.')}</EmptyState> : null}
        {data.goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            milestoneAction={(milestone) =>
              goal.status === 'ARCHIVED' ? null : (
                <button
                  type="button"
                  className={`btn btn-sm ${milestone.achievedAt ? 'btn-ghost' : 'btn-secondary'}`}
                  disabled={busy !== null}
                  onClick={() => void run(milestone.id, () => api(`/therapist/milestones/${milestone.id}`, { method: 'PATCH', body: { achieved: !milestone.achievedAt } }), milestone.achievedAt ? t('Milestone reopened') : t('Milestone confirmed'))}
                >
                  {milestone.achievedAt ? t('Reopen') : t('Confirm reached')}
                </button>
              )
            }
            actions={
              <>
                {goal.status === 'ACTIVE' ? (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void setStatus(goal, 'ACHIEVED', t('Goal confirmed'))}>
                    {t('Confirm goal achieved')}
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void setStatus(goal, 'ACTIVE', t('Goal reopened'))}>
                    {t('Reopen')}
                  </button>
                )}
                {goal.status !== 'ARCHIVED' ? (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void setStatus(goal, 'ARCHIVED', t('Goal archived'))}>
                    {t('Archive')}
                  </button>
                ) : null}
                {goal.status === 'ACTIVE' && goal.milestones.length < 10 ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const title = (milestoneDrafts[goal.id] ?? '').trim();
                      if (!title) return;
                      void run(goal.id, () => api(`/therapist/goals/${goal.id}/milestones`, { method: 'POST', body: { title } }), t('Milestone added')).then(() => setMilestoneDrafts({ ...milestoneDrafts, [goal.id]: '' }));
                    }}
                  >
                    <TextField label={t('New milestone')} value={milestoneDrafts[goal.id] ?? ''} onChange={(event) => setMilestoneDrafts({ ...milestoneDrafts, [goal.id]: event.target.value })} maxLength={120} />
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={busy !== null}>
                      {t('Add')}
                    </button>
                  </form>
                ) : null}
              </>
            }
          />
        ))}
      </section>

      <section className="grid gap-3" aria-labelledby="therapist-measurements">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="therapist-measurements" className="font-display text-2xl font-bold">
            {t('Measurements')}
          </h2>
          <button type="button" className="btn btn-secondary" onClick={() => setMeasureOpen(true)}>
            <Plus className="h-5 w-5" aria-hidden="true" /> {t('New measurement')}
          </button>
        </div>
        {data.measurements.length === 0 ? <p className="text-ink-500">{t('No measurements yet. Add one to follow a value such as range of motion over time.')}</p> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {data.measurements.map((definition) => (
            <MeasurementCard key={definition.id} definition={definition} today={today} onChanged={reload} />
          ))}
        </div>
      </section>

      <GoalDialog patientId={patientId} measurements={data.measurements} open={goalOpen} onClose={() => setGoalOpen(false)} onCreated={reload} />
      <MeasurementDialog patientId={patientId} open={measureOpen} onClose={() => setMeasureOpen(false)} onCreated={reload} />
    </div>
  );
}
