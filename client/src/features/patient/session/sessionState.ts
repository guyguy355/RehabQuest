/**
 * In-progress guided session, persisted per user + day + plan version so a refresh
 * resumes the same session.
 *
 * Time handling (no decrementing setInterval counters):
 * - Active time = accumulated milliseconds + (now − runningSince) while running.
 * - A heartbeat (`lastSeenAt`) is saved every few seconds. After a refresh or crash the
 *   session is restored *paused* and only the time up to the last heartbeat is counted.
 * - Timers store their end timestamp while running and their remaining time while paused,
 *   so background tabs and refreshes compute the correct remaining time.
 * - A timer reaching zero only notifies; it never records an exercise as done.
 */
import { readJson, removeKey, userKey, writeJson } from '../../../app/localData';
import type { Badge, CompletionStatus, DifficultyRating } from '../../../app/types';

export type TaskResult = { status: CompletionStatus; painLevel: number | null; difficulty: DifficultyRating | null; setsCompleted: number | null; xpAwarded: number; alreadyRecorded: boolean; title: string };

export type TimerState = { kind: 'hold' | 'rest'; totalMs: number; endsAt: number | null; remainingMs: number; setIndex: number };

export type TaskProgress = {
  setsDone: boolean[];
  reps: number[];
  activeMs: number; // active time attributed to this exercise
  idempotencyKey: string; // reused on retry so a lost response never creates a duplicate
};

export type SessionState = {
  version: 1;
  date: string;
  planVersionId: string;
  startedAt: number;
  phase: 'overview' | 'exercise' | 'outcome' | 'feedback' | 'saving';
  currentTaskId: string | null;
  outcome: 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'STOPPED' | null;
  partialSets: number | null; // sets done when the outcome is PARTIAL
  running: boolean; // false = paused
  runningSince: number | null;
  activeMs: number; // whole-session active time before runningSince
  lastSeenAt: number;
  tasks: Record<string, TaskProgress>;
  timer: TimerState | null;
  restored: boolean; // true right after a refresh restored it
  results: Record<string, TaskResult>; // confirmed by the server
  xpEarned: number;
  newBadges: Badge[];
  /** Set when this session reached the weekly goal for the first time this week (server-confirmed). */
  weeklyGoalMet?: { done: number; target: number } | null;
};

const key = (userId: string, date: string) => userKey(userId, `session.${date}`);

export function loadSession(userId: string, date: string, planVersionId: string): SessionState | null {
  const stored = readJson<SessionState>(key(userId, date));
  if (!stored || stored.version !== 1 || stored.planVersionId !== planVersionId) return null;
  // Restore paused: count active time only until the last heartbeat.
  const lastSeen = stored.lastSeenAt;
  const activeMs = stored.running && stored.runningSince ? stored.activeMs + Math.max(0, lastSeen - stored.runningSince) : stored.activeMs;
  const tasks = { ...stored.tasks };
  if (stored.running && stored.runningSince && stored.currentTaskId && tasks[stored.currentTaskId]) {
    const task = tasks[stored.currentTaskId];
    tasks[stored.currentTaskId] = { ...task, activeMs: task.activeMs + Math.max(0, lastSeen - stored.runningSince) };
  }
  const timer = stored.timer && stored.timer.endsAt ? { ...stored.timer, remainingMs: Math.max(0, stored.timer.endsAt - lastSeen), endsAt: null } : stored.timer;
  return { ...stored, tasks, activeMs, running: false, runningSince: null, timer, restored: true, phase: stored.phase === 'saving' ? 'feedback' : stored.phase };
}

export function saveSession(userId: string, state: SessionState) {
  writeJson(key(userId, state.date), { ...state, lastSeenAt: Date.now() });
}

export function clearSession(userId: string, date: string) {
  removeKey(key(userId, date));
}

export function newSession(date: string, planVersionId: string): SessionState {
  const now = Date.now();
  return { version: 1, date, planVersionId, startedAt: now, phase: 'overview', currentTaskId: null, outcome: null, partialSets: null, running: false, runningSince: null, activeMs: 0, lastSeenAt: now, tasks: {}, timer: null, restored: false, results: {}, xpEarned: 0, newBadges: [] };
}

export function elapsedMs(state: SessionState, now = Date.now()) {
  return state.activeMs + (state.running && state.runningSince ? now - state.runningSince : 0);
}

export function taskActiveMs(state: SessionState, taskId: string, now = Date.now()) {
  const task = state.tasks[taskId];
  if (!task) return 0;
  const live = state.running && state.runningSince && state.currentTaskId === taskId ? now - state.runningSince : 0;
  return task.activeMs + live;
}

/** Moves the live running time into the accumulators (used before pausing or switching exercise). */
export function settle(state: SessionState, now = Date.now()): SessionState {
  if (!state.running || !state.runningSince) return state;
  const delta = now - state.runningSince;
  const tasks = { ...state.tasks };
  if (state.currentTaskId && tasks[state.currentTaskId]) {
    tasks[state.currentTaskId] = { ...tasks[state.currentTaskId], activeMs: tasks[state.currentTaskId].activeMs + delta };
  }
  return { ...state, tasks, activeMs: state.activeMs + delta, runningSince: now };
}

export function pause(state: SessionState, now = Date.now()): SessionState {
  const settled = settle(state, now);
  const timer = settled.timer && settled.timer.endsAt ? { ...settled.timer, remainingMs: Math.max(0, settled.timer.endsAt - now), endsAt: null } : settled.timer;
  return { ...settled, running: false, runningSince: null, timer, restored: false };
}

export function resume(state: SessionState, now = Date.now()): SessionState {
  const timer = state.timer && !state.timer.endsAt && state.timer.remainingMs > 0 ? { ...state.timer, endsAt: now + state.timer.remainingMs } : state.timer;
  return { ...state, running: true, runningSince: now, timer, restored: false };
}

export function timerRemainingMs(timer: TimerState | null, now = Date.now()) {
  if (!timer) return 0;
  return timer.endsAt ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
}
