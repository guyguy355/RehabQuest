import { Clock3, Dumbbell, Plus, Repeat2, ShieldAlert, Target } from 'lucide-react';
import type { LibraryExercise } from '../../services/mockExerciseLibrary';
import { DifficultyBadge } from './DifficultyBadge';

type ExerciseLibraryCardProps = {
  exercise: LibraryExercise;
  onAddToPlan: (exerciseName: string) => void;
};

export function ExerciseLibraryCard({ exercise, onAddToPlan }: ExerciseLibraryCardProps) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient transition hover:shadow-ambient-lg">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-container/20 text-primary">
          <Dumbbell className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold text-on-surface">{exercise.name}</h2>
            <DifficultyBadge difficulty={exercise.difficulty} />
          </div>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">{exercise.targetArea}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric icon={Target} label="Sets" value={String(exercise.defaultSets)} />
        <Metric icon={Repeat2} label="Reps" value={String(exercise.defaultReps)} />
        <Metric icon={Clock3} label="Duration" value={`${exercise.defaultDurationSeconds}s`} />
      </div>

      <p className="mt-5 text-sm leading-6 text-on-surface-variant">{exercise.description}</p>

      <div className="mt-4 rounded-xl bg-tertiary-fixed px-4 py-3 text-on-tertiary-fixed">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
          <p className="text-sm font-semibold leading-5">{exercise.safetyNote}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAddToPlan(exercise.name)}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-base font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
      >
        <Plus className="h-5 w-5" strokeWidth={2.2} />
        Add to Plan
      </button>
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
