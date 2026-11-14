/**
 * The exact rule behind every achievement, shown to patients ("How to earn it") and mirrored in
 * docs/ACHIEVEMENTS.md. Each rule has a test in tests/gamification.test.ts or tests/progress.test.ts.
 */
export const BADGE_RULES: Record<string, string> = {
  'first-session': 'Finish all exercises of one planned session (stopping for discomfort counts as finishing).',
  'steady-three': 'Finish 3 planned sessions in a row. Rest days and approved pauses do not break the run.',
  'full-week': 'Finish every planned session of one plan week (weeks are counted from the plan start).',
  halfway: 'Finish at least half of all planned sessions of your plan (plans with 2 or more sessions).',
  'plan-complete': 'Finish the last planned session of your plan.',
  'weekly-goal': 'Reach your weekly session goal in one week (Sunday to Saturday).',
  'weekly-goal-4': 'Reach your weekly session goal in 4 different weeks. They do not need to be in a row.',
  'welcome-back': 'Finish a planned session after 3 or more planned sessions in a row were missed or skipped.',
  'first-check-in': 'Send your first weekly check-in.',
  'check-in-4': 'Send weekly check-ins in 4 different weeks. They do not need to be in a row.',
  'first-milestone': 'Your therapist confirms your first milestone.',
};
