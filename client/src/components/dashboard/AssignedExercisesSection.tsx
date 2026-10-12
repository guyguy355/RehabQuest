import { CalendarDays, CheckCircle2, Clock3, Dumbbell, Loader2, PlayCircle, Repeat2, Target } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, getAuthHeaders } from '../../auth/session';
import { apiBaseUrl } from '../../config/api';

type AssignedExercise = {
  assignmentId: string;
  id: string;
  title: string;
  description: string;
  bodyPart: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  sets: number;
  reps: number;
  durationSeconds: number;
  videoUrl?: string | null;
  imageUrl?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  completedAt?: string | null;
  painLevel?: number | null;
  difficultyFeedback?: string | null;
  patientNote?: string | null;
  feedbackAt?: string | null;
  status: 'ASSIGNED' | 'COMPLETED' | 'SKIPPED';
};

export function AssignedExercisesSection() {
  const [exercises, setExercises] = useState<AssignedExercise[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [completingAssignmentId, setCompletingAssignmentId] = useState<string | null>(null);
  const [feedbackAssignmentId, setFeedbackAssignmentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    async function loadExercises() {
      try {
        const response = await apiFetch(`${apiBaseUrl}/patient/exercises`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message ?? 'Could not load assigned exercises');
          return;
        }

        setExercises(data.exercises ?? []);
      } catch {
        setMessage('Could not reach the RehabQuest API');
      } finally {
        setIsLoading(false);
      }
    }

    void loadExercises();
  }, []);

  async function handleComplete(assignmentId: string) {
    setActionError('');
    setCompletingAssignmentId(assignmentId);

    try {
      const response = await apiFetch(`${apiBaseUrl}/patient/exercises/${assignmentId}/complete`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionError(data.message ?? 'Could not mark exercise as completed');
        return;
      }

      setExercises((current) =>
        current.map((exercise) =>
          exercise.assignmentId === assignmentId ? { ...exercise, ...data.exercise } : exercise,
        ),
      );
    } catch {
      setActionError('Could not reach the RehabQuest API');
    } finally {
      setCompletingAssignmentId(null);
    }
  }

  async function handleFeedback(
    assignmentId: string,
    feedback: { painLevel: number; difficultyFeedback: string; patientNote: string },
  ) {
    setActionError('');
    setFeedbackAssignmentId(assignmentId);

    try {
      const response = await apiFetch(`${apiBaseUrl}/patient/exercises/${assignmentId}/feedback`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(feedback),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionError(data.message ?? 'Could not save feedback');
        return;
      }

      setExercises((current) =>
        current.map((exercise) =>
          exercise.assignmentId === assignmentId ? { ...exercise, ...data.exercise } : exercise,
        ),
      );
    } catch {
      setActionError('Could not reach the RehabQuest API');
    } finally {
      setFeedbackAssignmentId(null);
    }
  }

  const groupedExercises = useMemo(() => {
    const today = new Date();

    return {
      today: exercises.filter((exercise) => exercise.status !== 'COMPLETED' && isSameDay(exercise.dueDate, today)),
      upcoming: exercises.filter((exercise) => exercise.status !== 'COMPLETED' && isFutureDay(exercise.dueDate, today)),
      completed: exercises.filter((exercise) => exercise.status === 'COMPLETED'),
      unscheduled: exercises.filter((exercise) => exercise.status !== 'COMPLETED' && !exercise.dueDate),
    };
  }, [exercises]);

  if (isLoading) {
    return (
      <section className="md:col-span-12">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-semibold text-on-surface-variant">Loading assigned exercises</p>
        </div>
      </section>
    );
  }

  if (message) {
    return (
      <section className="md:col-span-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 shadow-ambient">
          {message}
        </div>
      </section>
    );
  }

  if (exercises.length === 0) {
    return (
      <section className="md:col-span-12">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
          <Dumbbell className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-3 font-display text-2xl font-semibold text-on-surface">No exercises assigned yet</h2>
          <p className="mt-2 text-on-surface-variant">Your therapist has not assigned any exercises yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="md:col-span-12">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Assigned care</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Your Exercises</h2>
      </div>

      {actionError ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 shadow-ambient">
          {actionError}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <ExerciseGroup
          title="Today"
          exercises={groupedExercises.today}
          emptyText="No exercises due today."
          completingAssignmentId={completingAssignmentId}
          feedbackAssignmentId={feedbackAssignmentId}
          onComplete={handleComplete}
          onFeedback={handleFeedback}
        />
        <ExerciseGroup
          title="Upcoming"
          exercises={[...groupedExercises.upcoming, ...groupedExercises.unscheduled]}
          emptyText="No upcoming exercises."
          completingAssignmentId={completingAssignmentId}
          feedbackAssignmentId={feedbackAssignmentId}
          onComplete={handleComplete}
          onFeedback={handleFeedback}
        />
        <ExerciseGroup
          title="Completed"
          exercises={groupedExercises.completed}
          emptyText="No completed exercises yet."
          completingAssignmentId={completingAssignmentId}
          feedbackAssignmentId={feedbackAssignmentId}
          onComplete={handleComplete}
          onFeedback={handleFeedback}
        />
      </div>
    </section>
  );
}

function ExerciseGroup({
  title,
  exercises,
  emptyText,
  completingAssignmentId,
  feedbackAssignmentId,
  onComplete,
  onFeedback,
}: {
  title: string;
  exercises: AssignedExercise[];
  emptyText: string;
  completingAssignmentId: string | null;
  feedbackAssignmentId: string | null;
  onComplete: (assignmentId: string) => void;
  onFeedback: (
    assignmentId: string,
    feedback: { painLevel: number; difficultyFeedback: string; patientNote: string },
  ) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold text-on-surface">{title}</h3>
        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">
          {exercises.length}
        </span>
      </div>

      {exercises.length > 0 ? (
        <div className="grid gap-4">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.assignmentId}
              exercise={exercise}
              isCompleting={completingAssignmentId === exercise.assignmentId}
              isSavingFeedback={feedbackAssignmentId === exercise.assignmentId}
              onComplete={onComplete}
              onFeedback={onFeedback}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 text-sm font-semibold text-on-surface-variant shadow-ambient">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
  isCompleting,
  isSavingFeedback,
  onComplete,
  onFeedback,
}: {
  exercise: AssignedExercise;
  isCompleting: boolean;
  isSavingFeedback: boolean;
  onComplete: (assignmentId: string) => void;
  onFeedback: (
    assignmentId: string,
    feedback: { painLevel: number; difficultyFeedback: string; patientNote: string },
  ) => void;
}) {
  const isCompleted = exercise.status === 'COMPLETED';

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
      {exercise.imageUrl ? (
        <img
          src={exercise.imageUrl}
          alt={exercise.title}
          className="mb-4 h-40 w-full rounded-2xl object-cover"
        />
      ) : null}

      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-container/20 text-primary">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
          ) : (
            <Dumbbell className="h-5 w-5" strokeWidth={2.2} />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="font-display text-xl font-semibold text-on-surface">{exercise.title}</h4>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">{exercise.bodyPart}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-on-surface-variant">{exercise.description}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Metric icon={Target} label="Sets" value={String(exercise.sets)} />
        <Metric icon={Repeat2} label="Reps" value={String(exercise.reps)} />
        <Metric icon={Clock3} label="Time" value={`${exercise.durationSeconds}s`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-on-surface-variant">
        <span className="rounded-full bg-surface-container-low px-3 py-1">{exercise.difficulty}</span>
        <span className="rounded-full bg-surface-container-low px-3 py-1">{exercise.status}</span>
        {exercise.dueDate ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4 text-primary" />
            {new Date(exercise.dueDate).toLocaleDateString()}
          </span>
        ) : null}
        {exercise.videoUrl ? (
          <a href={exercise.videoUrl} target="_blank" className="inline-flex items-center gap-1 text-primary">
            <PlayCircle className="h-4 w-4" />
            Video
          </a>
        ) : null}
      </div>

      {exercise.notes ? (
        <div className="mt-4 rounded-xl bg-surface-container-low px-4 py-3 text-sm leading-6 text-on-surface-variant">
          {exercise.notes}
        </div>
      ) : null}

      <button
        type="button"
        disabled={isCompleted || isCompleting}
        onClick={() => onComplete(exercise.assignmentId)}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
      >
        {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {isCompleted ? 'Completed' : 'Mark as completed'}
      </button>

      {isCompleted ? (
        exercise.feedbackAt ? (
          <FeedbackSummary exercise={exercise} />
        ) : (
          <FeedbackForm exercise={exercise} isSaving={isSavingFeedback} onFeedback={onFeedback} />
        )
      ) : null}
    </article>
  );
}

function FeedbackForm({
  exercise,
  isSaving,
  onFeedback,
}: {
  exercise: AssignedExercise;
  isSaving: boolean;
  onFeedback: (
    assignmentId: string,
    feedback: { painLevel: number; difficultyFeedback: string; patientNote: string },
  ) => void;
}) {
  const [painLevel, setPainLevel] = useState('1');
  const [difficultyFeedback, setDifficultyFeedback] = useState('');
  const [patientNote, setPatientNote] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFeedback(exercise.assignmentId, {
      painLevel: Number(painLevel),
      difficultyFeedback,
      patientNote,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-xl bg-surface-container-low p-3 sm:p-4">
      <p className="text-sm font-bold text-on-surface">How did it feel?</p>
      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Pain level</span>
        <input
          type="number"
          min={1}
          max={10}
          value={painLevel}
          onChange={(event) => setPainLevel(event.target.value)}
          className="h-11 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Difficulty</span>
        <input
          value={difficultyFeedback}
          onChange={(event) => setDifficultyFeedback(event.target.value)}
          placeholder="Easy, just right, too hard..."
          className="h-11 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 text-on-surface outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Note</span>
        <textarea
          value={patientNote}
          onChange={(event) => setPatientNote(event.target.value)}
          rows={3}
          className="resize-none rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>
      <button
        type="submit"
        disabled={isSaving}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Save Feedback
      </button>
    </form>
  );
}

function FeedbackSummary({ exercise }: { exercise: AssignedExercise }) {
  return (
    <div className="mt-4 rounded-xl bg-secondary-container px-4 py-3 text-sm text-on-secondary-container">
      <p className="font-bold">Feedback submitted</p>
      <p className="mt-1 font-semibold">Pain level: {exercise.painLevel}/10</p>
      {exercise.difficultyFeedback ? <p className="mt-1">{exercise.difficultyFeedback}</p> : null}
      {exercise.patientNote ? <p className="mt-1">{exercise.patientNote}</p> : null}
      {exercise.feedbackAt ? (
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em]">
          {new Date(exercise.feedbackAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-3 py-3">
      <Icon className="h-4 w-4 text-primary" strokeWidth={2.1} />
      <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-base font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function isSameDay(value: string | null | undefined, date: Date) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  return (
    parsed.getFullYear() === date.getFullYear() &&
    parsed.getMonth() === date.getMonth() &&
    parsed.getDate() === date.getDate()
  );
}

function isFutureDay(value: string | null | undefined, date: Date) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  const startOfToday = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startOfParsed = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();

  return startOfParsed > startOfToday;
}
