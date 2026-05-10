import type { AvailableExercise, ExerciseAssignment } from '../../services/mockRehabPlanBuilder';

type AssignedExercisePreviewProps = {
  assignments: ExerciseAssignment[];
  exercises: AvailableExercise[];
};

export function AssignedExercisePreview({ assignments, exercises }: AssignedExercisePreviewProps) {
  function getExerciseName(exerciseId: string) {
    return exercises.find((exercise) => exercise.id === exerciseId)?.name ?? 'Unknown exercise';
  }

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Preview</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Assigned Exercises Preview</h2>

      <div className="mt-5 grid gap-3">
        {assignments.map((assignment) => (
          <article key={assignment.id} className="rounded-2xl bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-on-surface">
                  {getExerciseName(assignment.exerciseId)}
                </h3>
                <p className="mt-1 text-sm font-semibold text-on-surface-variant">Day {assignment.dayNumber}</p>
              </div>
              <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                {assignment.difficulty}
              </span>
            </div>
            <p className="mt-3 text-sm text-on-surface-variant">
              {assignment.sets} sets · {assignment.reps} reps · {assignment.durationSeconds}s
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
