import { Medal } from 'lucide-react';
import { QuestProgressBar } from './QuestProgressBar';

type DailyQuestHeaderProps = {
  plan: string;
  quest: string;
  completed: number;
  total: number;
};

export function DailyQuestHeader({ plan, quest, completed, total }: DailyQuestHeaderProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Daily Quest</p>
          <h1 className="mt-2 font-display text-[2.25rem] font-bold leading-tight text-on-background md:text-[2.75rem]">
            Today’s Rehab Quest
          </h1>
          <p className="mt-2 text-lg font-semibold text-on-surface">{plan}</p>
          <p className="mt-1 text-base text-on-surface-variant">{quest}</p>
        </div>

        <div className="inline-flex items-center gap-3 rounded-2xl bg-secondary-container px-5 py-4 text-on-secondary-container">
          <Medal className="h-8 w-8" strokeWidth={2.2} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Progress</p>
            <p className="font-display text-2xl font-semibold">
              {completed} of {total} completed
            </p>
          </div>
        </div>
      </div>

      <QuestProgressBar completed={completed} total={total} />
    </section>
  );
}
