import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhysioShell } from '../components/PhysioShell';
import { ExerciseFilters } from '../components/exercise-library/ExerciseFilters';
import { ExerciseLibraryCard } from '../components/exercise-library/ExerciseLibraryCard';
import { ExerciseSearchBar } from '../components/exercise-library/ExerciseSearchBar';
import {
  difficultyFilters,
  exerciseLibrary,
  targetAreaFilters,
} from '../services/mockExerciseLibrary';
import type { ExerciseDifficulty, ExerciseTargetArea } from '../services/mockExerciseLibrary';

export function ExerciseLibraryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetArea, setSelectedTargetArea] = useState<ExerciseTargetArea>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<ExerciseDifficulty>('All');
  const [successMessage, setSuccessMessage] = useState('');

  const filteredExercises = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return exerciseLibrary.filter((exercise) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        exercise.name.toLowerCase().includes(normalizedSearch) ||
        exercise.targetArea.toLowerCase().includes(normalizedSearch) ||
        exercise.description.toLowerCase().includes(normalizedSearch);
      const matchesTargetArea = selectedTargetArea === 'All' || exercise.targetArea === selectedTargetArea;
      const matchesDifficulty = selectedDifficulty === 'All' || exercise.difficulty === selectedDifficulty;

      return matchesSearch && matchesTargetArea && matchesDifficulty;
    });
  }, [searchTerm, selectedDifficulty, selectedTargetArea]);

  function handleAddToPlan(exerciseName: string) {
    setSuccessMessage(`${exerciseName} added to plan draft.`);
  }

  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
          <Link
            to="/physio/dashboard"
            className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary transition hover:text-on-primary-container"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Library</p>
            <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background md:text-[2.9rem]">
              Exercise Library
            </h1>
            <p className="mt-2 max-w-2xl text-lg font-semibold text-on-surface-variant">
              Browse and manage rehab exercises for patient plans.
            </p>
          </div>

          {successMessage ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary-container px-5 py-4 text-on-secondary-container">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
              <p className="font-semibold">{successMessage}</p>
            </div>
          ) : null}

          <div className="mt-7 grid gap-5">
            <ExerciseSearchBar value={searchTerm} onChange={setSearchTerm} />
            <ExerciseFilters
              targetAreas={targetAreaFilters}
              difficulties={difficultyFilters}
              selectedTargetArea={selectedTargetArea}
              selectedDifficulty={selectedDifficulty}
              onTargetAreaChange={setSelectedTargetArea}
              onDifficultyChange={setSelectedDifficulty}
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Results</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">
                {filteredExercises.length} {filteredExercises.length === 1 ? 'exercise' : 'exercises'}
              </h2>
            </div>
          </div>

          {filteredExercises.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredExercises.map((exercise) => (
                <ExerciseLibraryCard key={exercise.id} exercise={exercise} onAddToPlan={handleAddToPlan} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
              <h3 className="font-display text-2xl font-semibold text-on-surface">No exercises found</h3>
              <p className="mt-2 text-on-surface-variant">Try another search term, target area, or difficulty.</p>
            </div>
          )}
        </section>
      </main>
    </PhysioShell>
  );
}
