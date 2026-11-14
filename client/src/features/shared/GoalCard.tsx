import { CheckCircle2, Circle, Flag, Ruler } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Goal, Milestone } from '../../app/types';
import { useI18n } from '../../i18n';
import { formatDateTime, formatMeasure, formatShort } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { ProgressBar } from '../../ui/Progress';

export function useGoalStatusLabel() {
  const { t } = useI18n();
  return (status: Goal['status']) => ({ ACTIVE: t('In progress'), ACHIEVED: t('Achieved'), ARCHIVED: t('Archived') })[status];
}

/**
 * One goal with its milestones and, for measurement goals, progress toward the target.
 * Status is always written out (icon + text), never shown by colour alone.
 */
export function GoalCard({ goal, milestoneAction, actions }: { goal: Goal; milestoneAction?: (milestone: Milestone) => ReactNode; actions?: ReactNode }) {
  const { t } = useI18n();
  const statusLabel = useGoalStatusLabel();
  const done = goal.milestones.filter((milestone) => milestone.achievedAt).length;
  const measurement = goal.measurement;

  return (
    <article className={`card grid gap-3 p-5 ${goal.status === 'ARCHIVED' ? 'bg-ink-50' : ''}`} aria-labelledby={`goal-${goal.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`goal-${goal.id}`} className="flex items-start gap-2 font-display text-xl font-bold">
            <Flag className="mt-1 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <span>{goal.title}</span>
          </h3>
          {goal.description ? <p className="mt-1 text-ink-700">{goal.description}</p> : null}
          <p className="mt-1 text-sm text-ink-500">
            {goal.targetDate ? t('Target date: {date}', { date: formatShort(goal.targetDate) }) : t('No target date')}
          </p>
        </div>
        <Chip tone={goal.status === 'ACHIEVED' ? 'brand' : goal.status === 'ARCHIVED' ? 'neutral' : 'sky'} icon={goal.status === 'ACHIEVED' ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : undefined}>
          {statusLabel(goal.status)}
        </Chip>
      </div>

      {goal.status === 'ACHIEVED' && goal.achievedAt ? <p className="text-sm font-bold text-brand-700">{t('Confirmed by your therapist on {date}', { date: formatDateTime(goal.achievedAt) })}</p> : null}

      {measurement ? (
        <div className="grid gap-2 rounded-2xl bg-ink-50 p-3">
          <p className="flex items-center gap-2 text-sm font-extrabold text-ink-700">
            <Ruler className="h-4 w-4" aria-hidden="true" />
            {measurement.name}: {t('target {value} {unit}', { value: formatMeasure(measurement.target), unit: measurement.unit })}
            {measurement.direction === 'LOWER_IS_BETTER' ? ` (${t('lower is better')})` : ''}
          </p>
          {measurement.latest ? (
            <>
              {measurement.percent !== null ? <ProgressBar value={measurement.percent} max={100} label={t('Progress toward the target')} /> : null}
              <p className="tabular text-sm text-ink-700">
                {t('Latest: {value} {unit} on {date}', { value: formatMeasure(measurement.latest.value), unit: measurement.unit, date: formatShort(measurement.latest.measuredOn) })}
                {measurement.baseline !== null ? ` · ${t('start: {value} {unit}', { value: formatMeasure(measurement.baseline), unit: measurement.unit })}` : ''}
              </p>
              {measurement.targetReached && goal.status === 'ACTIVE' ? <p className="text-sm font-bold text-brand-700">{t('The latest measurement reaches the target. Your therapist confirms goals.')}</p> : null}
            </>
          ) : (
            <p className="text-sm text-ink-500">{t('No measurement recorded yet.')}</p>
          )}
        </div>
      ) : null}

      {goal.milestones.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-extrabold text-ink-700">{t('Milestones: {done} of {total} reached', { done, total: goal.milestones.length })}</p>
          <ol className="grid gap-2">
            {goal.milestones.map((milestone) => (
              <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink-100 p-3">
                <span className="flex min-w-0 items-start gap-2">
                  {milestone.achievedAt ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-300" aria-hidden="true" />}
                  <span>
                    <span className="font-bold">{milestone.title}</span>
                    <span className="block text-xs text-ink-500">
                      {milestone.achievedAt ? t('Reached {date}', { date: formatDateTime(milestone.achievedAt) }) : milestone.targetDate ? t('Aim: {date}', { date: formatShort(milestone.targetDate) }) : t('Not reached yet')}
                    </span>
                    {milestone.note ? <span className="block text-sm text-ink-700">{milestone.note}</span> : null}
                  </span>
                </span>
                {milestoneAction ? milestoneAction(milestone) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
