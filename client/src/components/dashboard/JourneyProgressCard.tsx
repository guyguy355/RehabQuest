import { Check, Dumbbell } from 'lucide-react';
import type { JourneyStep } from '../../types/patientDashboard';

type JourneyProgressCardProps = {
  steps: JourneyStep[];
  weekLabel: string;
};

export function JourneyProgressCard({ steps, weekLabel }: JourneyProgressCardProps) {
  const completedCount = steps.filter((step) => step.status === 'completed').length;
  const progressWidth = steps.length > 1 ? (completedCount / (steps.length - 1)) * 100 : 0;

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-ambient md:col-span-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-on-surface">Journey Progress</h2>
        <span className="text-sm font-bold text-primary">{weekLabel}</span>
      </div>

      <div className="relative overflow-x-auto px-2 py-5">
        <div className="absolute left-2 right-2 top-[42px] h-0.5 rounded-full bg-outline-variant" />
        <div
          className="absolute left-2 top-[42px] h-0.5 rounded-full bg-secondary"
          style={{ width: `calc(${progressWidth}% - 1rem)` }}
        />

        <ol className="relative z-10 grid min-w-[520px] grid-cols-7 items-start gap-3">
          {steps.map((step) => (
            <li key={step.label} className="flex flex-col items-center gap-3">
              <JourneyNode status={step.status} />
              <span
                className={[
                  'text-sm font-semibold',
                  step.status === 'current' ? 'text-on-surface' : 'text-on-surface-variant',
                  step.status === 'upcoming' ? 'opacity-50' : '',
                ].join(' ')}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function JourneyNode({ status }: { status: JourneyStep['status'] }) {
  if (status === 'completed') {
    return (
      <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-on-secondary">
        <Check className="h-5 w-5" strokeWidth={3} />
      </span>
    );
  }

  if (status === 'current') {
    return (
      <span className="grid h-14 w-14 place-items-center rounded-full border-4 border-surface bg-secondary-container text-on-secondary-container shadow-ambient ring-4 ring-secondary/20">
        <Dumbbell className="h-7 w-7" strokeWidth={2.4} />
      </span>
    );
  }

  return <span className="mt-1 grid h-10 w-10 place-items-center rounded-full border-2 border-outline-variant bg-surface-container-high" />;
}
