import { BookOpen, Image, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { LibraryExercise } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { SelectField, TextArea, TextField } from '../../ui/Field';
import { exerciseDifficultyLabel, formatDuration } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { ExerciseCatalogBrowser } from './ExerciseCatalogBrowser';

type Form = {
  title: string;
  description: string;
  instructions: string;
  safetyNotes: string;
  bodyPart: string;
  difficulty: LibraryExercise['difficulty'];
  sets: number;
  reps: number;
  durationSeconds: number;
  videoUrl: string;
  imageUrl: string;
  mediaAlt: string;
};

const EMPTY: Form = { title: '', description: '', instructions: '', safetyNotes: '', bodyPart: '', difficulty: 'EASY', sets: 2, reps: 10, durationSeconds: 60, videoUrl: '', imageUrl: '', mediaAlt: '' };

function ExerciseForm({ initial, exerciseId, onSaved, onCancel }: { initial: Form; exerciseId?: string; onSaved: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const hasMedia = Boolean(form.videoUrl.trim() || form.imageUrl.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFields({});
    setError('');
    try {
      await api(exerciseId ? `/therapist/exercises/${exerciseId}` : '/therapist/exercises', { method: exerciseId ? 'PUT' : 'POST', body: form });
      toast(exerciseId ? t('Exercise updated') : t('Exercise added to your library'));
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length) setFields(caught.fields);
      else setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <TextField id="ex-title" label={t('Name')} value={form.title} onChange={(event) => set('title', event.target.value)} error={fields.title} maxLength={100} />
      <TextField id="ex-description" label={t('Purpose (one line)')} value={form.description} onChange={(event) => set('description', event.target.value)} error={fields.description} maxLength={500} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="ex-body" label={t('Body area')} value={form.bodyPart} onChange={(event) => set('bodyPart', event.target.value)} error={fields.bodyPart} maxLength={60} />
        <SelectField id="ex-difficulty" label={t('Difficulty')} value={form.difficulty} onChange={(event) => set('difficulty', event.target.value as Form['difficulty'])}>
          <option value="EASY">{t('Easy')}</option>
          <option value="MEDIUM">{t('Medium')}</option>
          <option value="HARD">{t('Hard')}</option>
        </SelectField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField id="ex-sets" label={t('Default sets')} type="number" min={1} max={20} value={form.sets} onChange={(event) => set('sets', event.target.valueAsNumber)} error={fields.sets} />
        <TextField id="ex-reps" label={t('Default reps')} type="number" min={1} max={100} value={form.reps} onChange={(event) => set('reps', event.target.valueAsNumber)} error={fields.reps} />
        <TextField id="ex-secs" label={t('Time per set (s)')} type="number" min={1} max={3600} value={form.durationSeconds} onChange={(event) => set('durationSeconds', event.target.valueAsNumber)} error={fields.durationSeconds} />
      </div>
      <TextArea id="ex-instructions" label={t('Steps (one per line)')} hint={t('Written steps are always shown, so the exercise can be done without the media.')} value={form.instructions} onChange={(event) => set('instructions', event.target.value)} rows={4} maxLength={2000} />
      <TextArea id="ex-safety" label={t('Safety note (optional)')} value={form.safetyNotes} onChange={(event) => set('safetyNotes', event.target.value)} rows={2} maxLength={1000} />
      <fieldset className="grid gap-3 rounded-2xl border-2 border-ink-100 p-4">
        <legend className="field-label px-1">{t('Media (optional)')}</legend>
        <p className="text-sm text-ink-500">{t('Use only media you made or are licensed to use. Links must start with https://.')}</p>
        <TextField id="ex-video" label={t('Video link')} type="url" dir="ltr" value={form.videoUrl} onChange={(event) => set('videoUrl', event.target.value)} error={fields.videoUrl} placeholder="https://" />
        <TextField id="ex-image" label={t('Image link')} type="url" dir="ltr" value={form.imageUrl} onChange={(event) => set('imageUrl', event.target.value)} error={fields.imageUrl} placeholder="https://" />
        <TextArea
          id="ex-media-alt"
          label={hasMedia ? t('Describe the image or video (required)') : t('Describe the image or video')}
          hint={t('Shown as a caption and read by screen readers.')}
          value={form.mediaAlt}
          onChange={(event) => set('mediaAlt', event.target.value)}
          error={fields.mediaAlt}
          rows={2}
          maxLength={500}
        />
      </fieldset>
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('Cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner /> : null} {exerciseId ? t('Save exercise') : t('Add exercise')}
        </button>
      </div>
    </form>
  );
}

export function ExerciseLibraryPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ exercises: LibraryExercise[] }>('/therapist/exercises');
  const [editing, setEditing] = useState<LibraryExercise | 'new' | null>(null);
  const [deleting, setDeleting] = useState<LibraryExercise | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/therapist/exercises/${deleting.id}`, { method: 'DELETE' });
      toast(t('Exercise deleted'));
      setDeleting(null);
      void reload();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  }

  const toForm = (exercise: LibraryExercise): Form => ({
    title: exercise.title,
    description: exercise.description,
    instructions: exercise.instructions ?? '',
    safetyNotes: exercise.safetyNotes ?? '',
    bodyPart: exercise.bodyPart,
    difficulty: exercise.difficulty,
    sets: exercise.sets,
    reps: exercise.reps,
    durationSeconds: exercise.durationSeconds,
    videoUrl: exercise.videoUrl ?? '',
    imageUrl: exercise.imageUrl ?? '',
    mediaAlt: exercise.mediaAlt ?? '',
  });
  const inUse = (exercise: LibraryExercise) => exercise.usedInPlans + exercise.usedInTemplates > 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Library')}
        title={t('Exercise library')}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setBrowsing(true)}>
              <BookOpen className="h-5 w-5" aria-hidden="true" /> {t('Browse starter exercises')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus className="h-5 w-5" aria-hidden="true" /> {t('New exercise')}
            </button>
          </>
        }
      >
        {t('Your own exercises. Editing an exercise here does not change plans that were already published.')}
      </PageHeader>

      {loading && !data ? <LoadingBlock rows={3} label={t('Loading exercises')} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data && data.exercises.length === 0 ? (
        <EmptyState
          title={t('No exercises yet')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={() => setBrowsing(true)}>{t('Start from the starter catalog')}</button>
              <button className="btn btn-secondary" onClick={() => setEditing('new')}>{t('Add your first exercise')}</button>
            </div>
          }
        >
          {t('Exercises you add here can be used in any of your plans and templates.')}
        </EmptyState>
      ) : null}

      {data && data.exercises.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.exercises.map((exercise) => (
            <li key={exercise.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold leading-tight">{exercise.title}</p>
                  <p className="text-sm text-ink-500">{exercise.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-ink-500 hover:bg-ink-100" onClick={() => setEditing(exercise)} aria-label={t('Edit {name}', { name: exercise.title })}>
                    <Pencil className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-rose-600 hover:bg-rose-50" onClick={() => setDeleting(exercise)} aria-label={t('Delete {name}', { name: exercise.title })}>
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                <Chip tone="brand">{exercise.bodyPart}</Chip>
                <Chip>{exerciseDifficultyLabel(exercise.difficulty)}</Chip>
                <Chip>
                  <bdi dir="ltr">
                    {exercise.sets} × {exercise.reps}
                  </bdi>{' '}
                  · {formatDuration(exercise.durationSeconds)}
                </Chip>
                {exercise.videoUrl ? <Chip tone="sky" icon={<Video className="h-3.5 w-3.5" aria-hidden="true" />}>{t('Video')}</Chip> : null}
                {exercise.imageUrl ? <Chip tone="sky" icon={<Image className="h-3.5 w-3.5" aria-hidden="true" />}>{t('Image')}</Chip> : null}
                {inUse(exercise) ? <Chip tone="grape">{t('In use')}</Chip> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('New exercise') : t('Edit exercise')} wide>
        {editing ? (
          <ExerciseForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? EMPTY : toForm(editing)}
            exerciseId={editing === 'new' ? undefined : editing.id}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void reload();
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={browsing} onClose={() => setBrowsing(false)} title={t('Starter exercises')} wide>
        {browsing ? (
          <ExerciseCatalogBrowser
            onCancel={() => setBrowsing(false)}
            onAdded={() => {
              setBrowsing(false);
              void reload();
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={t('Delete this exercise?')}>
        {deleting ? (
          <>
            <p className="text-ink-700">
              {inUse(deleting)
                ? t('“{name}” is used in a plan or template (including past records), so it cannot be deleted. You can still edit it.', { name: deleting.title })
                : t('“{name}” will be removed from your library.', { name: deleting.title })}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
                {t('Cancel')}
              </button>
              <button type="button" className="btn btn-soft-danger" onClick={confirmDelete} disabled={busy || inUse(deleting)}>
                {busy ? <Spinner /> : null} {t('Delete')}
              </button>
            </div>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
