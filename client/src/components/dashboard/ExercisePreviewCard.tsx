import { CheckCircle2, Dumbbell } from 'lucide-react';
import type { ExercisePreview } from '../../types/patientDashboard';

type ExercisePreviewCardProps = {
  exercise: ExercisePreview;
};

const difficultyStyles: Record<ExercisePreview['difficulty'], string> = {
  Easy: 'bg-secondary-container text-on-secondary-container',
  Medium: 'bg-tertiary-fixed text-on-tertiary-fixed',
  Hard: 'bg-red-100 text-red-800',
};

export function ExercisePreviewCard({ exercise }: ExercisePreviewCardProps) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-container-low text-primary">
        <Dumbbell className="h-6 w-6" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-semibold leading-6 text-on-surface">{exercise.name}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${difficultyStyles[exercise.difficulty]}`}>
            {exercise.difficulty}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-on-surface-variant">{exercise.targetArea}</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          {exercise.sets} sets · {exercise.reps} reps
        </p>
      </div>

      <CheckCircle2 className="h-6 w-6 shrink-0 text-outline-variant" strokeWidth={2.1} />
    </article>
  );
}
