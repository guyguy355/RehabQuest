import type { LucideIcon } from 'lucide-react';

export type PatientDashboardData = {
  patientName: string;
  injury: string;
  currentPlan: string;
  todayQuest: string;
  streakDays: number;
  progressPercent: number;
  averagePain: number;
  completedExercises: number;
  totalExercises: number;
  adherencePercent: number;
  nextAssessment: string;
  exercises: ExercisePreview[];
  badges: BadgePreview[];
  journey: JourneyStep[];
};

export type ExercisePreview = {
  name: string;
  targetArea: string;
  sets: number;
  reps: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

export type BadgePreview = {
  title: string;
  description: string;
  status: 'earned' | 'in-progress' | 'locked';
};

export type JourneyStep = {
  label: string;
  status: 'completed' | 'current' | 'upcoming';
};

export type BottomNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};
