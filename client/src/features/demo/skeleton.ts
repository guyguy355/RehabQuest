/** Proportions of the built-in figure in metres (about 1.7 m tall). Shared by the rig and the animations. */
export const SKELETON = {
  thigh: 0.42,
  shin: 0.42,
  hipHalfWidth: 0.095,
  torso: 0.48,
  /** Height of the mid-back joint above the pelvis. */
  waist: 0.24,
  /** Height of the ankle joint above the sole. */
  ankle: 0.08,
  shoulderHalfWidth: 0.2,
  upperArm: 0.28,
  forearm: 0.25,
  headRadius: 0.105,
  /** Distance from the pelvis centre to the back surface: the pelvis height when lying on the back. */
  backDepth: 0.095,
} as const;

/** Top surface of the exercise mat above the floor. */
export const MAT_TOP = 0.03;

/** Smooth start and stop for a movement phase, 0..1 → 0..1. */
export const easeInOut = (progress: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, progress)));
