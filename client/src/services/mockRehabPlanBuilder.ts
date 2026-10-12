export type PlanDetails = {
  patientId: string;
  title: string;
  injuryType: string;
  startDate: string;
  endDate: string;
  rehabStage: string;
};

export type AvailableExercise = {
  id: string;
  name: string;
  targetArea: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  defaultSets: number;
  defaultReps: number;
  defaultDurationSeconds: number;
};

export type ExerciseAssignment = {
  id: string;
  exerciseId: string;
  dayNumber: number;
  sets: number;
  reps: number;
  durationSeconds: number;
  difficulty: AvailableExercise['difficulty'];
  notes: string;
};

export const planPatientOptions = [
  { id: '1', name: 'Guy Abramovich' },
  { id: '2', name: 'Daniel Cohen' },
  { id: '3', name: 'Maya Levi' },
  { id: '4', name: 'Noa Mizrahi' },
  { id: '5', name: 'Eitan Bar' },
];

export const defaultPlanDetails: PlanDetails = {
  patientId: '1',
  title: 'Knee Stability Phase 1',
  injuryType: 'Knee rehabilitation',
  startDate: '2026-05-01',
  endDate: '2026-05-28',
  rehabStage: 'Strength & stability',
};

export const availableExercises: AvailableExercise[] = [
  {
    id: 'heel-slides',
    name: 'Heel Slides',
    targetArea: 'Knee',
    difficulty: 'Easy',
    defaultSets: 3,
    defaultReps: 12,
    defaultDurationSeconds: 60,
  },
  {
    id: 'quad-sets',
    name: 'Quad Sets',
    targetArea: 'Knee',
    difficulty: 'Easy',
    defaultSets: 3,
    defaultReps: 10,
    defaultDurationSeconds: 45,
  },
  {
    id: 'glute-bridges',
    name: 'Glute Bridges',
    targetArea: 'Hip / Knee Support',
    difficulty: 'Medium',
    defaultSets: 3,
    defaultReps: 12,
    defaultDurationSeconds: 75,
  },
  {
    id: 'ankle-pumps',
    name: 'Ankle Pumps',
    targetArea: 'Ankle / Circulation',
    difficulty: 'Easy',
    defaultSets: 2,
    defaultReps: 20,
    defaultDurationSeconds: 60,
  },
  {
    id: 'wall-slides',
    name: 'Wall Slides',
    targetArea: 'Shoulder',
    difficulty: 'Medium',
    defaultSets: 3,
    defaultReps: 10,
    defaultDurationSeconds: 90,
  },
];

export function createAssignmentFromExercise(exercise: AvailableExercise, index: number): ExerciseAssignment {
  return {
    id: `assignment-${Date.now()}-${index}`,
    exerciseId: exercise.id,
    dayNumber: 1,
    sets: exercise.defaultSets,
    reps: exercise.defaultReps,
    durationSeconds: exercise.defaultDurationSeconds,
    difficulty: exercise.difficulty,
    notes: '',
  };
}
