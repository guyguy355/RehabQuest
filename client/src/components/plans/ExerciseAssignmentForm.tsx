import { Plus } from 'lucide-react';
import { ExerciseAssignmentCard } from './ExerciseAssignmentCard';
import type { AvailableExercise, ExerciseAssignment } from '../../services/mockRehabPlanBuilder';

type ExerciseAssignmentFormProps = {
  assignments: ExerciseAssignment[];
  exercises: AvailableExercise[];
  onAdd: () => void;
  onChange: (assignment: ExerciseAssignment) => void;
  onRemove: (assignmentId: string) => void;
};

export function ExerciseAssignmentForm({
  assignments,
  exercises,
  onAdd,
  onChange,
  onRemove,
}: ExerciseAssignmentFormProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Exercise assignment</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Add exercises to plan</h2>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-base font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.2} />
          Add Exercise
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {assignments.map((assignment) => (
          <ExerciseAssignmentCard
            key={assignment.id}
            assignment={assignment}
            exercises={exercises}
            onChange={onChange}
            onRemove={() => onRemove(assignment.id)}
          />
        ))}
      </div>
    </section>
  );
}
