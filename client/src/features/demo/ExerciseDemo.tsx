/**
 * Animated 3D demonstration of one exercise, for the patient's exercise screen.
 *
 * - Renders nothing when the exercise has no demonstration this client can show, so the
 *   screen keeps its existing content (text steps, therapist image/video).
 * - Plays in a loop while it is on screen and the tab is visible; starts paused when the
 *   person asked for reduced motion (OS setting or calm mode).
 * - It is a picture only: it never counts repetitions and never records anything.
 * - Use it for the one exercise that is open. Do not put it in lists: every instance owns a WebGL canvas.
 */
import { Pause, Play } from 'lucide-react';
import { Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences } from '../../app/preferences';
import type { ExerciseDemo as ExerciseDemoData } from '../../app/types';
import { useI18n } from '../../i18n';
import { Chip } from '../../ui/Pills';
import { resolveDemo } from './registry';
import type { Playback, ResolvedDemo, ViewName } from './types';

const DemoCanvas = lazy(() => import('./DemoCanvas'));

const SPEEDS = [0.5, 1, 1.5] as const;

class DemoErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Exercise demonstration could not be shown', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** True while the element is (partly) on screen and the browser tab is visible. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const listener = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  }, []);

  return { ref, onScreen: inView && tabVisible };
}

function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border-2 border-ink-200 bg-white p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`min-h-10 min-w-11 rounded-lg px-3 text-sm font-extrabold transition-colors ${option.value === value ? 'bg-brand-600 text-white' : 'text-brand-700 hover:bg-brand-50'}`}
        >
          <bdi>{option.label}</bdi>
        </button>
      ))}
    </div>
  );
}

export function ExerciseDemo({ demo, title }: { demo: ExerciseDemoData | null | undefined; title: string }) {
  const resolved = useMemo(() => resolveDemo(demo), [demo]);
  if (!demo || !resolved) return null;
  return <DemoPlayer resolved={resolved} approved={demo.reviewStatus === 'APPROVED'} title={title} />;
}

function DemoPlayer({ resolved, approved, title }: { resolved: ResolvedDemo; approved: boolean; title: string }) {
  const { t } = useI18n();
  const { calm } = usePreferences();
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  // Reduced motion: start paused on a still frame; the person can press Play.
  const [startPaused] = useState(calm);
  const [wantsPlay, setWantsPlay] = useState(!calm);
  const [speed, setSpeed] = useState<number>(1);
  const [view, setView] = useState<ViewName>(resolved.kind === 'procedural' ? (resolved.animation.startView ?? 'side') : 'side');
  const [seen, setSeen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // The canvas is created the first time the player scrolls into view, and kept after that.
  useEffect(() => {
    if (onScreen) setSeen(true);
  }, [onScreen]);

  const playing = wantsPlay && onScreen && !contextLost;
  const onTick = useCallback(
    (time: number) => {
      if (ref.current) ref.current.dataset.demoTime = time.toFixed(1);
    },
    [ref],
  );
  const playback: Playback = {
    playing,
    speed,
    startTime: startPaused && resolved.kind === 'procedural' ? resolved.animation.posterTime : 0,
    onTick,
  };

  const placeholder = <div className="absolute inset-0 animate-pulse bg-brand-100/60" role="status" aria-label={t('Loading the demonstration')} />;

  return (
    <section aria-labelledby="demo-title" className="card grid gap-3 p-3 sm:p-4" data-testid="exercise-demo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="demo-title" className="font-display text-xl font-bold">
          {t('Watch the movement')}
        </h2>
        {approved ? null : <Chip tone="sun">{t('Preview · not yet reviewed by a physiotherapist')}</Chip>}
      </div>

      {failed ? (
        <p className="rounded-2xl bg-ink-50 p-4 text-ink-700" role="status">
          {t('The 3D demonstration can’t be shown on this device. Follow the written steps below.')}
        </p>
      ) : (
        <>
          <div
            ref={ref}
            role="img"
            aria-label={t('Animated 3D demonstration of {title}', { title })}
            data-demo-state={playing ? 'playing' : 'paused'}
            className="relative aspect-[4/3] max-h-[24rem] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-brand-50 to-white sm:aspect-[16/10]"
            dir="ltr"
          >
            {seen ? (
              <DemoErrorBoundary onError={() => setFailed(true)}>
                <Suspense fallback={placeholder}>
                  <DemoCanvas demo={resolved} view={view} playback={playback} instantCamera={calm} onContextChange={setContextLost} />
                </Suspense>
              </DemoErrorBoundary>
            ) : (
              placeholder
            )}
            {contextLost ? placeholder : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`btn btn-sm ${wantsPlay ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setWantsPlay((value) => !value)}>
              {wantsPlay ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              {wantsPlay ? t('Pause demonstration') : t('Play demonstration')}
            </button>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Segmented label={t('Playback speed')} value={speed} onChange={setSpeed} options={SPEEDS.map((value) => ({ value, label: `${value}×` }))} />
              <Segmented<ViewName>
                label={t('Camera view')}
                value={view}
                onChange={setView}
                options={[
                  { value: 'front', label: t('Front') },
                  { value: 'side', label: t('Side') },
                ]}
              />
            </div>
          </div>
        </>
      )}

      <p className="text-sm text-ink-500">{t('A general illustration of the movement. It does not count your repetitions. Follow your therapist’s instructions, and stop if it hurts.')}</p>
    </section>
  );
}
