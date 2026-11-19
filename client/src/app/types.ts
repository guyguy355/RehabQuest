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
  mediaAlt: string | null;
  /** Animated 3D demonstration. Sent on patient screens only; null/absent when there is none to show. */
  demo?: ExerciseDemo | null;
};

/**
 * Which predefined animation demonstrates an exercise (see features/demo and docs/EXERCISE_DEMOS.md).
 * The server sends it only when a physiotherapist approved it, or (preview mode) while UNREVIEWED.
 */
export type ExerciseDemo = {
  type: 'PROCEDURAL' | 'GLB';
  key: string;
  reviewStatus: 'UNREVIEWED' | 'APPROVED';
  modelUrl: string | null;
  clipName: string | null;
};

export type LibraryExercise = Exercise & { sets: number; reps: number; durationSeconds: number; usedInPlans: number; usedInTemplates: number };

/** An entry in the built-in starter catalog (shared, read-only). `inLibrary`: already copied into my library. */
export type CatalogExercise = Pick<Exercise, 'title' | 'description' | 'bodyPart' | 'difficulty'> & {
  key: string;
  instructions: string;
  safetyNotes: string;
  sets: number;
  reps: number;
  durationSeconds: number;
  inLibrary: boolean;
};

export type CompletionStatus = 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'STOPPED';
export type DifficultyRating = 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD';
export type OutcomeReason = 'PAIN_OR_DISCOMFORT' | 'TIRED' | 'NO_TIME' | 'FORGOT' | 'NO_EQUIPMENT' | 'UNSURE_HOW' | 'OTHER';

export type Completion = {
  id: string;
  taskId: string;
  sessionDate: string;
  status: CompletionStatus;
  painLevel: number | null;
  difficulty: DifficultyRating | null;
  reason: OutcomeReason | null;
  notes: string | null;
  setsCompleted: number | null;
  repsPerSet: number[];
  activeSeconds: number | null;
  xpAwarded: number;
  needsReview: boolean;
  reviewedAt: string | null;
  completedAt: string;
  occurredAt: string | null;
  receivedAt: string;
  source: 'ONLINE' | 'OFFLINE_SYNC';
  prescribed: { sets: number; reps: number; durationSeconds: number; holdSeconds: number | null; restSeconds: number | null };
  exercise?: { id: string; title: string };
  reviewReasons?: string[];
};

/** One prescribed exercise as the patient sees it (from an immutable published version). */
export type PlanTask = {
  id: string; // stable task slot id
  taskId: string;
  versionItemId: string;
  versionId: string;
  sets: number;
  reps: number;
  holdSeconds: number | null;
  restSeconds: number | null;
  durationSeconds: number;
  orderIndex: number;
  notes: string | null;
  exercise: Exercise;
};

export type PlanStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT' | 'ARCHIVED';

export type Plan = {
  id: string;
  title: string;
  condition: string;
  status: PlanStatus;
  revision: number;
  startDate: string;
  endDate: string;
  trainingWeekdays: number[];
  restDates: string[];
  therapistNotes: string | null;
  therapist: { id: string; name: string };
  versionId: string | null;
  versionNumber: number | null;
  tasks: PlanTask[];
  pauses: { startDate: string; endDate: string | null }[];
};

export type DayState = 'done' | 'skipped' | 'missed' | 'today' | 'upcoming' | 'rest' | 'paused';

export type Day = {
  date: string;
  week: number;
  versionNumber: number;
  isTrainingDay: boolean;
  state: DayState;
  taskCount: number;
  completedCount: number;
  partialCount: number;
  skippedCount: number;
  stoppedCount: number;
};

/** One session day as the patient recorded it (GET /patient/sessions/:date). */
export type SessionDay = {
  date: string;
  today: string;
  state: DayState;
  planTitle: string | null;
  /** All XP confirmed for that day, including the session bonus. */
  xpEarned: number;
  items: { taskId: string; title: string; prescribed: Completion['prescribed']; completion: Completion | null }[];
};

export type SessionStats = {
  totalSessions: number;
  sessionsToDate: number;
  doneSessions: number;
  missedSessions: number;
  restDays: number;
  pausedDays: number;
};

export type OverviewStatus = 'no-plan' | 'training' | 'rest' | 'not-started' | 'finished' | 'paused' | 'completed';

export type PatientOverview = {
  today: string;
  timezone: string;
  status: OverviewStatus;
  plan: Plan | null;
  todayVersionId: string | null;
  /** False once the care relationship with the plan's therapist has ended. */
  careActive: boolean;
  todayTasks: (PlanTask & { completion: Completion | null })[];
  nextTrainingDay?: string | null;
  days: Day[];
  streak: number;
  stats: SessionStats | null;
  weeklyGoal: WeeklyGoal | null;
  returnAfterBreak: { missedInRow: number; lastDoneDate: string | null } | null;
  mascotCosmetic: string;
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
  weeklyGoal?: (WeeklyGoal & { justMet: boolean }) | null;
  xpTotal: number;
  xpLast7Days: number;
};

// ----------------------------------------------------------------- authoring

export type VersionItem = {
  id: string;
  taskId: string | null;
  exerciseId: string;
  orderIndex: number;
  sets: number;
  reps: number;
  holdSeconds: number | null;
  restSeconds: number | null;
  durationSeconds: number;
  notes: string | null;
  exercise: Exercise;
};

export type PlanVersion = {
  id: string;
  planId: string;
  patient: { id: string; name: string; timezone: string };
  planStatus: PlanStatus;
  planRevision: number;
  number: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'DISCARDED';
  title: string;
  condition: string;
  therapistNotes: string | null;
  trainingWeekdays: number[];
  restDates: string[];
  effectiveFrom: string;
  endDate: string;
  changeNote: string | null;
  lockVersion: number;
  templateId: string | null;
  basedOnVersionId: string | null;
  createdBy: { id: string; name: string };
  publishedBy: { id: string; name: string } | null;
  publishedAt: string | null;
  updatedAt: string;
  items: VersionItem[];
};

export type VersionSummary = {
  id: string;
  number: number | null;
  status: 'DRAFT' | 'PUBLISHED';
  title: string;
  effectiveFrom: string;
  endDate: string;
  changeNote: string | null;
  publishedAt: string | null;
  publishedBy: { name: string } | null;
  lockVersion: number;
  itemCount: number;
};

export type DraftPreview = {
  version: PlanVersion;
  versionNumber: number;
  isRevision: boolean;
  firstSessionDate: string | null;
  sessionItems: PlanTask[];
  days: { date: string; kind: 'outside' | 'paused' | 'rest' | 'training' }[];
  changes: { added: string[]; removed: string[]; changed: string[] };
};

export type ProgramTemplate = {
  id: string;
  title: string;
  condition: string;
  description: string | null;
  trainingWeekdays: number[];
  durationWeeks: number;
  status: 'ACTIVE' | 'ARCHIVED';
  lockVersion: number;
  updatedAt: string;
  items: {
    id: string;
    exerciseId: string;
    exercise: { id: string; title: string; bodyPart: string };
    orderIndex: number;
    sets: number;
    reps: number;
    holdSeconds: number | null;
    restSeconds: number | null;
    durationSeconds: number;
    notes: string | null;
  }[];
};

// ---- Stage 3: motivation, goals, measurements, check-ins, analytics, education ----

export type WeeklyGoal = {
  weekStart: string;
  weekEnd: string;
  applicable: boolean;
  planned: number;
  target: number;
  done: number;
  met: boolean;
  remaining: number;
};

export type AchievementBadge = Badge & { rule: string };

export type Motivation = {
  today: string;
  preference: { calmMode: boolean; soundEnabled: boolean; weeklySessionGoal: number | null; mascotCosmetic: string };
  weeklyGoal: WeeklyGoal;
  returnAfterBreak: { missedInRow: number; lastDoneDate: string | null } | null;
  badges: AchievementBadge[];
  history: ({ type: 'achievement'; id: string; name: string; at: string } | { type: 'weekly-goal'; id: string; weekStart: string; goal: number; done: number; at: string })[];
  cosmetics: { id: string; unlockedBy: string | null; unlocked: boolean }[];
  equipped: string;
};

export type MeasurementDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';

export type MeasurementDefinition = {
  id: string;
  name: string;
  unit: string;
  direction: MeasurementDirection;
  minValue: number;
  maxValue: number;
  patientCanRecord: boolean;
  archived: boolean;
  values: { id: string; value: number; measuredOn: string; note: string | null; source: 'THERAPIST' | 'PATIENT'; createdAt: string }[];
};

export type Milestone = { id: string; title: string; orderIndex: number; targetDate: string | null; achievedAt: string | null; note: string | null };

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  kind: 'FUNCTIONAL' | 'MEASUREMENT';
  status: 'ACTIVE' | 'ACHIEVED' | 'ARCHIVED';
  targetDate: string | null;
  achievedAt: string | null;
  lockVersion: number;
  therapist: { id: string; name: string };
  createdAt: string;
  milestones: Milestone[];
  measurement: {
    definitionId: string;
    name: string;
    unit: string;
    direction: MeasurementDirection;
    target: number;
    baseline: number | null;
    latest: { measuredOn: string; value: number } | null;
    percent: number | null;
    targetReached: boolean;
  } | null;
};

export type GoalsResponse = { goals: Goal[]; measurements: MeasurementDefinition[] };

export type CheckIn = {
  id: string;
  weekStart: string;
  painTypical: number | null;
  painWorst: number | null;
  activityLimit: number | null;
  confidence: number | null;
  note: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type WeekStatus = 'no-plan' | 'not-applicable' | 'upcoming' | 'measured';

export type WeekRow = {
  weekStart: string;
  weekEnd: string;
  status: WeekStatus;
  planned: number;
  due: number;
  done: number;
  skipped: number;
  missed: number;
  pending: number;
  restDays: number;
  pausedDays: number;
  adherencePercent: number | null;
  painReports: number;
  painAverage: number | null;
  painMax: number | null;
  checkIn: { painTypical: number | null; painWorst: number | null; activityLimit: number | null; confidence: number | null } | null;
};

export type Analytics = {
  today: string;
  weeks: WeekRow[];
  summary: { due: number; done: number; adherencePercent: number | null; painReports: number; painAverage: number | null; measuredWeeks: number; notApplicableWeeks: number };
};

export type CardVersion = { id: string; number: number; title: string; body: string; readingMinutes: number; createdAt: string };

export type CardAssignment = {
  id: string;
  cardId: string;
  note: string | null;
  assignedAt: string;
  task: { id: string; title: string } | null;
  latest: CardVersion;
  state: 'unread' | 'read' | 'updated';
  lastRead: { versionNumber: number; at: string } | null;
};

export type LibraryCard = { id: string; lockVersion: number; archived: boolean; activeAssignments: number; latest: CardVersion };
export type CardDetail = { id: string; lockVersion: number; archived: boolean; versions: CardVersion[] };
