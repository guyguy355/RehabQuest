/**
 * Neck exercises of the starter catalog. Each movement follows the written instructions of its
 * catalog entry (server/src/data/exercise-catalog.ts) and nothing more.
 *
 * NOT CLINICALLY REVIEWED. Ranges, tempo and posture are illustrative choices made by a developer.
 * A physiotherapist must check each movement before that exercise's demoReviewStatus is set to APPROVED.
 */
import type { ProceduralAnimation } from '../types';
import { anim, CHAIR, type Key, merge, mirror, path, rep, sides, SIT, VIEW, x } from './build';

/** Sitting, the left hand holding the chair seat. */
const HOLDING_SEAT: Key = merge(SIT, { ik: { armL: { at: [0.26, 0.47, -0.05], pole: [0.3, 0, -1] } } });
/** Sitting with both hands in the lap (so either hand can come up to the head). */
const HANDS_IN_LAP: Key = merge(SIT, { ik: { armL: { at: [0.12, 0.62, 0.25], pole: [1, -0.5, 0] }, armR: { at: [-0.12, 0.62, 0.25], pole: [-1, -0.5, 0] } } });
const HAND_ON_HEAD: Key = { ik: { armL: { at: [0.2, 1.17, 0.02] } } };
const PRESS: Key = merge(HAND_ON_HEAD, { j: { neck: [0, 0, -3] } });

export const neckAnimations: ProceduralAnimation[] = [
  // Sit tall; draw the chin straight back, making a "double chin"; hold 3 s.
  anim('neck-chin-tucks', SIT, rep({ j: { neck: x(-12), head: x(14) }, o: { head: [0, 0, -0.03] } }, 1, 3, 1, 0.8), { props: [CHAIR], views: VIEW.head }),

  // Sit tall; slowly turn the head to look over one shoulder; back to the middle; then the other side.
  anim('neck-rotation', SIT, sides({ j: { head: [0, 60, 0] } }, 1.6, 0.6, 1.4, 0.4), { props: [CHAIR], views: VIEW.head, startView: 'front' }),

  // Sit tall, shoulders relaxed; tilt the ear toward the shoulder; hold a few breaths; switch sides.
  anim('neck-side-bend', SIT, sides({ j: { neck: [0, 0, -14], head: [0, 0, -16] } }, 1.6, 3, 1.6, 0.5), { props: [CHAIR], views: VIEW.head, startView: 'front' }),

  // Sit holding the chair seat with one hand; tilt the head away from that side and look slightly down; hold.
  anim(
    'neck-upper-trap-stretch',
    HOLDING_SEAT,
    [
      [{ j: { neck: [8, 0, 14], head: [10, 0, 14] } }, 1.6, 4.5],
      [{}, 1.6, 0.8],
    ],
    { hl: ['armL'], props: [CHAIR], views: VIEW.head, startView: 'front' },
  ),

  // Sit or stand tall; roll the shoulders up, back and down in slow circles.
  path(
    'neck-shoulder-rolls',
    SIT,
    6.4,
    (time) => {
      const turn = (2 * Math.PI * time) / 3.2;
      const shift: [number, number, number] = [0, 0.035 * Math.sin(turn), 0.03 * Math.cos(turn)];
      return { o: { shoulderL: shift, shoulderR: shift } };
    },
    { hl: ['armL', 'armR'], props: [CHAIR], views: VIEW.head },
  ),

  // Sit tall, a hand on the side of the head; press the head gently into the hand without moving; hold 5 s; switch sides.
  anim(
    'neck-isometric-side-press',
    HANDS_IN_LAP,
    [
      [HAND_ON_HEAD, 1.4, 0.2],
      [PRESS, 0.5, 5],
      [{}, 1.4, 0.5],
      [mirror(HAND_ON_HEAD), 1.4, 0.2],
      [mirror(PRESS), 0.5, 5],
      [{}, 1.4, 0.5],
    ],
    { props: [CHAIR], views: VIEW.head, startView: 'front', poster: 1 },
  ),

  // Sit holding the chair seat with one hand; turn the head halfway to the other side and look down toward the armpit; hold.
  anim(
    'neck-levator-stretch',
    HOLDING_SEAT,
    [
      [{ j: { neck: [0, -40, 0], head: x(35) } }, 1.8, 4.5],
      [{}, 1.8, 0.8],
    ],
    { hl: ['armL'], props: [CHAIR], views: VIEW.head, startView: 'front' },
  ),

  // Sit tall; slowly lower the chin toward the chest; hold a few breaths; lift the head back up.
  anim(
    'neck-flexion-stretch',
    SIT,
    [
      [{ j: { neck: x(22), head: x(26) } }, 1.8, 3.5],
      [{}, 1.8, 0.8],
    ],
    { props: [CHAIR], views: VIEW.head },
  ),
];
