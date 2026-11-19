/**
 * Which demonstration belongs to which key. One animation per exercise: an exercise whose key is
 * not listed here (or that has no demo at all) keeps its existing content and shows no 3D player.
 * How to add one: docs/EXERCISE_DEMOS.md.
 */
import type { ExerciseDemo } from '../../app/types';
import { ankleAnimations } from './animations/ankle';
import { elbowMoreAnimations, shoulderMoreAnimations, wristMoreAnimations } from './animations/armsMore';
import { elbowAnimations, wristAnimations } from './animations/arm';
import { heelSlides } from './animations/heelSlides';
import { hipAnimations } from './animations/hip';
import { kneeAnimations } from './animations/knee';
import { ankleMoreAnimations, balanceAnimations, hipMoreAnimations, kneeMoreAnimations } from './animations/legsMore';
import { neckAnimations } from './animations/neck';
import { shoulderAnimations } from './animations/shoulder';
import { backAnimations, coreAnimations } from './animations/trunk';
import { backMoreAnimations, coreMoreAnimations, neckMoreAnimations, thoracicAnimations, vestibularAnimations } from './animations/trunkMore';
import type { CameraViews, ProceduralAnimation, ResolvedDemo } from './types';

const ALL: ProceduralAnimation[] = [
  heelSlides,
  ...kneeAnimations,
  ...hipAnimations,
  ...ankleAnimations,
  ...shoulderAnimations,
  ...elbowAnimations,
  ...wristAnimations,
  ...neckAnimations,
  ...backAnimations,
  ...coreAnimations,
  ...kneeMoreAnimations,
  ...hipMoreAnimations,
  ...ankleMoreAnimations,
  ...balanceAnimations,
  ...shoulderMoreAnimations,
  ...elbowMoreAnimations,
  ...wristMoreAnimations,
  ...neckMoreAnimations,
  ...thoracicAnimations,
  ...backMoreAnimations,
  ...coreMoreAnimations,
  ...vestibularAnimations,
];

export const PROCEDURAL_ANIMATIONS: Readonly<Record<string, ProceduralAnimation>> = Object.fromEntries(ALL.map((animation) => [animation.key, animation]));
if (import.meta.env.DEV && Object.keys(PROCEDURAL_ANIMATIONS).length !== ALL.length) console.error('Two exercise demonstrations share a key');

/** Camera positions for a standing, roughly 1.7 m tall rigged model whose feet are at the origin. */
const STANDING_VIEWS: CameraViews = {
  front: { position: [0, 1.2, 4.6], target: [0, 0.9, 0] },
  side: { position: [4.6, 1.2, 0], target: [0, 0.9, 0] },
};

/** Models are loaded from this app's own origin (e.g. /models/…) or over https only. */
const SAFE_MODEL_URL = /^(\/(?!\/)|https:\/\/)/;

/** The renderable demonstration for an exercise, or null when there is nothing this client can show. */
export function resolveDemo(demo: ExerciseDemo | null | undefined): ResolvedDemo | null {
  if (!demo) return null;
  if (demo.type === 'PROCEDURAL') {
    const animation = PROCEDURAL_ANIMATIONS[demo.key];
    return animation ? { kind: 'procedural', animation } : null;
  }
  if (demo.type === 'GLB' && demo.modelUrl && SAFE_MODEL_URL.test(demo.modelUrl)) {
    return { kind: 'glb', modelUrl: demo.modelUrl, clipName: demo.clipName, views: STANDING_VIEWS };
  }
  return null;
}
