import { CheckCircle2 } from 'lucide-react';

type CompletedExerciseRowProps = {
  name: string;
  completedTimes: number;
};

export function CompletedExerciseRow({ name, completedTimes }: CompletedExerciseRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-container text-on-secondary-container">
        <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold text-on-surface">{name}</p>
        <p className="text-sm text-on-surface-variant">
          Completed {completedTimes} {completedTimes === 1 ? 'time' : 'times'}
        </p>
      </div>
    </div>
  );
}
