import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhysioShell } from '../components/PhysioShell';
import { AssignedExercisePreview } from '../components/plans/AssignedExercisePreview';
import { ExerciseAssignmentForm } from '../components/plans/ExerciseAssignmentForm';
import { PlanDetailsForm } from '../components/plans/PlanDetailsForm';
import {
  availableExercises,
  createAssignmentFromExercise,
  defaultPlanDetails,
  planPatientOptions,
} from '../services/mockRehabPlanBuilder';
import type { ExerciseAssignment, PlanDetails } from '../services/mockRehabPlanBuilder';

export function CreateRehabPlanPage() {
  const [planDetails, setPlanDetails] = useState<PlanDetails>(defaultPlanDetails);
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([
    createAssignmentFromExercise(availableExercises[0], 0),
    createAssignmentFromExercise(availableExercises[1], 1),
    createAssignmentFromExercise(availableExercises[2], 2),
  ]);
  const [successMessage, setSuccessMessage] = useState('');

  function addAssignment() {
    setAssignments((currentAssignments) => [
      ...currentAssignments,
      createAssignmentFromExercise(availableExercises[0], currentAssignments.length),
    ]);
    setSuccessMessage('');
  }

  function updateAssignment(updatedAssignment: ExerciseAssignment) {
    setAssignments((currentAssignments) =>
      currentAssignments.map((assignment) =>
        assignment.id === updatedAssignment.id ? updatedAssignment : assignment,
      ),
    );
    setSuccessMessage('');
  }

  function removeAssignment(assignmentId: string) {
    setAssignments((currentAssignments) =>
      currentAssignments.filter((assignment) => assignment.id !== assignmentId),
    );
    setSuccessMessage('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage('Rehab plan saved locally for demo.');
  }

  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <form onSubmit={handleSubmit} className="grid gap-6">
          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
            <Link
              to="/physio/dashboard"
              className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary transition hover:text-on-primary-container"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>

            <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Plan builder</p>
                <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background md:text-[2.9rem]">
                  Create Rehab Plan
                </h1>
                <p className="mt-2 max-w-2xl text-lg font-semibold text-on-surface-variant">
                  Build a structured recovery plan with daily exercises and progress tracking.
                </p>
              </div>

              <button
                type="submit"
                className="flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-display text-base font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
              >
                Save Plan
              </button>
            </div>

            {successMessage ? (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary-container px-5 py-4 text-on-secondary-container">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
                <p className="font-semibold">{successMessage}</p>
              </div>
            ) : null}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid content-start gap-6">
              <PlanDetailsForm value={planDetails} patients={planPatientOptions} onChange={setPlanDetails} />
              <ExerciseAssignmentForm
                assignments={assignments}
                exercises={availableExercises}
                onAdd={addAssignment}
                onChange={updateAssignment}
                onRemove={removeAssignment}
              />
            </div>

            <div className="content-start">
              <AssignedExercisePreview assignments={assignments} exercises={availableExercises} />
            </div>
          </div>
        </form>
      </main>
    </PhysioShell>
  );
}
