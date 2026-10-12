export type ExerciseTargetArea =
  | 'All'
  | 'Knee'
  | 'Shoulder'
  | 'Hip / Knee Support'
  | 'Ankle / Circulation'
  | 'Lower Back';

export type ExerciseDifficulty = 'All' | 'Easy' | 'Medium' | 'Hard';

export type LibraryExercise = {
  id: string;
  name: string;
  targetArea: Exclude<ExerciseTargetArea, 'All'>;
  difficulty: Exclude<ExerciseDifficulty, 'All'>;
  defaultSets: number;
  defaultReps: number;
  defaultDurationSeconds: number;
  description: string;
  safetyNote: string;
};

export const targetAreaFilters: ExerciseTargetArea[] = [
  'All',
  'Knee',
  'Shoulder',
  'Hip / Knee Support',
  'Ankle / Circulation',
  'Lower Back',
];

export const difficultyFilters: ExerciseDifficulty[] = ['All', 'Easy', 'Medium', 'Hard'];

export const exerciseLibrary: LibraryExercise[] = [
  {
    id: 'heel-slides',
    name: 'Heel Slides',
    targetArea: 'Knee',
    difficulty: 'Easy',
    defaultSets: 3,
    defaultReps: 12,
    defaultDurationSeconds: 60,
    description: 'Improves knee mobility and range of motion.',
    safetyNote: 'Move slowly and stop if pain becomes sharp or unusual.',
  },
  {
    id: 'quad-sets',
    name: 'Quad Sets',
    targetArea: 'Knee',
    difficulty: 'Easy',
    defaultSets: 3,
    defaultReps: 10,
    defaultDurationSeconds: 45,
    description: 'Activates and strengthens the quadriceps.',
    safetyNote: 'Keep the contraction controlled and avoid forcing the knee.',
  },
  {
    id: 'glute-bridges',
    name: 'Glute Bridges',
    targetArea: 'Hip / Knee Support',
    difficulty: 'Medium',
    defaultSets: 3,
    defaultReps: 12,
    defaultDurationSeconds: 75,
    description: 'Strengthens glutes and supports knee stability.',
    safetyNote: 'Avoid arching the lower back.',
  },
  {
    id: 'ankle-pumps',
    name: 'Ankle Pumps',
    targetArea: 'Ankle / Circulation',
    difficulty: 'Easy',
    defaultSets: 2,
    defaultReps: 20,
    defaultDurationSeconds: 60,
    description: 'Promotes ankle mobility and circulation.',
    safetyNote: 'Keep the movement gentle and controlled.',
  },
  {
    id: 'wall-slides',
    name: 'Wall Slides',
    targetArea: 'Shoulder',
    difficulty: 'Medium',
    defaultSets: 3,
    defaultReps: 10,
    defaultDurationSeconds: 90,
    description: 'Improves shoulder mobility and control.',
    safetyNote: 'Stay within a comfortable range of motion.',
  },
  {
    id: 'bird-dog',
    name: 'Bird Dog',
    targetArea: 'Lower Back',
    difficulty: 'Medium',
    defaultSets: 3,
    defaultReps: 8,
    defaultDurationSeconds: 90,
    description: 'Builds core stability and lower-back control.',
    safetyNote: 'Keep hips level and move slowly.',
  },
];
