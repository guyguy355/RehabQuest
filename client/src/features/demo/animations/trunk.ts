/**
 * Lower-back and core exercises of the starter catalog. Each movement follows the written
 * instructions of its catalog entry (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation } from '../types';
import { anim, cam, CHAIR, HANDS_DOWN, HOOK, type Key, MAT, merge, mirror, PRONE, QUAD, rep, sides, SIT, SUPINE, VIEW, x } from './build';

const HOOK_HANDS = merge(HOOK, { ik: HANDS_DOWN });
/** One knee drawn up over the chest (left). */
const KNEE_UP: Key = { ik: { legL: { at: [0.095, 0.5, 0.05], pole: [0, 1, -0.8], foot: null } } };
const BOTH_KNEES_UP: Key = merge(KNEE_UP, mirror(KNEE_UP));
const HOLD_KNEE: Key = merge(KNEE_UP, { ik: { armL: { at: [0.13, 0.5, -0.33] }, armR: { at: [0.04, 0.5, -0.33] } } });
const KNEES_FALL: Key = { r: [-90, 18, 0], j: { spine: [0, -18, 0] }, ik: { legL: { pole: [1, 0.7, 0] }, legR: { pole: [1, 0.7, 0] } } };

/** Lying face down on the forearms, and the two planks that start from there. */
const ON_FOREARMS = (wristZ: number): Key => ({
  p: [0, 0.13, 0],
  r: [90, 0, 0],
  j: { ankleL: x(70), ankleR: x(70) },
  ik: { armL: { at: [0.2, 0.06, wristZ], pole: [1, -0.3, 0] }, armR: { at: [-0.2, 0.06, wristZ], pole: [-1, -0.3, 0] } },
});
const ELBOWS_UNDER: Key['ik'] = { armL: { pole: [0, -1, -0.3] }, armR: { pole: [0, -1, -0.3] } };
const HOLD: (top: Key, up?: number, hold?: number) => [Key, number, number?][] = (top, up = 1.6, hold = 4.5) => [
  [top, up, hold],
  [{}, up, 0.8],
];

export const backAnimations: ProceduralAnimation[] = [
  // Lie on the back, knees bent; flatten the lower back into the floor by tilting the pelvis; hold 3 s.
  anim('back-pelvic-tilt', merge(HOOK, { j: { spine: x(-7), chest: x(7) } }), rep({ p: [0, 0.118, -0.1], r: [-98, 0, 0], j: { spine: x(6), chest: x(2) } }, 1.2, 3, 1.2, 0.8), {
    props: [MAT],
    views: cam([0, 0.25, -0.05], 2.6),
  }),

  // Lie on the back, knees bent; hold one knee and draw it gently toward the chest; hold; switch legs.
  anim(
    'back-knee-to-chest',
    HOOK_HANDS,
    [
      [HOLD_KNEE, 1.8, 3.5],
      [{}, 1.8, 0.4],
      [mirror(HOLD_KNEE), 1.8, 3.5],
      [{}, 1.8, 0.6],
    ],
    { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor },
  ),

  // Lie on the back, knees bent and together; let both knees fall slowly to one side, then the other.
  anim(
    'back-lower-trunk-rotation',
    merge(HOOK, {
      j: { shoulderL: [0, 0, 60], shoulderR: [0, 0, -60] },
      ik: { legL: { at: [0.06, 0.11, 0.45], foot: null }, legR: { at: [-0.06, 0.11, 0.45], foot: null } },
    }),
    [
      [KNEES_FALL, 1.8, 0.6],
      [{}, 1.6, 0.2],
      [mirror(KNEES_FALL), 1.8, 0.6],
      [{}, 1.6, 0.4],
    ],
    { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor, startView: 'front' },
  ),

  // On hands and knees; round the back up toward the ceiling, then let it sag gently while lifting the head.
  anim(
    'back-cat-cow',
    QUAD,
    [
      [{ p: [0, 0.52, -0.2], r: [66, 0, 0], j: { chest: x(38), neck: x(25), head: x(20) } }, 1.8, 0.8],
      [{ p: [0, 0.47, -0.2], r: [94, 0, 0], j: { chest: x(-28), neck: x(-22), head: x(-15) } }, 2.4, 0.8],
      [{}, 1.4, 0.4],
    ],
    { props: [MAT], views: VIEW.quad },
  ),

  // Lie on the stomach, hands under the shoulders; push the upper body up, hips on the floor; lower slowly.
  anim(
    'back-prone-press-up',
    merge(PRONE, { ik: { armL: { at: [0.26, 0.07, 0.5], pole: [0.4, 1, -0.4] }, armR: { at: [-0.26, 0.07, 0.5], pole: [-0.4, 1, -0.4] } } }),
    rep({ r: [82, 0, 0], j: { spine: x(-22), chest: x(-25), neck: x(-10) } }, 2, 1, 2.4, 0.8),
    { props: [MAT], views: VIEW.floor },
  ),

  // On hands and knees; sit the hips back toward the heels, arms reaching forward; hold and breathe slowly.
  anim(
    'back-childs-pose',
    QUAD,
    HOLD(
      {
        p: [0, 0.27, -0.52],
        r: [88, 0, 0],
        j: { chest: x(17), neck: x(8) },
        ik: { legL: { pole: [0, -0.3, 1] }, legR: { pole: [0, -0.3, 1] }, armL: { at: [0.2, 0.08, 0.4] }, armR: { at: [-0.2, 0.08, 0.4] } },
      },
      2.2,
    ),
    { props: [MAT], views: VIEW.quad },
  ),

  // Lie on the back, knees bent; bring one knee up, then the other; hold both behind the thighs; draw them toward the chest.
  anim(
    'back-double-knee-to-chest',
    HOOK_HANDS,
    [
      [KNEE_UP, 1.4, 0.2],
      [merge(BOTH_KNEES_UP, { ik: { armL: { at: [0.12, 0.4, -0.22] }, armR: { at: [-0.12, 0.4, -0.22] } } }), 1.4, 0.3],
      [
        {
          ik: {
            legL: { at: [0.095, 0.52, -0.03], pole: [0, 1, -0.8], foot: null },
            legR: { at: [-0.095, 0.52, -0.03], pole: [0, 1, -0.8], foot: null },
            armL: { at: [0.12, 0.42, -0.26] },
            armR: { at: [-0.12, 0.42, -0.26] },
          },
        },
        1,
        4,
      ],
      [BOTH_KNEES_UP, 0.9, 0.1],
      [KNEE_UP, 1.4, 0.2],
      [{}, 1.4, 0.8],
    ],
    { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor, poster: 2 },
  ),

  // Sit on a chair with the feet apart; slide the hands down the legs toward the floor, letting the back round; hold; come up slowly.
  anim(
    'back-seated-forward-bend',
    merge(SIT, {
      ik: {
        legL: { at: [0.22, 0.08, 0.42] },
        legR: { at: [-0.22, 0.08, 0.42] },
        armL: { at: [0.2, 0.6, 0.3], pole: [1, 0, -0.5] },
        armR: { at: [-0.2, 0.6, 0.3], pole: [-1, 0, -0.5] },
      },
    }),
    [
      [{ j: { spine: x(60), chest: x(40), neck: x(15) }, ik: { armL: { at: [0.2, 0.12, 0.48] }, armR: { at: [-0.2, 0.12, 0.48] } } }, 2.4, 3.5],
      [{}, 2.8, 0.8],
    ],
    { props: [CHAIR], views: VIEW.sit },
  ),

  // Lie on the stomach, arms overhead; lift one arm and the opposite leg a little; hold 3 s; switch sides.
  anim('back-superman-alternating', merge(PRONE, { j: { shoulderL: x(-180), shoulderR: x(-180) } }), sides({ j: { shoulderL: x(-197), hipR: x(12) } }, 1.4, 3, 1.4, 0.5), {
    hl: ['armL', 'armR', 'legL', 'legR'],
    props: [{ kind: 'mat', size: [0.8, 0.03, 2.6], at: [0, 0.015, 0.2] }],
    views: cam([0, 0.27, 0.25], 3.6),
  }),
];

export const coreAnimations: ProceduralAnimation[] = [
  // Lie on the back, knees and arms raised; lower one arm overhead and the opposite leg toward the floor; return; switch.
  anim(
    'core-dead-bug',
    merge(SUPINE, { j: { hipL: x(-90), hipR: x(-90), kneeL: x(90), kneeR: x(90), shoulderL: x(-90), shoulderR: x(-90) } }),
    sides({ j: { shoulderL: x(-168), hipR: x(-18), kneeR: x(12) } }, 2, 0.6, 2, 0.4),
    { props: [MAT], views: cam([0, 0.35, -0.05], 3.4) },
  ),

  // On hands and knees; reach one arm forward and the opposite leg back; hold 3 s; switch sides.
  anim('core-bird-dog', QUAD, sides({ ik: { armL: { at: [0.2, 0.6, 0.74] }, legR: { at: [-0.095, 0.49, -1.0], pole: [0, -1, 0] } } }, 1.6, 3, 1.6, 0.5), {
    props: [{ kind: 'mat', size: [0.8, 0.03, 2.4], at: [0, 0.015, -0.1] }],
    views: cam([0, 0.38, -0.1], 3.7, [0.14, 0.34]),
  }),

  // Lie face down on the forearms; lift the body so it is straight from head to heels; hold; lower.
  anim('core-forearm-plank', ON_FOREARMS(0.635), HOLD({ p: [0, 0.278, -0.01], r: [81, 0, 0], j: { ankleL: x(-5), ankleR: x(-5) }, ik: ELBOWS_UNDER }), {
    props: [MAT],
    views: VIEW.floor,
  }),

  // Lie on the side on one forearm, knees bent; lift the hips so the body is straight from head to knees; hold; lower.
  anim(
    'core-side-plank-knees',
    {
      p: [0, 0.2, 0],
      r: [0, 90, -50],
      ik: {
        armL: { at: [0.25, 0.06, -0.435], pole: [0, -1, 0] },
        legL: { at: [-0.38, 0.06, 0.5], pole: [1, 0, 0.3] },
        legR: { at: [-0.38, 0.16, 0.5], pole: [1, 0, 0.3] },
      },
    },
    HOLD({ p: [0, 0.37, 0], r: [0, 90, -72] }),
    { props: [MAT], views: cam([0, 0.35, 0], 3.1) },
  ),

  // Lie on the back, knees bent, feet flat; tighten the stomach; lift one foot a little, tap the heel down; switch legs.
  anim(
    'core-heel-taps',
    HOOK,
    [
      [{ ik: { legL: { at: [0.1, 0.21, 0.45] } } }, 1, 0.3],
      [{}, 1, 0.3],
      [{ ik: { legR: { at: [-0.1, 0.21, 0.45] } } }, 1, 0.3],
      [{}, 1, 0.4],
    ],
    { hl: ['legL', 'legR'], props: [MAT], views: VIEW.floor },
  ),

  // Lie on the back, knees bent, feet flat; let one knee lower slowly out to the side; bring it back; switch sides.
  anim('core-bent-knee-fallout', HOOK, sides({ ik: { legL: { pole: [1, 0.45, 0], foot: null } } }, 2, 0.5, 2, 0.4), {
    hl: ['legL', 'legR'],
    props: [MAT],
    views: VIEW.floor,
    startView: 'front',
  }),

  // Sit tall at the front of a chair; lift one knee a little, lower it, then lift the other.
  anim('core-seated-march', SIT, sides({ ik: { legL: { at: [0.095, 0.21, 0.42] } } }, 1, 0.4, 1.2, 0.3), { hl: ['legL', 'legR'], props: [CHAIR], views: VIEW.sit }),

  // Lie face down on the forearms, knees on the floor; lift the hips so the body is straight from head to knees; hold; lower.
  anim('core-plank-on-knees', ON_FOREARMS(0.61), HOLD({ p: [0, 0.208, -0.023], r: [70.8, 0, 0], j: { kneeL: x(19), kneeR: x(19) }, ik: ELBOWS_UNDER }), {
    props: [MAT],
    views: VIEW.floor,
  }),
];
