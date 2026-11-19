/**
 * Elbow and wrist exercises of the starter catalog. Each movement follows the written instructions
 * of its catalog entry (server/src/data/exercise-catalog.ts) and nothing more. The figure has no
 * fingers, so the finger and thumb exercises have no demonstration.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation, Prop } from '../types';
import { anim, cam, CHAIR, type Key, MAT, merge, rep, SIT, STAND, SUPINE, VIEW, x } from './build';

/** Sitting at a table, leaning a little forward, the left forearm resting on it. `twist` -90 = palm down. */
const AT_TABLE = (wrist: [number, number, number]): Key => merge(SIT, { j: { spine: x(25) }, ik: { armL: { at: wrist, pole: [0, -1, 0], twist: -90 } } });
const HAND_OVER_EDGE: [number, number, number] = [0.08, 0.78, 0.56];
const NARROW_TABLE: Prop = { kind: 'table', at: [0, 0.72, 0.42], size: [0.9, 0.04, 0.3] };
const TABLE_VIEW = cam([0.05, 0.74, 0.42], 2.5, [0.14, 0.3]);

/** Standing with the left arm held straight in front; the right hand is at the side until it helps. */
const ARM_IN_FRONT = (twist: number): Key =>
  merge(STAND, { ik: { armL: { at: [0, 1.3, 0.46], pole: [0, -1, 0], twist }, armR: { at: [-0.25, 0.86, 0.03], pole: [-0.3, -1, 0] } } });

export const elbowAnimations: ProceduralAnimation[] = [
  // Sit with the arm at the side; bend the elbow as far as comfortable, palm up; straighten it fully.
  anim('elbow-flexion-extension', merge(SIT, { j: { shoulderL: [0, 0, 5], elbowL: [-4, 80, 0] } }), rep({ j: { elbowL: [-140, 80, 0] } }, 1.8, 0.6, 2, 0.6), {
    hl: ['armL'],
    props: [CHAIR],
    views: VIEW.sit,
  }),

  // Sit with the elbow bent 90° and tucked at the side; turn the palm up, then down.
  anim(
    'elbow-forearm-rotation',
    merge(SIT, { j: { shoulderL: [0, 0, 3], elbowL: x(-90) } }),
    [
      [{ j: { elbowL: [-90, 80, 0] } }, 1.2, 0.5],
      [{ j: { elbowL: [-90, -80, 0] } }, 1.8, 0.5],
      [{}, 1.2, 0.4],
    ],
    { hl: ['armL'], props: [CHAIR], views: cam([0.15, 0.75, 0.2], 2.6, [0.1, 0.25]), startView: 'front' },
  ),

  // Hold a light weight, palm up; bend the elbow to lift it, then lower slowly.
  anim('elbow-biceps-curl', merge(STAND, { j: { elbowL: [-5, 80, 0] } }), rep({ j: { elbowL: [-135, 80, 0] } }, 1.6, 0.4, 2.4, 0.6), {
    hl: ['armL'],
    held: [{ kind: 'weight', hand: 'L' }],
    views: VIEW.upperBody,
  }),

  // Lie on the back with a light weight, upper arm pointing to the ceiling, elbow bent; straighten the elbow; lower slowly.
  anim('elbow-triceps-extension', merge(SUPINE, { j: { shoulderL: x(-90), elbowL: x(-100) } }), rep({ j: { elbowL: x(-5) } }, 1.8, 0.5, 2.6, 0.6), {
    hl: ['armL'],
    props: [MAT],
    held: [{ kind: 'weight', hand: 'L' }],
    views: cam([0, 0.4, -0.3], 3),
  }),

  // Arm straight in front, palm up; the other hand gently bends the wrist and fingers down; hold.
  anim(
    'elbow-wrist-flexor-stretch',
    ARM_IN_FRONT(90),
    [
      [{ ik: { armR: { at: [-0.03, 1.25, 0.47] } } }, 1.2, 0.2],
      [{ j: { wristL: [0, 0, 55] }, ik: { armR: { at: [-0.04, 1.22, 0.47] } } }, 1.2, 4.5],
      [{ ik: { armR: { at: [-0.03, 1.25, 0.47] } } }, 1, 0.2],
      [{}, 1.2, 0.6],
    ],
    { hl: ['armL'], views: VIEW.upperBody, poster: 1 },
  ),

  // Forearm on a table, palm down, light weight over the edge; the other hand lifts the wrist; lower it slowly on its own.
  anim(
    'elbow-eccentric-wrist-extension',
    merge(AT_TABLE(HAND_OVER_EDGE), { j: { wristL: [0, 0, -35] }, ik: { armR: { at: [-0.12, 0.78, 0.45], pole: [-0.6, -1, -0.2] } } }),
    [
      [{ j: { wristL: [0, 0, 40] }, ik: { armR: { at: [0.04, 0.75, 0.66] } } }, 0.9, 0.3],
      [{ j: { wristL: [0, 0, 40] } }, 0.7, 0.3],
      [{}, 3.6, 0.8],
    ],
    { hl: ['armL'], props: [CHAIR, NARROW_TABLE], held: [{ kind: 'weight', hand: 'L' }], views: TABLE_VIEW, poster: 1 },
  ),
];

export const wristAnimations: ProceduralAnimation[] = [
  // Forearm on a table, hand over the edge; lift the hand up, then let it drop down.
  anim(
    'wrist-flexion-extension',
    AT_TABLE(HAND_OVER_EDGE),
    [
      [{ j: { wristL: [0, 0, 45] } }, 1.2, 0.4],
      [{ j: { wristL: [0, 0, -50] } }, 1.8, 0.4],
      [{}, 1, 0.4],
    ],
    { hl: ['armL'], props: [CHAIR, NARROW_TABLE], views: TABLE_VIEW },
  ),

  // Arm straight in front, palm down; the other hand gently bends the wrist down; hold.
  anim(
    'wrist-extensor-stretch',
    ARM_IN_FRONT(-90),
    [
      [{ ik: { armR: { at: [-0.03, 1.34, 0.44] } } }, 1.2, 0.2],
      [{ j: { wristL: [0, 0, -55] }, ik: { armR: { at: [-0.04, 1.3, 0.47] } } }, 1.2, 4.5],
      [{ ik: { armR: { at: [-0.03, 1.34, 0.44] } } }, 1, 0.2],
      [{}, 1.2, 0.6],
    ],
    { hl: ['armL'], views: VIEW.upperBody, poster: 1 },
  ),

  // Forearm and palm flat on a table; slide the hand toward the thumb side, then the little-finger side.
  anim(
    'wrist-side-to-side',
    AT_TABLE([0.08, 0.78, 0.45]),
    [
      [{ j: { wristL: x(25) } }, 1, 0.3],
      [{ j: { wristL: x(-25) } }, 1.6, 0.3],
      [{}, 1, 0.3],
    ],
    { hl: ['armL'], props: [CHAIR, { kind: 'table', at: [0, 0.72, 0.52], size: [0.9, 0.04, 0.5] }], views: cam([0.05, 0.74, 0.45], 2.5, [0.3, 0.5]), startView: 'front' },
  ),

  // Press the palms together in front of the chest; lower the hands, palms together, until a stretch is felt; hold.
  anim(
    'wrist-prayer-stretch',
    merge(STAND, {
      j: { wristL: [0, 0, 0], wristR: [0, 0, 0] },
      ik: { armL: { at: [0.03, 1.27, 0.2], pole: [1, -0.5, 0], hand: [180, 0, 0] }, armR: { at: [-0.03, 1.27, 0.2], pole: [-1, -0.5, 0], hand: [180, 0, 0] } },
    }),
    [
      [{ ik: { armL: { at: [0.03, 1.1, 0.2], pole: [1, 0, 0] }, armR: { at: [-0.03, 1.1, 0.2], pole: [-1, 0, 0] } } }, 1.8, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['armL', 'armR'], views: VIEW.upperBody, startView: 'front' },
  ),

  // Forearm on a table, palm down, light weight over the edge; lift the hand up; lower slowly.
  anim('wrist-weighted-extension', merge(AT_TABLE(HAND_OVER_EDGE), { j: { wristL: [0, 0, -30] } }), rep({ j: { wristL: [0, 0, 45] } }, 1.4, 0.5, 2.8, 0.6), {
    hl: ['armL'],
    props: [CHAIR, NARROW_TABLE],
    held: [{ kind: 'weight', hand: 'L' }],
    views: TABLE_VIEW,
  }),
];
