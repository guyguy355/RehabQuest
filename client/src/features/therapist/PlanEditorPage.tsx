import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { LibraryExercise, Plan } from '../../app/types';
import { useApi } from '../../app/useApi';
import { SelectField, TextArea, TextField } from '../../ui/Field';
import { addDays, WEEKDAYS, WEEKDAYS_LONG } from '../../ui/format';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type TaskDraft = { key: string; id?: string; exerciseId: string; sets: number; reps: number; durationSeconds: number; notes: string };
type Draft = { title: string; condition: string; startDate: string; endDate: string; trainingWeekdays: number[]; therapistNotes: string; tasks: TaskDraft[] };

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

let keyCounter = 0;
const newKey = () => `t${++keyCounter}`;

function NumberInput({ id, label, value, min, max, onChange, error }: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void; error?: string }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-extrabold text-ink-500">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isNaN(value) ? '' : value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="field-input tabular min-h-11 px-3"
        aria-invalid={error ? true : undefined}
      />
      {error ? <span className="text-xs font-bold text-rose-700">{error}</span> : null}
    </div>
  );
}

export function PlanEditorPage() {
  const { patientId, planId } = useParams();
  const isEdit = Boolean(planId);
  const navigate = useNavigate();
  const toast = useToast();
  const library = useApi<{ exercises: LibraryExercise[] }>('/therapist/exercises');
  const existing = useApi<{ plan: Plan; patient: { id: string; name: string } }>(isEdit ? `/therapist/plans/${planId}` : null);
  const patient = useApi<{ patient: { id: string; name: string } }>(!isEdit && patientId ? `/therapist/patients/${patientId}` : null);

  const today = localToday();
  const [draft, setDraft] = useState<Draft | null>(
    isEdit ? null : { title: '', condition: '', startDate: today, endDate: addDays(today, 27), trainingWeekdays: [1, 3, 5], therapistNotes: '', tasks: [] },
  );
  const [pick, setPick] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const plan = existing.data?.plan;
    if (!plan) return;
    setDraft({
      title: plan.title,
      condition: plan.condition,
      startDate: plan.startDate,
      endDate: plan.endDate,
      trainingWeekdays: plan.trainingWeekdays,
      therapistNotes: plan.therapistNotes ?? '',
      tasks: plan.tasks.map((task) => ({ key: newKey(), id: task.id, exerciseId: task.exercise.id, sets: task.sets, reps: task.reps, durationSeconds: task.durationSeconds, notes: task.notes ?? '' })),
    });
  }, [existing.data]);

  const exercises = library.data?.exercises ?? [];
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const loadError = library.error ?? existing.error ?? patient.error;
  const patientName = existing.data?.patient.name ?? patient.data?.patient.name ?? '';
  const backTo = `/therapist/patients/${existing.data?.patient.id ?? patientId}`;
  const started = isEdit && existing.data ? existing.data.plan.startDate <= today : false;

  if (loadError) return <ErrorState message={errorMessage(loadError)} onRetry={() => { void library.reload(); void existing.reload(); void patient.reload(); }} />;
  if (!draft || library.loading) return <LoadingBlock rows={4} label="Loading plan editor" />;

  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const updateTask = (key: string, patch: Partial<TaskDraft>) => update({ tasks: draft.tasks.map((task) => (task.key === key ? { ...task, ...patch } : task)) });
  const move = (index: number, delta: number) => {
    const tasks = [...draft.tasks];
    const [task] = tasks.splice(index, 1);
    tasks.splice(index + delta, 0, task);
    update({ tasks });
  };

  function addExercise() {
    const exercise = byId.get(pick);
    if (!exercise || !draft) return;
    update({ tasks: [...draft.tasks, { key: newKey(), exerciseId: exercise.id, sets: exercise.sets, reps: exercise.reps, durationSeconds: exercise.durationSeconds, notes: '' }] });
    setPick('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !draft) return;
    setFields({});
    setError('');

    const local: Record<string, string> = {};
    if (!draft.title.trim()) local.title = 'Title is required';
    if (!draft.condition.trim()) local.condition = 'Focus area is required';
    if (draft.trainingWeekdays.length === 0) local.trainingWeekdays = 'Choose at least one training day';
    if (draft.endDate < draft.startDate) local.endDate = 'End date must be on or after the start date';
    if (draft.tasks.length === 0) local.tasks = 'Add at least one exercise';
    if (Object.keys(local).length) {
      setFields(local);
      return;
    }

    setSaving(true);
    const body = {
      title: draft.title,
      condition: draft.condition,
      startDate: draft.startDate,
      endDate: draft.endDate,
      trainingWeekdays: draft.trainingWeekdays,
      therapistNotes: draft.therapistNotes,
      tasks: draft.tasks.map(({ id, exerciseId, sets, reps, durationSeconds, notes }) => ({ ...(id ? { id } : {}), exerciseId, sets, reps, durationSeconds, notes })),
    };

    try {
      if (isEdit) await api(`/therapist/plans/${planId}`, { method: 'PUT', body });
      else await api(`/therapist/patients/${patientId}/plans`, { method: 'POST', body });
      toast(isEdit ? 'Plan updated' : 'Plan created and shared with the patient');
      navigate(backTo);
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length) setFields(caught.fields);
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={patientName ? `Plan for ${patientName}` : 'Plan'} title={isEdit ? 'Edit plan' : 'Create a plan'}>
        The patient sees exactly these exercises on each training day. Days you leave unselected are rest days.
      </PageHeader>

      {exercises.length === 0 ? (
        <EmptyState title="Your exercise library is empty" action={<Link className="btn btn-primary" to="/therapist/exercises">Add exercises</Link>}>
          Create exercises in your library first, then add them to a plan.
        </EmptyState>
      ) : (
        <form onSubmit={submit} className="grid gap-6" noValidate>
          <section className="card grid gap-4 p-5 md:grid-cols-2">
            <TextField id="plan-title" label="Plan title" value={draft.title} onChange={(event) => update({ title: event.target.value })} error={fields.title} placeholder="Knee strength — phase 2" maxLength={100} />
            <TextField id="plan-condition" label="Focus area" value={draft.condition} onChange={(event) => update({ condition: event.target.value })} error={fields.condition} placeholder="Knee (post-surgery)" maxLength={100} />
            <TextField
              id="plan-start"
              label="Start date"
              type="date"
              value={draft.startDate}
              min={isEdit ? undefined : today}
              disabled={started}
              hint={started ? 'The plan has started; the start date is fixed.' : undefined}
              onChange={(event) => update({ startDate: event.target.value })}
              error={fields.startDate}
            />
            <TextField id="plan-end" label="End date" type="date" value={draft.endDate} min={draft.startDate} onChange={(event) => update({ endDate: event.target.value })} error={fields.endDate} />
            <fieldset className="grid gap-2 md:col-span-2">
              <legend className="field-label mb-1">Training days</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((label, day) => {
                  const on = draft.trainingWeekdays.includes(day);
                  return (
                    <label key={label}>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={on}
                        onChange={() => update({ trainingWeekdays: on ? draft.trainingWeekdays.filter((value) => value !== day) : [...draft.trainingWeekdays, day].sort() })}
                        aria-label={WEEKDAYS_LONG[day]}
                      />
                      <span className="grid h-12 w-14 cursor-pointer place-items-center rounded-2xl border-2 border-ink-200 font-extrabold text-ink-500 transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-500">
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-sm text-ink-500">{fields.trainingWeekdays ? <span className="font-bold text-rose-700">{fields.trainingWeekdays}</span> : `${7 - draft.trainingWeekdays.length} rest day${7 - draft.trainingWeekdays.length === 1 ? '' : 's'} per week. Rest days never break the patient’s streak.`}</p>
            </fieldset>
            <div className="md:col-span-2">
              <TextArea id="plan-notes" label="Note for the patient (optional)" value={draft.therapistNotes} onChange={(event) => update({ therapistNotes: event.target.value })} maxLength={1000} rows={3} placeholder="Move slowly and stop if pain goes above 5/10." />
            </div>
          </section>

          <section className="card grid gap-4 p-5" aria-labelledby="exercises-title">
            <div>
              <h2 id="exercises-title" className="font-display text-xl font-bold">
                Exercises
              </h2>
              <p className="text-sm text-ink-500">Changes apply from today. Past records keep the parameters that were prescribed at the time.</p>
            </div>

            {draft.tasks.length === 0 ? <p className={`rounded-2xl p-4 text-sm font-bold ${fields.tasks ? 'bg-rose-50 text-rose-700' : 'bg-ink-50 text-ink-500'}`}>{fields.tasks ?? 'No exercises yet. Add one below.'}</p> : null}

            <ol className="grid gap-3">
              {draft.tasks.map((task, index) => {
                const exercise = byId.get(task.exerciseId);
                const prefix = `task-${task.key}`;
                return (
                  <li key={task.key} className="grid gap-3 rounded-3xl border-2 border-ink-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-extrabold">
                        <span className="tabular mr-2 text-ink-500">{index + 1}.</span>
                        {exercise?.title ?? 'Exercise'}
                        <span className="ml-2 text-sm font-bold text-ink-500">{exercise?.bodyPart}</span>
                      </p>
                      <div className="flex gap-1">
                        <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 disabled:opacity-30" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${exercise?.title} up`}>
                          <ArrowUp className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 disabled:opacity-30" onClick={() => move(index, 1)} disabled={index === draft.tasks.length - 1} aria-label={`Move ${exercise?.title} down`}>
                          <ArrowDown className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50" onClick={() => update({ tasks: draft.tasks.filter((item) => item.key !== task.key) })} aria-label={`Remove ${exercise?.title}`}>
                          <Trash2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <NumberInput id={`${prefix}-sets`} label="Sets" value={task.sets} min={1} max={20} onChange={(value) => updateTask(task.key, { sets: value })} error={fields[`tasks.${index}.sets`]} />
                      <NumberInput id={`${prefix}-reps`} label="Reps" value={task.reps} min={1} max={100} onChange={(value) => updateTask(task.key, { reps: value })} error={fields[`tasks.${index}.reps`]} />
                      <NumberInput id={`${prefix}-secs`} label="Seconds per set" value={task.durationSeconds} min={1} max={3600} onChange={(value) => updateTask(task.key, { durationSeconds: value })} error={fields[`tasks.${index}.durationSeconds`]} />
                    </div>
                    <TextField id={`${prefix}-notes`} label="Instruction for this patient (optional)" value={task.notes} maxLength={300} onChange={(event) => updateTask(task.key, { notes: event.target.value })} placeholder="Use a towel under the heel." />
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1">
                <SelectField id="add-exercise" label="Add from your library" value={pick} onChange={(event) => setPick(event.target.value)}>
                  <option value="">Choose an exercise…</option>
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.title} ({exercise.bodyPart})
                    </option>
                  ))}
                </SelectField>
              </div>
              <button type="button" className="btn btn-secondary" onClick={addExercise} disabled={!pick}>
                <Plus className="h-5 w-5" aria-hidden="true" /> Add
              </button>
            </div>
          </section>

          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Link to={backTo} className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? <Spinner /> : null} {isEdit ? 'Save changes' : 'Create plan'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
