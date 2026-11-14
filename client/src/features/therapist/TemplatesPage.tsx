import { Archive, Copy, LayoutTemplate, Pencil, Plus, RotateCcw, UserPlus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { LibraryExercise, PlanVersion, ProgramTemplate } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { SelectField, TextArea, TextField } from '../../ui/Field';
import { weekdayList, weekdayName } from '../../ui/format';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { type ItemDraft, ItemsEditor, newItemKey, toItemPayload } from './ItemsEditor';
import { todayIn } from './PlanEditorPage';
import type { PatientRow } from './TherapistHome';

function UseTemplateDialog({ template, onClose }: { template: ProgramTemplate | null; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const patients = useApi<{ patients: PatientRow[] }>(template ? '/therapist/patients' : null);
  const [patientId, setPatientId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!template || !patientId || busy) return;
    setBusy(true);
    setError('');
    try {
      const patient = await api<{ patient: { timezone: string } }>(`/therapist/patients/${patientId}`);
      const result = await api<{ draft: PlanVersion }>(`/therapist/patients/${patientId}/plans`, { method: 'POST', body: { templateId: template.id, startDate: todayIn(patient.patient.timezone) } });
      navigate(`/therapist/plan-versions/${result.draft.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Dialog open={template !== null} onClose={onClose} title={t('Use template for a patient')}>
      <form onSubmit={create} className="grid gap-4">
        <p className="text-ink-700">{t('A copy of the template becomes a draft plan. Later edits to the template do not change the patient’s plan.')}</p>
        <SelectField id="template-patient" label={t('Patient')} value={patientId} onChange={(event) => setPatientId(event.target.value)}>
          <option value="">{t('Choose a patient…')}</option>
          {(patients.data?.patients ?? []).map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </SelectField>
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <button type="submit" className="btn btn-primary" disabled={!patientId || busy}>
          {busy ? <Spinner /> : <UserPlus className="h-5 w-5" aria-hidden="true" />} {t('Create draft plan')}
        </button>
      </form>
    </Dialog>
  );
}

export function TemplatesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [archived, setArchived] = useState(false);
  const { data, error, loading, reload } = useApi<{ templates: ProgramTemplate[] }>(`/therapist/templates${archived ? '?status=ARCHIVED' : ''}`);
  const [using, setUsing] = useState<ProgramTemplate | null>(null);

  async function act(path: string, message: string, navigateTo?: (template: ProgramTemplate) => string) {
    try {
      const result = await api<{ template: ProgramTemplate }>(path, { method: 'POST' });
      toast(message);
      if (navigateTo) navigate(navigateTo(result.template));
      else void reload();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Library')}
        title={t('Program templates')}
        actions={
          <Link to="/therapist/templates/new" className="btn btn-primary">
            <Plus className="h-5 w-5" aria-hidden="true" /> {t('New template')}
          </Link>
        }
      >
        {t('Reusable programs. Using a template copies it into a patient draft; the two stay independent.')}
      </PageHeader>

      <div role="tablist" aria-label={t('Template status')} className="flex gap-2">
        {[false, true].map((value) => (
          <button key={String(value)} role="tab" aria-selected={archived === value} type="button" className={`btn btn-sm ${archived === value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setArchived(value)}>
            {value ? t('Archived') : t('Active')}
          </button>
        ))}
      </div>

      {loading && !data ? <LoadingBlock rows={3} label={t('Loading templates')} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data && data.templates.length === 0 ? (
        <EmptyState title={archived ? t('No archived templates') : t('No templates yet')} mood="think">
          {archived ? null : t('Create a template from scratch, or save any plan version as a template.')}
        </EmptyState>
      ) : null}

      {data && data.templates.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.templates.map((template) => (
            <li key={template.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <LayoutTemplate className="mt-1 h-6 w-6 shrink-0 text-grape-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold leading-tight">{template.title}</p>
                  <p className="text-sm text-ink-500">
                    {template.condition} · {t('{count} exercises', { count: template.items.length })} · {t('{count} weeks', { count: template.durationWeeks })} · {weekdayList(template.trainingWeekdays)}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {archived ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(`/therapist/templates/${template.id}/restore`, t('Template restored'))}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t('Restore')}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setUsing(template)}>
                      <UserPlus className="h-4 w-4" aria-hidden="true" /> {t('Use for a patient')}
                    </button>
                    <Link to={`/therapist/templates/${template.id}`} className="btn btn-secondary btn-sm">
                      <Pencil className="h-4 w-4" aria-hidden="true" /> {t('Edit')}
                    </Link>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(`/therapist/templates/${template.id}/duplicate`, t('Template copied'), (copy) => `/therapist/templates/${copy.id}`)}>
                      <Copy className="h-4 w-4" aria-hidden="true" /> {t('Duplicate')}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(`/therapist/templates/${template.id}/archive`, t('Template archived'))}>
                      <Archive className="h-4 w-4" aria-hidden="true" /> {t('Archive')}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <UseTemplateDialog template={using} onClose={() => setUsing(null)} />
    </div>
  );
}

type TemplateForm = { title: string; condition: string; description: string; trainingWeekdays: number[]; durationWeeks: number; items: ItemDraft[] };

export function TemplateEditorPage() {
  const { templateId } = useParams();
  const isNew = !templateId || templateId === 'new';
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const existing = useApi<{ template: ProgramTemplate }>(isNew ? null : `/therapist/templates/${templateId}`);
  const library = useApi<{ exercises: LibraryExercise[] }>('/therapist/exercises');
  const [form, setForm] = useState<TemplateForm | null>(isNew ? { title: '', condition: '', description: '', trainingWeekdays: [1, 3, 5], durationWeeks: 4, items: [] } : null);
  const [lockVersion, setLockVersion] = useState(1);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const template = existing.data?.template;
    if (!template) return;
    setLockVersion(template.lockVersion);
    setForm({
      title: template.title,
      condition: template.condition,
      description: template.description ?? '',
      trainingWeekdays: template.trainingWeekdays,
      durationWeeks: template.durationWeeks,
      items: template.items.map((item) => ({ key: newItemKey(), exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, holdSeconds: item.holdSeconds, restSeconds: item.restSeconds, durationSeconds: item.durationSeconds, notes: item.notes ?? '' })),
    });
  }, [existing.data]);

  if (existing.error || library.error) return <ErrorState message={errorMessage(existing.error ?? library.error)} />;
  if (!form || !library.data) return <LoadingBlock rows={3} label={t('Loading template')} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setFields({});
    setError('');
    const body = { title: form.title, condition: form.condition, description: form.description.trim() || null, trainingWeekdays: form.trainingWeekdays, durationWeeks: form.durationWeeks, items: toItemPayload(form.items, false) };
    try {
      if (isNew) await api('/therapist/templates', { method: 'POST', body });
      else await api(`/therapist/templates/${templateId}`, { method: 'PUT', body: { ...body, lockVersion } });
      toast(isNew ? t('Template created') : t('Template saved'));
      navigate('/therapist/templates');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'stale_template') setStale(true);
      if (caught instanceof ApiError && Object.keys(caught.fields).length) setFields(caught.fields);
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Program templates')} title={isNew ? t('New template') : t('Edit template')}>
        {t('Changes here never affect plans already created from this template.')}
      </PageHeader>
      {stale ? (
        <div role="alert" className="card grid gap-2 border-sun-300 bg-sun-50 p-4">
          <p className="font-extrabold">{t('This template was changed in another window')}</p>
          <p className="text-sm">{t('Your changes are still in the form. Reload to see the latest version, then re-apply your edits.')}</p>
          <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={() => { setStale(false); void existing.reload(); }}>
            {t('Load the latest version')}
          </button>
        </div>
      ) : null}
      <form onSubmit={submit} className="grid gap-6" noValidate>
        <section className="card grid gap-4 p-5 md:grid-cols-2">
          <TextField id="template-title" label={t('Template name')} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} error={fields.title} maxLength={100} />
          <TextField id="template-condition" label={t('Focus area')} value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} error={fields.condition} maxLength={100} />
          <TextField id="template-weeks" label={t('Length (weeks)')} type="number" min={1} max={52} value={form.durationWeeks} onChange={(event) => setForm({ ...form, durationWeeks: event.target.valueAsNumber })} error={fields.durationWeeks} />
          <fieldset className="grid gap-2">
            <legend className="field-label mb-1">{t('Training days')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const on = form.trainingWeekdays.includes(day);
                return (
                  <label key={day}>
                    <input type="checkbox" className="peer sr-only" checked={on} aria-label={weekdayName(day, 'long')} onChange={() => setForm({ ...form, trainingWeekdays: on ? form.trainingWeekdays.filter((value) => value !== day) : [...form.trainingWeekdays, day].sort() })} />
                    <span className="grid h-11 min-w-11 cursor-pointer place-items-center rounded-xl border-2 border-ink-200 px-1.5 text-sm font-extrabold text-ink-500 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-sky-500">
                      {weekdayName(day)}
                    </span>
                  </label>
                );
              })}
            </div>
            {fields.trainingWeekdays ? <p className="text-sm font-bold text-rose-700">{fields.trainingWeekdays}</p> : null}
          </fieldset>
          <div className="md:col-span-2">
            <TextArea id="template-description" label={t('Description / note for the patient (optional)')} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={1000} rows={2} />
          </div>
        </section>
        <section className="card grid gap-4 p-5">
          <h2 className="font-display text-xl font-bold">{t('Exercises')}</h2>
          <ItemsEditor items={form.items} onChange={(items) => setForm({ ...form, items })} library={library.data.exercises} fields={fields} emptyError={fields.items} />
        </section>
        {error && !stale ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/therapist/templates" className="btn btn-secondary">
            {t('Cancel')}
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <Spinner /> : null} {isNew ? t('Create template') : t('Save template')}
          </button>
        </div>
      </form>
    </div>
  );
}
