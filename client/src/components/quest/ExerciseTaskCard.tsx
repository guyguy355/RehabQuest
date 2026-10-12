import { CheckCircle2, Circle, Dumbbell, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ExercisePreview } from '../../types/patientDashboard';

type ExerciseTaskCardProps = {
  exercise: ExercisePreview;
  index: number;
};

const difficultyClasses: Record<ExercisePreview['difficulty'], string> = {
  Easy: 'bg-secondary-container text-on-secondary-container',
  Medium: 'bg-tertiary-fixed text-on-tertiary-fixed',
  Hard: 'bg-red-100 text-red-800',
};

export function ExerciseTaskCard({ exercise, index }: ExerciseTaskCardProps) {
  const isCompleted = exercise.status === 'completed';

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient transition hover:shadow-ambient-lg">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-container-low text-primary">
          <Dumbbell className="h-6 w-6" strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold leading-7 text-on-surface">{exercise.name}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${difficultyClasses[exercise.difficulty]}`}>
              {exercise.difficulty}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">{exercise.targetArea}</p>
        </div>

        <div
          className={[
            'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold',
            isCompleted ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant',
          ].join(' ')}
        >
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          {isCompleted ? 'Completed' : 'Not completed'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-container-low px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">Sets</p>
          <p className="mt-1 font-display text-2xl font-semibold text-on-surface">{exercise.sets}</p>
        </div>
        <div className="rounded-xl bg-surface-container-low px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">Reps</p>
          <p className="mt-1 font-display text-2xl font-semibold text-on-surface">{exercise.reps}</p>
        </div>
      </div>

      <Link
        to={`/patient/exercise/${index + 1}`}
        className="mt-5 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-base font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
      >
        <Play className="h-4 w-4" fill="currentColor" />
        Start Exercise
      </Link>
    </article>
  );
}
