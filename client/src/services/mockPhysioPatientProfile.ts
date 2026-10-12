import { CalendarDays, Flame, HeartPulse, ListChecks, TrendingUp } from 'lucide-react';

export const patientProfiles = [
  {
    id: '1',
    name: 'Guy Abramovich',
    injury: 'Knee rehabilitation',
    currentStage: 'Strength & stability',
    currentPlan: 'Knee Stability Phase 1',
    status: 'On Track' as const,
    completionRate: '86%',
    averagePain: '3.1/10',
    currentStreak: '6 days',
    missedTasksThisWeek: '1',
    lastActivity: "Completed today's rehab quest 15 minutes ago",
    metrics: [
      {
        title: 'Completion Rate',
        value: '86%',
        description: '18 of 21 assigned tasks completed this week',
        icon: TrendingUp,
        tone: 'mint' as const,
      },
      {
        title: 'Average Pain',
        value: '3.1/10',
        description: 'Stable compared to last week',
        icon: HeartPulse,
        tone: 'blue' as const,
      },
      {
        title: 'Current Streak',
        value: '6 days',
        description: 'Daily rehab consistency',
        icon: Flame,
        tone: 'amber' as const,
      },
      {
        title: 'Missed Tasks',
        value: '1',
        description: 'Missed assigned tasks this week',
        icon: ListChecks,
        tone: 'blue' as const,
      },
    ],
    plan: {
      title: 'Knee Stability Phase 1',
      startDate: 'May 1, 2026',
      endDate: 'May 28, 2026',
      progress: 50,
      tasksCompleted: '12 of 24',
      icon: CalendarDays,
    },
    painReports: [
      {
        exercise: 'Heel Slides',
        pain: '3/10',
        date: 'Today',
        note: 'Felt okay, slight stiffness.',
      },
      {
        exercise: 'Quad Sets',
        pain: '2/10',
        date: 'Today',
        note: 'No major discomfort.',
      },
      {
        exercise: 'Glute Bridges',
        pain: '4/10',
        date: 'Yesterday',
        note: 'Mild discomfort near the end.',
      },
      {
        exercise: 'Heel Slides',
        pain: '3/10',
        date: 'Yesterday',
        note: 'Better than last week.',
      },
    ],
    assignedExercises: [
      {
        name: 'Heel Slides',
        targetArea: 'Knee',
        sets: 3,
        reps: 12,
        status: 'Active',
      },
      {
        name: 'Quad Sets',
        targetArea: 'Knee',
        sets: 3,
        reps: 10,
        status: 'Active',
      },
      {
        name: 'Glute Bridges',
        targetArea: 'Hip / Knee Support',
        sets: 3,
        reps: 12,
        status: 'Active',
      },
    ],
  },
];

export function getPatientProfileById(patientId: string | undefined) {
  return patientProfiles.find((patient) => patient.id === patientId);
}
