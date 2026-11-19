/**
 * Development-only review gallery (served by the dev server at /demo-gallery.html, not part of the
 * production build). Lists every built-in movement so a developer or physiotherapist can look at
 * each one. `?key=…&t=…&view=…` shows a single still frame; `&shot=1` hides everything but the frame.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DemoCanvas from './DemoCanvas';
import { PROCEDURAL_ANIMATIONS } from './registry';
import type { ViewName } from './types';

const params = new URLSearchParams(location.search);
const KEYS = Object.keys(PROCEDURAL_ANIMATIONS);

function Gallery() {
  const [key, setKey] = useState(params.get('key') ?? KEYS[0]);
  const [view, setView] = useState<ViewName | null>((params.get('view') as ViewName | null) ?? null);
  const [playing, setPlaying] = useState(!params.has('t'));
  const [time, setTime] = useState(0);
  const [at, setAt] = useState(params.get("t"));
  // Lets a screenshot script step through every movement without reloading the page.
  Object.assign(window, { demoKeys: KEYS, showDemo: (nextKey: string, nextAt: string, nextView: ViewName) => (setKey(nextKey), setAt(nextAt), setView(nextView), setPlaying(false)) });
  const animation = PROCEDURAL_ANIMATIONS[key];
  const shot = params.has('shot');
  if (!animation) return <p>Unknown key: {key}</p>;
  const startTime = at === "poster" ? animation.posterTime : Number(at ?? 0);
  const shownView = view ?? animation.startView ?? 'side';

  const frame = (
    <div id="frame" data-ready={time >= 0} style={{ width: shot ? 480 : 'min(100%, 640px)', aspectRatio: '16 / 10', background: 'linear-gradient(#E7FAF5, #fff)' }}>
      <DemoCanvas
        key={`${key}-${playing}-${startTime}`}
        demo={{ kind: 'procedural', animation }}
        view={shownView}
        playback={{ playing, speed: 1, startTime, onTick: setTime }}
        instantCamera
        onContextChange={() => undefined}
      />
    </div>
  );
  if (shot) return frame;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '16rem 1fr', gap: 16, padding: 16 }}>
      <nav style={{ maxHeight: '95vh', overflow: 'auto' }}>
        <strong>{KEYS.length} movements (all unreviewed)</strong>
        {KEYS.map((name) => (
          <button key={name} type="button" onClick={() => setKey(name)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 6, border: 0, background: name === key ? '#C9F4EA' : 'transparent', cursor: 'pointer' }}>
            {name}
          </button>
        ))}
      </nav>
      <main>
        <h1 style={{ fontSize: 20 }}>{key}</h1>
        {frame}
        <p>
          <button type="button" onClick={() => setPlaying((value) => !value)}>
            {playing ? 'Pause' : 'Play'}
          </button>{' '}
          <button type="button" onClick={() => setView(shownView === 'side' ? 'front' : 'side')}>
            View: {shownView}
          </button>{' '}
          {time.toFixed(1)} s of {animation.duration.toFixed(1)} s
        </p>
        <p>Development preview. Not reviewed by a physiotherapist.</p>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
