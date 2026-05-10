import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ExerciseStatsCard } from '../components/exercise/ExerciseStatsCard';
import { InstructionCard } from '../components/exercise/InstructionCard';
import { SafetyNoteCard } from '../components/exercise/SafetyNoteCard';
import { VideoPlaceholder } from '../components/exercise/VideoPlaceholder';
import { getExerciseById } from '../services/mockExercises';

const difficultyClasses = {
  Easy: 'bg-secondary-container text-on-secondary-container',
  Medium: 'bg-tertiary-fixed text-on-tertiary-fixed',
  Hard: 'bg-red-100 text-red-800',
};

export function ExerciseDetailsPage() {
  const { exerciseId } = useParams();
  const exercise = getExerciseById(exerciseId);

  if (!exercise) {
    return (
      <AppShell>
        <main className="mx-auto max-w-[760px] px-5 py-7">
          <Link to="/patient/quest" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to quest
          </Link>
          <section className="mt-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-ambient">
            <h1 className="font-display text-3xl font-bold text-on-surface">Exercise not found</h1>
            <p className="mt-2 text-on-surface-variant">Choose an exercise from today’s rehab quest.</p>
          </section>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <Link
          to="/patient/quest"
          className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary transition hover:text-on-primary-container"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to quest
        </Link>

        <section className="mt-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Exercise Details</p>
              <h1 className="mt-2 font-display text-[2.25rem] font-bold leading-tight text-on-background md:text-[2.75rem]">
                {exercise.name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-surface-container px-4 py-2 text-sm font-bold text-on-surface-variant">
                  {exercise.targetArea}
                </span>
                <span className={`rounded-full px-4 py-2 text-sm font-bold ${difficultyClasses[exercise.difficulty]}`}>
                  {exercise.difficulty}
                </span>
              </div>
            </div>

            <Link
              to={`/patient/pain-report/${exercise.id}`}
              className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-display text-lg font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
            >
              <CheckCircle2 className="h-5 w-5" />
              Complete Exercise
            </Link>
          </div>

          <div className="mt-8">
            <ExerciseStatsCard exercise={exercise} />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="grid gap-6">
            <InstructionCard instructions={exercise.instructions} />
            <SafetyNoteCard note={exercise.safetyNote} />
          </div>
          <VideoPlaceholder />
        </div>
      </main>
    </AppShell>
  );
}
