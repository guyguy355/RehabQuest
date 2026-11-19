/**
 * Heel slides (starter catalog "knee-heel-slides").
 *
 * Follows the written instructions of that exercise and nothing more:
 *   1. Lie on your back with legs straight.
 *   2. Slide one heel toward you, bending the knee as far as is comfortable.
 *   3. Pause for two seconds, then slide back.
 *
 * NOT CLINICALLY REVIEWED. Range, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check this movement before the exercise's demoReviewStatus is set to APPROVED.
 */
import { easeInOut, MAT_TOP, SKELETON } from '../skeleton';
import type { Pose, ProceduralAnimation } from '../types';

const SETTLE = 0.6; // lying still before the repetition starts
const SLIDE_IN = 2.4;
const HOLD = 2.0; // "pause for two seconds"
const SLIDE_OUT = 2.6;
const REST = 0.8; // pause between repetitions
const DURATION = SETTLE + SLIDE_IN + HOLD + SLIDE_OUT + REST;

/** Hip bend at the end of the slide. The knee bend follows from keeping the heel on the mat. */
const MAX_HIP_BEND = (50 * Math.PI) / 180;

/** 0 = leg straight, 1 = heel closest to the body. */
function bendAmount(time: number) {
  let t = time - SETTLE;
  if (t <= 0) return 0;
  if (t < SLIDE_IN) return easeInOut(t / SLIDE_IN);
  t -= SLIDE_IN;
  if (t < HOLD) return 1;
  t -= HOLD;
  if (t < SLIDE_OUT) return 1 - easeInOut(t / SLIDE_OUT);
  return 0;
}

function pose(time: number): Pose {
  const hip = bendAmount(time) * MAX_HIP_BEND;
  // The heel stays at hip height (on the mat): the shin drops as far as the thigh lifts the knee.
  const shinDrop = Math.asin(Math.min(1, (SKELETON.thigh / SKELETON.shin) * Math.sin(hip)));
  const knee = hip + shinDrop;

  return {
    // Lying on the back: head toward -z, feet toward +z, face up.
    root: { position: [0, MAT_TOP + SKELETON.backDepth, -0.1], rotation: [-Math.PI / 2, 0, 0] },
    joints: {
      hipL: [-hip, 0, 0],
      kneeL: [knee, 0, 0],
      shoulderL: [0, 0, 0.16],
      shoulderR: [0, 0, -0.16],
    },
  };
}

export const heelSlides: ProceduralAnimation = {
  key: 'heel-slides',
  duration: DURATION,
  posterTime: SETTLE + SLIDE_IN + HOLD / 2,
  pose,
  highlight: ['legL'],
  props: [{ kind: 'mat' }],
  views: {
    side: { position: [3.05, 0.95, 0.05], target: [0, 0.27, 0.05] },
    front: { position: [1.15, 1.5, 2.95], target: [0, 0.22, 0.05] },
  },
};
