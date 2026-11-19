/**
 * The WebGL scene of one exercise demonstration. Loaded lazily (it pulls in three.js) and only
 * by <ExerciseDemo>, which decides when it plays. While not playing the canvas renders on
 * demand only, so a paused or off-screen demonstration costs nothing.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { ProceduralHumanoid } from './ProceduralHumanoid';
import type { CameraView, Playback, ResolvedDemo, ViewName } from './types';

const GlbCharacter = lazy(() => import('./GlbCharacter'));

/** Views are authored for a 16:10 frame. On narrower frames the camera backs off so the figure still fits. */
const AUTHORED_ASPECT = 1.6;

function CameraRig({ view, instant }: { view: CameraView; instant: boolean }) {
  const { camera, size, invalidate } = useThree();
  const lookAt = useRef<Vector3 | null>(null);

  useEffect(() => {
    invalidate();
  }, [view, size, invalidate]);

  useFrame((_, delta) => {
    const target = new Vector3(...view.target);
    const backOff = Math.max(1, AUTHORED_ASPECT / (size.width / size.height));
    const position = new Vector3(...view.position).sub(target).multiplyScalar(backOff).add(target);

    if (!lookAt.current || instant) {
      camera.position.copy(position);
      lookAt.current = target;
    } else {
      const step = 1 - Math.exp(-Math.min(delta, 0.05) * 7);
      camera.position.lerp(position, step);
      lookAt.current.lerp(target, step);
      // Keep rendering until the glide is finished, also while the animation itself is paused.
      if (camera.position.distanceToSquared(position) > 1e-5) invalidate();
      else camera.position.copy(position);
    }
    camera.lookAt(lookAt.current);
  });
  return null;
}

export type DemoCanvasProps = {
  demo: ResolvedDemo;
  view: ViewName;
  playback: Playback;
  /** Move the camera without a glide (reduced motion). */
  instantCamera: boolean;
  onContextChange: (lost: boolean) => void;
};

export default function DemoCanvas({ demo, view, playback, instantCamera, onContextChange }: DemoCanvasProps) {
  const views = demo.kind === 'procedural' ? demo.animation.views : demo.views;
  const start = views[view];

  return (
    <Canvas
      frameloop={playback.playing ? 'always' : 'demand'}
      dpr={[1, 2]}
      shadows
      camera={{ fov: 30, near: 0.1, far: 40, position: [...start.position] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl, invalidate }) => {
        const canvas = gl.domElement;
        // A canvas that was removed loses its context on purpose (disposal); only a live one counts.
        canvas.addEventListener('webglcontextlost', () => canvas.isConnected && onContextChange(true));
        canvas.addEventListener('webglcontextrestored', () => {
          onContextChange(false);
          invalidate();
        });
      }}
    >
      <hemisphereLight args={['#ffffff', '#C9F4EA', 1.5]} />
      <directionalLight
        position={[2.5, 5, 3]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <shadowMaterial opacity={0.16} />
      </mesh>
      <CameraRig view={start} instant={instantCamera} />
      {demo.kind === 'procedural' ? (
        <ProceduralHumanoid animation={demo.animation} playback={playback} />
      ) : (
        <Suspense fallback={null}>
          <GlbCharacter url={demo.modelUrl} clipName={demo.clipName} playback={playback} />
        </Suspense>
      )}
    </Canvas>
  );
}
