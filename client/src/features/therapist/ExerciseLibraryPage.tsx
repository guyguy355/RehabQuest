import { Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { LibraryExercise } from '../../app/types';
import { useApi } from '../../app/useApi';
import { Dialog } from '../../ui/Dialog';
import { SelectField, TextArea, TextField } from '../../ui/Field';
import { formatDuration } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type Form = Omit<LibraryExercise, 'id' | 'usedInPlans' | 'instructions' | 'safetyNotes' | 'videoUrl' | 'imageUrl'> & {
  instructions: string;
  safetyNotes: string;
  videoUrl: string;
};

const EMPTY: Form = { title: '', description: '', instructions: '', safetyNotes: '', bodyPart: '', difficulty: 'EASY', sets: 2, reps: 10, durationSeconds: 60, videoUrl: '' };

function ExerciseForm({ initial, exerciseId, onSaved, onCancel }: { initial: Form; exerciseId?: string; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFields({});
    setError('');
    try {
      await api(exerciseId ? `/therapist/exercises/${exerciseId}` : '/therapist/exercises', { method: exerciseId ? 'PUT' : 'POST', body: form });
      toast(exerciseId ? 'Exercise updated' : 'Exercise added to your library');
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length) setFields(caught.fields);
      else setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <TextField id="ex-title" label="Name" value={form.title} onChange={(event) => set('title', event.target.value)} error={fields.title} maxLength={100} />
      <TextField id="ex-description" label="Purpose (one line)" value={form.description} onChange={(event) => set('description', event.target.value)} error={fields.description} maxLength={500} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="ex-body" label="Body area" value={form.bodyPart} onChange={(event) => set('bodyPart', event.target.value)} error={fields.bodyPart} placeholder="Knee" maxLength={60} />
        <SelectField id="ex-difficulty" label="Difficulty" value={form.difficulty} onChange={(event) => set('difficulty', event.target.value as Form['difficulty'])}>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </SelectField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField id="ex-sets" label="Default sets" type="number" min={1} max={20} value={form.sets} onChange={(event) => set('sets', event.target.valueAsNumber)} error={fields.sets} />
        <TextField id="ex-reps" label="Default reps" type="number" min={1} max={100} value={form.reps} onChange={(event) => set('reps', event.target.valueAsNumber)} error={fields.reps} />
        <TextField id="ex-secs" label="Seconds per set" type="number" min={1} max={3600} value={form.durationSeconds} onChange={(event) => set('durationSeconds', event.target.valueAsNumber)} error={fields.durationSeconds} />
      </div>
      <TextArea id="ex-instructions" label="Steps (one per line)" value={form.instructions} onChange={(event) => set('instructions', event.target.value)} rows={4} maxLength={2000} />
      <TextArea id="ex-safety" label="Safety note (optional)" value={form.safetyNotes} onChange={(event) => set('safetyNotes', event.target.value)} rows={2} maxLength={1000} />
      <TextField id="ex-video" label="Video link (optional)" type="url" value={form.videoUrl} onChange={(event) => set('videoUrl', event.target.value)} error={fields.videoUrl} placeholder="https://" />
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner /> : null} {exerciseId ? 'Save exercise' : 'Add exercise'}
        </button>
      </div>
    </form>
  );
}

export function ExerciseLibraryPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ exercises: LibraryExercise[] }>('/therapist/exercises');
  const [editing, setEditing] = useState<LibraryExercise | 'new' | null>(null);
  const [deleting, setDeleting] = useState<LibraryExercise | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/therapist/exercises/${deleting.id}`, { method: 'DELETE' });
      toast('Exercise deleted');
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
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Library"
        title="Exercise library"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-5 w-5" aria-hidden="true" /> New exercise
          </button>
        }
      >
        Your own exercises. Defaults are copied into a plan, where you can adjust them per patient.
      </PageHeader>

      {loading && !data ? <LoadingBlock rows={3} label="Loading exercises" /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data && data.exercises.length === 0 ? <EmptyState title="No exercises yet" action={<button className="btn btn-primary" onClick={() => setEditing('new')}>Add your first exercise</button>}>Exercises you add here can be used in any of your plans.</EmptyState> : null}

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
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100" onClick={() => setEditing(exercise)} aria-label={`Edit ${exercise.title}`}>
                    <Pencil className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50" onClick={() => setDeleting(exercise)} aria-label={`Delete ${exercise.title}`}>
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                <Chip tone="brand">{exercise.bodyPart}</Chip>
                <Chip>{exercise.difficulty.toLowerCase()}</Chip>
                <Chip>
                  {exercise.sets} × {exercise.reps} · {formatDuration(exercise.durationSeconds)}/set
                </Chip>
                {exercise.usedInPlans ? <Chip tone="sky">in {exercise.usedInPlans} plan{exercise.usedInPlans === 1 ? '' : 's'}</Chip> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New exercise' : 'Edit exercise'} wide>
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

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Delete this exercise?">
        {deleting ? (
          <>
            <p className="text-ink-700">
              {deleting.usedInPlans > 0
                ? `“${deleting.title}” is used in ${deleting.usedInPlans} plan item${deleting.usedInPlans === 1 ? "" : "s"} (including past records), so it cannot be deleted. You can still edit it.`
                : `“${deleting.title}” will be removed from your library.`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-soft-danger" onClick={confirmDelete} disabled={busy || deleting.usedInPlans > 0}>
                {busy ? <Spinner /> : null} Delete
              </button>
            </div>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
