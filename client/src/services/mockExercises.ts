import type { ExerciseDetail } from '../types/patientDashboard';

export const exerciseDetails: ExerciseDetail[] = [
  {
    id: '1',
    name: 'Heel Slides',
    targetArea: 'Knee',
    difficulty: 'Easy',
    sets: 3,
    reps: 12,
    durationSeconds: 60,
    status: 'not-completed',
    instructions:
      'Lie on your back with your legs straight. Slowly slide your heel toward your body by bending your knee, then return to the starting position.',
    safetyNote: 'Move slowly and stop if pain becomes sharp or unusual.',
  },
  {
    id: '2',
    name: 'Quad Sets',
    targetArea: 'Knee',
    difficulty: 'Easy',
    sets: 3,
    reps: 10,
    durationSeconds: 45,
    status: 'not-completed',
    instructions:
      'Sit or lie with your leg straight. Tighten the muscle on the front of your thigh and press the back of your knee gently toward the floor. Hold briefly, then relax.',
    safetyNote: 'Do not force the knee downward. Keep the contraction controlled.',
  },
  {
    id: '3',
    name: 'Glute Bridges',
    targetArea: 'Hip / Knee Support',
    difficulty: 'Medium',
    sets: 3,
    reps: 12,
    durationSeconds: 75,
    status: 'not-completed',
    instructions:
      'Lie on your back with knees bent and feet flat on the floor. Tighten your glutes and lift your hips until your body forms a straight line from shoulders to knees. Lower slowly.',
    safetyNote: 'Keep the movement controlled and avoid arching your lower back.',
  },
];

export function getExerciseById(exerciseId: string | undefined) {
  return exerciseDetails.find((exercise) => exercise.id === exerciseId);
}
