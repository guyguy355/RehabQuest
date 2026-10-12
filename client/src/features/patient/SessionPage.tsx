import { AlertTriangle, ArrowRight, Check, ExternalLink, Gem, HandHeart, Timer, X } from 'lucide-react';
import { type FormEvent, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import type { Badge, CompletionResult, DifficultyRating, PatientOverview } from '../../app/types';
import { useApi } from '../../app/useApi';
import { formatDuration } from '../../ui/format';
import { TextArea } from '../../ui/Field';
import { Mascot } from '../../ui/Mascot';
import { Chip } from '../../ui/Pills';
import { ProgressBar } from '../../ui/Progress';
import { ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { DifficultyChoice, PainScale } from './Feedback';

type Task = PatientOverview['todayTasks'][number];
type Phase = { kind: 'exercise' } | { kind: 'feedback'; status: 'COMPLETED' | 'STOPPED' };

export type SessionSummary = { xpEarned: number; newBadges: Badge[]; stopped: number; completed: number };

function SetTracker({ sets }: { sets: number }) {
  const [done, setDone] = useState(0);
  return (
    <div>
      <p className="field-label">Tick off your sets</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: sets }, (_, index) => {
          const checked = index < done;
          return (
            <button
              key={index}
              type="button"
              aria-pressed={checked}
              aria-label={`Set ${index + 1} ${checked ? 'done' : 'not done'}`}
              onClick={() => setDone(checked ? index : index + 1)}
              className={`grid h-12 w-12 place-items-center rounded-2xl border-2 font-black transition ${checked ? 'border-brand-600 bg-brand-500 text-white' : 'border-ink-200 bg-white text-ink-500'}`}
              style={{ boxShadow: `0 3px 0 0 ${checked ? '#076B5F' : '#D3DDDD'}` }}
            >
              {checked ? <Check className="h-6 w-6" strokeWidth={3.5} aria-hidden="true" /> : index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseStep({ task, onDone, onStop }: { task: Task; onDone: () => void; onStop: () => void }) {
  const steps = (task.exercise.instructions ?? '').split('\n').map((line) => line.trim()).filter(Boolean);

  return (
    <div className="grid gap-5 animate-rise">
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="brand">{task.exercise.bodyPart}</Chip>
          <Chip tone="neutral">{task.exercise.difficulty.toLowerCase()}</Chip>
        </div>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight">{task.exercise.title}</h1>
        <p className="text-ink-500">{task.exercise.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="eyebrow">Prescribed</p>
          <p className="tabular font-display text-3xl font-bold text-brand-700">
            {task.sets} × {task.reps}
          </p>
          <p className="text-sm font-bold text-ink-500">sets × reps</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Time per set</p>
          <p className="tabular flex items-center gap-1.5 font-display text-3xl font-bold text-brand-700">
            <Timer className="h-6 w-6" aria-hidden="true" /> {formatDuration(task.durationSeconds)}
          </p>
          <p className="text-sm font-bold text-ink-500">take it slowly</p>
        </div>
      </div>

      {task.notes ? (
        <p className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-4 font-semibold text-ink-900">
          <span className="font-extrabold text-sky-700">Your therapist’s note: </span>
          {task.notes}
        </p>
      ) : null}

      {steps.length > 0 ? (
        <section aria-labelledby="how-title">
          <h2 id="how-title" className="font-display text-xl font-bold">
            How to do it
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

      {task.exercise.safetyNotes ? (
        <p className="flex gap-2 rounded-2xl bg-sun-50 p-4 text-ink-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sun-600" aria-hidden="true" />
          <span>{task.exercise.safetyNotes}</span>
        </p>
      ) : null}

      {task.exercise.videoUrl ? (
        <a href={task.exercise.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-extrabold text-brand-700 underline-offset-4 hover:underline">
          Watch the demonstration video <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}

      <SetTracker sets={task.sets} />

      <div className="sticky bottom-0 -mx-4 grid gap-3 border-t-2 border-ink-100 bg-canvas/95 px-4 pb-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
        <button type="button" onClick={onDone} className="btn btn-primary btn-lg w-full">
          I finished this exercise
        </button>
        <button type="button" onClick={onStop} className="btn btn-soft-danger w-full">
          <HandHeart className="h-5 w-5" aria-hidden="true" /> Stop – I have pain or symptoms
        </button>
      </div>
    </div>
  );
}

function FeedbackStep({
  task,
  status,
  onBack,
  onSubmitted,
}: {
  task: Task;
  status: 'COMPLETED' | 'STOPPED';
  onBack: () => void;
  onSubmitted: (result: CompletionResult) => void;
}) {
  const [pain, setPain] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyRating | null>(null);
  const [notes, setNotes] = useState('');
  const [painError, setPainError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const stopped = status === 'STOPPED';

  async function submit(event: FormEvent) {
    event.preventDefault();
    // Guard against double submits even before React re-renders the disabled button.
    if (inFlight.current) return;
    if (pain === null) {
      setPainError('Choose a number from 0 to 10');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const result = await api<CompletionResult>(`/patient/tasks/${task.id}/completion`, {
        method: 'POST',
        body: { status, painLevel: pain, difficulty: stopped ? null : difficulty, notes: notes.trim() || null },
      });
      onSubmitted(result);
    } catch (caught) {
      setError(errorMessage(caught));
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 animate-rise" noValidate>
      <div className="flex items-center gap-4">
        <Mascot mood={stopped ? 'care' : 'cheer'} size={84} />
        <div>
          <p className="eyebrow">{task.exercise.title}</p>
          <h1 className="font-display text-3xl font-bold leading-tight">{stopped ? 'Stopping was the right call' : 'How did it feel?'}</h1>
          <p className="text-ink-700">
            {stopped ? 'Your therapist will see this. You lose nothing and your streak stays safe.' : 'Your answers go to your therapist.'}
          </p>
        </div>
      </div>

      <PainScale
        value={pain}
        onChange={(value) => {
          setPain(value);
          setPainError('');
        }}
        error={painError}
      />

      {pain !== null && pain >= 7 && !stopped ? (
        <InlineMessage tone="info">
          That is a high pain score. It will be flagged for your therapist. If the pain is sharp or does not settle, stop for today and contact your clinic.
        </InlineMessage>
      ) : null}

      {stopped ? null : <DifficultyChoice value={difficulty} onChange={setDifficulty} />}

      <TextArea
        label={stopped ? 'What happened? (optional)' : 'Anything to tell your therapist? (optional)'}
        maxLength={500}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        hint={`${notes.length}/500`}
        rows={3}
      />

      {stopped ? (
        <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
          If you have severe or unusual pain, swelling, numbness, or feel unwell, contact your clinic or emergency services.
        </p>
      ) : null}

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <button type="button" onClick={onBack} className="btn btn-secondary" disabled={submitting}>
          Back
        </button>
        <button type="submit" className={`btn btn-lg ${stopped ? 'btn-sun' : 'btn-primary'}`} disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Saving…' : stopped ? 'Save and tell my therapist' : 'Save and continue'}
        </button>
      </div>
    </form>
  );
}

export function SessionPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi<PatientOverview>('/patient/overview');
  const [phase, setPhase] = useState<Phase>({ kind: 'exercise' });
  const [finishedIds, setFinishedIds] = useState<string[]>([]);
  const [summary, setSummary] = useState<SessionSummary>({ xpEarned: 0, newBadges: [], stopped: 0, completed: 0 });
  const [flash, setFlash] = useState<{ key: number; xp: number; already: boolean } | null>(null);

  const tasks = useMemo(() => data?.todayTasks ?? [], [data]);
  const pending = tasks.filter((task) => !task.completion && !finishedIds.includes(task.id));
  const current = pending[0];
  const doneCount = tasks.length - pending.length;

  if (loading && !data) return <LoadingBlock label="Loading today’s session" rows={4} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;
  if (data.status !== 'training' || tasks.length === 0) return <Navigate to="/patient" replace />;

  function handleSubmitted(task: Task, result: CompletionResult) {
    const next: SessionSummary = {
      xpEarned: summary.xpEarned + result.xpAwarded,
      newBadges: [...summary.newBadges, ...result.newBadges],
      stopped: summary.stopped + (result.completion.status === 'STOPPED' ? 1 : 0),
      completed: summary.completed + (result.completion.status === 'COMPLETED' ? 1 : 0),
    };
    setSummary(next);
    setFinishedIds((ids) => [...ids, task.id]);
    setPhase({ kind: 'exercise' });
    setFlash({ key: Date.now(), xp: result.xpAwarded, already: result.alreadyRecorded });
    window.scrollTo({ top: 0 });

    if (result.sessionComplete || pending.length <= 1) {
      navigate('/patient/session/complete', { replace: true, state: next });
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div className="flex items-center gap-3">
        <Link to="/patient" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-ink-500 hover:bg-ink-100" aria-label="Leave session (finished exercises are saved)">
          <X className="h-6 w-6" aria-hidden="true" />
        </Link>
        <div className="flex-1">
          <ProgressBar value={doneCount} max={tasks.length} label={`${doneCount} of ${tasks.length} exercises done`} size="lg" />
        </div>
        <span className="tabular text-sm font-extrabold text-ink-500">
          {doneCount}/{tasks.length}
        </span>
      </div>

      {flash ? (
        <p key={flash.key} role="status" className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 animate-xp rounded-2xl bg-sun-400 px-4 py-2 font-black text-ink-900 shadow-lg">
          {flash.already ? (
            'Already saved earlier'
          ) : flash.xp > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Gem className="h-5 w-5" aria-hidden="true" /> +{flash.xp} XP
            </span>
          ) : (
            'Saved. Thank you for telling us.'
          )}
        </p>
      ) : null}

      {current ? (
        phase.kind === 'exercise' ? (
          <ExerciseStep key={current.id} task={current} onDone={() => setPhase({ kind: 'feedback', status: 'COMPLETED' })} onStop={() => setPhase({ kind: 'feedback', status: 'STOPPED' })} />
        ) : (
          <FeedbackStep key={`${current.id}-${phase.status}`} task={current} status={phase.status} onBack={() => setPhase({ kind: 'exercise' })} onSubmitted={(result) => handleSubmitted(current, result)} />
        )
      ) : (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <Mascot mood="cheer" />
          <p className="font-display text-2xl font-bold">All exercises saved</p>
          <Link to="/patient" className="btn btn-primary">
            Back to your path <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
