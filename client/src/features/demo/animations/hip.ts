/**
 * Hip exercises of the starter catalog. Each movement follows the written instructions of its
 * catalog entry (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation } from '../types';
import { anim, AT_COUNTER, cam, COUNTER, feet, HANDS_DOWN, HOOK, type Key, MAT, merge, rep, SIDE, sides, STAND, VIEW, x } from './build';

const BRIDGE: Key = { p: [0, 0.3, -0.13], r: [-112, 0, 0], j: { neck: x(20) } };
const SIDE_VIEW = cam([0, 0.3, 0.1], 3.1);
const ANKLE_ON_KNEE: Key = { ik: { legL: { at: [-0.07, 0.5, 0.16], pole: [1, 0.4, 0.2], foot: null } } };
const LEG_IN_AIR: Key = { ik: { legL: { at: [0.095, 0.74, 0.455], foot: null } } };

export const hipAnimations: ProceduralAnimation[] = [
  // Lie on the back, knees bent, feet flat; squeeze the glutes and lift the hips; lower slowly.
  anim('hip-glute-bridge', merge(HOOK, { ik: HANDS_DOWN }), rep(BRIDGE, 1.8, 1.5, 2.4, 0.8), { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor }),

  // Lie on the side, hips and knees bent, feet together; lift the top knee, feet touching; lower slowly.
  anim(
    'hip-clamshell',
    merge(SIDE, { j: { hipL: x(-45), kneeL: x(80) }, ik: { legR: { at: [0.058, 0.25, 0.64], pole: [1, 0, 0] } } }),
    rep({ ik: { legR: { pole: [1, 1.2, 0] } } }, 1.6, 0.8, 2.2, 0.8),
    { hl: ['legR'], props: [MAT], views: SIDE_VIEW },
  ),

  // Lie on the side, bottom knee bent, top leg straight; lift the top leg, toes forward; lower slowly.
  anim('hip-side-lying-abduction', merge(SIDE, { j: { hipL: x(-35), kneeL: x(70) } }), rep({ j: { hipR: [0, 0, -32] } }, 1.8, 0.6, 2.4, 0.8), {
    hl: ['legR'],
    props: [MAT],
    views: SIDE_VIEW,
  }),

  // Hold a counter; keeping the knee straight, move one leg backward; return slowly.
  anim('hip-standing-extension', AT_COUNTER, rep({ j: { hipL: x(18) } }, 1.6, 0.6, 2.2, 0.8), { hl: ['legL'], props: [COUNTER], views: VIEW.stand }),

  // Hold a counter; lift one knee toward the chest, then lower; alternate legs.
  anim('hip-standing-march', AT_COUNTER, sides({ j: { hipL: x(-75), kneeL: x(80) } }, 1.2, 0.5, 1.3, 0.4), {
    hl: ['legL', 'legR'],
    props: [COUNTER],
    views: VIEW.stand,
  }),

  // Kneel on one knee on a cushion, other foot in front; tuck the pelvis and shift gently forward; hold.
  anim(
    'hip-flexor-stretch',
    {
      ...STAND,
      p: [0, 0.52, 0],
      j: { ...STAND.j, ankleL: x(70) },
      ik: { legL: { at: [0.095, 0.08, -0.42], pole: [0, -1, 0.4] }, legR: { at: [-0.095, 0.08, 0.5], pole: [0, 1, 1], foot: [0, 0, 0] } },
    },
    [
      [{ p: [0, 0.47, 0.14] }, 1.8, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['legL'], props: [{ kind: 'cushion', at: [0.095, 0.025, 0.02] }], views: cam([0, 0.55, 0.05], 3.6, [0.1, 0.22]) },
  ),

  // Hold a counter; knee straight and toes forward, lift one leg out to the side; lower slowly.
  anim('hip-standing-abduction', AT_COUNTER, rep({ j: { hipL: [0, 0, 28] } }, 1.6, 0.6, 2.2, 0.8), {
    hl: ['legL'],
    props: [COUNTER],
    views: VIEW.stand,
    startView: 'front',
  }),

  // Lie on the back, knees bent; rest one ankle on the opposite knee; draw both legs toward the chest; hold.
  anim(
    'hip-figure-four-stretch',
    merge(HOOK, { ik: HANDS_DOWN }),
    [
      [ANKLE_ON_KNEE, 1.6, 0.4],
      [
        {
          ik: {
            legL: { at: [-0.07, 0.6, -0.1], pole: [1, 0.4, 0.2], foot: null },
            legR: { at: [-0.1, 0.45, 0.3], pole: [0, 1, -0.6], foot: null },
            armL: { at: [-0.06, 0.36, -0.16] },
            armR: { at: [-0.15, 0.36, -0.16] },
          },
        },
        1.6,
        4.5,
      ],
      [ANKLE_ON_KNEE, 1.4, 0.2],
      [{}, 1.4, 0.8],
    ],
    { hl: ['legL'], props: [MAT], views: VIEW.floor, startView: 'front', poster: 1 },
  ),

  // Stand along a counter, knees slightly bent; step sideways, bring the other foot to meet it; then back.
  anim(
    'hip-side-steps',
    { ...STAND, p: [0, 0.87, 0], ik: feet() },
    [
      [{ p: [0.07, 0.87, 0], ik: { legL: { at: [0.25, 0.13, 0] } } }, 0.45],
      [{ p: [0.15, 0.87, 0], ik: { legL: { at: [0.395, 0.08, 0] } } }, 0.45, 0.2],
      [{ p: [0.22, 0.87, 0], ik: { legL: { at: [0.395, 0.08, 0] }, legR: { at: [0.06, 0.13, 0] } } }, 0.45],
      [{ p: [0.3, 0.87, 0], ik: { legL: { at: [0.395, 0.08, 0] }, legR: { at: [0.205, 0.08, 0] } } }, 0.45, 0.5],
      [{ p: [0.22, 0.87, 0], ik: { legL: { at: [0.395, 0.08, 0] }, legR: { at: [0.06, 0.13, 0] } } }, 0.45],
      [{ p: [0.15, 0.87, 0], ik: { legL: { at: [0.395, 0.08, 0] } } }, 0.45, 0.2],
      [{ p: [0.07, 0.87, 0], ik: { legL: { at: [0.25, 0.13, 0] } } }, 0.45],
      [{}, 0.45, 0.6],
    ],
    {
      hl: ['legL', 'legR'],
      props: [{ kind: 'counter', at: [0.15, 0.45, -0.6], size: [1.9, 0.9, 0.4] }],
      views: cam([0.15, 0.88, 0], 4.6, [0.06, 0.14]),
      startView: 'front',
    },
  ),

  // Lie on the back, knees bent; straighten one knee so that leg is in the air; lift the hips with the other leg; lower slowly.
  anim(
    'hip-single-leg-bridge',
    merge(HOOK, { ik: HANDS_DOWN }),
    [
      [LEG_IN_AIR, 1.4, 0.2],
      [{ ...BRIDGE, ik: { legL: { at: [0.095, 0.915, 0.425], foot: null } } }, 1.8, 1.2],
      [LEG_IN_AIR, 2.2, 0.2],
      [{}, 1.4, 0.8],
    ],
    { hl: ['legR'], props: [MAT], views: cam([0, 0.4, 0.05], 3.3), poster: 1 },
  ),
];
