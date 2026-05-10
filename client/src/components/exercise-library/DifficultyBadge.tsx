import type { LibraryExercise } from '../../services/mockExerciseLibrary';

type DifficultyBadgeProps = {
  difficulty: LibraryExercise['difficulty'];
};

const difficultyClasses: Record<LibraryExercise['difficulty'], string> = {
  Easy: 'bg-secondary-container text-on-secondary-container',
  Medium: 'bg-tertiary-fixed text-on-tertiary-fixed',
  Hard: 'bg-red-100 text-red-800',
};

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${difficultyClasses[difficulty]}`}>{difficulty}</span>;
}
