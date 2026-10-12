export type PatientStatus = 'All' | 'On Track' | 'Needs Attention' | 'Missed Tasks';

export type PhysioPatient = {
  id: string;
  name: string;
  injury: string;
  currentPlan: string;
  completionRate: string;
  averagePain: string;
  currentStreak: string;
  status: Exclude<PatientStatus, 'All'>;
  lastActivity: string;
};

export const patientStatusFilters: PatientStatus[] = ['All', 'On Track', 'Needs Attention', 'Missed Tasks'];

export const physioPatients: PhysioPatient[] = [
  {
    id: '1',
    name: 'Guy Abramovich',
    injury: 'Knee rehabilitation',
    currentPlan: 'Knee Stability Phase 1',
    completionRate: '86%',
    averagePain: '3.1/10',
    currentStreak: '6 days',
    status: 'On Track',
    lastActivity: "Completed today's quest 15 minutes ago",
  },
  {
    id: '2',
    name: 'Daniel Cohen',
    injury: 'Shoulder rehabilitation',
    currentPlan: 'Shoulder Mobility Phase 2',
    completionRate: '52%',
    averagePain: '6.8/10',
    currentStreak: '1 day',
    status: 'Needs Attention',
    lastActivity: 'Reported pain level 7/10 1 hour ago',
  },
  {
    id: '3',
    name: 'Maya Levi',
    injury: 'Knee rehabilitation',
    currentPlan: 'Knee Stability Phase 1',
    completionRate: '41%',
    averagePain: '4.2/10',
    currentStreak: '0 days',
    status: 'Missed Tasks',
    lastActivity: 'Missed 2 assigned exercises 3 hours ago',
  },
  {
    id: '4',
    name: 'Noa Mizrahi',
    injury: 'Ankle rehabilitation',
    currentPlan: 'Ankle Mobility Phase 1',
    completionRate: '74%',
    averagePain: '2.9/10',
    currentStreak: '4 days',
    status: 'On Track',
    lastActivity: 'Completed 4 of 5 weekly quests yesterday',
  },
  {
    id: '5',
    name: 'Eitan Bar',
    injury: 'Lower back rehabilitation',
    currentPlan: 'Core Stability Phase 1',
    completionRate: '67%',
    averagePain: '5.1/10',
    currentStreak: '2 days',
    status: 'Needs Attention',
    lastActivity: 'Added a note about back stiffness today',
  },
];
