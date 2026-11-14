import { FilePlus2, LayoutTemplate } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { LibraryExercise, PlanVersion, ProgramTemplate } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { TextField } from '../../ui/Field';
import { addDays, weekdayList } from '../../ui/format';
import { ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { todayIn } from './PlanEditorPage';

/** Step 1 of a new plan: start from a template or from a blank draft. */
export function NewPlanPage() {
  const { patientId = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const patient = useApi<{ patient: { id: string; name: string; timezone: string } }>(`/therapist/patients/${patientId}`);
  const templates = useApi<{ templates: ProgramTemplate[] }>('/therapist/templates');
  const library = useApi<{ exercises: LibraryExercise[] }>('/therapist/exercises');
  const [choice, setChoice] = useState<string>('blank');
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (patient.error || templates.error || library.error) return <ErrorState message={errorMessage(patient.error ?? templates.error ?? library.error)} />;
  if (!patient.data || !templates.data || !library.data) return <LoadingBlock rows={3} label={t('Loading')} />;

  const today = todayIn(patient.data.patient.timezone);
  const start = startDate || today;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const firstExercise = library.data!.exercises[0];
      if (choice === 'blank' && !firstExercise) {
        setError(t('Add at least one exercise to your library first.'));
        setSubmitting(false);
        return;
      }
      const body =
        choice === 'blank'
          ? {
              title: t('New plan'),
              condition: '—',
              effectiveFrom: start,
              endDate: addDays(start, 27),
              trainingWeekdays: [1, 3, 5],
              items: [{ exerciseId: firstExercise.id, sets: firstExercise.sets, reps: firstExercise.reps, durationSeconds: firstExercise.durationSeconds }],
            }
          : { templateId: choice, startDate: start };
      const result = await api<{ draft: PlanVersion }>(`/therapist/patients/${patientId}/plans`, { method: 'POST', body });
      navigate(`/therapist/plan-versions/${result.draft.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Plan for {name}', { name: patient.data.patient.name })} title={t('Create a plan')}>
        {t('Start from one of your templates or from scratch. You can edit everything before publishing.')}
      </PageHeader>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <fieldset className="grid gap-3">
          <legend className="field-label mb-2">{t('Start from')}</legend>
          <label className="card-raised flex cursor-pointer items-start gap-3 p-4 has-[:checked]:border-brand-400">
            <input type="radio" name="start-from" className="mt-1 h-5 w-5 accent-brand-600" checked={choice === 'blank'} onChange={() => setChoice('blank')} />
            <span>
              <span className="flex items-center gap-2 font-extrabold">
                <FilePlus2 className="h-5 w-5 text-brand-600" aria-hidden="true" /> {t('Blank plan')}
              </span>
              <span className="text-sm text-ink-500">{t('A draft with one exercise from your library, ready to edit.')}</span>
            </span>
          </label>
          {templates.data.templates.map((template) => (
            <label key={template.id} className="card-raised flex cursor-pointer items-start gap-3 p-4 has-[:checked]:border-brand-400">
              <input type="radio" name="start-from" className="mt-1 h-5 w-5 accent-brand-600" checked={choice === template.id} onChange={() => setChoice(template.id)} />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-extrabold">
                  <LayoutTemplate className="h-5 w-5 text-grape-500" aria-hidden="true" /> {template.title}
                </span>
                <span className="block text-sm text-ink-500">
                  {template.condition} · {t('{count} exercises', { count: template.items.length })} · {t('{count} weeks', { count: template.durationWeeks })} · {weekdayList(template.trainingWeekdays)}
                </span>
              </span>
            </label>
          ))}
          {templates.data.templates.length === 0 ? (
            <p className="text-sm text-ink-500">
              {t('No templates yet.')} <Link className="font-bold text-brand-700 underline" to="/therapist/templates">{t('Create a template')}</Link>
            </p>
          ) : null}
        </fieldset>
        <div className="max-w-xs">
          <TextField id="new-plan-start" label={t('Start date')} type="date" min={today} value={start} onChange={(event) => setStartDate(event.target.value)} />
        </div>
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <div className="flex flex-wrap gap-2">
          <Link to={`/therapist/patients/${patientId}`} className="btn btn-secondary">
            {t('Cancel')}
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <Spinner /> : null} {t('Create draft')}
          </button>
        </div>
      </form>
    </div>
  );
}
