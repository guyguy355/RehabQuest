export const aiProgressSummary = {
  patientId: '1',
  patient: {
    name: 'Guy Abramovich',
    injury: 'Knee rehabilitation',
    currentPlan: 'Knee Stability Phase 1',
    currentStage: 'Strength & stability',
    completionRate: '86%',
    averagePain: '3.1/10',
    currentStreak: '6 days',
    missedTasksThisWeek: '1',
  },
  summary:
    'Guy completed 18 of 21 assigned rehab tasks this week, showing strong adherence to his Knee Stability Phase 1 plan. His average reported pain was 3.1/10, which appears stable compared to last week. Pain was slightly higher after Glute Bridges, while mobility exercises such as Heel Slides and Quad Sets were reported with lower discomfort. Overall, Guy appears consistent and engaged with the plan.',
  adherence: [
    { label: 'Completed tasks', value: '18/21' },
    { label: 'Weekly completion rate', value: '86%' },
    { label: 'Missed tasks', value: '1' },
    { label: 'Streak', value: '6 days' },
  ],
  painTrend: [
    { label: 'Average pain', value: '3.1/10' },
    { label: 'Highest reported pain', value: '4/10' },
    { label: 'Lowest reported pain', value: '2/10' },
    {
      label: 'Pattern',
      value: 'Mild discomfort after strength exercises, stable response to mobility exercises',
    },
  ],
  discussionPoints: [
    'Review Glute Bridges technique and check whether the movement causes discomfort near the end of the set.',
    'Ask whether knee stiffness appears before or after exercises.',
    'Consider monitoring pain after strength-based exercises over the next few sessions.',
    'Reinforce consistency because the patient has maintained a strong completion rate.',
  ],
  recentNotes: [
    { exercise: 'Heel Slides', note: 'Felt okay, slight stiffness.' },
    { exercise: 'Quad Sets', note: 'No major discomfort.' },
    { exercise: 'Glute Bridges', note: 'Mild discomfort near the end.' },
  ],
};
