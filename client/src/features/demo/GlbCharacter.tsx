/**
 * A rigged GLB model playing one authored animation clip. Used for demos with type GLB
 * (Exercise.demoModelUrl + demoClipName). The clip is driven by the shared demo clock, so
 * pause, speed and looping behave exactly like the built-in figure.
 */
import { useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import type { Playback } from './types';
import { useDemoFrame } from './useDemoFrame';

const TARGET_HEIGHT = 1.7;

export default function GlbCharacter({ url, clipName, playback }: { url: string; clipName: string | null; playback: Playback }) {
  const { scene, animations } = useGLTF(url);
  const { actions, names, mixer } = useAnimations(animations, scene);
  const name = clipName ?? names[0];
  const action = name ? actions[name] : null;
  if (!action) throw new Error(`Animation clip "${clipName ?? '(first)'}" was not found in ${url}`);

  // Scale to a known height and stand the model on the floor, whatever units it was authored in.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
    const centre = box.getCenter(new Vector3());
    return { scale, position: [-centre.x * scale, -box.min.y * scale, -centre.z * scale] as const };
  }, [scene]);

  useEffect(() => {
    scene.traverse((object) => {
      object.castShadow = true;
    });
    // The demo clock sets the clip time itself; the mixer must not advance on its own.
    mixer.timeScale = 0;
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [action, mixer, scene]);

  const duration = action.getClip().duration;
  useDemoFrame(playback, duration, (time) => {
    action.time = time;
    mixer.update(0);
  });

  return <primitive object={scene} scale={fit.scale} position={fit.position} />;
}
