export type Role = 'PATIENT' | 'THERAPIST' | 'ADMIN';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
};

export type Exercise = {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  safetyNotes: string | null;
  bodyPart: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  videoUrl: string | null;
  imageUrl: string | null;
};

export type LibraryExercise = Exercise & { sets: number; reps: number; durationSeconds: number; usedInPlans: number };

export type CompletionStatus = 'COMPLETED' | 'STOPPED';
export type DifficultyRating = 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD';

export type Completion = {
  id: string;
  taskId: string;
  sessionDate: string;
  status: CompletionStatus;
  painLevel: number;
  difficulty: DifficultyRating | null;
  notes: string | null;
  xpAwarded: number;
  needsReview: boolean;
  reviewedAt: string | null;
  completedAt: string;
  prescribed: { sets: number; reps: number; durationSeconds: number };
  exercise?: { id: string; title: string };
  reviewReasons?: string[];
};

export type PlanTask = {
  id: string;
  sets: number;
  reps: number;
  durationSeconds: number;
  orderIndex: number;
  notes: string | null;
  activeFrom: string;
  activeUntil: string | null;
  exercise: Exercise;
};

export type PlanStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export type Plan = {
  id: string;
  title: string;
  condition: string;
  status: PlanStatus;
  startDate: string;
  endDate: string;
  trainingWeekdays: number[];
  therapistNotes: string | null;
  therapist: { id: string; name: string };
  tasks: PlanTask[];
};

export type DayState = 'done' | 'missed' | 'today' | 'upcoming' | 'rest';

export type Day = {
  date: string;
  week: number;
  isTrainingDay: boolean;
  state: DayState;
  taskCount: number;
  completedCount: number;
  stoppedCount: number;
};

export type SessionStats = {
  totalSessions: number;
  sessionsToDate: number;
  doneSessions: number;
  missedSessions: number;
  restDays: number;
};

export type OverviewStatus = 'no-plan' | 'training' | 'rest' | 'not-started' | 'finished' | 'paused' | 'completed';

export type PatientOverview = {
  today: string;
  timezone: string;
  status: OverviewStatus;
  plan: Plan | null;
  todayTasks: (PlanTask & { completion: Completion | null })[];
  nextTrainingDay?: string | null;
  days: Day[];
  streak: number;
  stats: SessionStats | null;
  xpTotal: number;
  xpLast7Days: number;
};

export type Badge = { id: string; name: string; description: string; icon: string | null; earnedAt: string | null };

export type CompletionResult = {
  alreadyRecorded: boolean;
  completion: Completion;
  xpAwarded: number;
  sessionComplete: boolean;
  newBadges: Badge[];
  xpTotal: number;
  xpLast7Days: number;
};
