import { Clock3, Dumbbell, Repeat2, Target } from 'lucide-react';
import type { ExerciseDetail } from '../../types/patientDashboard';

type ExerciseStatsCardProps = {
  exercise: ExerciseDetail;
};

export function ExerciseStatsCard({ exercise }: ExerciseStatsCardProps) {
  const stats = [
    { label: 'Target', value: exercise.targetArea, icon: Target },
    { label: 'Sets', value: String(exercise.sets), icon: Dumbbell },
    { label: 'Reps', value: String(exercise.reps), icon: Repeat2 },
    { label: 'Duration', value: `${exercise.durationSeconds}s`, icon: Clock3 },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl bg-surface-container-low p-4">
          <stat.icon className="h-6 w-6 text-primary" strokeWidth={2.1} />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{stat.label}</p>
          <p className="mt-1 font-display text-xl font-semibold text-on-surface">{stat.value}</p>
        </div>
      ))}
    </section>
  );
}
