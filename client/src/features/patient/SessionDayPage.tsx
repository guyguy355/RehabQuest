import { ArrowLeft, Gem, HandHeart } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { Completion, SessionDay } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { difficultyLabel, formatDuration, formatLongDay, formatTime, outcomeLabel, reasonLabel } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, LoadingBlock } from '../../ui/States';

const OUTCOME_TONE = { COMPLETED: 'brand', PARTIAL: 'sky', SKIPPED: 'neutral', STOPPED: 'coral' } as const;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="tabular font-bold text-ink-900">{children}</dd>
    </div>
  );
}

function Recorded({ completion, prescribed }: { completion: Completion; prescribed: Completion['prescribed'] }) {
  const { t } = useI18n();
  const performed = completion.status !== 'SKIPPED';
  return (
    <>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {performed && completion.setsCompleted !== null ? (
          <Fact label={t('Sets done')}>
            <span dir="ltr">
              {completion.setsCompleted}/{prescribed.sets}
            </span>
          </Fact>
        ) : null}
        {performed && completion.repsPerSet.length > 0 ? (
          <Fact label={t('Reps per set')}>
            <span dir="ltr">{completion.repsPerSet.join(' · ')}</span>
          </Fact>
        ) : null}
        {performed && completion.activeSeconds ? <Fact label={t('Active time')}>{formatDuration(completion.activeSeconds)}</Fact> : null}
        <Fact label={t('Pain')}>{completion.painLevel === null ? t('Not reported') : <span dir="ltr">{completion.painLevel}/10</span>}</Fact>
        {completion.difficulty ? <Fact label={t('How it felt')}>{difficultyLabel(completion.difficulty)}</Fact> : null}
        {completion.reason ? <Fact label={t('Reason')}>{reasonLabel(completion.reason)}</Fact> : null}
        <Fact label={t('Saved at')}>{formatTime(completion.occurredAt ?? completion.completedAt)}</Fact>
      </dl>
      {completion.notes ? (
        <div className="mt-3 rounded-2xl bg-ink-50 p-3">
          <p className="eyebrow">{t('Your note')}</p>
          <p className="whitespace-pre-wrap break-words text-ink-900">{completion.notes}</p>
        </div>
      ) : null}
    </>
  );
}

/** A finished (or partly recorded) session: what was planned and what the patient saved. Read-only. */
export function SessionDayPage() {
  const { t } = useI18n();
  const { date = '' } = useParams();
  const valid = DATE_KEY.test(date);
  const { data, error, loading, reload } = useApi<SessionDay>(valid ? `/patient/sessions/${date}` : null);

  const back = (
    <Link to="/patient" className="btn btn-secondary btn-sm whitespace-nowrap">
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t('Back to my path')}
    </Link>
  );

  if (!valid || error?.status === 404) {
    return (
      <EmptyState title={t('No session on this day')} mood="think" action={back}>
        {t('Nothing was planned or saved for this date.')}
      </EmptyState>
    );
  }
  if (loading && !data) return <LoadingBlock label={t('Loading your session')} rows={3} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const saved = data.items.filter((item) => item.completion).length;
  const stoppedAny = data.items.some((item) => item.completion?.status === 'STOPPED');
  const unfinishedToday = data.state === 'today';

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <PageHeader eyebrow={data.planTitle ?? t('Session')} title={formatLongDay(data.date)} actions={back}>
        {t('What you saved in this session. Your therapist sees the same record.')}
      </PageHeader>

      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <Chip tone="brand">{t('{done} of {total} exercises saved', { done: saved, total: data.items.length })}</Chip>
        <Chip tone="sun" icon={<Gem className="h-3.5 w-3.5" aria-hidden="true" />}>
          {t('{xp} XP earned', { xp: data.xpEarned })}
        </Chip>
        {stoppedAny ? (
          <Chip tone="coral" icon={<HandHeart className="h-3.5 w-3.5" aria-hidden="true" />}>
            {t('Stopped safely')}
          </Chip>
        ) : null}
      </div>

      <ol className="grid gap-3" aria-label={t('Exercises in this session')}>
        {data.items.map((item, index) => (
          <li key={item.taskId} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="eyebrow">{t('Exercise {n} of {total}', { n: index + 1, total: data.items.length })}</p>
                <h2 className="font-display text-xl font-bold leading-tight">{item.title}</h2>
                <p className="text-sm font-bold text-ink-500">
                  {t('Planned')}: <span dir="ltr">{item.prescribed.sets} × {item.prescribed.reps}</span>
                  {item.prescribed.holdSeconds ? ` · ${t('hold {time}', { time: formatDuration(item.prescribed.holdSeconds) })}` : ''}
                </p>
              </div>
              {item.completion ? <Chip tone={OUTCOME_TONE[item.completion.status]}>{outcomeLabel(item.completion.status)}</Chip> : <Chip>{t('No result saved')}</Chip>}
            </div>
            {item.completion ? <Recorded completion={item.completion} prescribed={item.prescribed} /> : null}
          </li>
        ))}
      </ol>

      {unfinishedToday ? (
        <Link to="/patient/session" className="btn btn-primary btn-lg w-full">
          {t('Continue today’s session')}
        </Link>
      ) : null}
    </div>
  );
}
