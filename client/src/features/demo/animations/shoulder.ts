/**
 * Shoulder exercises of the starter catalog. Each movement follows the written instructions of its
 * catalog entry (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation } from '../types';
import { anim, cam, CHAIR, feet, MAT, merge, path, rep, SIDE, SIT, STAND, SUPINE, VIEW, x } from './build';

const WALL_IN_FRONT = { kind: 'wall', at: [0, 1.05, 0.62] } as const;

export const shoulderAnimations: ProceduralAnimation[] = [
  // Lean on a table with the good arm; let the other arm hang and swing it in small circles.
  path(
    'shoulder-pendulum',
    { p: [0, 0.88, -0.15], r: [50, 0, 0], j: { neck: x(-30), shoulderL: x(-50) }, ik: { ...feet(), armR: { at: [-0.3, 0.78, 0.5], pole: [-1, -0.3, 0] } } },
    6,
    (time) => {
      const turn = (2 * Math.PI * time) / 3;
      return { j: { shoulderL: [-50 + 9 * Math.cos(turn), 0, 9 * Math.sin(turn)] } };
    },
    { hl: ['armL'], props: [{ kind: 'table', at: [-0.35, 0.72, 0.78], size: [0.8, 0.04, 0.6] }], views: cam([0, 0.72, 0.25], 3.9, [0.08, 0.2]) },
  ),

  // Face a wall with the hands on it; slide the hands up as far as comfortable, then back down.
  anim(
    'shoulder-wall-slides',
    merge(STAND, { p: [0, 0.92, 0.05], ik: { armL: { at: [0.18, 1.25, 0.5], pole: [0.5, -1, -0.3] }, armR: { at: [-0.18, 1.25, 0.5], pole: [-0.5, -1, -0.3] } } }),
    rep({ p: [0, 0.92, 0.2], ik: { armL: { at: [0.18, 1.78, 0.5] }, armR: { at: [-0.18, 1.78, 0.5] } } }, 2.2, 0.8, 2.4, 0.8),
    { hl: ['armL', 'armR'], props: [WALL_IN_FRONT], views: cam([0, 1.0, 0.1], 4.4, [0.06, 0.14], true) },
  ),

  // Sit at a table with a towel under the hand; slide the hand forward, leaning the body with it; slide back.
  anim('shoulder-table-slides', merge(SIT, { ik: { armL: { at: [0.2, 0.77, 0.36], pole: [0.5, -1, -0.3] } } }), rep({ j: { spine: x(28) }, ik: { armL: { at: [0.2, 0.77, 0.7] } } }, 2, 0.8, 2.4, 0.8), {
    hl: ['armL'],
    props: [CHAIR, { kind: 'table', at: [0, 0.72, 0.62], size: [0.9, 0.04, 0.62] }],
    views: VIEW.sitTable,
  }),

  // Sit tall, arms relaxed; squeeze the shoulder blades back and down; hold 5 s.
  anim(
    'shoulder-blade-squeeze',
    STAND,
    rep({ o: { shoulderL: [-0.02, -0.012, -0.045], shoulderR: [0.02, -0.012, -0.045] }, j: { shoulderL: [12, 0, 9], shoulderR: [12, 0, -9], elbowL: x(-12), elbowR: x(-12), chest: x(-5) } }, 1.2, 5, 1.2, 0.8),
    { hl: ['armL', 'armR'], views: cam([0, 1.15, 0], 3.1, [0.04, 0.1], true) },
  ),

  // Light band, elbow at the side bent 90°; rotate the forearm outward, then back slowly.
  anim('shoulder-band-external-rotation', merge(STAND, { j: { shoulderL: [0, -25, 0], elbowL: x(-90) } }), rep({ j: { shoulderL: [0, 45, 0] } }, 1.4, 0.5, 2, 0.6), {
    hl: ['armL'],
    held: [{ kind: 'band', from: [-1.1, 1.04, 0.2], to: 'wristL', offset: [0, -0.05, 0] }],
    views: VIEW.upperBody,
    startView: 'front',
  }),

  // Band anchored at chest height in front; pull the ends back, bending the elbows; return slowly.
  anim(
    'shoulder-band-row',
    merge(STAND, { ik: { armL: { at: [0.2, 1.25, 0.48], pole: [0.3, -0.4, -1] }, armR: { at: [-0.2, 1.25, 0.48], pole: [-0.3, -0.4, -1] } } }),
    rep({ o: { shoulderL: [0, 0, -0.03], shoulderR: [0, 0, -0.03] }, ik: { armL: { at: [0.25, 1.15, 0.04] }, armR: { at: [-0.25, 1.15, 0.04] } } }, 1.4, 0.6, 2, 0.6),
    {
      hl: ['armL', 'armR'],
      held: [
        { kind: 'band', from: [0, 1.25, 1.6], to: 'wristL', offset: [0, -0.05, 0] },
        { kind: 'band', from: [0, 1.25, 1.6], to: 'wristR', offset: [0, -0.05, 0] },
      ],
      views: cam([0, 1.05, 0.45], 3.8, [0.05, 0.14]),
    },
  ),

  // An arm's length from a wall, hands on it at shoulder height; bend the elbows, chest toward the wall; push back.
  anim(
    'shoulder-wall-push-up',
    {
      p: [0, 0.912, -0.083],
      r: [8, 0, 0],
      j: { ankleL: x(-8), ankleR: x(-8) },
      ik: { armL: { at: [0.22, 1.3, 0.5], pole: [0.7, -1, -0.2] }, armR: { at: [-0.22, 1.3, 0.5], pole: [-0.7, -1, -0.2] } },
    },
    rep({ p: [0, 0.859, 0.115], r: [22, 0, 0], j: { ankleL: x(-22), ankleR: x(-22) } }, 1.8, 0.4, 1.8, 0.6),
    { hl: ['armL', 'armR'], props: [WALL_IN_FRONT], views: VIEW.standBehind },
  ),

  // Lie on the back holding a stick with both hands; lift it up and overhead as far as comfortable; lower slowly.
  anim('shoulder-stick-flexion', merge(SUPINE, { j: { shoulderL: x(-15), shoulderR: x(-15) } }), rep({ j: { shoulderL: x(-150), shoulderR: x(-150) } }, 2.6, 0.8, 2.8, 0.8), {
    hl: ['armL'],
    props: [MAT],
    held: [{ kind: 'stick' }],
    views: cam([0, 0.35, -0.2], 3.3),
  }),

  // Lie on the back, elbows bent 90° at the sides, holding a stick; the good arm pushes the other hand outward.
  anim(
    'shoulder-stick-external-rotation',
    merge(SUPINE, { j: { shoulderL: x(0), shoulderR: x(0), elbowL: x(-90), elbowR: x(-90) } }),
    rep({ j: { shoulderL: [0, 38, 0], shoulderR: [0, 38, 0] } }, 1.8, 0.8, 2.2, 0.6),
    { hl: ['armL'], props: [MAT], held: [{ kind: 'stick' }], views: cam([0, 0.3, -0.25], 2.9), startView: 'front' },
  ),

  // Side-on to a wall, elbow bent 90° at the side, back of the hand against the wall; press gently; hold 5 s.
  anim('shoulder-isometric-external-rotation', merge(STAND, { j: { shoulderR: [0, -12, 0], elbowR: x(-90) } }), rep({ j: { shoulderR: [0, -16, 0] } }, 0.8, 5, 0.8, 1), {
    hl: ['armR'],
    props: [{ kind: 'wall', at: [-0.33, 1.05, 0], turn: 90 }],
    views: VIEW.upperBody,
    startView: 'front',
  }),

  // Bring one arm across the chest at shoulder height; the other hand above the elbow draws it closer; hold.
  anim(
    'shoulder-cross-body-stretch',
    merge(STAND, { ik: { armL: { at: [0.25, 0.86, 0.03], pole: [0, -0.2, 1] }, armR: { at: [-0.25, 0.86, 0.03], pole: [0, -1, 0.3] } } }),
    [
      [{ ik: { armL: { at: [-0.22, 1.34, 0.2] }, armR: { at: [0, 1.28, 0.27] } } }, 1.6, 0.3],
      [{ ik: { armL: { at: [-0.28, 1.34, 0.14] }, armR: { at: [-0.04, 1.28, 0.22] } } }, 1, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['armL'], views: VIEW.upperBody, startView: 'front', poster: 1 },
  ),

  // Lie on the side, top elbow bent 90° resting on the waist; lift the hand toward the ceiling; lower slowly.
  anim('shoulder-side-lying-external-rotation', merge(SIDE, { j: { shoulderR: [0, 45, 0], elbowR: x(-90) } }), rep({ j: { shoulderR: [0, -35, 0] } }, 1.6, 0.6, 2.2, 0.6), {
    hl: ['armR'],
    props: [MAT],
    views: cam([0, 0.32, -0.1], 2.9),
  }),
];
