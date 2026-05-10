type QuestProgressBarProps = {
  completed: number;
  total: number;
};

export function QuestProgressBar({ completed, total }: QuestProgressBarProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between text-sm font-semibold text-on-surface-variant">
        <span>Today’s progress</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
