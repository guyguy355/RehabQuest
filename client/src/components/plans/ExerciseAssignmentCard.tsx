import { Trash2 } from 'lucide-react';
import type { AvailableExercise, ExerciseAssignment } from '../../services/mockRehabPlanBuilder';

type ExerciseAssignmentCardProps = {
  assignment: ExerciseAssignment;
  exercises: AvailableExercise[];
  onChange: (assignment: ExerciseAssignment) => void;
  onRemove: () => void;
};

export function ExerciseAssignmentCard({ assignment, exercises, onChange, onRemove }: ExerciseAssignmentCardProps) {
  function updateNumber(field: 'dayNumber' | 'sets' | 'reps' | 'durationSeconds', value: string) {
    onChange({ ...assignment, [field]: Number(value) });
  }

  function selectExercise(exerciseId: string) {
    const exercise = exercises.find((item) => item.id === exerciseId);

    if (!exercise) {
      return;
    }

    onChange({
      ...assignment,
      exerciseId: exercise.id,
      sets: exercise.defaultSets,
      reps: exercise.defaultReps,
      durationSeconds: exercise.defaultDurationSeconds,
      difficulty: exercise.difficulty,
    });
  }

  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Assignment</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-on-surface">Exercise task</h3>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-10 w-10 place-items-center rounded-xl text-on-surface-variant transition hover:bg-red-100 hover:text-red-800"
          aria-label="Remove exercise assignment"
        >
          <Trash2 className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Exercise">
          <select
            value={assignment.exerciseId}
            onChange={(event) => selectExercise(event.target.value)}
            className={fieldClassName}
          >
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day number">
          <input
            type="number"
            min="1"
            value={assignment.dayNumber}
            onChange={(event) => updateNumber('dayNumber', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="Sets">
          <input
            type="number"
            min="1"
            value={assignment.sets}
            onChange={(event) => updateNumber('sets', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="Reps">
          <input
            type="number"
            min="1"
            value={assignment.reps}
            onChange={(event) => updateNumber('reps', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="Duration seconds">
          <input
            type="number"
            min="1"
            value={assignment.durationSeconds}
            onChange={(event) => updateNumber('durationSeconds', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="Difficulty">
          <select
            value={assignment.difficulty}
            onChange={(event) =>
              onChange({ ...assignment, difficulty: event.target.value as ExerciseAssignment['difficulty'] })
            }
            className={fieldClassName}
          >
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </Field>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-bold text-on-surface">Notes/instructions override</span>
        <textarea
          value={assignment.notes}
          onChange={(event) => onChange({ ...assignment, notes: event.target.value })}
          rows={3}
          placeholder="Optional clinician note for this assignment..."
          className="mt-2 w-full resize-none rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-on-surface shadow-ambient outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-on-surface">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const fieldClassName =
  'h-12 w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';
