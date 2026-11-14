import { AlertTriangle, CalendarX, Eye, FileStack, Save, Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { LibraryExercise, PlanVersion } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { TextArea, TextField } from '../../ui/Field';
import { formatDay, formatDuration, formatShort, weekdayList, weekdayName } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { type ItemDraft, ItemsEditor, newItemKey, toItemPayload } from './ItemsEditor';

type Form = {
  title: string;
  condition: string;
  therapistNotes: string;
  trainingWeekdays: number[];
  restDates: string[];
  effectiveFrom: string;
  endDate: string;
  changeNote: string;
  items: ItemDraft[];
};

export function todayIn(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function toForm(version: PlanVersion): Form {
  return {
    title: version.title,
    condition: version.condition,
    therapistNotes: version.therapistNotes ?? '',
    trainingWeekdays: version.trainingWeekdays,
    restDates: version.restDates,
    effectiveFrom: version.effectiveFrom,
    endDate: version.endDate,
    changeNote: version.changeNote ?? '',
    items: version.items.map((item) => ({
      key: newItemKey(),
      taskId: item.taskId,
      exerciseId: item.exerciseId,
      sets: item.sets,
      reps: item.reps,
      holdSeconds: item.holdSeconds,
      restSeconds: item.restSeconds,
      durationSeconds: item.durationSeconds,
      notes: item.notes ?? '',
    })),
  };
}

export function toDraftPayload(form: Form) {
  return {
    title: form.title,
    condition: form.condition,
    therapistNotes: form.therapistNotes.trim() || null,
    trainingWeekdays: form.trainingWeekdays,
    restDates: form.restDates,
    effectiveFrom: form.effectiveFrom,
    endDate: form.endDate,
    changeNote: form.changeNote.trim() || null,
    items: toItemPayload(form.items),
  };
}

/** Read-only view of a published (immutable) version. */
function PublishedVersionView({ version }: { version: PlanVersion }) {
  const { t } = useI18n();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function saveAsTemplate() {
    setSaving(true);
    try {
      await api(`/therapist/plan-versions/${version.id}/save-as-template`, { method: 'POST', body: { title: `${version.title}` } });
      toast(t('Saved as a template'));
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Plan for {name}', { name: version.patient.name })}
        title={t('Version {number}', { number: version.number ?? '—' })}
        actions={
          <>
            <Link to={`/therapist/plans/${version.planId}/versions`} className="btn btn-secondary">
              <FileStack className="h-5 w-5" aria-hidden="true" /> {t('Version history')}
            </Link>
            <button type="button" className="btn btn-secondary" onClick={saveAsTemplate} disabled={saving}>
              {saving ? <Spinner /> : null} {t('Save as template')}
            </button>
          </>
        }
      >
        {version.status === 'PUBLISHED'
          ? t('Published {date} by {name}. Published versions never change; revise the plan to make changes.', { date: version.publishedAt ? formatDay(version.publishedAt.slice(0, 10)) : '—', name: version.publishedBy?.name ?? '—' })
          : t('This draft was discarded.')}
      </PageHeader>
      <section className="card grid gap-3 p-5">
        <p className="font-display text-xl font-bold">{version.title}</p>
        <p className="text-sm text-ink-500">
          {version.condition} · {t('From {from} to {to}', { from: formatShort(version.effectiveFrom), to: formatShort(version.endDate) })} · {t('Trains {days}', { days: weekdayList(version.trainingWeekdays) })}
        </p>
        {version.restDates.length ? <p className="text-sm text-ink-500">{t('Extra rest days: {dates}', { dates: version.restDates.map(formatShort).join(', ') })}</p> : null}
        {version.changeNote ? <p className="rounded-2xl bg-ink-50 p-3 text-sm">{t('Change note: {note}', { note: version.changeNote })}</p> : null}
        <ol className="grid gap-2">
          {version.items.map((item, index) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink-100 p-3">
              <span className="tabular grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-black text-brand-800">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{item.exercise.title}</p>
                {item.notes ? <p className="text-sm text-ink-500">{item.notes}</p> : null}
              </div>
              <span className="tabular text-sm font-extrabold text-ink-700" dir="ltr">
                {item.sets} × {item.reps} · {formatDuration(item.durationSeconds)}
                {item.holdSeconds ? ` · ${t('hold {n} s', { n: item.holdSeconds })}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function PlanEditorPage() {
  const { versionId = '' } = useParams();
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const version = useApi<{ version: PlanVersion }>(`/therapist/plan-versions/${versionId}`);
  const library = useApi<{ exercises: LibraryExercise[] }>('/therapist/exercises');

  const [form, setForm] = useState<Form | null>(null);
  const [lockVersion, setLockVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restDate, setRestDate] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const loaded = version.data?.version;
  useEffect(() => {
    if (!loaded) return;
    setForm(toForm(loaded));
    setLockVersion(loaded.lockVersion);
    setDirty(false);
  }, [loaded]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(
    async (useLock: number) => {
      if (!form) return null;
      setSaving(true);
      setFields({});
      setError('');
      try {
        const result = await api<{ version: PlanVersion }>(`/therapist/plan-versions/${versionId}`, { method: 'PUT', body: { ...toDraftPayload(form), lockVersion: useLock } });
        setLockVersion(result.version.lockVersion);
        setConflict(false);
        setDirty(false);
        return result.version;
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'stale_draft') setConflict(true);
        else if (caught instanceof ApiError && Object.keys(caught.fields).length) setFields(caught.fields);
        setError(errorMessage(caught));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [form, versionId],
  );

  if (version.error || library.error) {
    return version.error?.status === 404 ? (
      <EmptyState title={t('Plan version not found')} action={<Link to="/therapist" className="btn btn-primary">{t('Back to patients')}</Link>} />
    ) : (
      <ErrorState message={errorMessage(version.error ?? library.error)} onRetry={() => { void version.reload(); void library.reload(); }} />
    );
  }
  if (!loaded || !form || !library.data) return <LoadingBlock rows={4} label={t('Loading plan editor')} />;
  if (loaded.status !== 'DRAFT') return <PublishedVersionView version={loaded} />;

  const update = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch });
    setDirty(true);
  };
  const today = todayIn(loaded.patient.timezone);
  const isRevision = loaded.planStatus !== 'DRAFT';
  const restCount = 7 - form.trainingWeekdays.length;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (await save(lockVersion)) toast(t('Draft saved'));
  }

  async function reloadLatest() {
    await version.reload();
    setConflict(false);
    setError('');
  }

  async function overwrite() {
    try {
      const latest = await api<{ version: PlanVersion }>(`/therapist/plan-versions/${versionId}`);
      if (latest.version.status !== 'DRAFT') {
        setError(t('This draft was published or discarded in the meantime.'));
        return;
      }
      if (await save(latest.version.lockVersion)) toast(t('Your version was saved'));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function goToPreview() {
    const saved = dirty ? await save(lockVersion) : loaded;
    if (saved) navigate(`/therapist/plan-versions/${versionId}/preview`);
  }

  async function discard() {
    try {
      await api(`/therapist/plan-versions/${versionId}/discard`, { method: 'POST', body: { lockVersion } });
      toast(t('Draft discarded'));
      navigate(`/therapist/patients/${loaded!.patient.id}`);
    } catch (caught) {
      setConfirmDiscard(false);
      if (caught instanceof ApiError && caught.code === 'stale_draft') setConflict(true);
      setError(errorMessage(caught));
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Plan for {name}', { name: loaded.patient.name })} title={isRevision ? t('Revise plan (draft)') : t('New plan (draft)')}>
        {t('Drafts are private. The patient sees nothing until you preview and publish.')}
      </PageHeader>

      {conflict ? (
        <div role="alert" className="card grid gap-3 border-sun-300 bg-sun-50 p-4">
          <p className="flex items-center gap-2 font-extrabold text-ink-900">
            <AlertTriangle className="h-5 w-5 text-sun-600" aria-hidden="true" /> {t('Someone else saved this draft after you opened it')}
          </p>
          <p className="text-sm text-ink-700">{t('Your changes are still in the form below and have not been saved. Choose what to do:')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={reloadLatest}>
              {t('Load the latest version (discard my changes)')}
            </button>
            <button type="button" className="btn btn-sun btn-sm" onClick={overwrite}>
              {t('Save my version over it')}
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-6" noValidate>
        <section className="card grid gap-4 p-5 md:grid-cols-2" aria-label={t('Plan details')}>
          <TextField id="plan-title" label={t('Plan title')} value={form.title} onChange={(event) => update({ title: event.target.value })} error={fields.title} maxLength={100} required />
          <TextField id="plan-condition" label={t('Focus area')} value={form.condition} onChange={(event) => update({ condition: event.target.value })} error={fields.condition} maxLength={100} required />
          <TextField
            id="plan-start"
            label={isRevision ? t('Changes take effect on') : t('Start date')}
            type="date"
            min={today}
            value={form.effectiveFrom}
            onChange={(event) => update({ effectiveFrom: event.target.value })}
            error={fields.effectiveFrom}
            hint={isRevision ? t('Today or later. Earlier days keep the version that applied then.') : undefined}
          />
          <TextField id="plan-end" label={t('End date')} type="date" min={form.effectiveFrom} value={form.endDate} onChange={(event) => update({ endDate: event.target.value })} error={fields.endDate} />

          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="field-label mb-1">{t('Training days')}</legend>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const on = form.trainingWeekdays.includes(day);
                return (
                  <label key={day}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={on}
                      onChange={() => update({ trainingWeekdays: on ? form.trainingWeekdays.filter((value) => value !== day) : [...form.trainingWeekdays, day].sort() })}
                      aria-label={weekdayName(day, 'long')}
                    />
                    <span className="grid h-12 min-w-14 cursor-pointer place-items-center rounded-2xl border-2 border-ink-200 px-2 font-extrabold text-ink-500 transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-500">
                      {weekdayName(day)}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-sm text-ink-500">
              {fields.trainingWeekdays ? <span className="font-bold text-rose-700">{fields.trainingWeekdays}</span> : t('{count} rest days per week', { count: restCount })}{' '}
              {t('Rest days never break the patient’s streak.')}
            </p>
          </fieldset>

          <div className="grid gap-2 md:col-span-2">
            <p className="field-label">{t('Extra rest days (optional)')}</p>
            <p className="text-sm text-ink-500">{t('Days off on a normal training weekday, for example a holiday or a check-up.')}</p>
            <div className="flex flex-wrap items-end gap-2">
              <TextField id="rest-date" label={t('Rest date')} type="date" min={form.effectiveFrom} max={form.endDate} value={restDate} onChange={(event) => setRestDate(event.target.value)} />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!restDate || form.restDates.includes(restDate)}
                onClick={() => {
                  update({ restDates: [...form.restDates, restDate].sort() });
                  setRestDate('');
                }}
              >
                <CalendarX className="h-5 w-5" aria-hidden="true" /> {t('Add rest day')}
              </button>
            </div>
            {fields.restDates ? <p className="text-sm font-bold text-rose-700">{fields.restDates}</p> : null}
            {form.restDates.length ? (
              <ul className="flex flex-wrap gap-2">
                {form.restDates.map((date) => (
                  <li key={date}>
                    <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-grape-50 px-3 text-sm font-extrabold text-grape-700" onClick={() => update({ restDates: form.restDates.filter((value) => value !== date) })} aria-label={t('Remove rest day {date}', { date: formatDay(date) })}>
                      {formatDay(date)} ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <TextArea id="plan-notes" label={t('Note for the patient (optional)')} value={form.therapistNotes} onChange={(event) => update({ therapistNotes: event.target.value })} maxLength={1000} rows={3} />
          </div>
          {isRevision ? (
            <div className="md:col-span-2">
              <TextField id="plan-change" label={t('What changed and why (optional, for the history)')} value={form.changeNote} onChange={(event) => update({ changeNote: event.target.value })} maxLength={300} />
            </div>
          ) : null}
        </section>

        <section className="card grid gap-4 p-5" aria-labelledby="exercises-title">
          <div>
            <h2 id="exercises-title" className="font-display text-xl font-bold">
              {t('Exercises')}
            </h2>
            <p className="text-sm text-ink-500">{t('Past records keep the instructions and numbers that applied when they were done.')}</p>
          </div>
          {library.data.exercises.length === 0 ? (
            <InlineMessage tone="info">
              {t('Your exercise library is empty.')} <Link className="underline" to="/therapist/exercises">{t('Add exercises')}</Link>
            </InlineMessage>
          ) : null}
          <ItemsEditor items={form.items} onChange={(items) => update({ items })} library={library.data.exercises} fields={fields} emptyError={fields.items} />
        </section>

        {error && !conflict ? <InlineMessage tone="error">{error}</InlineMessage> : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmDiscard(true)}>
            <Trash2 className="h-5 w-5" aria-hidden="true" /> {t('Discard draft')}
          </button>
          <div className="flex flex-wrap gap-2">
            {dirty ? <Chip tone="sun">{t('Unsaved changes')}</Chip> : <Chip tone="brand">{t('Saved')}</Chip>}
            <button type="submit" className="btn btn-secondary" disabled={saving || !dirty}>
              {saving ? <Spinner /> : <Save className="h-5 w-5" aria-hidden="true" />} {t('Save draft')}
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={goToPreview} disabled={saving || form.items.length === 0}>
              <Eye className="h-5 w-5" aria-hidden="true" /> {t('Preview as patient')}
            </button>
          </div>
        </div>
      </form>

      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title={t('Discard this draft?')}>
        <p className="text-ink-700">{isRevision ? t('The published plan stays as it is. Only this draft is removed.') : t('This plan was never published, so it will be archived.')}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmDiscard(false)}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-soft-danger" onClick={discard}>
            {t('Discard draft')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
