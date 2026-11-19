/**
 * Knee, hip, ankle, foot, balance and general-fitness exercises added to the starter catalog after
 * the first set. Each movement follows the written instructions of its catalog entry
 * (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { Held, ProceduralAnimation, Prop } from '../types';
import { anim, AT_COUNTER, cam, CHAIR, COUNTER, feet, HANDS_DOWN, HOOK, type Key, LONG_SIT, MAT, merge, mirror, path, PRONE, QUAD, rep, SIDE, sides, SIT, STAND, type Step, SUPINE, VIEW, x } from './build';

const HOOK_RIGHT: Key['ik'] = { legR: { at: [-0.1, 0.11, 0.45], pole: [0, 1, 0], foot: [0, 0, 0] } };
const SIDE_VIEW = cam([0, 0.3, 0.1], 3.1);
const WALL_IN_FRONT: Prop = { kind: 'wall', at: [0, 1.05, 0.62] };
const TALL_COUNTER: Prop = { kind: 'counter', at: [-0.78, 0.525, 0], size: [0.5, 1.05, 1.4] };
const HOLD = (top: Key, move = 1.8, hold = 4.5): Step[] => [
  [top, move, hold],
  [{}, move, 0.8],
];

/** Lying on the back with the feet up on a wall. */
const FEET_ON_WALL = (leftY: number): Key['ik'] => ({
  legL: { at: [0.095, leftY, 0.62], pole: [0, 1, -1], foot: [-90, 0, 0] },
  legR: { at: [-0.095, 0.8, 0.62], pole: [0, 1, -1], foot: [-90, 0, 0] },
});

/** Sideways steps: out to the left and back. `y` is the pelvis height (knees slightly bent). */
const sideSteps = (y: number): Step[] => {
  const at = (px: number, left: [number, number], right?: [number, number]): Key => ({
    p: [px, y, 0],
    ik: { legL: { at: [left[0], left[1], 0] }, ...(right && { legR: { at: [right[0], right[1], 0] } }) },
  });
  return [
    [at(0.07, [0.25, 0.13]), 0.45],
    [at(0.15, [0.395, 0.08]), 0.45, 0.2],
    [at(0.22, [0.395, 0.08], [0.06, 0.13]), 0.45],
    [at(0.3, [0.395, 0.08], [0.205, 0.08]), 0.45, 0.5],
    [at(0.22, [0.395, 0.08], [0.06, 0.13]), 0.45],
    [at(0.15, [0.395, 0.08]), 0.45, 0.2],
    [at(0.07, [0.25, 0.13]), 0.45],
    [{}, 0.45, 0.6],
  ];
};

/** Sitting on the floor, legs straight, holding a band or towel that goes around the left foot. */
const HOLDING_FOOT_STRAP: Key = merge(LONG_SIT, {
  r: [-8, 0, 0],
  j: { hipL: x(-82), hipR: x(-82) },
  ik: { armL: { at: [0.12, 0.32, 0], pole: [0.5, -1, -0.3] }, armR: { at: [-0.02, 0.32, 0], pole: [-0.5, -1, -0.3] } },
});
const FOOT_STRAP = (look: 'band' | 'towel'): Held[] => [{ kind: 'band', from: 'wristL', to: 'ankleL', offset: [0, -0.03, 0.13], look }];

const CALF_STANCE: Key = {
  p: [0, 0.86, -0.05],
  j: { spine: x(6) },
  ik: {
    legL: { at: [0.095, 0.08, -0.3], foot: [0, 0, 0] },
    legR: { at: [-0.095, 0.08, 0.25], foot: [0, 0, 0] },
    armL: { at: [0.2, 1.28, 0.5], pole: [0.4, -1, -0.2] },
    armR: { at: [-0.2, 1.28, 0.5], pole: [-0.4, -1, -0.2] },
  },
};

const LUNGE_STEP: Key = { p: [0, 0.9, 0.1], ik: { legL: { at: [0.095, 0.16, 0.3] } } };
const STEP_TAP: Step[] = [
  [{ ik: { legL: { at: [0.095, 0.3, 0.2] } } }, 0.45],
  [{ ik: { legL: { at: [0.095, 0.23, 0.36] } } }, 0.35, 0.25],
  [{ ik: { legL: { at: [0.095, 0.3, 0.2] } } }, 0.35],
  [{}, 0.45, 0.2],
];
const mirrored = (steps: Step[]): Step[] => steps.map(([to, move, hold]) => [mirror(to), move, hold]);

export const kneeMoreAnimations: ProceduralAnimation[] = [
  // Hold a counter; bend one knee and hold the ankle behind you; draw the heel toward the buttock; hold.
  anim(
    'knee-standing-quad-stretch',
    merge(AT_COUNTER, { ik: { armL: { at: [0.25, 0.86, 0.03], pole: [0.3, 0, -1] } } }),
    [
      [{ j: { kneeL: x(138) }, ik: { armL: { at: [0.14, 0.88, -0.24] } } }, 1.6, 0.3],
      [{ j: { kneeL: x(148), hipL: x(8) }, ik: { armL: { at: [0.14, 0.9, -0.26] } } }, 1, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['legL'], props: [COUNTER], views: VIEW.stand, poster: 1 },
  ),

  // Lie on the back, one knee bent; hold behind the other thigh and lift that leg; straighten the knee; hold.
  anim(
    'knee-supine-hamstring-stretch',
    merge(SUPINE, { ik: { ...HOOK_RIGHT, ...HANDS_DOWN } }),
    [
      [{ j: { hipL: x(-90), kneeL: x(90) }, ik: { armL: { at: [0.14, 0.36, -0.16] }, armR: { at: [0.03, 0.36, -0.16] } } }, 1.8, 0.3],
      [{ j: { hipL: x(-90), kneeL: x(25) }, ik: { armL: { at: [0.14, 0.36, -0.16] }, armR: { at: [0.03, 0.36, -0.16] } } }, 1.6, 4.5],
      [{}, 2, 0.8],
    ],
    { hl: ['legL'], props: [MAT], views: cam([0, 0.4, 0], 3.3), poster: 1 },
  ),

  // Lie on the stomach; tighten the buttock and lift one straight leg a little; hold 3 s; lower slowly.
  anim('knee-prone-straight-leg-raise', PRONE, rep({ j: { hipL: x(12) } }, 1.4, 3, 2, 0.8), { hl: ['legL'], props: [MAT], views: VIEW.floor }),

  // Lie on the back, one knee toward the chest, a band around the foot held in both hands; push the foot away; bend back slowly.
  anim(
    'knee-band-leg-press',
    merge(SUPINE, {
      ik: { legL: { at: [0.095, 0.45, 0.1], pole: [0, 1, -0.5] }, armL: { at: [0.13, 0.3, -0.2], pole: [1, 0, 0] }, armR: { at: [0.02, 0.3, -0.2], pole: [-1, 0, 0] } },
    }),
    rep({ ik: { legL: { at: [0.095, 0.55, 0.62] } } }, 1.8, 0.5, 2.4, 0.8),
    { hl: ['legL'], props: [MAT], held: [{ kind: 'band', from: 'wristL', to: 'ankleL', offset: [0, -0.04, 0.08] }], views: cam([0, 0.4, 0.05], 3.3) },
  ),

  // Sit on a chair; slide the treated foot back under the chair; the other ankle crosses in front and pushes gently back; hold 5 s.
  anim(
    'knee-seated-assisted-bend',
    SIT,
    [
      [{ ik: { legL: { at: [0.095, 0.08, 0.12] } } }, 1.6, 0.3],
      [{ ik: { legL: { at: [0.095, 0.08, 0.12] }, legR: { at: [0.06, 0.1, 0.22] } } }, 1.2, 0.2],
      [{ ik: { legL: { at: [0.095, 0.08, 0.05] }, legR: { at: [0.07, 0.1, 0.15] } } }, 0.8, 5],
      [{}, 2, 0.8],
    ],
    { hl: ['legL'], props: [CHAIR], views: VIEW.sit, poster: 2 },
  ),

  // Lie on the back with the feet up on a wall; let the treated foot slide down the wall, bending the knee; push it back up.
  anim('knee-wall-heel-slide', merge(SUPINE, { p: [0, 0.125, 0.2], ik: FEET_ON_WALL(0.8) }), rep({ ik: { legL: { at: [0.095, 0.42, 0.62] } } }, 2.4, 1, 2.4, 0.8), {
    hl: ['legL'],
    props: [{ kind: 'mat', at: [0, 0.015, -0.3] }, { kind: 'wall', at: [0, 1.05, 0.75] }],
    views: cam([0, 0.45, 0.05], 3.5, [0.22, 0.42], true),
  }),

  // Sit with the knees bent; cross the ankles and try to straighten the back leg while the front leg stops it; hold.
  anim(
    'knee-isometric-extension-hold',
    merge(SIT, { ik: { legL: { at: [0.05, 0.08, 0.3] }, legR: { at: [0.0, 0.1, 0.39], foot: [0, 25, 0] } } }),
    rep({ ik: { legL: { at: [0.05, 0.08, 0.33] }, legR: { at: [0.0, 0.1, 0.42] } } }, 0.8, 6, 0.8, 1),
    { hl: ['legL'], props: [CHAIR], views: VIEW.sit },
  ),

  // Lie on the back, knees slightly bent, heels on the floor and toes up; press the heels down and lift the hips; lower slowly.
  anim(
    'knee-heel-dig-bridge',
    merge(SUPINE, {
      ik: { legL: { at: [0.1, 0.1, 0.62], pole: [0, 1, 0], foot: [-35, 0, 0] }, legR: { at: [-0.1, 0.1, 0.62], pole: [0, 1, 0], foot: [-35, 0, 0] }, ...HANDS_DOWN },
    }),
    rep({ p: [0, 0.26, -0.12], r: [-106, 0, 0], j: { neck: x(14) } }, 1.8, 1.2, 2.4, 0.8),
    { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor },
  ),

  // Stand next to a counter; step forward and bend both knees, lowering the body a little; push back to standing.
  anim(
    'knee-forward-lunge',
    merge(STAND, { ik: feet() }),
    [
      [LUNGE_STEP, 0.5],
      [{ p: [0, 0.78, 0.28], ik: { legL: { at: [0.095, 0.08, 0.55] }, legR: { at: [-0.095, 0.14, -0.02], foot: [30, 0, 0] } } }, 0.8, 0.7],
      [LUNGE_STEP, 0.7],
      [{}, 0.5, 0.8],
    ],
    { hl: ['legL'], props: [COUNTER], views: cam([0, 0.85, 0.25], 4.2, [0.06, 0.14]), poster: 1 },
  ),
];

export const hipMoreAnimations: ProceduralAnimation[] = [
  // Side-on to a wall, hand on it; cross the leg nearest the wall behind the other; lean the hip toward the wall; hold.
  anim(
    'hip-it-band-stretch-standing',
    merge(STAND, { p: [0, 0.9, 0], ik: { ...feet(), armR: { at: [-0.45, 1.25, 0.05], pole: [-0.3, -1, -0.3] } } }),
    [
      [{ ik: { legR: { at: [0.12, 0.08, -0.14] } } }, 1, 0.3],
      [{ p: [-0.06, 0.86, 0], j: { spine: [0, 0, -12] }, ik: { legR: { at: [0.12, 0.08, -0.14] }, legL: { at: [0.14, 0.08, 0.02] } } }, 1.6, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['legR'], props: [{ kind: 'wall', at: [-0.56, 1.05, 0], turn: 90 }], views: VIEW.stand, startView: 'front', poster: 1 },
  ),

  // Lie on the side, top leg bent with the foot on the floor in front; lift the straight bottom leg a little; hold 3 s.
  anim('hip-side-lying-adduction', merge(SIDE, { ik: { legR: { at: [0.35, 0.1, 0.25], pole: [0.3, 1, 0], foot: [0, 0, 0] } } }), rep({ j: { hipL: [0, 0, -14] } }, 1.4, 3, 1.8, 0.8), {
    hl: ['legL'],
    props: [MAT],
    views: SIDE_VIEW,
  }),

  // Lie on the stomach with one knee bent 90°; tighten the buttock and lift that thigh a little; lower slowly.
  anim('hip-prone-extension', merge(PRONE, { j: { kneeL: x(90), ankleL: x(0) } }), rep({ j: { hipL: x(13) } }, 1.4, 0.8, 2, 0.8), { hl: ['legL'], props: [MAT], views: VIEW.floor }),

  // Lie on the side, hips and knees bent, knees together; lift the top foot toward the ceiling; lower slowly.
  anim(
    'hip-reverse-clamshell',
    merge(SIDE, { j: { hipL: x(-45), kneeL: x(80) }, ik: { legR: { at: [0.058, 0.25, 0.64], pole: [1, 0, 0] } } }),
    rep({ ik: { legR: { at: [0.058, 0.46, 0.6], pole: [1, -0.5, 0] } } }, 1.6, 0.8, 2.2, 0.8),
    { hl: ['legR'], props: [MAT], views: SIDE_VIEW },
  ),

  // Lie on the back, knees bent, a soft ball between the knees; squeeze the knees together; hold 5 s.
  anim(
    'hip-adductor-squeeze',
    merge(HOOK, { ik: { legL: { pole: [0.14, 1, 0] }, legR: { pole: [-0.14, 1, 0] } } }),
    rep({ ik: { legL: { pole: [0.02, 1, 0] }, legR: { pole: [-0.02, 1, 0] } } }, 1, 5, 1, 0.8),
    { hl: ['legL', 'legR'], props: [MAT, { kind: 'ball', at: [0, 0.43, 0.175], size: [0.075, 0, 0] }], views: VIEW.floor, startView: 'front' },
  ),

  // Sit with the soles of the feet together and the knees apart; sit tall and let the knees drop toward the floor; hold.
  anim(
    'hip-butterfly-stretch',
    {
      p: [0, 0.11, 0],
      ik: {
        legL: { at: [0.035, 0.08, 0.3], pole: [1, 0.9, 0.3] },
        legR: { at: [-0.035, 0.08, 0.3], pole: [-1, 0.9, 0.3] },
        armL: { at: [0.09, 0.17, 0.3], pole: [1, 0, -0.3] },
        armR: { at: [-0.09, 0.17, 0.3], pole: [-1, 0, -0.3] },
      },
    },
    HOLD({ ik: { legL: { pole: [1, 0.2, 0.3] }, legR: { pole: [-1, 0.2, 0.3] } } }),
    { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floorSit, startView: 'front' },
  ),

  // Feet wide apart, holding a counter; bend one knee and shift the weight to that side, other leg straight; hold.
  anim('hip-standing-adductor-stretch', merge(AT_COUNTER, { p: [0, 0.8, 0], ik: feet(0, 0, 0.38) }), HOLD({ p: [0.2, 0.72, 0] }), {
    hl: ['legR'],
    props: [COUNTER],
    views: VIEW.stand,
    startView: 'front',
  }),

  // Sit on a chair and rest one ankle on the opposite knee; sit tall, then lean forward from the hips; hold.
  anim(
    'hip-seated-piriformis-stretch',
    SIT,
    [
      [{ ik: { legL: { at: [-0.1, 0.57, 0.38], pole: [1, 0.2, 0.2], foot: null } } }, 1.4, 0.3],
      [{ j: { spine: x(30) }, ik: { legL: { at: [-0.1, 0.57, 0.38], pole: [1, 0.2, 0.2], foot: null } } }, 1.6, 4.5],
      [{ ik: { legL: { at: [-0.1, 0.57, 0.38], pole: [1, 0.2, 0.2], foot: null } } }, 1.4, 0.2],
      [{}, 1.4, 0.8],
    ],
    { hl: ['legL'], props: [CHAIR], views: VIEW.sit, startView: 'front', poster: 1 },
  ),

  // On hands and knees; keeping the knee bent, lift one leg out to the side; lower slowly.
  anim('hip-fire-hydrant', QUAD, rep({ ik: { legL: { at: [0.42, 0.36, -0.62], pole: [1, -0.1, 0.6] } } }, 1.6, 0.6, 2, 0.8), {
    hl: ['legL'],
    props: [MAT],
    views: VIEW.quad,
    startView: 'front',
  }),

  // Lie on the back, legs straight; slide one leg out to the side, toes pointing up; slide it back.
  anim('hip-supine-abduction-slide', SUPINE, rep({ j: { hipL: [0, 0, 28] } }, 1.8, 0.5, 2, 0.8), { hl: ['legL'], props: [{ kind: 'mat', size: [1.5, 0.03, 2.1] }], views: VIEW.floor, startView: 'front' }),

  // Band around both legs just above the knees; knees slightly bent; step sideways keeping the band tight; then back.
  anim('hip-band-side-steps', { ...STAND, p: [0, 0.85, 0], ik: feet(0, 0, 0.14) }, sideSteps(0.85), {
    hl: ['legL', 'legR'],
    held: [{ kind: 'band', from: 'kneeR', to: 'kneeL', offset: [0, 0.06, 0] }],
    views: cam([0.15, 0.88, 0], 4.3, [0.06, 0.14]),
    startView: 'front',
    poster: 1,
  }),

  // Feet hip-width apart, knees slightly bent, hands on the hips; push the hips back and tip forward with a straight back; stand tall.
  anim(
    'hip-hinge',
    { p: [0, 0.9, 0], ik: { ...feet(), armL: { at: [0.2, 0.96, 0.02], pole: [1, 0, -0.6] }, armR: { at: [-0.2, 0.96, 0.02], pole: [-1, 0, -0.6] } } },
    rep({ p: [0, 0.86, -0.14], j: { spine: x(45), neck: x(-20) }, ik: { armL: { at: [0.2, 0.9, -0.1] }, armR: { at: [-0.2, 0.9, -0.1] } } }, 1.8, 0.6, 1.8, 0.8),
    { hl: ['legL', 'legR'], views: VIEW.stand },
  ),
];

export const ankleMoreAnimations: ProceduralAnimation[] = [
  // Face a wall, hands on it, one foot behind; back heel down and both knees bent; lean in; hold.
  anim('ankle-soleus-stretch', CALF_STANCE, HOLD({ p: [0, 0.76, 0.04], j: { spine: x(8) } }), { hl: ['legL'], props: [WALL_IN_FRONT], views: VIEW.standBehind }),

  // Sit with the leg straight and a towel around the ball of the foot; pull the towel to bring the toes toward you; hold.
  anim('ankle-towel-calf-stretch', merge(HOLDING_FOOT_STRAP, { j: { ankleL: x(8) } }), HOLD({ j: { ankleL: x(-18) }, ik: { armL: { at: [0.12, 0.34, -0.05] }, armR: { at: [-0.02, 0.34, -0.05] } } }, 1.6), {
    hl: ['legL'],
    props: [MAT],
    held: FOOT_STRAP('towel'),
    views: VIEW.floorSit,
  }),

  // Sit with the leg straight, a band around the ball of the foot, the ends in the hands; point the foot away; return slowly.
  anim('ankle-band-plantarflexion', merge(HOLDING_FOOT_STRAP, { j: { ankleL: x(-10) } }), rep({ j: { ankleL: x(30) } }, 1.2, 0.6, 1.8, 0.6), {
    hl: ['legL'],
    props: [MAT],
    held: FOOT_STRAP('band'),
    views: VIEW.floorSit,
  }),

  // Sit with the foot off the floor; slowly circle the foot one way, then the other.
  path(
    'ankle-circles',
    merge(SIT, { ik: { legL: null }, j: { hipL: x(-88), kneeL: x(45) } }),
    10,
    (time) => {
      const turn = 4 * Math.PI * Math.sin((Math.PI * time) / 10) ** 2;
      return { j: { ankleL: [8 + 18 * Math.sin(turn), 22 * Math.cos(turn), 0] } };
    },
    { hl: ['legL'], props: [CHAIR], views: cam([0.1, 0.3, 0.55], 2.9, [0.14, 0.3]), startView: 'front' },
  ),

  // Face a wall, the treated foot a few centimetres from it; heel down, bend the knee forward to touch the wall; return.
  anim(
    'ankle-knee-to-wall',
    {
      p: [0, 0.9, -0.05],
      ik: {
        legL: { at: [0.095, 0.08, 0.14], foot: [0, 0, 0] },
        legR: { at: [-0.095, 0.08, -0.25], foot: [0, 0, 0] },
        armL: { at: [0.2, 1.2, 0.26], pole: [0.6, -1, -0.2] },
        armR: { at: [-0.2, 1.2, 0.26], pole: [-0.6, -1, -0.2] },
      },
    },
    rep({ p: [0, 0.84, 0.08] }, 1.6, 0.8, 1.6, 0.8),
    { hl: ['legL'], props: [{ kind: 'wall', at: [0, 1.05, 0.38] }], views: VIEW.standBehind },
  ),

  // Hold a counter; lift the toes and the front of both feet, rocking back onto the heels; lower slowly.
  anim('ankle-toe-raises', AT_COUNTER, rep({ p: [0, 0.92, -0.03], j: { ankleL: x(-22), ankleR: x(-22) } }, 1.2, 0.6, 1.6, 0.6), {
    hl: ['legL', 'legR'],
    props: [COUNTER],
    views: cam([0, 0.6, 0.05], 3.4, [0.06, 0.14]),
  }),

  // Stand on one leg holding a counter; rise onto the toes, pause, lower slowly.
  anim('ankle-single-leg-calf-raise', merge(AT_COUNTER, { j: { hipR: x(-10), kneeR: x(60) } }), rep({ p: [0, 0.975, 0.07], j: { ankleL: x(35) } }, 1.4, 0.8, 2.2, 0.6), {
    hl: ['legL'],
    props: [COUNTER],
    views: VIEW.stand,
  }),

  // Balls of both feet on the edge of a step, holding a rail; rise with both feet; shift onto the treated leg and lower the heel slowly below the step.
  anim(
    'ankle-eccentric-heel-drop',
    merge(STAND, { p: [0, 1.07, -0.1], ik: { armR: { at: [-0.5, 1.12, 0], pole: [-0.3, -0.5, -1] } } }),
    [
      [{ p: [0, 1.125, -0.03], j: { ankleL: x(35), ankleR: x(35) } }, 1, 0.3],
      [{ p: [0, 1.125, -0.03], j: { ankleL: x(35), ankleR: x(35), hipR: x(-15), kneeR: x(45) } }, 0.7, 0.2],
      [{ p: [0, 1.03, -0.07], j: { ankleL: x(-20), hipR: x(-15), kneeR: x(45) } }, 3, 0.5],
      [{}, 1.1, 0.8],
    ],
    { hl: ['legL'], props: [{ kind: 'step', at: [0, 0.075, 0.2], size: [0.8, 0.15, 0.5] }, TALL_COUNTER], views: cam([0, 0.75, 0], 3.9, [0.06, 0.14]), poster: 2 },
  ),

  // Sit with a small firm ball under the arch of the foot; roll the foot slowly back and forth over the ball.
  anim(
    'foot-ball-roll',
    merge(SIT, { ik: { legL: { at: [0.095, 0.16, 0.44] } } }),
    [
      [{ ik: { legL: { at: [0.095, 0.16, 0.53] } } }, 1.2, 0.2],
      [{ ik: { legL: { at: [0.095, 0.16, 0.37] } } }, 1.8, 0.2],
      [{}, 0.9, 0.2],
    ],
    { hl: ['legL'], props: [CHAIR, { kind: 'ball', at: [0.095, 0.04, 0.46], size: [0.04, 0, 0] }], views: cam([0.1, 0.25, 0.5], 2.9, [0.14, 0.3]) },
  ),
];

export const balanceAnimations: ProceduralAnimation[] = [
  // Feet hip-width apart; shift the weight onto one foot, then the other; then forward onto the toes and back onto the heels.
  anim(
    'balance-weight-shifts',
    merge(STAND, { ik: feet() }),
    [
      [{ p: [0.07, 0.918, 0] }, 1, 0.5],
      [{ p: [-0.07, 0.918, 0] }, 1.6, 0.5],
      [{}, 1, 0.3],
      [{ p: [0, 0.918, 0.06] }, 0.9, 0.5],
      [{ p: [0, 0.918, -0.04] }, 1.2, 0.5],
      [{}, 0.8, 0.5],
    ],
    { hl: ['legL', 'legR'], props: [COUNTER], views: VIEW.stand, startView: 'front' },
  ),

  // Sit tall at the front of a chair; reach one hand forward, then out to the side; return and switch arms.
  anim(
    'balance-seated-reach',
    merge(SIT, { ik: { armL: { at: [0.12, 0.62, 0.25], pole: [1, -0.5, 0] }, armR: { at: [-0.12, 0.62, 0.25], pole: [-1, -0.5, 0] } } }),
    (() => {
      const forward: Key = { j: { spine: x(18) }, ik: { armL: { at: [0.2, 0.95, 0.62] } } };
      const sideways: Key = { j: { spine: [0, 0, -14] }, ik: { armL: { at: [0.72, 0.95, 0.05] } } };
      const steps: Step[] = [
        [forward, 1.2, 0.5],
        [{}, 1, 0.2],
        [sideways, 1.2, 0.5],
        [{}, 1, 0.3],
      ];
      return [...steps, ...mirrored(steps)];
    })(),
    { hl: ['armL', 'armR'], props: [CHAIR], views: cam([0, 0.7, 0.2], 3.8, [0.1, 0.2]), startView: 'front' },
  ),

  // Place one foot directly in front of the other, heel touching toes; hold; swap the feet.
  anim(
    'balance-tandem-stand',
    merge(STAND, { p: [0, 0.9, 0], ik: feet() }),
    (() => {
      const steps: Step[] = [
        [{ p: [0, 0.9, 0.06], ik: { legL: { at: [0.03, 0.14, 0.14] }, legR: { at: [-0.05, 0.08, 0] } } }, 0.6],
        [{ p: [0, 0.9, 0.12], ik: { legL: { at: [0, 0.08, 0.27] }, legR: { at: [0, 0.08, 0] } } }, 0.6, 3.5],
        [{ p: [0, 0.9, 0.06], ik: { legL: { at: [0.03, 0.14, 0.14] }, legR: { at: [-0.05, 0.08, 0] } } }, 0.6],
        [{}, 0.6, 0.5],
      ];
      return [...steps, ...mirrored(steps)];
    })(),
    { hl: ['legL', 'legR'], props: [COUNTER], views: VIEW.stand, poster: 1 },
  ),

  // Face a low step, holding a rail; tap one foot lightly on the step and bring it back; alternate feet.
  anim('balance-step-taps', merge(AT_COUNTER, { ik: feet() }), [...STEP_TAP, ...mirrored(STEP_TAP)], {
    hl: ['legL', 'legR'],
    props: [{ kind: 'step', at: [0, 0.075, 0.45], size: [0.8, 0.15, 0.5] }, COUNTER],
    views: VIEW.stand,
    poster: 1,
  }),

  // Stand on one leg next to a counter; with the other foot reach and tap toward 12, 3 and 6 o'clock, returning between taps.
  anim(
    'balance-clock-reach',
    merge(STAND, { p: [0, 0.86, 0], ik: feet() }),
    [
      [{ ik: { legR: { at: [-0.095, 0.09, 0.3] } } }, 0.9, 0.3],
      [{}, 0.8, 0.2],
      [{ ik: { legR: { at: [-0.4, 0.09, 0] } } }, 0.9, 0.3],
      [{}, 0.8, 0.2],
      [{ ik: { legR: { at: [-0.095, 0.09, -0.3], foot: [20, 0, 0] } } }, 0.9, 0.3],
      [{}, 0.8, 0.6],
    ],
    { hl: ['legL'], props: [{ kind: 'counter', at: [-0.95, 0.45, 0] }], views: VIEW.stand, startView: 'front' },
  ),

  // Stand next to a counter; march on the spot, lifting the knees and swinging the arms.
  anim('general-march-on-the-spot', STAND, sides({ j: { hipL: x(-65), kneeL: x(75), shoulderR: [-35, 0, -7], elbowR: x(-30), shoulderL: [22, 0, 7] } }, 0.55, 0.1, 0.55, 0.05), {
    hl: ['legL', 'legR'],
    props: [COUNTER],
    views: VIEW.stand,
  }),
];
