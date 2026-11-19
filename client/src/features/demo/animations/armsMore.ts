/**
 * Shoulder, elbow and wrist exercises added to the starter catalog after the first set. Each
 * movement follows the written instructions of its catalog entry
 * (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation, Prop } from '../types';
import { anim, cam, CHAIR, type Key, MAT, merge, path, PRONE, rep, SIDE, SIT, STAND, type Step, SUPINE, VIEW, x } from './build';

const HOLD = (top: Key, move = 1.8, hold = 4.5): Step[] => [
  [top, move, hold],
  [{}, move, 0.8],
];
const PRESS = (top: Key): Step[] => rep(top, 0.8, 5, 0.8, 1);

/** Lying face down on a bed with the left arm hanging over the side. */
const BED: Prop = { kind: 'counter', at: [-0.12, 0.25, 0], size: [0.9, 0.5, 2.1] };
const ON_BED: Key = merge(PRONE, { p: [0.13, 0.63, 0.08], j: { shoulderL: x(-90), shoulderR: [0, 0, -8], head: [0, 50, 0] } });
const BED_VIEW = cam([0.15, 0.5, 0.2], 3.4, [0.12, 0.3]);

/** Sitting at a table, leaning a little forward, the left forearm resting on it. `twist` 90 = palm up, -90 = palm down. */
const AT_TABLE = (twist: number, wrist: [number, number, number] = [0.08, 0.78, 0.56]): Key =>
  merge(SIT, { j: { spine: x(25) }, ik: { armL: { at: wrist, pole: [0, -1, 0], twist } } });
const NARROW_TABLE: Prop = { kind: 'table', at: [0, 0.72, 0.42], size: [0.9, 0.04, 0.3] };
const TABLE_VIEW = cam([0.05, 0.74, 0.42], 2.5, [0.14, 0.3]);
const HELPING_HAND: Key['ik'] = { armR: { at: [-0.12, 0.78, 0.45], pole: [-0.6, -1, -0.2] } };

/** Body straight, leaning on a counter in front; `lean` is the angle from upright in degrees. */
const LEANING = (lean: number): Key => {
  const angle = (lean * Math.PI) / 180;
  return { p: [0, 0.08 + 0.84 * Math.cos(angle), -0.45 + 0.84 * Math.sin(angle)], r: [lean, 0, 0], j: { ankleL: x(-lean), ankleR: x(-lean) } };
};

export const shoulderMoreAnimations: ProceduralAnimation[] = [
  // Lie on the treated side, that arm straight out in front with the elbow bent 90°; the other hand presses the forearm down toward the floor; hold.
  anim(
    'shoulder-sleeper-stretch',
    merge(SIDE, { j: { shoulderL: [-90, -90, 0], elbowL: x(-90) }, ik: { armR: { at: [0.28, 0.31, -0.44], pole: [0, 1, 0.5] } } }),
    HOLD({ j: { shoulderL: [-90, -145, 0] }, ik: { armR: { at: [0.28, 0.2, -0.24] } } }),
    { hl: ['armL'], props: [MAT], views: cam([0, 0.3, -0.2], 2.9) },
  ),

  // Stand holding a stick in both hands, the treated hand at the end; the good arm pushes the treated arm out to the side and up; lower slowly.
  anim('shoulder-stick-abduction', merge(STAND, { j: { shoulderL: [0, 0, 10], shoulderR: [0, 0, -10] } }), rep({ j: { shoulderL: [0, 0, 85], shoulderR: [-25, 0, 38], elbowR: x(-45) } }, 2.2, 0.8, 2.4, 0.8), {
    hl: ['armL'],
    held: [{ kind: 'stick' }],
    views: cam([0.15, 1.05, 0.05], 3.6, [0.05, 0.12]),
    startView: 'front',
  }),

  // Face a wall at arm's length; walk the fingers up the wall as high as comfortable; walk them back down.
  anim(
    'shoulder-finger-wall-walk',
    merge(STAND, { p: [0, 0.92, 0.05], ik: { armL: { at: [0.2, 1.1, 0.5], pole: [0.4, -1, -0.3] } } }),
    rep({ p: [0, 0.92, 0.2], ik: { armL: { at: [0.2, 1.8, 0.5] } } }, 2.6, 0.8, 2.6, 0.8),
    { hl: ['armL'], props: [{ kind: 'wall', at: [0, 1.05, 0.62] }], views: cam([0, 1.0, 0.1], 4.4, [0.06, 0.14], true) },
  ),

  // Sit and clasp the hands together; lift both arms forward and up as far as comfortable; lower slowly.
  anim(
    'shoulder-clasped-hands-lift',
    merge(SIT, { ik: { armL: { at: [0.03, 0.63, 0.3], pole: [1, -1, 0] }, armR: { at: [-0.03, 0.63, 0.3], pole: [-1, -1, 0] } } }),
    [
      [{ ik: { armL: { at: [0.03, 1.05, 0.48] }, armR: { at: [-0.03, 1.05, 0.48] } } }, 1.4],
      [{ ik: { armL: { at: [0.03, 1.44, 0.12] }, armR: { at: [-0.03, 1.44, 0.12] } } }, 1.2, 0.8],
      [{ ik: { armL: { at: [0.03, 1.05, 0.48] }, armR: { at: [-0.03, 1.05, 0.48] } } }, 1.4],
      [{}, 1.4, 0.8],
    ],
    { hl: ['armL', 'armR'], props: [CHAIR], views: cam([0, 0.85, 0.1], 3.9, [0.08, 0.18]), poster: 1 },
  ),

  // Stand in a doorway with the forearms on the frame, elbows at shoulder height; step one foot forward and lean gently through; hold.
  anim(
    'shoulder-doorway-chest-stretch',
    {
      p: [0, 0.86, 0.1],
      ik: {
        legL: { at: [0.095, 0.08, 0.4], foot: [0, 0, 0] },
        legR: { at: [-0.095, 0.08, 0], foot: [0, 0, 0] },
        armL: { at: [0.48, 1.62, 0.14], pole: [1, -0.3, -0.2] },
        armR: { at: [-0.48, 1.62, 0.14], pole: [-1, -0.3, -0.2] },
      },
    },
    HOLD({ p: [0, 0.84, 0.26] }),
    {
      hl: ['armL', 'armR'],
      props: [
        { kind: 'wall', at: [0.56, 1.05, 0.2], size: [0.14, 2.1, 0.12] },
        { kind: 'wall', at: [-0.56, 1.05, 0.2], size: [0.14, 2.1, 0.12] },
      ],
      views: VIEW.standBehind,
      startView: 'front',
    },
  ),

  // At a door frame, elbow bent 90° at the side, palm against it; press the palm gently inward; hold 5 s.
  anim('shoulder-isometric-internal-rotation', merge(STAND, { j: { shoulderR: [0, 6, 0], elbowR: x(-90) } }), PRESS({ j: { shoulderR: [0, 10, 0] } }), {
    hl: ['armR'],
    props: [{ kind: 'wall', at: [-0.1, 1.05, 0.33], size: [0.1, 2.1, 0.1] }],
    views: VIEW.upperBody,
    startView: 'front',
  }),

  // Face a wall, elbow bent at the side, fist against the wall; press the fist gently forward; hold 5 s.
  anim('shoulder-isometric-flexion', merge(STAND, { j: { elbowL: x(-90) } }), PRESS({ j: { shoulderL: [-4, 0, 7] } }), {
    hl: ['armL'],
    props: [{ kind: 'wall', at: [0, 1.05, 0.42] }],
    views: cam([0, 1.15, 0.1], 3.1, [0.04, 0.1], true),
  }),

  // Side-on to a wall, elbow bent at the side; press the outside of the elbow gently into the wall; hold 5 s.
  anim('shoulder-isometric-abduction', merge(STAND, { j: { shoulderR: [0, 0, -4], elbowR: x(-90) } }), PRESS({ j: { shoulderR: [0, 0, -9] } }), {
    hl: ['armR'],
    props: [{ kind: 'wall', at: [-0.32, 1.05, 0], turn: 90 }],
    views: VIEW.upperBody,
    startView: 'front',
  }),

  // Band anchored at elbow height beside you, elbow bent 90° at the side; pull the hand in across the stomach; return slowly.
  anim('shoulder-band-internal-rotation', merge(STAND, { j: { shoulderL: [0, 45, 0], elbowL: x(-90) } }), rep({ j: { shoulderL: [0, -32, 0] } }, 1.4, 0.5, 2, 0.6), {
    hl: ['armL'],
    held: [{ kind: 'band', from: [1.2, 1.04, 0.2], to: 'wristL', offset: [0, -0.05, 0] }],
    views: VIEW.upperBody,
    startView: 'front',
  }),

  // Hold a light band in front at chest height, arms straight; pull the hands apart, squeezing the shoulder blades; return slowly.
  anim('shoulder-band-pull-apart', merge(STAND, { j: { shoulderL: [-88, 0, -8], shoulderR: [-88, 0, 8] } }), rep({ j: { shoulderL: [-88, 0, 42], shoulderR: [-88, 0, -42] } }, 1.4, 0.6, 2, 0.6), {
    hl: ['armL', 'armR'],
    held: [{ kind: 'stick', look: 'band' }],
    views: VIEW.upperBody,
    startView: 'front',
  }),

  // Arms at the sides, thumbs up; lift the arm slightly forward of sideways, up to shoulder height; lower slowly.
  anim('shoulder-scaption-raise', STAND, rep({ j: { shoulderL: [0, -30, 88] } }, 1.8, 0.5, 2.4, 0.6), { hl: ['armL'], views: cam([0.1, 1.1, 0.05], 3.4, [0.05, 0.12]), startView: 'front' }),

  // Lie face down on a bed with the arm hanging over the side; lift the straight arm out to the side to shoulder height; lower slowly.
  anim('shoulder-prone-horizontal-abduction', ON_BED, rep({ j: { shoulderL: [-90, 0, 86] } }, 1.8, 0.5, 2.4, 0.6), { hl: ['armL'], props: [BED], views: BED_VIEW, startView: 'front' }),

  // Lie face down on a bed with the arm hanging over the side; bend the elbow and pull it up toward the ceiling; lower slowly.
  anim('shoulder-prone-row', ON_BED, rep({ j: { shoulderL: x(12), elbowL: x(-102) }, o: { shoulderL: [0, 0, -0.03] } }, 1.6, 0.6, 2.2, 0.6), { hl: ['armL'], props: [BED], views: BED_VIEW }),

  // Lie on the back with the arm straight up; reach the hand higher so the shoulder blade lifts off the floor; let it sink back.
  anim('shoulder-supine-punch', merge(SUPINE, { j: { shoulderL: x(-90) } }), rep({ o: { shoulderL: [0, 0, 0.055] } }, 1.2, 1, 1.4, 0.6), {
    hl: ['armL'],
    props: [MAT],
    views: cam([0, 0.4, -0.3], 2.9),
  }),

  // Arms at the sides; lift both shoulders straight up toward the ears; pause; lower slowly.
  anim('shoulder-shrugs', STAND, rep({ o: { shoulderL: [0, 0.05, 0], shoulderR: [0, 0.05, 0] } }, 1, 0.8, 1.6, 0.6), { hl: ['armL', 'armR'], views: VIEW.upperBody, startView: 'front' }),

  // Band anchored in front; elbow out to the side at shoulder height, bent 90°, forearm forward; rotate the forearm up to the ceiling; lower slowly.
  anim('shoulder-band-external-rotation-90', merge(STAND, { j: { shoulderL: [0, 0, 90], elbowL: x(-90) } }), rep({ j: { shoulderL: [-82, 0, 90] } }, 1.6, 0.5, 2.2, 0.6), {
    hl: ['armL'],
    held: [{ kind: 'band', from: [0.48, 1.3, 1.5], to: 'wristL', offset: [0, -0.05, 0] }],
    views: cam([0.2, 1.2, 0.3], 3.5, [0.05, 0.12]),
  }),

  // Hands on a sturdy counter, feet walked back until the body is straight; bend the elbows to lower the chest; push back up.
  anim(
    'shoulder-counter-push-up',
    merge(LEANING(28), { ik: { armL: { at: [0.22, 0.96, 0.58], pole: [0.7, -0.6, -0.6] }, armR: { at: [-0.22, 0.96, 0.58], pole: [-0.7, -0.6, -0.6] } } }),
    rep(LEANING(40), 1.8, 0.4, 1.8, 0.6),
    { hl: ['armL', 'armR'], props: [{ kind: 'counter', at: [0, 0.45, 0.77], size: [1.2, 0.9, 0.4] }], views: cam([0, 0.75, 0.1], 4, [0.06, 0.16], true) },
  ),
];

export const elbowMoreAnimations: ProceduralAnimation[] = [
  // Forearm on a table, palm up, light weight over the edge; the other hand curls the wrist up; lower it slowly on its own.
  anim(
    'elbow-eccentric-wrist-flexion',
    merge(AT_TABLE(90), { j: { wristL: [0, 0, 35] }, ik: HELPING_HAND }),
    [
      [{ j: { wristL: [0, 0, -40] }, ik: { armR: { at: [0.04, 0.75, 0.66] } } }, 0.9, 0.3],
      [{ j: { wristL: [0, 0, -40] } }, 0.7, 0.3],
      [{}, 3.6, 0.8],
    ],
    { hl: ['armL'], props: [CHAIR, NARROW_TABLE], held: [{ kind: 'weight', hand: 'L' }], views: TABLE_VIEW, poster: 1 },
  ),

  // Forearm on a table, palm down; the other hand on the back of the hand; try to lift the wrist against it; hold without moving.
  anim('elbow-isometric-wrist-extension', merge(AT_TABLE(-90), { ik: { armR: { at: [0.08, 0.84, 0.6], pole: [-0.6, 0.2, -0.6] } } }), rep({ j: { wristL: [0, 0, 5] } }, 0.8, 6, 0.8, 1), {
    hl: ['armL'],
    props: [CHAIR, NARROW_TABLE],
    views: TABLE_VIEW,
  }),

  // Forearm on a table, holding a hammer by the end of its handle; slowly turn the palm up, then down.
  anim(
    'elbow-hammer-rotation',
    AT_TABLE(0),
    [
      [{ ik: { armL: { twist: 75 } } }, 1.6, 0.5],
      [{ ik: { armL: { twist: -75 } } }, 2.4, 0.5],
      [{}, 1.6, 0.4],
    ],
    { hl: ['armL'], props: [CHAIR, NARROW_TABLE], held: [{ kind: 'weight', hand: 'L' }], views: TABLE_VIEW, startView: 'front' },
  ),

  // Hold a rolled towel in both hands in front; twist it as if wringing out water, one hand forward and one back; then the other way.
  anim(
    'elbow-towel-twist',
    merge(STAND, { ik: { armL: { at: [0.12, 1.08, 0.36], pole: [0.6, -1, -0.3], twist: -90 }, armR: { at: [-0.12, 1.08, 0.36], pole: [-0.6, -1, -0.3], twist: 90 } } }),
    [
      [{ j: { wristL: [0, 0, 40], wristR: [0, 0, 40] } }, 1.2, 0.5],
      [{ j: { wristL: [0, 0, -40], wristR: [0, 0, -40] } }, 1.8, 0.5],
      [{}, 1.2, 0.4],
    ],
    { hl: ['armL', 'armR'], held: [{ kind: 'stick', look: 'towel' }], views: VIEW.upperBody },
  ),

  // Sit with the elbow bent 90°, palm up; the other hand on the wrist; try to bend the elbow against it; hold without moving.
  anim('elbow-isometric-biceps-hold', merge(SIT, { j: { shoulderL: [0, 0, 3], elbowL: [-90, 80, 0] }, ik: { armR: { at: [0.19, 0.75, 0.27], pole: [-0.5, -1, 0] } } }), PRESS({ j: { elbowL: [-94, 80, 0] } }), {
    hl: ['armL'],
    props: [CHAIR],
    views: cam([0.05, 0.75, 0.2], 2.8, [0.1, 0.25]),
    startView: 'front',
  }),
];

export const wristMoreAnimations: ProceduralAnimation[] = [
  // Forearm on a table, palm up, light weight over the edge; curl the hand up; lower slowly.
  anim('wrist-weighted-flexion', merge(AT_TABLE(90), { j: { wristL: [0, 0, 30] } }), rep({ j: { wristL: [0, 0, -45] } }, 1.4, 0.5, 2.8, 0.6), {
    hl: ['armL'],
    props: [CHAIR, NARROW_TABLE],
    held: [{ kind: 'weight', hand: 'L' }],
    views: TABLE_VIEW,
  }),

  // Forearm on a table, thumb up, light weight over the edge; lift the hand up toward the thumb side; lower slowly.
  anim('wrist-weighted-side-lift', merge(AT_TABLE(0), { j: { wristL: x(15) } }), rep({ j: { wristL: x(-25) } }, 1.4, 0.5, 2.6, 0.6), {
    hl: ['armL'],
    props: [CHAIR, NARROW_TABLE],
    held: [{ kind: 'weight', hand: 'L' }],
    views: TABLE_VIEW,
  }),

  // Forearm on a table, hand over the edge; slowly circle the hand one way, then the other.
  path(
    'wrist-circles',
    AT_TABLE(-90),
    9,
    (time) => {
      const turn = 4 * Math.PI * Math.sin((Math.PI * time) / 9) ** 2;
      return { j: { wristL: [18 * Math.sin(turn), 0, 28 * Math.cos(turn)] } };
    },
    { hl: ['armL'], props: [CHAIR, NARROW_TABLE], views: TABLE_VIEW },
  ),
];

