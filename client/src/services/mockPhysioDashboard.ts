import { AlertTriangle, ClipboardList, Dumbbell, FilePlus2, ListChecks, UsersRound } from 'lucide-react';

export const physioMetrics = [
  {
    title: 'Total Patients',
    value: '8',
    description: 'Active rehab patients',
    icon: UsersRound,
    tone: 'blue' as const,
  },
  {
    title: 'Patients On Track',
    value: '5',
    description: 'Completing assigned quests consistently',
    icon: ListChecks,
    tone: 'mint' as const,
  },
  {
    title: 'Need Attention',
    value: '2',
    description: 'Missed tasks or rising pain reports',
    icon: AlertTriangle,
    tone: 'amber' as const,
  },
  {
    title: 'Average Completion',
    value: '78%',
    description: 'Across all active patients this week',
    icon: ClipboardList,
    tone: 'blue' as const,
  },
];

export const recentPatientActivity = [
  {
    message: 'Guy Abramovich completed today’s rehab quest',
    status: 'Completed',
    time: '15 minutes ago',
  },
  {
    message: 'Daniel Cohen reported pain level 7/10',
    status: 'Needs attention',
    time: '1 hour ago',
  },
  {
    message: 'Maya Levi missed 2 assigned exercises',
    status: 'Missed tasks',
    time: '3 hours ago',
  },
  {
    message: 'Noa Mizrahi completed 4 of 5 weekly quests',
    status: 'On track',
    time: 'Yesterday',
  },
];

export const attentionPatients = [
  {
    id: '1',
    name: 'Daniel Cohen',
    injury: 'Shoulder rehabilitation',
    averagePain: '6.8/10',
    completionRate: '52%',
    reason: 'Pain increased this week',
  },
  {
    id: '2',
    name: 'Maya Levi',
    injury: 'Knee rehabilitation',
    averagePain: '4.2/10',
    completionRate: '41%',
    reason: 'Missed multiple exercises',
  },
];

export const physioQuickActions = [
  {
    title: 'View All Patients',
    to: '/physio/patients',
    icon: UsersRound,
  },
  {
    title: 'Create Rehab Plan',
    to: '/physio/plans/new',
    icon: FilePlus2,
  },
  {
    title: 'Open Exercise Library',
    to: '/physio/exercises',
    icon: Dumbbell,
  },
];
