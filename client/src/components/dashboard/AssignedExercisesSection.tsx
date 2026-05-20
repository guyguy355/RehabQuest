import { CalendarDays, CheckCircle2, Clock3, Dumbbell, Loader2, PlayCircle, Repeat2, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const apiBaseUrl = 'http://localhost:3000';

type AssignedExercise = {
  id: string;
  title: string;
  description: string;
  bodyPart: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  sets: number;
  reps: number;
  durationSeconds: number;
  videoUrl?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  status: 'ASSIGNED' | 'COMPLETED' | 'SKIPPED';
};

export function AssignedExercisesSection() {
  const [exercises, setExercises] = useState<AssignedExercise[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadExercises() {
      try {
        const response = await fetch(`${apiBaseUrl}/patient/exercises`, {
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

      <div className="grid gap-6 lg:grid-cols-3">
        <ExerciseGroup title="Today" exercises={groupedExercises.today} emptyText="No exercises due today." />
        <ExerciseGroup
          title="Upcoming"
          exercises={[...groupedExercises.upcoming, ...groupedExercises.unscheduled]}
          emptyText="No upcoming exercises."
        />
        <ExerciseGroup title="Completed" exercises={groupedExercises.completed} emptyText="No completed exercises yet." />
      </div>
    </section>
  );
}

function ExerciseGroup({
  title,
  exercises,
  emptyText,
}: {
  title: string;
  exercises: AssignedExercise[];
  emptyText: string;
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
            <ExerciseCard key={exercise.id} exercise={exercise} />
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

function ExerciseCard({ exercise }: { exercise: AssignedExercise }) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-container/20 text-primary">
          {exercise.status === 'COMPLETED' ? (
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

      <div className="mt-4 grid grid-cols-3 gap-2">
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
    </article>
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

function getAuthHeaders(): Record<string, string> {
  const token =
    localStorage.getItem('rehabquestToken') ?? localStorage.getItem('authToken') ?? localStorage.getItem('token');

  return token ? { Authorization: `Bearer ${token}` } : {};
}
