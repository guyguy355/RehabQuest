/**
 * Neck, upper-back, lower-back, core and dizziness exercises added to the starter catalog after
 * the first set. Each movement follows the written instructions of its catalog entry
 * (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation } from '../types';
import { anim, cam, CHAIR, feet, HANDS_DOWN, HOOK, type Key, MAT, merge, mirror, path, PRONE, QUAD, rep, SIDE, sides, SIT, STAND, type Step, SUPINE, VIEW, x } from './build';

const HOLD = (top: Key, move = 1.8, hold = 4.5): Step[] => [
  [top, move, hold],
  [{}, move, 0.8],
];
const mirrored = (steps: Step[]): Step[] => steps.map(([to, move, hold]) => [mirror(to), move, hold]);

/** Sitting with both hands in the lap (so either hand can come up to the head). */
const HANDS_IN_LAP: Key = merge(SIT, { ik: { armL: { at: [0.12, 0.62, 0.25], pole: [1, -0.5, 0] }, armR: { at: [-0.12, 0.62, 0.25], pole: [-1, -0.5, 0] } } });
const HANDS_BEHIND_HEAD: Key['ik'] = { armL: { at: [0.14, 1.16, -0.12], pole: [1, -0.3, -0.4] }, armR: { at: [-0.14, 1.16, -0.12], pole: [-1, -0.3, -0.4] } };
/** Both hands behind the head, written as joint turns so the arms follow the trunk. */
const ELBOWS_OUT: Key['j'] = { shoulderL: [-105, 0, 95], shoulderR: [-105, 0, -95], elbowL: x(-145), elbowR: x(-145) };
/** Arms folded across the chest. */
const ARMS_CROSSED: Key['j'] = { shoulderL: [-20, -70, 0], shoulderR: [-20, 70, 0], elbowL: x(-125), elbowR: x(-125) };
const BRIDGE: Key = { p: [0, 0.3, -0.13], r: [-112, 0, 0], j: { neck: x(20) } };
const HEAD_VIEW_LYING = cam([0, 0.2, -0.6], 2.2);

export const neckMoreAnimations: ProceduralAnimation[] = [
  // Sit tall, a hand on the forehead; press the head gently into the hand without moving; hold 5 s.
  anim(
    'neck-isometric-front-press',
    HANDS_IN_LAP,
    [
      [{ ik: { armL: { at: [0.12, 1.16, 0.17], pole: [1, -1, 0.3] } } }, 1.4, 0.2],
      [{ j: { neck: x(3) }, ik: { armL: { at: [0.12, 1.16, 0.17], pole: [1, -1, 0.3] } } }, 0.5, 5],
      [{}, 1.4, 0.8],
    ],
    { props: [CHAIR], views: VIEW.head, poster: 1 },
  ),

  // Sit tall and clasp the hands behind the head; press the head gently back into the hands without moving; hold 5 s.
  anim(
    'neck-isometric-back-press',
    HANDS_IN_LAP,
    [
      [{ ik: HANDS_BEHIND_HEAD }, 1.6, 0.2],
      [{ j: { neck: x(-3) }, ik: HANDS_BEHIND_HEAD }, 0.5, 5],
      [{}, 1.6, 0.8],
    ],
    { props: [CHAIR], views: VIEW.head, poster: 1 },
  ),

  // Sit tall, a hand on the side of the forehead; try to turn the head toward the hand without moving; hold 5 s; switch sides.
  anim(
    'neck-isometric-rotation',
    HANDS_IN_LAP,
    (() => {
      const hand: Key = { ik: { armL: { at: [0.17, 1.17, 0.11], pole: [1, -1, 0.2] } } };
      const steps: Step[] = [
        [hand, 1.4, 0.2],
        [merge(hand, { j: { head: [0, 4, 0] } }), 0.5, 5],
        [{}, 1.4, 0.5],
      ];
      return [...steps, ...mirrored(steps)];
    })(),
    { props: [CHAIR], views: VIEW.head, startView: 'front', poster: 1 },
  ),

  // Lie on the back with a small folded towel under the head; gently nod the chin, without lifting the head; hold 5 s.
  anim('neck-supine-chin-nod', SUPINE, rep({ j: { head: x(11) } }, 1, 5, 1, 0.8), {
    props: [MAT, { kind: 'cushion', at: [0, 0.04, -0.75], size: [0.26, 0.025, 0.2] }],
    views: HEAD_VIEW_LYING,
  }),

  // Lie on the back, knees bent; tuck the chin, then lift the head just off the floor; hold 3 s, chin tucked; lower.
  anim(
    'neck-chin-tuck-head-lift',
    HOOK,
    [
      [{ j: { head: x(11) } }, 0.9, 0.2],
      [{ j: { neck: x(18), head: x(13) } }, 1, 3],
      [{}, 1.4, 0.8],
    ],
    { props: [MAT], views: HEAD_VIEW_LYING, poster: 1 },
  ),

  // Sit tall, shoulders relaxed; slowly tilt the head back to look at the ceiling; return to the middle.
  anim('neck-extension', SIT, rep({ j: { neck: x(-18), head: x(-22) } }, 1.8, 1, 1.8, 0.8), { props: [CHAIR], views: VIEW.head }),

  // Sit tall and lower the chin toward the chest; slowly roll the head toward one shoulder, back through the middle, to the other.
  path(
    'neck-half-circles',
    SIT,
    8,
    (time) => {
      const side = Math.sin((2 * Math.PI * time) / 8);
      return { j: { neck: [20 - 9 * side * side, 0, 12 * side], head: [16 - 8 * side * side, 0, 16 * side] } };
    },
    { props: [CHAIR], views: VIEW.head, startView: 'front', poster: 2 },
  ),
];

export const thoracicAnimations: ProceduralAnimation[] = [
  // Sit on a chair whose back reaches mid-back, hands behind the head; lean back gently over the top of the chair; return.
  anim('thoracic-seated-extension', merge(SIT, { j: ELBOWS_OUT }), rep({ j: { chest: x(-24), neck: x(-8) } }, 1.8, 1, 1.8, 0.8), { props: [CHAIR], views: cam([0, 0.85, 0], 3.3, [0.08, 0.18]) }),

  // Sit tall with the arms crossed over the chest; turn the upper body to one side; back to the middle; then the other side.
  anim(
    'thoracic-seated-rotation',
    merge(SIT, { j: ARMS_CROSSED }),
    sides({ j: { spine: [0, 12, 0], chest: [0, 32, 0], head: [0, 12, 0] } }, 1.8, 0.6, 1.6, 0.3),
    { props: [CHAIR], views: cam([0, 0.85, 0.05], 3.3, [0.08, 0.3]), startView: 'front' },
  ),

  // Sit tall; reach one arm overhead and lean gently to the opposite side; hold a few breaths; switch sides.
  anim('thoracic-seated-side-bend', SIT, sides({ j: { shoulderL: [0, 0, 160], elbowL: x(-15), spine: [0, 0, 9], chest: [0, 0, 14] } }, 1.8, 3, 1.8, 0.5), {
    hl: ['armL', 'armR'],
    props: [CHAIR],
    views: cam([0, 0.9, 0.05], 3.6, [0.08, 0.18]),
    startView: 'front',
  }),

  // Lie on the side, knees bent, arms straight out in front, palms together; lift the top arm up and over, chest and head following; return slowly.
  anim(
    'thoracic-open-book',
    merge(SIDE, { j: { hipL: x(-60), kneeL: x(80), hipR: x(-60), kneeR: x(80), shoulderL: x(-90), elbowL: x(0), shoulderR: x(-90) } }),
    rep({ j: { chest: [0, -55, 0], head: [0, -30, 0], shoulderR: [-90, 0, -100], shoulderL: [-90, 0, 55] } }, 2.4, 1, 2.4, 0.8),
    { hl: ['armR'], props: [{ kind: 'mat', size: [1.6, 0.03, 2.1] }], views: cam([0, 0.3, -0.1], 3.3), startView: 'front' },
  ),

  // On hands and knees; slide one arm under the body, palm up, shoulder lowering; return and reach the same arm up to the ceiling.
  anim(
    'thoracic-thread-the-needle',
    QUAD,
    [
      [{ j: { chest: [0, 28, 0] }, ik: { armL: { at: [-0.36, 0.09, 0.2], pole: [0, 1, 0] } } }, 1.8, 0.8],
      [{}, 1.4, 0.1],
      [{ j: { chest: [0, -35, 0], head: [0, -25, 0] }, ik: { armL: { at: [0.34, 1.0, 0.2], pole: [1, 0, 0] } } }, 1.8, 0.8],
      [{}, 1.6, 0.6],
    ],
    { hl: ['armL'], props: [MAT], views: VIEW.quad, startView: 'front' },
  ),

  // On hands and knees, one hand behind the head; lower that elbow toward the opposite arm; then turn to point the elbow up.
  anim(
    'thoracic-quadruped-rotation',
    merge(QUAD, { ik: { armL: null }, j: { shoulderL: [-105, 0, 95], elbowL: x(-145) } }),
    [
      [{ j: { chest: [0, 26, 0] } }, 1.6, 0.6],
      [{ j: { chest: [0, -38, 0], head: [0, -20, 0] } }, 2.2, 0.8],
      [{}, 1.6, 0.6],
    ],
    { hl: ['armL'], props: [MAT], views: VIEW.quad, startView: 'front', poster: 1 },
  ),

  // Lie on the back, knees bent, a roller across the upper back; support the head with the hands; lean back gently over the roller; come back up.
  anim('thoracic-foam-roller-extension', merge(HOOK, { r: [-84, 0, 0], j: { ...ELBOWS_OUT, chest: x(14) } }), rep({ j: { chest: x(-22), neck: x(-6) } }, 2, 1, 2, 0.8), {
    props: [MAT, { kind: 'roll', at: [0, 0.095, -0.4], size: [0.5, 0.065, 0] }],
    views: cam([0, 0.3, -0.15], 2.9),
  }),

  // Back against a wall, feet a step forward; arms against the wall, elbows bent like a goalpost; slide the arms up and down.
  anim(
    'thoracic-wall-angels',
    { p: [0, 0.85, -0.02], ik: { ...feet(0.3, 0.3, 0.11), armL: { at: [0.42, 1.42, -0.07], pole: [1, -0.5, 0] }, armR: { at: [-0.42, 1.42, -0.07], pole: [-1, -0.5, 0] } } },
    rep({ ik: { armL: { at: [0.22, 1.76, -0.07] }, armR: { at: [-0.22, 1.76, -0.07] } } }, 2.2, 0.6, 2.4, 0.8),
    { hl: ['armL', 'armR'], props: [{ kind: 'wall', at: [0, 1.05, -0.17] }], views: cam([0, 1.0, 0.05], 4.3, [0.06, 0.14]), startView: 'front' },
  ),

  // Lie face down, elbows bent at the sides in a W; squeeze the shoulder blades and lift the arms a little; hold 3 s.
  anim(
    'thoracic-prone-w',
    merge(PRONE, { ik: { armL: { at: [0.32, 0.12, 0.56], pole: [1, 0, -0.6] }, armR: { at: [-0.32, 0.12, 0.56], pole: [-1, 0, -0.6] } } }),
    rep({ j: { chest: x(-7), neck: x(-6) }, ik: { armL: { at: [0.32, 0.24, 0.55], pole: [1, 0.5, -0.6] }, armR: { at: [-0.32, 0.24, 0.55], pole: [-1, 0.5, -0.6] } } }, 1.4, 3, 1.6, 0.8),
    { hl: ['armL', 'armR'], props: [MAT], views: cam([0, 0.25, 0.25], 2.9), startView: 'front' },
  ),
];

export const backMoreAnimations: ProceduralAnimation[] = [
  // Lie on the stomach; prop yourself up on the forearms, elbows under the shoulders; relax the lower back.
  anim(
    'back-prone-on-elbows',
    { p: [0, 0.13, 0], r: [90, 0, 0], j: { ankleL: x(70), ankleR: x(70) }, ik: { armL: { at: [0.2, 0.06, 0.625], pole: [1, -0.3, 0] }, armR: { at: [-0.2, 0.06, 0.625], pole: [-1, -0.3, 0] } } },
    HOLD({ r: [84, 0, 0], j: { spine: x(-16), chest: x(-18), neck: x(-12) }, ik: { armL: { pole: [0, -1, -0.3] }, armR: { pole: [0, -1, -0.3] } } }, 2),
    { props: [MAT], views: VIEW.floor },
  ),

  // Feet apart, hands on the lower back; lean back gently over the hands; return to upright.
  anim(
    'back-standing-extension',
    merge(STAND, { ik: { ...feet(0, 0, 0.15), armL: { at: [0.1, 1.02, -0.1], pole: [1, 0, -0.5] }, armR: { at: [-0.1, 1.02, -0.1], pole: [-1, 0, -0.5] } } }),
    rep({ p: [0, 0.915, 0.03], j: { spine: x(-12), chest: x(-14), neck: x(-8) } }, 1.8, 1, 1.8, 0.8),
    { views: VIEW.stand },
  ),

  // Stand tall, arms at the sides; slide one hand down the outside of the leg toward the knee; come up; other side.
  anim('back-standing-side-bend', STAND, sides({ j: { spine: [0, 0, -10], chest: [0, 0, -12], shoulderL: [0, 0, -14] } }, 1.6, 0.6, 1.6, 0.4), { views: VIEW.stand, startView: 'front' }),

  // Sit tall at the front of a chair; roll the pelvis back so the lower back rounds, then forward so it arches gently.
  anim(
    'back-seated-pelvic-tilt',
    SIT,
    [
      [{ r: [-12, 0, 0], j: { spine: x(16), chest: x(10) } }, 1.6, 0.6],
      [{ r: [8, 0, 0], j: { spine: x(-10), chest: x(-3) } }, 2.2, 0.6],
      [{}, 1.2, 0.4],
    ],
    { props: [CHAIR], views: VIEW.sit },
  ),

  // Sit slumped slightly, chin toward the chest; straighten one knee while lifting the head; lower the leg while dropping the chin.
  anim(
    'back-seated-nerve-slide',
    merge(SIT, { ik: { legL: null }, j: { hipL: x(-90), kneeL: x(90), spine: x(12), chest: x(14), neck: x(24), head: x(15) } }),
    rep({ j: { kneeL: x(8), neck: x(-10), head: x(-15) } }, 1.8, 0.4, 1.8, 0.5),
    { hl: ['legL'], props: [CHAIR], views: VIEW.sit },
  ),
];

export const coreMoreAnimations: ProceduralAnimation[] = [
  // Lie on the back, knees bent; tighten the stomach; slide one heel away until the leg is straight, then back; switch legs.
  anim('core-heel-slide-brace', HOOK, sides({ ik: { legL: { at: [0.1, 0.1, 0.72], foot: [-70, 0, 0] } } }, 2, 0.3, 2, 0.4), { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor }),

  // On hands and knees with the back flat; reach one arm forward without the body shifting; lower and switch arms.
  anim('core-quadruped-arm-lift', QUAD, sides({ ik: { armL: { at: [0.2, 0.6, 0.74] } } }, 1.6, 1, 1.6, 0.4), { hl: ['armL', 'armR'], props: [MAT], views: VIEW.quad }),

  // On hands and knees; slide one foot back along the floor until the leg is straight, then lift it a little; return and switch legs.
  anim(
    'core-quadruped-leg-slide',
    QUAD,
    (() => {
      const slide: Key = { ik: { legL: { at: [0.095, 0.07, -0.9], pole: [0, -1, 0] } } };
      const steps: Step[] = [
        [slide, 1.4, 0.2],
        [{ ik: { legL: { at: [0.095, 0.3, -0.96], pole: [0, -1, 0] } } }, 0.8, 0.8],
        [slide, 0.8, 0.1],
        [{}, 1.4, 0.4],
      ];
      return [...steps, ...mirrored(steps)];
    })(),
    { hl: ['legL', 'legR'], props: [{ kind: 'mat', size: [0.8, 0.03, 2.4], at: [0, 0.015, -0.2] }], views: cam([0, 0.38, -0.2], 3.6, [0.14, 0.34]), poster: 1 },
  ),

  // Lie on the back, knees bent, hands across the chest; lift the head and shoulders a little; hold 2 s; lower slowly.
  anim('core-crunch', merge(HOOK, { j: ARMS_CROSSED }), rep({ j: { spine: x(6), chest: x(24), neck: x(14) } }, 1.4, 2, 2, 0.8), {
    props: [MAT],
    views: VIEW.floor,
  }),

  // Lie on the back with both hips and knees bent 90° in the air; slowly lower one foot to tap the floor; bring it back; switch.
  anim('core-single-leg-lower', merge(SUPINE, { j: { hipL: x(-90), hipR: x(-90), kneeL: x(90), kneeR: x(90) } }), sides({ j: { hipL: x(-38) } }, 1.8, 0.3, 1.8, 0.3), {
    hl: ['legL', 'legR'],
    props: [MAT],
    views: cam([0, 0.35, 0], 3.3),
  }),

  // Lie on the back, knees bent, hips lifted into a bridge; lift one foot a little without the hips dropping; put it down; lift the other.
  anim(
    'core-bridge-march',
    merge(HOOK, { ik: HANDS_DOWN }),
    [
      [BRIDGE, 1.6, 0.3],
      [merge(BRIDGE, { ik: { legL: { at: [0.1, 0.25, 0.45] } } }), 0.8, 0.5],
      [BRIDGE, 0.8, 0.2],
      [merge(BRIDGE, { ik: { legR: { at: [-0.1, 0.25, 0.45] } } }), 0.8, 0.5],
      [BRIDGE, 0.8, 0.2],
      [{}, 1.8, 0.8],
    ],
    { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor, poster: 1 },
  ),

  // Band anchored at chest height beside you, held in both hands at the chest; press the hands straight out without the body turning; bring back slowly.
  anim(
    'core-band-anti-rotation-press',
    merge(STAND, { ik: { ...feet(0, 0, 0.16), armL: { at: [0.04, 1.2, 0.15], pole: [1, -1, 0] }, armR: { at: [-0.04, 1.2, 0.15], pole: [-1, -1, 0] } } }),
    rep({ ik: { armL: { at: [0.04, 1.2, 0.46] }, armR: { at: [-0.04, 1.2, 0.46] } } }, 1.4, 1, 1.8, 0.8),
    { held: [{ kind: 'band', from: [1.4, 1.2, 0.1], to: 'wristL', offset: [0, -0.05, 0] }], views: cam([0.2, 1.0, 0.1], 3.9, [0.05, 0.14]), startView: 'front' },
  ),

  // Lie on the side on one forearm, legs straight; lift the hips so the body is straight from head to feet; hold; lower.
  anim(
    'core-side-plank',
    {
      p: [0, 0.2, 0],
      r: [0, 90, -50],
      ik: { armL: { at: [0.25, 0.06, -0.435], pole: [0, -1, 0] }, legL: { at: [0, 0.07, 0.79], pole: [1, 0, 0] }, legR: { at: [0, 0.17, 0.79], pole: [1, 0, 0] } },
    },
    HOLD({ p: [0, 0.383, 0], r: [0, 90, -74] }, 1.6),
    { props: [MAT], views: cam([0, 0.35, 0.1], 3.2) },
  ),
];

export const vestibularAnimations: ProceduralAnimation[] = [
  // Sit on a firm chair; turn the head slowly side to side, then nod it up and down.
  anim(
    'vestibular-seated-head-turns',
    SIT,
    [
      [{ j: { head: [0, 45, 0] } }, 1.2, 0.2],
      [{ j: { head: [0, -45, 0] } }, 2, 0.2],
      [{}, 1.2, 0.3],
      [{ j: { neck: x(-10), head: x(-14) } }, 1, 0.2],
      [{ j: { neck: x(14), head: x(14) } }, 1.6, 0.2],
      [{}, 1, 0.5],
    ],
    { props: [CHAIR], views: VIEW.head, startView: 'front' },
  ),

  // Sit on a firm chair; bend forward to touch the floor or the ankles, looking at the hand; sit back up and look ahead.
  anim(
    'vestibular-seated-bend-reach',
    merge(SIT, { ik: { armL: { at: [0.16, 0.62, 0.28], pole: [1, -0.5, -0.3] } } }),
    rep({ j: { spine: x(58), chest: x(34), neck: x(10) }, ik: { armL: { at: [0.16, 0.14, 0.5] } } }, 2, 0.8, 2.2, 1.2),
    { props: [CHAIR], views: VIEW.sit },
  ),
];
