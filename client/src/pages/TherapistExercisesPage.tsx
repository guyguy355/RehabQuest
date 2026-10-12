import { Clock3, Dumbbell, Loader2, Pencil, PlayCircle, Repeat2, Save, Target, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, getAuthHeaders } from '../auth/session';
import { apiBaseUrl } from '../config/api';
import { PhysioShell } from '../components/PhysioShell';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

type TherapistExercise = {
  id: string;
  title: string;
  description: string;
  bodyPart: string;
  difficulty: Difficulty;
  sets: number;
  reps: number;
  durationSeconds: number;
  videoUrl?: string | null;
  imageUrl?: string | null;
  createdAt: string;
};

type ExerciseForm = {
  title: string;
  description: string;
  bodyPart: string;
  difficulty: Difficulty;
  sets: string;
  reps: string;
  durationSeconds: string;
  videoUrl: string;
  imageUrl: string;
};

const initialForm: ExerciseForm = {
  title: '',
  description: '',
  bodyPart: '',
  difficulty: 'EASY',
  sets: '3',
  reps: '10',
  durationSeconds: '60',
  videoUrl: '',
  imageUrl: '',
};

export function TherapistExercisesPage() {
  const [form, setForm] = useState<ExerciseForm>(initialForm);
  const [exercises, setExercises] = useState<TherapistExercise[]>([]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);

  async function loadExercises() {
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await apiFetch(`${apiBaseUrl}/therapist/exercises`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not load exercises');
        setIsError(true);
        return;
      }

      setExercises(data.exercises ?? []);
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadExercises();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    setIsSubmitting(true);

    try {
      const isEditing = Boolean(editingExerciseId);
      const response = await apiFetch(
        isEditing
          ? `${apiBaseUrl}/therapist/exercises/${editingExerciseId}`
          : `${apiBaseUrl}/therapist/exercises`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            bodyPart: form.bodyPart,
            difficulty: form.difficulty,
            sets: Number(form.sets),
            reps: Number(form.reps),
            durationSeconds: Number(form.durationSeconds),
            videoUrl: form.videoUrl,
            imageUrl: form.imageUrl,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? `Could not ${isEditing ? 'update' : 'create'} exercise`);
        setIsError(true);
        return;
      }

      setForm(initialForm);
      setEditingExerciseId(null);
      setMessage(isEditing ? 'Exercise updated successfully' : 'Exercise created successfully');
      await loadExercises();
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(exerciseId: string) {
    setMessage('');
    setIsError(false);
    setDeletingExerciseId(exerciseId);

    try {
      const response = await apiFetch(`${apiBaseUrl}/therapist/exercises/${exerciseId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setMessage(data.message ?? 'Could not delete exercise');
        setIsError(true);
        return;
      }

      if (editingExerciseId === exerciseId) {
        cancelEdit();
      }

      setMessage('Exercise deleted successfully');
      await loadExercises();
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setDeletingExerciseId(null);
    }
  }

  function startEdit(exercise: TherapistExercise) {
    setEditingExerciseId(exercise.id);
    setMessage('');
    setIsError(false);
    setForm({
      title: exercise.title,
      description: exercise.description,
      bodyPart: exercise.bodyPart,
      difficulty: exercise.difficulty,
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      durationSeconds: String(exercise.durationSeconds),
      videoUrl: exercise.videoUrl ?? '',
      imageUrl: exercise.imageUrl ?? '',
    });
  }

  function cancelEdit() {
    setEditingExerciseId(null);
    setForm(initialForm);
  }

  function updateForm(field: keyof ExerciseForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-4 py-6 sm:px-5 sm:py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Custom exercises</p>
          <h1 className="mt-2 break-words font-display text-[2rem] font-bold leading-tight text-on-background sm:text-[2.3rem] md:text-[2.9rem]">
            Therapist Exercises
          </h1>
          <p className="mt-2 max-w-2xl text-base font-semibold text-on-surface-variant sm:text-lg">
            Create exercise templates that stay scoped to your therapist account.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {editingExerciseId ? 'Edit' : 'Create'}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">
              {editingExerciseId ? 'Edit exercise' : 'New exercise'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Title" value={form.title} onChange={(value) => updateForm('title', value)} />
              <TextField label="Body part" value={form.bodyPart} onChange={(value) => updateForm('bodyPart', value)} />
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-on-surface">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-on-surface shadow-ambient outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-on-surface">Difficulty</span>
                <select
                  value={form.difficulty}
                  onChange={(event) => updateForm('difficulty', event.target.value)}
                  className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </label>
              <TextField label="Sets" type="number" value={form.sets} onChange={(value) => updateForm('sets', value)} />
              <TextField label="Reps" type="number" value={form.reps} onChange={(value) => updateForm('reps', value)} />
              <TextField
                label="Duration seconds"
                type="number"
                value={form.durationSeconds}
                onChange={(value) => updateForm('durationSeconds', value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Video URL" value={form.videoUrl} onChange={(value) => updateForm('videoUrl', value)} />
              <TextField label="Image URL" value={form.imageUrl} onChange={(value) => updateForm('imageUrl', value)} />
            </div>

            {message ? (
              <p
                className={[
                  'rounded-xl px-4 py-3 text-sm font-semibold',
                  isError
                    ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'bg-surface-container-low text-on-surface-variant',
                ].join(' ')}
              >
                {message}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {editingExerciseId ? 'Save Changes' : 'Create Exercise'}
              </button>
              {editingExerciseId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/60 px-5 font-display text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high sm:w-auto"
                >
                  <X className="h-5 w-5" />
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">My exercises</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">
              {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
            </h2>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 font-semibold text-on-surface-variant">Loading exercises</p>
            </div>
          ) : exercises.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  isDeleting={deletingExerciseId === exercise.id}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
              <Dumbbell className="mx-auto h-9 w-9 text-primary" />
              <h3 className="mt-3 font-display text-2xl font-semibold text-on-surface">No exercises created yet</h3>
              <p className="mt-2 text-on-surface-variant">Create your first custom exercise with the form above.</p>
            </div>
          )}
        </section>
      </main>
    </PhysioShell>
  );
}

function TextField({
  label,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-on-surface">{label}</span>
      <input
        type={type}
        value={value}
        min={type === 'number' ? 1 : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function ExerciseCard({
  exercise,
  isDeleting,
  onEdit,
  onDelete,
}: {
  exercise: TherapistExercise;
  isDeleting: boolean;
  onEdit: (exercise: TherapistExercise) => void;
  onDelete: (exerciseId: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
      {exercise.imageUrl ? (
        <img
          src={exercise.imageUrl}
          alt={exercise.title}
          className="mb-5 h-44 w-full rounded-2xl object-cover"
        />
      ) : null}

      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-container/20 text-primary">
          <Dumbbell className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h3 className="break-words font-display text-xl font-semibold text-on-surface sm:text-2xl">{exercise.title}</h3>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">{exercise.bodyPart}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-on-surface-variant">{exercise.description}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric icon={Target} label="Sets" value={String(exercise.sets)} />
        <Metric icon={Repeat2} label="Reps" value={String(exercise.reps)} />
        <Metric icon={Clock3} label="Duration" value={`${exercise.durationSeconds}s`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-on-surface-variant">
        <span className="rounded-full bg-surface-container-low px-3 py-1">{exercise.difficulty}</span>
        <span>Created {new Date(exercise.createdAt).toLocaleDateString()}</span>
        {exercise.videoUrl ? (
          <a href={exercise.videoUrl} className="inline-flex items-center gap-1 text-primary" target="_blank">
            <PlayCircle className="h-4 w-4" />
            Video
          </a>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => onEdit(exercise)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant/60 px-4 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => onDelete(exercise.id)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete
        </button>
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-3 py-3">
      <Icon className="h-5 w-5 text-primary" strokeWidth={2.1} />
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-on-surface">{value}</p>
    </div>
  );
}

