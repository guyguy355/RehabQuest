import { Award, Flame, LockKeyhole, Target } from 'lucide-react';

export const badgeSummary = [
  { label: 'Earned Badges', value: '3', icon: Award, tone: 'mint' as const },
  { label: 'Locked Badges', value: '5', icon: LockKeyhole, tone: 'blue' as const },
  { label: 'Current Streak', value: '6 days', icon: Flame, tone: 'amber' as const },
];

export const earnedBadgeDetails = [
  {
    name: 'First Quest Completed',
    description: 'Completed your first daily rehab quest.',
    status: 'Earned' as const,
    icon: Award,
  },
  {
    name: '3 Day Streak',
    description: 'Completed rehab quests for 3 days in a row.',
    status: 'Earned' as const,
    icon: Flame,
  },
  {
    name: 'Consistency Hero',
    description: 'Completed today’s rehab quest and kept your streak alive.',
    status: 'Earned' as const,
    icon: Target,
  },
];

export const lockedBadgeDetails = [
  {
    name: '7 Day Streak',
    description: 'Complete rehab quests for 7 days in a row.',
    progress: '6/7',
    icon: Flame,
  },
  {
    name: 'Pain Logger',
    description: 'Submit pain reports after 10 completed exercises.',
    progress: '8/10',
    icon: Award,
  },
  {
    name: 'Plan Halfway',
    description: 'Complete 50% of your current rehab plan.',
    progress: '12/24 tasks',
    icon: Target,
  },
  {
    name: 'Comeback Week',
    description: 'Complete every assigned rehab quest in one full week.',
    progress: '6/7 days',
    icon: Flame,
  },
  {
    name: 'Plan Completed',
    description: 'Complete all tasks in your current rehab plan.',
    progress: '12/24 tasks',
    icon: Target,
  },
];
