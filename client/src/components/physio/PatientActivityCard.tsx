type PatientActivityCardProps = {
  message: string;
  status: string;
  time: string;
};

const statusClasses: Record<string, string> = {
  Completed: 'bg-secondary-container text-on-secondary-container',
  'Needs attention': 'bg-tertiary-fixed text-on-tertiary-fixed',
  'Missed tasks': 'bg-red-100 text-red-800',
  'On track': 'bg-primary-container/20 text-primary',
};

export function PatientActivityCard({ message, status, time }: PatientActivityCardProps) {
  return (
    <article className="rounded-2xl bg-surface-container-low p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold leading-6 text-on-surface">{message}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{time}</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusClasses[status] ?? statusClasses['On track']}`}>
          {status}
        </span>
      </div>
    </article>
  );
}
