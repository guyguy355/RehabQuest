import { AlertTriangle, BookOpenText, Check, ExternalLink, MessageCircleQuestion, Minus, Plus, Timer as TimerIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CardAssignment, PlanTask } from '../../../app/types';
import { useI18n } from '../../../i18n';
import { exerciseDifficultyLabel, formatDuration } from '../../../ui/format';
import { Chip } from '../../../ui/Pills';
import { ExerciseDemo } from '../../demo/ExerciseDemo';
import type { TaskProgress } from './sessionState';

const DIRECT_VIDEO = /\.(mp4|webm|ogg)(\?|$)/i;

/** Therapist media for the exercise, always with a text description. */
function Media({ task }: { task: PlanTask }) {
  const { t } = useI18n();
  const { imageUrl, videoUrl, mediaAlt, title } = task.exercise;
  if (!imageUrl && !videoUrl) return null;
  return (
    <div className="grid gap-3">
      {imageUrl ? (
        <figure className="overflow-hidden rounded-3xl border-2 border-ink-100 bg-white">
          <img src={imageUrl} alt={mediaAlt ?? title} className="max-h-72 w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
          {mediaAlt ? <figcaption className="p-3 text-sm text-ink-700">{mediaAlt}</figcaption> : null}
        </figure>
      ) : null}
      {videoUrl ? (
        DIRECT_VIDEO.test(videoUrl) ? (
          <figure className="overflow-hidden rounded-3xl border-2 border-ink-100 bg-white">
            <video src={videoUrl} controls preload="none" className="max-h-72 w-full bg-ink-900" aria-describedby={`video-desc-${task.id}`} />
            <figcaption id={`video-desc-${task.id}`} className="p-3 text-sm text-ink-700">
              <span className="font-extrabold">{t('Video description:')}</span> {mediaAlt}
            </figcaption>
          </figure>
        ) : (
          <p className="grid gap-1">
            <a href={videoUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center gap-2 font-extrabold text-brand-700 underline-offset-4 hover:underline">
              {t('Watch the demonstration video (opens a new tab)')} <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            {mediaAlt ? <span className="text-sm text-ink-700">{t('Video description:')} {mediaAlt}</span> : null}
          </p>
        )
      ) : null}
    </div>
  );
}

export function ExerciseView({
  task,
  cards = [],
  progress,
  disabled,
  timerActive,
  onToggleSet,
  onReps,
  onTimer,
}: {
  task: PlanTask;
  cards?: CardAssignment[];
  progress: TaskProgress;
  disabled: boolean;
  timerActive: boolean;
  onToggleSet: (index: number) => void;
  onReps: (index: number, value: number) => void;
  onTimer: (kind: 'hold' | 'rest', seconds: number, setIndex: number) => void;
}) {
  const { t } = useI18n();
  const steps = (task.exercise.instructions ?? '').split('\n').map((line) => line.trim()).filter(Boolean);

  return (
    <div className="grid gap-5">
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="brand">{task.exercise.bodyPart}</Chip>
          <Chip>{exerciseDifficultyLabel(task.exercise.difficulty)}</Chip>
        </div>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight">{task.exercise.title}</h1>
        <p className="text-ink-500">{task.exercise.description}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3">
          <dt className="eyebrow">{t('Sets × reps')}</dt>
          <dd className="tabular font-display text-2xl font-bold text-brand-700" dir="ltr">
            {task.sets} × {task.reps}
          </dd>
        </div>
        <div className="card p-3">
          <dt className="eyebrow">{t('Time per set')}</dt>
          <dd className="font-display text-2xl font-bold text-brand-700">{formatDuration(task.durationSeconds)}</dd>
        </div>
        <div className="card p-3">
          <dt className="eyebrow">{t('Hold')}</dt>
          <dd className="font-display text-2xl font-bold text-brand-700">{task.holdSeconds ? formatDuration(task.holdSeconds) : '—'}</dd>
        </div>
        <div className="card p-3">
          <dt className="eyebrow">{t('Rest between sets')}</dt>
          <dd className="font-display text-2xl font-bold text-brand-700">{task.restSeconds ? formatDuration(task.restSeconds) : '—'}</dd>
        </div>
      </dl>

      {task.notes ? (
        <p className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-4 font-semibold text-ink-900">
          <span className="font-extrabold text-sky-700">{t('Your therapist’s note:')} </span>
          {task.notes}
        </p>
      ) : null}

      {/* Shown only for exercises with their own approved (or preview) animation; others keep the media below as before. */}
      <ExerciseDemo key={task.id} demo={task.exercise.demo} title={task.exercise.title} />

      <Media task={task} />

      {steps.length > 0 ? (
        <section aria-labelledby="how-title">
          <h2 id="how-title" className="font-display text-xl font-bold">
            {t('How to do it')}
          </h2>
          <ol className="mt-2 grid gap-2">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-black text-brand-800">{index + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Link
        to={`/patient/messages?context=${encodeURIComponent(`TASK:${task.id}`)}&label=${encodeURIComponent(task.exercise.title)}`}
        className="inline-flex min-h-11 items-center gap-2 justify-self-start font-extrabold text-brand-700 underline-offset-4 hover:underline"
      >
        <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" /> {t('Ask your therapist about this exercise')}
      </Link>

      {cards.length > 0 ? (
        <ul className="grid gap-2" aria-label={t('Cards about this exercise')}>
          {cards.map((card) => (
            <li key={card.id}>
              <Link to="/patient/learn" className="inline-flex min-h-11 items-center gap-2 font-extrabold text-brand-700 underline-offset-4 hover:underline">
                <BookOpenText className="h-5 w-5" aria-hidden="true" /> {t('Read: {title}', { title: card.latest.title })}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {task.exercise.safetyNotes ? (
        <p className="flex gap-2 rounded-2xl bg-sun-50 p-4 text-ink-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sun-600" aria-hidden="true" />
          <span>{task.exercise.safetyNotes}</span>
        </p>
      ) : null}

      <section aria-labelledby="sets-title" className="grid gap-2">
        <h2 id="sets-title" className="font-display text-xl font-bold">
          {t('Your sets')}
        </h2>
        <p className="text-sm text-ink-500">{t('Tick each set when you finish it. Timers only help you count; they never record anything.')}</p>
        <ol className="grid gap-2">
          {progress.setsDone.map((done, index) => (
            <li key={index} className={`flex flex-wrap items-center gap-2 rounded-2xl border-2 p-2 ${done ? 'border-brand-200 bg-brand-50' : 'border-ink-100 bg-white'}`}>
              <span className="min-w-16 font-extrabold">{t('Set {n}', { n: index + 1 })}</span>
              <div className="flex items-center gap-1" role="group" aria-label={t('Reps in set {n}', { n: index + 1 })}>
                <button type="button" className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink-200 bg-white disabled:opacity-40" disabled={disabled || progress.reps[index] <= 0} onClick={() => onReps(index, progress.reps[index] - 1)} aria-label={t('Fewer reps')}>
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <output className="tabular w-12 text-center font-display text-xl font-bold" aria-live="polite">
                  {progress.reps[index]}
                </output>
                <button type="button" className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink-200 bg-white disabled:opacity-40" disabled={disabled || progress.reps[index] >= 200} onClick={() => onReps(index, progress.reps[index] + 1)} aria-label={t('More reps')}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="text-xs font-bold text-ink-500">{t('of {n} reps', { n: task.reps })}</span>
              </div>
              <div className="ms-auto flex flex-wrap gap-2">
                {task.holdSeconds ? (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || timerActive} onClick={() => onTimer('hold', task.holdSeconds!, index)}>
                    <TimerIcon className="h-4 w-4" aria-hidden="true" /> {t('Hold {n} s', { n: task.holdSeconds })}
                  </button>
                ) : null}
                {task.restSeconds && done && index < task.sets - 1 ? (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || timerActive} onClick={() => onTimer('rest', task.restSeconds!, index)}>
                    <TimerIcon className="h-4 w-4" aria-hidden="true" /> {t('Rest {n} s', { n: task.restSeconds })}
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-pressed={done}
                  disabled={disabled}
                  onClick={() => onToggleSet(index)}
                  className={`btn btn-sm min-w-28 ${done ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : null}
                  {done ? t('Set done') : t('Mark set done')}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
