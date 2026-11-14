import { HandHeart } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import type { CompletionStatus, DifficultyRating, OutcomeReason, PlanTask } from '../../../app/types';
import { useI18n } from '../../../i18n';
import { TextArea } from '../../../ui/Field';
import { Mascot } from '../../../ui/Mascot';
import { InlineMessage, Spinner } from '../../../ui/States';
import { DifficultyChoice, PainScale, ReasonChoice } from '../Feedback';
import { formatClock } from './useNow';
import { type TimerState, timerRemainingMs } from './sessionState';

export type FeedbackValues = { painLevel: number | null; difficulty: DifficultyRating | null; reason: OutcomeReason | null; notes: string; setsCompleted: number | null };

/** Choose what happened with this exercise. */
export function OutcomeChooser({ task, setsTicked, onChoose, onBack }: { task: PlanTask; setsTicked: number; onChoose: (outcome: CompletionStatus, setsCompleted: number | null) => void; onBack: () => void }) {
  const { t } = useI18n();
  const suggested: CompletionStatus = setsTicked >= task.sets ? 'COMPLETED' : setsTicked > 0 ? 'PARTIAL' : 'COMPLETED';
  const [outcome, setOutcome] = useState<CompletionStatus>(suggested);
  const [sets, setSets] = useState(Math.min(Math.max(setsTicked, 1), Math.max(task.sets - 1, 1)));

  const options: { value: CompletionStatus; label: string; hint: string }[] = [
    { value: 'COMPLETED', label: t('I did all prescribed sets'), hint: t('{sets} × {reps}', { sets: task.sets, reps: task.reps }) },
    ...(task.sets > 1 ? [{ value: 'PARTIAL' as const, label: t('I did part of it'), hint: t('Some sets, not all of them') }] : []),
    { value: 'SKIPPED', label: t('I skipped it'), hint: t('Not done today. That is okay; it is recorded honestly.') },
    { value: 'STOPPED', label: t('I stopped because of discomfort'), hint: t('Your therapist will see it. Nothing is lost.') },
  ];

  return (
    <form
      className="grid gap-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onChoose(outcome, outcome === 'PARTIAL' ? sets : null);
      }}
    >
      <h1 className="font-display text-3xl font-bold">{t('How did {name} go?', { name: task.exercise.title })}</h1>
      <fieldset className="grid gap-2">
        <legend className="sr-only">{t('Result')}</legend>
        {options.map((option) => (
          <label key={option.value} className="card-raised flex cursor-pointer items-start gap-3 p-4 has-[:checked]:border-brand-400 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-sky-500">
            <input type="radio" name="outcome" value={option.value} checked={outcome === option.value} onChange={() => setOutcome(option.value)} className="mt-1 h-5 w-5 accent-brand-600" />
            <span>
              <span className="block font-extrabold">{option.label}</span>
              <span className="text-sm text-ink-500">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {outcome === 'PARTIAL' ? (
        <div className="grid max-w-xs gap-1">
          <label htmlFor="partial-sets" className="field-label">
            {t('How many sets did you do?')}
          </label>
          <input id="partial-sets" type="number" min={1} max={task.sets - 1} value={sets} onChange={(event) => setSets(Math.min(task.sets - 1, Math.max(1, event.target.valueAsNumber || 1)))} className="field-input tabular" />
          <span className="text-sm text-ink-500">{t('out of {n}', { n: task.sets })}</span>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          {t('Back to the exercise')}
        </button>
        <button type="submit" className="btn btn-primary btn-lg">
          {t('Continue')}
        </button>
      </div>
    </form>
  );
}

export function FeedbackForm({ task, outcome, saving, error, onBack, onSubmit }: { task: PlanTask; outcome: CompletionStatus; saving: boolean; error: string; onBack: () => void; onSubmit: (values: FeedbackValues) => void }) {
  const { t } = useI18n();
  const stopped = outcome === 'STOPPED';
  const skipped = outcome === 'SKIPPED';
  const [pain, setPain] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyRating | null>(null);
  const [reason, setReason] = useState<OutcomeReason | null>(stopped ? 'PAIN_OR_DISCOMFORT' : null);
  const [notes, setNotes] = useState('');
  const [painError, setPainError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!skipped && pain === null) {
      setPainError(t('Choose a number from 0 to 10'));
      return;
    }
    onSubmit({ painLevel: pain, difficulty: stopped || skipped ? null : difficulty, reason: stopped || skipped ? reason : null, notes, setsCompleted: null });
  }

  const title = stopped ? t('Stopping was the right call') : skipped ? t('Skipping is okay') : t('How did it feel?');
  const subtitle = stopped
    ? t('Your therapist will see this. You lose nothing and your streak stays safe.')
    : skipped
      ? t('It is recorded honestly so your therapist can plan with you. No XP for a skipped exercise.')
      : t('Your answers go to your therapist.');

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="flex items-center gap-4">
        <Mascot mood={stopped ? 'care' : skipped ? 'calm' : 'cheer'} size={84} />
        <div>
          <p className="eyebrow">{task.exercise.title}</p>
          <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
          <p className="text-ink-700">{subtitle}</p>
        </div>
      </div>

      <PainScale value={pain} optional={skipped} onChange={(value) => { setPain(value); setPainError(''); }} error={painError} />
      {pain !== null && pain >= 7 && !stopped ? (
        <InlineMessage tone="info">{t('That is a high pain score. If the pain is sharp or does not settle, stop for today and contact your clinic.')}</InlineMessage>
      ) : null}
      {stopped || skipped ? <ReasonChoice value={reason} onChange={setReason} legend={stopped ? t('What made you stop?') : t('Why was it skipped?')} /> : <DifficultyChoice value={difficulty} onChange={setDifficulty} />}

      <TextArea
        id="feedback-note"
        label={stopped ? t('What happened? (optional)') : t('Anything to tell your therapist? (optional)')}
        maxLength={500}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        hint={`${notes.length}/500`}
        rows={3}
      />

      {stopped ? (
        <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {t('If you have severe or unusual pain, swelling, numbness, or feel unwell, contact your clinic or emergency services.')}
        </p>
      ) : null}

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={saving}>
          {t('Back')}
        </button>
        <button type="submit" className={`btn btn-lg ${stopped ? 'btn-sun' : 'btn-primary'}`} disabled={saving}>
          {saving ? <Spinner /> : stopped ? <HandHeart className="h-5 w-5" aria-hidden="true" /> : null}
          {saving ? t('Saving…') : error ? t('Try again') : stopped ? t('Save and tell my therapist') : t('Save and continue')}
        </button>
      </div>
    </form>
  );
}

export function TimerPanel({ timer, now, running, onCancel }: { timer: TimerState; now: number; running: boolean; onCancel: () => void }) {
  const { t } = useI18n();
  const remaining = timerRemainingMs(timer, now);
  const finished = remaining <= 0;
  const progress = 1 - remaining / timer.totalMs;
  const label = timer.kind === 'hold' ? t('Hold') : t('Rest');

  return (
    <section aria-label={t('Timer')} className={`card flex flex-wrap items-center gap-4 p-4 ${finished ? 'border-brand-300 bg-brand-50' : ''}`}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#E9EFEF" strokeWidth="7" />
        <circle cx="32" cy="32" r="27" fill="none" stroke={timer.kind === 'hold' ? '#12A58B' : '#8B5CF6'} strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 27} strokeDashoffset={2 * Math.PI * 27 * (1 - progress)} transform="rotate(-90 32 32)" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">
          {label} · {t('Set {n}', { n: timer.setIndex + 1 })}
        </p>
        <p className="tabular font-display text-4xl font-bold" dir="ltr">
          {formatClock(remaining)}
        </p>
        <p role="status" className="text-sm font-bold text-ink-700">
          {finished ? t('Time is up. Tick the set yourself when you are done.') : running ? '' : t('Paused')}
        </p>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
        {finished ? t('Close timer') : t('Stop timer')}
      </button>
    </section>
  );
}
