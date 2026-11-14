import { Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WeeklyGoal } from '../../../app/types';
import { useI18n } from '../../../i18n';
import { formatShort } from '../../../ui/format';
import { ProgressBar } from '../../../ui/Progress';

/**
 * The weekly consistency goal. A week with no planned sessions shows "not applicable", not 0/0.
 * `chosen` undefined = the chosen goal is not known here (home screen): only the progress is shown.
 */
export function WeeklyGoalCard({ goal, chosen, compact = false }: { goal: WeeklyGoal; chosen?: number | null; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <section className="card grid gap-2 p-5" aria-labelledby="weekly-goal-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="weekly-goal-title" className="flex items-center gap-2 font-display text-xl font-bold">
          <Target className="h-5 w-5 text-brand-600" aria-hidden="true" /> {t('This week’s goal')}
        </h2>
        <span className="text-sm font-bold text-ink-500">
          {formatShort(goal.weekStart)} – {formatShort(goal.weekEnd)}
        </span>
      </div>
      {!goal.applicable ? (
        <p className="text-ink-700">{t('No planned sessions this week, so there is no goal to reach. Rest and pauses never count against you.')}</p>
      ) : (
        <>
          <ProgressBar value={Math.min(goal.done, goal.target)} max={goal.target} label={t('Weekly goal progress')} tone="brand" />
          <p className="tabular font-bold text-ink-900">
            {goal.met ? t('Goal reached: {done} of {target} sessions. Well done.', { done: goal.done, target: goal.target }) : t('{done} of {target} sessions done', { done: goal.done, target: goal.target })}
          </p>
          <p className="text-sm text-ink-500">
            {chosen === undefined ? null : chosen === null ? t('Goal: every planned session ({count} this week).', { count: goal.planned }) : t('Your goal: {goal} sessions a week. This week has {count} planned.', { goal: chosen, count: goal.planned })}
            {!compact ? null : (
              <>
                {' '}
                <Link to="/patient/progress?tab=goals" className="font-extrabold text-brand-700 underline-offset-4 hover:underline">
                  {t('Change goal')}
                </Link>
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
