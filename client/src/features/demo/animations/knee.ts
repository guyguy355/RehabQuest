/**
 * Knee exercises of the starter catalog. Each movement follows the written instructions of its
 * catalog entry (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation } from '../types';
import { anim, AT_COUNTER, cam, CHAIR, COUNTER, feet, type Key, LONG_SIT, MAT, merge, PRONE, rep, SIT, STAND, SUPINE, VIEW, x } from './build';

const HOOK_RIGHT: Key['ik'] = { legR: { at: [-0.1, 0.11, 0.45], pole: [0, 1, 0], foot: [0, 0, 0] } };
const STEP_HALFWAY: Key = { p: [0, 1.0, 0.2], ik: { legR: { at: [-0.095, 0.29, 0.08] }, armR: { at: [-0.47, 0.99, 0.26] } } };

export const kneeAnimations: ProceduralAnimation[] = [
  // Sit with the leg straight; tighten the thigh and press the back of the knee down; hold 5 s.
  anim('knee-quad-sets', merge(LONG_SIT, { j: { hipL: x(-80), kneeL: x(10) } }), rep({ j: { hipL: x(-75), kneeL: x(0), ankleL: x(-15) } }, 1.2, 5, 1.2, 1), {
    hl: ['legL'],
    props: [MAT],
    views: VIEW.floorSit,
  }),

  // Lie on the back, one knee bent; lift the straight leg to the height of the other knee; lower slowly.
  anim('knee-straight-leg-raise', merge(SUPINE, { ik: HOOK_RIGHT }), rep({ j: { hipL: x(-28) } }, 2, 1, 2.8, 0.8), { hl: ['legL'], props: [MAT], views: VIEW.floor }),

  // Rolled towel under the knee; straighten the knee by lifting the heel; hold 3 s; lower slowly.
  anim('knee-short-arc-quads', merge(SUPINE, { j: { hipL: x(-18), kneeL: x(36) } }), rep({ j: { kneeL: x(2) } }, 1.6, 3, 2.4, 0.8), {
    hl: ['legL'],
    props: [MAT, { kind: 'roll', at: [0.095, 0.115, 0.26] }],
    views: VIEW.floor,
  }),

  // Sit tall on a chair; straighten one knee until the leg is level; pause; lower slowly.
  anim('knee-seated-extension', merge(SIT, { ik: { legL: null }, j: { hipL: x(-90), kneeL: x(90) } }), rep({ j: { kneeL: x(4) } }, 1.8, 1, 2.6, 0.8), {
    hl: ['legL'],
    props: [CHAIR],
    views: VIEW.sit,
  }),

  // Low step, holding a rail; step up with the treated leg, then step down slowly.
  anim(
    'knee-step-ups',
    {
      ...STAND,
      p: [0, 0.92, 0.02],
      ik: { legL: { at: [0.095, 0.23, 0.36], foot: [0, 0, 0] }, legR: { at: [-0.095, 0.08, 0], foot: [0, 0, 0] }, armR: { at: [-0.47, 0.97, 0.12], pole: [-0.3, -0.5, -1] } },
    },
    [
      [STEP_HALFWAY, 1.1],
      [{ p: [0, 1.07, 0.36], ik: { legR: { at: [-0.095, 0.23, 0.36] }, armR: { at: [-0.47, 1.02, 0.42] } } }, 0.9, 1],
      [STEP_HALFWAY, 1.4],
      [{}, 1.3, 0.8],
    ],
    { hl: ['legL'], props: [{ kind: 'step', at: [0, 0.075, 0.42], size: [0.8, 0.15, 0.5] }, COUNTER], views: cam([0, 0.95, 0.15], 4.3, [0.06, 0.14]), poster: 1 },
  ),

  // Back against a wall, feet a step forward; slide down until the knees are slightly bent; hold; slide up.
  anim('knee-wall-sit', { ...STAND, p: [0, 0.85, -0.02], ik: feet(0.35, 0.35, 0.11) }, rep({ p: [0, 0.76, -0.02] }, 2, 4, 2, 0.8), {
    hl: ['legL', 'legR'],
    props: [{ kind: 'wall', at: [0, 1.05, -0.17] }],
    views: VIEW.stand,
  }),

  // Sit near the front of a chair; lean forward and stand up; sit down slowly.
  anim(
    'knee-sit-to-stand',
    merge(SIT, { ik: feet(0.32) }),
    [
      [{ j: { spine: x(28) } }, 0.9],
      [{ p: [0, 0.92, 0.3], j: { shoulderL: [0, 0, 7], shoulderR: [0, 0, -7], elbowL: x(0), elbowR: x(0) } }, 1.6, 1],
      [{ j: { spine: x(28) } }, 2.2],
      [{}, 0.8, 0.8],
    ],
    { hl: ['legL', 'legR'], props: [CHAIR], views: cam([0, 0.8, 0.2], 4.1, [0.06, 0.14]), poster: 1 },
  ),

  // Hold a counter; bend the knees a little, sitting the hips back; straighten up.
  anim('knee-mini-squat', merge(AT_COUNTER, { ik: feet() }), rep({ p: [0, 0.86, -0.06], j: { spine: x(18) } }, 1.6, 0.6, 1.6, 0.8), {
    hl: ['legL', 'legR'],
    props: [COUNTER],
    views: VIEW.stand,
  }),

  // Hold a counter; bend one knee, bringing the heel toward the buttock; lower slowly.
  anim('knee-hamstring-curl-standing', AT_COUNTER, rep({ j: { kneeL: x(95) } }, 1.6, 0.5, 2.2, 0.8), { hl: ['legL'], props: [COUNTER], views: VIEW.stand }),

  // Front of a chair, one leg straight with the heel on the floor; lean forward from the hips; hold.
  anim(
    'knee-hamstring-stretch',
    merge(SIT, { ik: { legL: null }, j: { hipL: x(-58), ankleL: x(-25) } }),
    [
      [{ j: { spine: x(30) } }, 1.8, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['legL'], props: [CHAIR], views: cam([0, 0.6, 0.3], 3.7, [0.1, 0.2]) },
  ),

  // Lie on the stomach; bend one knee, heel toward the buttock; lower slowly.
  anim('knee-prone-bend', PRONE, rep({ j: { kneeL: x(105), ankleL: x(25) } }, 2, 0.6, 2.4, 0.8), { hl: ['legL'], props: [MAT], views: VIEW.floor }),

  // Band behind the knee, anchored in front; start slightly bent; straighten against the band; hold 2 s.
  anim('knee-terminal-extension-band', { ...STAND, p: [0, 0.895, 0.02], ik: feet(0.1, -0.1) }, rep({ p: [0, 0.91, -0.02] }, 1.2, 2, 1.8, 0.8), {
    hl: ['legL'],
    held: [{ kind: 'band', from: [0.095, 0.5, 1.5], to: 'kneeL' }],
    views: cam([0, 0.8, 0.4], 4.5, [0.06, 0.14]),
  }),

  // Sideways on a low step, holding a rail; bend the standing knee to lower the free heel to the floor; straighten.
  anim(
    'knee-lateral-step-down',
    {
      ...STAND,
      p: [0, 1.07, 0],
      ik: { legL: { at: [0.095, 0.23, 0], foot: [0, 0, 0] }, legR: { at: [-0.15, 0.25, 0.02], foot: [0, 0, 0] }, armR: { at: [-0.5, 1.12, 0.1], pole: [-0.3, -0.5, -1] } },
    },
    rep({ p: [0, 0.95, -0.06], j: { spine: x(14) }, ik: { legR: { at: [-0.15, 0.11, 0.06] } } }, 2.2, 0.5, 1.8, 0.8),
    {
      hl: ['legL'],
      props: [
        { kind: 'step', at: [0.2, 0.075, 0], size: [0.45, 0.15, 0.6] },
        { kind: 'counter', at: [-0.78, 0.525, 0], size: [0.5, 1.05, 1.4] },
      ],
      views: cam([0, 0.95, 0.05], 4.7, [0.06, 0.14]),
      startView: 'front',
    },
  ),
];
