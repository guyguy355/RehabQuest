import { HandHeart, Pause, Play, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, errorMessage } from '../../app/api';
import { useCurrentUser } from '../../app/AuthProvider';
import { newId } from '../../app/localData';
import { playChime, usePreferences } from '../../app/preferences';
import type { CardAssignment, CompletionResult, CompletionStatus, PatientOverview, PlanTask } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { Mascot } from '../../ui/Mascot';
import { ProgressBar } from '../../ui/Progress';
import { ErrorState, InlineMessage, LoadingBlock } from '../../ui/States';
import { submitCompletion } from './session/submit';
import { ExerciseView } from './session/ExerciseView';
import { type FeedbackValues, FeedbackForm, OutcomeChooser, TimerPanel } from './session/OutcomeViews';
import { clearSession, elapsedMs, loadSession, newSession, pause, resume, saveSession, type SessionState, settle, taskActiveMs, timerRemainingMs } from './session/sessionState';
import { formatClock, useNow } from './session/useNow';
import { SessionOverview } from './SessionOverview';

export type SessionSummary = Pick<SessionState, 'results' | 'xpEarned' | 'newBadges' | 'weeklyGoalMet'> & { date: string };

export function SessionPage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { soundEnabled } = usePreferences();
  const { data, error, loading, reload } = useApi<PatientOverview>('/patient/overview');
  // Cards the therapist placed next to an exercise; optional, the session works without them.
  const education = useApi<{ cards: CardAssignment[] }>('/patient/education');
  const [state, setState] = useState<SessionState | null>(null);
  const [saveError, setSaveError] = useState('');
  const stateRef = useRef<SessionState | null>(null);
  stateRef.current = state;

  // Restore (paused) or start a session bound to today's date and plan version.
  useEffect(() => {
    if (!data || data.status !== 'training' || !data.todayVersionId) return;
    setState(loadSession(user.id, data.today, data.todayVersionId) ?? newSession(data.today, data.todayVersionId));
  }, [data, user.id]);

  // Persist every change, plus a heartbeat while running and when the tab is hidden.
  useEffect(() => {
    if (state) saveSession(user.id, state);
  }, [state, user.id]);
  useEffect(() => {
    if (!state?.running) return;
    const persist = () => stateRef.current && saveSession(user.id, stateRef.current);
    const id = window.setInterval(persist, 5000);
    document.addEventListener('visibilitychange', persist);
    window.addEventListener('pagehide', persist);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', persist);
      window.removeEventListener('pagehide', persist);
    };
  }, [state?.running, user.id]);

  const timerRunning = Boolean(state?.timer?.endsAt);
  const now = useNow(Boolean(state?.running));

  // Timer end: notify only (sound/vibration if enabled). It never records anything.
  const notifiedRef = useRef<number | null>(null);
  useEffect(() => {
    const timer = state?.timer;
    if (!timer?.endsAt || timerRemainingMs(timer, now) > 0 || notifiedRef.current === timer.endsAt) return;
    notifiedRef.current = timer.endsAt;
    if (soundEnabled) playChime();
    if ('vibrate' in navigator) navigator.vibrate?.(200);
    setState((current) => (current && current.timer ? { ...current, timer: { ...current.timer, endsAt: null, remainingMs: 0 } } : current));
  }, [now, state?.timer, soundEnabled]);

  const tasks = useMemo(() => data?.todayTasks ?? [], [data]);
  const doneIds = useMemo(() => new Set([...tasks.filter((task) => task.completion).map((task) => task.id), ...Object.keys(state?.results ?? {})]), [tasks, state?.results]);
  const pending = tasks.filter((task) => !doneIds.has(task.id));
  const current: PlanTask | undefined = (state?.currentTaskId && pending.find((task) => task.id === state.currentTaskId)) || pending[0];

  const update = useCallback((change: (current: SessionState) => SessionState) => setState((value) => (value ? change(value) : value)), []);

  const ensureTask = useCallback((value: SessionState, task: PlanTask): SessionState => {
    if (value.tasks[task.id]) return value;
    return { ...value, tasks: { ...value.tasks, [task.id]: { setsDone: Array(task.sets).fill(false), reps: Array(task.sets).fill(task.reps), activeMs: 0, idempotencyKey: newId() } } };
  }, []);

  const finishSession = useCallback(
    (value: SessionState) => {
      const summary: SessionSummary = { results: value.results, xpEarned: value.xpEarned, newBadges: value.newBadges, weeklyGoalMet: value.weeklyGoalMet ?? null, date: value.date };
      clearSession(user.id, value.date);
      navigate('/patient/session/complete', { replace: true, state: summary });
    },
    [navigate, user.id],
  );

  if (loading && !data) return <LoadingBlock label={t('Loading today’s session')} rows={4} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;
  if (data.status !== 'training' || tasks.length === 0) return <Navigate to="/patient" replace />;
  if (!state) return <LoadingBlock label={t('Loading today’s session')} rows={2} />;

  const total = tasks.length;
  const doneCount = total - pending.length;
  const inSession = state.phase !== 'overview';
  const progress = current ? state.tasks[current.id] : undefined;

  function start() {
    if (!current) return;
    update((value) => resume({ ...ensureTask(value, current), phase: 'exercise', currentTaskId: current.id }));
  }

  function togglePause() {
    update((value) => (value.running ? pause(value) : resume(value)));
  }

  function stopForDiscomfort() {
    if (!current) return;
    update((value) => ({ ...ensureTask(settle(value), current), currentTaskId: current.id, phase: 'feedback', outcome: 'STOPPED', timer: null }));
  }

  async function save(values: FeedbackValues) {
    const value = stateRef.current;
    if (!value || !current || !value.outcome || value.phase === 'saving') return;
    const settled = settle(value);
    const task = settled.tasks[current.id];
    const outcome = value.outcome;
    setSaveError('');
    setState({ ...settled, phase: 'saving' });

    const ticked = task.setsDone.filter(Boolean).length;
    const setsCompleted = outcome === 'COMPLETED' ? current.sets : outcome === 'PARTIAL' ? (value.partialSets ?? Math.max(1, ticked)) : outcome === 'SKIPPED' ? 0 : ticked;
    const doneReps = task.reps.filter((_, index) => task.setsDone[index]);

    try {
      const result: CompletionResult = await submitCompletion(user.id, current.id, {
        status: outcome,
        painLevel: values.painLevel,
        difficulty: values.difficulty,
        reason: values.reason,
        notes: values.notes.trim() || null,
        setsCompleted,
        repsPerSet: outcome === 'SKIPPED' ? [] : doneReps,
        activeSeconds: Math.round(taskActiveMs(settled, current.id) / 1000),
        idempotencyKey: task.idempotencyKey,
        sessionDate: value.date,
        planVersionId: value.planVersionId,
        occurredAt: new Date().toISOString(),
      });
      const next: SessionState = {
        ...settled,
        phase: 'exercise',
        outcome: null,
        partialSets: null,
        timer: null,
        xpEarned: settled.xpEarned + result.xpAwarded,
        newBadges: [...settled.newBadges, ...result.newBadges],
        weeklyGoalMet: result.weeklyGoal?.justMet ? { done: result.weeklyGoal.done, target: result.weeklyGoal.target } : (settled.weeklyGoalMet ?? null),
        results: {
          ...settled.results,
          [current.id]: { status: result.completion.status, painLevel: result.completion.painLevel, difficulty: result.completion.difficulty, setsCompleted: result.completion.setsCompleted, xpAwarded: result.alreadyRecorded ? 0 : result.completion.xpAwarded, alreadyRecorded: result.alreadyRecorded, title: current.exercise.title },
        },
      };
      const remaining = pending.filter((task) => task.id !== current.id);
      if (remaining.length === 0) {
        finishSession(next);
        return;
      }
      setState(ensureTask({ ...next, currentTaskId: remaining[0].id }, remaining[0]));
      window.scrollTo({ top: 0 });
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError && caught.status === 0
          ? t('Could not reach RehabQuest. Your answers are kept on this device; press “Try again”. The same answer will never be saved twice.')
          : errorMessage(caught),
      );
      setState((latest) => (latest ? { ...latest, phase: 'feedback' } : latest));
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div className="sticky z-20 -mx-4 grid gap-2 border-b-2 border-ink-100 bg-canvas/95 px-4 py-2 backdrop-blur" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}>
        <div className="flex items-center gap-2">
          <Link to="/patient" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-ink-500 hover:bg-ink-100" aria-label={t('Leave session (saved exercises stay saved)')}>
            <X className="h-6 w-6" aria-hidden="true" />
          </Link>
          <div className="flex-1">
            <ProgressBar value={doneCount} max={total} label={t('{done} of {total} exercises saved', { done: doneCount, total })} size="lg" />
          </div>
          <span className="tabular text-sm font-extrabold text-ink-500" dir="ltr">
            {doneCount}/{total}
          </span>
        </div>
        {inSession && current ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={togglePause} className={`btn btn-sm ${state.running ? 'btn-secondary' : 'btn-primary'}`} aria-pressed={!state.running}>
              {state.running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
              {state.running ? t('Pause') : t('Resume')}
            </button>
            <span className="tabular text-sm font-bold text-ink-500" title={t('Active time, pauses not counted')}>
              {t('Active time')} <bdi dir="ltr">{formatClock(elapsedMs(state, now))}</bdi>
            </span>
            {state.outcome !== 'STOPPED' ? (
              <button type="button" onClick={stopForDiscomfort} className="btn btn-soft-danger btn-sm ms-auto">
                <HandHeart className="h-4 w-4" aria-hidden="true" /> {t('Stop – discomfort')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {state.restored && inSession ? (
        <InlineMessage tone="info">{t('Welcome back. Your session was kept and is paused. Press Resume when you are ready.')}</InlineMessage>
      ) : null}

      {!current ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <Mascot mood="cheer" />
          <p className="font-display text-2xl font-bold">{t('All exercises are saved')}</p>
          <button type="button" className="btn btn-primary" onClick={() => finishSession(state)}>
            {t('See your summary')}
          </button>
        </div>
      ) : state.phase === 'overview' ? (
        <div className="grid gap-5">
          <SessionOverview tasks={tasks} doneTaskIds={[...doneIds]} />
          {data.plan?.therapistNotes ? <p className="rounded-2xl bg-sky-50 p-4">{data.plan.therapistNotes}</p> : null}
          <button type="button" className="btn btn-primary btn-lg" onClick={start}>
            <Play className="h-5 w-5 fill-white rtl:rotate-180" aria-hidden="true" /> {doneCount ? t('Continue session') : t('Start session')}
          </button>
        </div>
      ) : state.phase === 'exercise' && progress ? (
        <div className="grid gap-5">
          {!state.running ? (
            <div role="status" className="card flex flex-wrap items-center justify-between gap-3 border-sun-300 bg-sun-50 p-4">
              <p className="font-extrabold">{t('Session paused. Paused time is not counted.')}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={togglePause}>
                <Play className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t('Resume')}
              </button>
            </div>
          ) : null}
          {state.timer ? <TimerPanel timer={state.timer} now={now} running={state.running} onCancel={() => update((value) => ({ ...value, timer: null }))} /> : null}
          <ExerciseView
            task={current}
            cards={education.data?.cards.filter((card) => card.task?.id === current.id) ?? []}
            progress={progress}
            disabled={!state.running}
            timerActive={timerRunning}
            onToggleSet={(index) => update((value) => ({ ...value, tasks: { ...value.tasks, [current.id]: { ...value.tasks[current.id], setsDone: value.tasks[current.id].setsDone.map((done, position) => (position === index ? !done : done)) } } }))}
            onReps={(index, reps) => update((value) => ({ ...value, tasks: { ...value.tasks, [current.id]: { ...value.tasks[current.id], reps: value.tasks[current.id].reps.map((count, position) => (position === index ? reps : count)) } } }))}
            onTimer={(kind, seconds, setIndex) => update((value) => ({ ...value, timer: { kind, setIndex, totalMs: seconds * 1000, remainingMs: seconds * 1000, endsAt: Date.now() + seconds * 1000 } }))}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => update((value) => ({ ...settle(value), phase: 'outcome', timer: null }))}>
              {t('I’m done with this exercise')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => update((value) => ({ ...settle(value), phase: 'feedback', outcome: 'SKIPPED', timer: null }))}>
              {t('Skip this exercise')}
            </button>
          </div>
        </div>
      ) : state.phase === 'outcome' && progress ? (
        <OutcomeChooser
          task={current}
          setsTicked={progress.setsDone.filter(Boolean).length}
          onBack={() => update((value) => ({ ...value, phase: 'exercise' }))}
          onChoose={(outcome: CompletionStatus, sets) => update((value) => ({ ...value, phase: 'feedback', outcome, partialSets: sets }))}
        />
      ) : (state.phase === 'feedback' || state.phase === 'saving') && state.outcome ? (
        <FeedbackForm
          key={`${current.id}-${state.outcome}`}
          task={current}
          outcome={state.outcome}
          saving={state.phase === 'saving'}
          error={saveError}
          onBack={() => {
            setSaveError('');
            update((value) => ({ ...value, phase: 'exercise', outcome: null }));
          }}
          onSubmit={save}
        />
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => update((value) => ({ ...value, phase: 'exercise' }))}>
          {t('Continue')}
        </button>
      )}
    </div>
  );
}
