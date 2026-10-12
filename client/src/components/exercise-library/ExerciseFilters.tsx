import type { ExerciseDifficulty, ExerciseTargetArea } from '../../services/mockExerciseLibrary';

type ExerciseFiltersProps = {
  targetAreas: ExerciseTargetArea[];
  difficulties: ExerciseDifficulty[];
  selectedTargetArea: ExerciseTargetArea;
  selectedDifficulty: ExerciseDifficulty;
  onTargetAreaChange: (targetArea: ExerciseTargetArea) => void;
  onDifficultyChange: (difficulty: ExerciseDifficulty) => void;
};

export function ExerciseFilters({
  targetAreas,
  difficulties,
  selectedTargetArea,
  selectedDifficulty,
  onTargetAreaChange,
  onDifficultyChange,
}: ExerciseFiltersProps) {
  return (
    <div className="grid gap-4">
      <FilterGroup
        label="Target area"
        options={targetAreas}
        selectedOption={selectedTargetArea}
        onChange={onTargetAreaChange}
      />
      <FilterGroup
        label="Difficulty"
        options={difficulties}
        selectedOption={selectedDifficulty}
        onChange={onDifficultyChange}
      />
    </div>
  );
}

function FilterGroup<TOption extends string>({
  label,
  options,
  selectedOption,
  onChange,
}: {
  label: string;
  options: TOption[];
  selectedOption: TOption;
  onChange: (option: TOption) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option === selectedOption;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={[
                'h-10 rounded-xl px-3 text-sm font-bold transition active:scale-95',
                isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container-lowest text-on-surface-variant shadow-ambient hover:bg-surface-container-high',
              ].join(' ')}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
