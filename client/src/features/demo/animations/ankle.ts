/**
 * Ankle exercises of the starter catalog. Each movement follows the written instructions of its
 * catalog entry (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation } from '../types';
import { anim, AT_COUNTER, cam, CHAIR, COUNTER, type Key, LONG_SIT, MAT, merge, path, rep, SIT, STAND, SUPINE, VIEW, x } from './build';

/** Sitting with the left foot off the floor. */
const FOOT_UP = (knee: number): Key => merge(SIT, { ik: { legL: null }, j: { hipL: x(-88), kneeL: x(knee) } });
const FOOT_VIEW = cam([0.1, 0.25, 0.5], 2.9, [0.14, 0.3]);

export const ankleAnimations: ProceduralAnimation[] = [
  // Sit with the foot off the floor; trace letters with the big toe, moving from the ankle.
  path(
    'ankle-alphabet',
    FOOT_UP(45),
    9,
    (time) => {
      const turn = (2 * Math.PI * time) / 9;
      return { j: { ankleL: [8 + 20 * Math.sin(3 * turn), 24 * Math.sin(2 * turn), 0] } };
    },
    { hl: ['legL'], props: [CHAIR], views: cam([0.1, 0.3, 0.55], 2.9, [0.14, 0.3]), startView: 'front' },
  ),

  // Leg straight; point the foot away, then pull it back toward you.
  anim(
    'ankle-pumps',
    SUPINE,
    [
      [{ j: { ankleL: x(32) } }, 1, 0.4],
      [{ j: { ankleL: x(-18) } }, 1.3, 0.4],
      [{}, 0.7, 0.3],
    ],
    { hl: ['legL'], props: [MAT], views: cam([0, 0.22, 0.45], 2.5) },
  ),

  // Hold a counter; rise onto the toes, pause, lower slowly.
  anim('ankle-calf-raises', AT_COUNTER, rep({ p: [0, 0.975, 0.07], j: { ankleL: x(35), ankleR: x(35) } }, 1.4, 0.8, 2.2, 0.6), {
    hl: ['legL', 'legR'],
    props: [COUNTER],
    views: VIEW.stand,
  }),

  // Face a wall, hands on it, one foot behind; back heel down, back knee straight; lean forward; hold.
  anim(
    'ankle-calf-stretch',
    {
      p: [0, 0.86, -0.05],
      j: { spine: x(6) },
      ik: {
        legL: { at: [0.095, 0.08, -0.3], foot: [0, 0, 0] },
        legR: { at: [-0.095, 0.08, 0.25], foot: [0, 0, 0] },
        armL: { at: [0.2, 1.28, 0.5], pole: [0.4, -1, -0.2] },
        armR: { at: [-0.2, 1.28, 0.5], pole: [-0.4, -1, -0.2] },
      },
    },
    [
      [{ p: [0, 0.84, 0.06], j: { spine: x(10) } }, 1.8, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['legL'], props: [{ kind: 'wall', at: [0, 1.05, 0.62] }], views: VIEW.standBehind },
  ),

  // Sit with a band around the forefoot, anchored to the inside; turn the foot outward; return slowly.
  anim('ankle-band-eversion', merge(FOOT_UP(70), { j: { ankleL: [0, -8, 0] } }), rep({ j: { ankleL: [0, 26, 0] } }, 1.2, 0.6, 1.8, 0.6), {
    hl: ['legL'],
    props: [CHAIR],
    held: [{ kind: 'band', from: [-0.5, 0.1, 0.66], to: 'ankleL', offset: [0, -0.04, 0.12] }],
    views: FOOT_VIEW,
    startView: 'front',
  }),

  // Stand next to a counter; lift one foot and balance.
  anim(
    'ankle-single-leg-balance',
    STAND,
    [
      [{ j: { hipR: x(-35), kneeR: x(70) } }, 1.2, 5.5],
      [{}, 1.2, 0.8],
    ],
    { hl: ['legL'], props: [COUNTER], views: VIEW.stand },
  ),

  // Sit with the leg straight, band around the top of the foot, anchored in front; pull the foot up; return slowly.
  anim('ankle-band-dorsiflexion', merge(LONG_SIT, { j: { ankleL: x(14) } }), rep({ j: { ankleL: x(-20) } }, 1.2, 0.6, 1.8, 0.6), {
    hl: ['legL'],
    props: [MAT],
    held: [{ kind: 'band', from: [0.095, 0.2, 1.5], to: 'ankleL', offset: [0, -0.02, 0.12] }],
    views: cam([0, 0.3, 0.45], 2.8),
  }),

  // Sit with a band around the forefoot, anchored to the outside; turn the foot inward; return slowly.
  anim('ankle-band-inversion', merge(FOOT_UP(70), { j: { ankleL: [0, 8, 0] } }), rep({ j: { ankleL: [0, -26, 0] } }, 1.2, 0.6, 1.8, 0.6), {
    hl: ['legL'],
    props: [CHAIR],
    held: [{ kind: 'band', from: [0.7, 0.1, 0.66], to: 'ankleL', offset: [0, -0.04, 0.12] }],
    views: FOOT_VIEW,
    startView: 'front',
  }),

  // Sit tall on a chair, feet flat; lift both heels, toes on the floor; lower slowly.
  anim(
    'ankle-seated-heel-raise',
    SIT,
    rep({ ik: { legL: { at: [0.095, 0.135, 0.44], foot: [35, 0, 0] }, legR: { at: [-0.095, 0.135, 0.44], foot: [35, 0, 0] } } }, 1.2, 0.6, 1.8, 0.6),
    { hl: ['legL', 'legR'], props: [CHAIR], views: cam([0, 0.4, 0.3], 3, [0.12, 0.3]) },
  ),
];
