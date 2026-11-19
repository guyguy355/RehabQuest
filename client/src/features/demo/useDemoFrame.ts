import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Playback } from './types';

/**
 * The one clock of a demonstration. Advances the position in the repetition while playing
 * (scaled by the speed) and hands it to `apply` on every rendered frame, so the procedural
 * figure and a GLB clip are paused, slowed and looped in exactly the same way.
 */
export function useDemoFrame(playback: Playback, duration: number, apply: (time: number) => void) {
  const latest = useRef(playback);
  const time = useRef(playback.startTime);
  const lastTick = useRef(-1);
  useEffect(() => {
    latest.current = playback;
  });

  useFrame((_, delta) => {
    const { playing, speed, onTick } = latest.current;
    // A frame after a long gap (hidden tab, paused loop) must not jump ahead.
    if (playing && duration > 0) time.current = (time.current + Math.min(delta, 0.1) * speed) % duration;
    apply(time.current);
    if (onTick && Math.abs(time.current - lastTick.current) >= 0.2) {
      lastTick.current = time.current;
      onTick(time.current);
    }
  });
}
