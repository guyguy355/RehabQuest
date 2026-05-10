import { Award, Flame, HeartPulse, Target, TrendingUp } from 'lucide-react';

export const progressMetrics = [
  {
    title: 'Plan Progress',
    value: '50%',
    description: '12 of 24 tasks completed',
    icon: Target,
    tone: 'blue' as const,
  },
  {
    title: 'Weekly Completion',
    value: '86%',
    description: '6 of 7 days active',
    icon: TrendingUp,
    tone: 'mint' as const,
  },
  {
    title: 'Current Streak',
    value: '6 days',
    description: 'Keep your recovery habit alive',
    icon: Flame,
    tone: 'amber' as const,
  },
  {
    title: 'Average Pain',
    value: '3.1/10',
    description: 'Stable compared to last week',
    icon: HeartPulse,
    tone: 'blue' as const,
  },
];

export const painTrend = [
  { day: 'Monday', value: 4 },
  { day: 'Tuesday', value: 3 },
  { day: 'Wednesday', value: 3 },
  { day: 'Thursday', value: 2 },
  { day: 'Friday', value: 3 },
  { day: 'Saturday', value: 3 },
  { day: 'Sunday', value: 4 },
];

export const completedExercises = [
  { name: 'Heel Slides', completedTimes: 4 },
  { name: 'Quad Sets', completedTimes: 4 },
  { name: 'Glute Bridges', completedTimes: 3 },
  { name: 'Ankle Pumps', completedTimes: 1 },
];

export const earnedBadges = [
  { name: 'First Quest Completed', icon: Award },
  { name: '3 Day Streak', icon: Flame },
  { name: 'Consistency Hero', icon: Award },
];
