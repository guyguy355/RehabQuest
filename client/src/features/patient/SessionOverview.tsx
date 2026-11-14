import { Clock, Dumbbell, Timer } from 'lucide-react';
import type { PlanTask } from '../../app/types';
import { useI18n } from '../../i18n';
import { estimateMinutes, formatDuration } from '../../ui/format';

/** Prescription line, kept LTR so "2 × 12" never flips in Hebrew. */
export function Prescription({ task }: { task: Pick<PlanTask, 'sets' | 'reps' | 'holdSeconds' | 'restSeconds' | 'durationSeconds'> }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-sm font-bold text-ink-700">
      <bdi className="tabular" dir="ltr">
        {task.sets} × {task.reps}
      </bdi>
      {task.holdSeconds ? <span>· {t('hold {n} s', { n: task.holdSeconds })}</span> : null}
      {task.restSeconds ? <span>· {t('rest {n} s', { n: task.restSeconds })}</span> : null}
    </span>
  );
}

/** "Before you start" overview of today's session (also used for the therapist's patient-view preview). */
export function SessionOverview({ tasks, doneTaskIds = [] }: { tasks: PlanTask[]; doneTaskIds?: string[] }) {
  const { t } = useI18n();
  const minutes = estimateMinutes(tasks);
  return (
    <section aria-labelledby="overview-title" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="overview-title" className="font-display text-2xl font-bold">
          {t("Today's exercises")}
        </h2>
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink-500">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {t('Estimated time: about {minutes} min', { minutes })}
        </p>
      </div>
      <p className="text-sm text-ink-500">{t('The time is an estimate from your plan. Go at your own pace.')}</p>
      <ol className="grid gap-2">
        {tasks.map((task, index) => {
          const done = doneTaskIds.includes(task.id);
          return (
            <li key={task.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${done ? 'border-brand-200 bg-brand-50' : 'border-ink-100 bg-white'}`}>
              <span className={`tabular grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${done ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-700'}`}>{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{task.exercise.title}</p>
                <Prescription task={task} />
              </div>
              <span className="hidden items-center gap-1 text-xs font-bold text-ink-500 sm:flex">
                {task.holdSeconds ? <Timer className="h-4 w-4" aria-hidden="true" /> : <Dumbbell className="h-4 w-4" aria-hidden="true" />}
                {formatDuration(task.durationSeconds)}
              </span>
              {done ? <span className="text-xs font-extrabold text-brand-700">{t('Saved')}</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
