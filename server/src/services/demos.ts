/**
 * Animated 3D exercise demonstrations (docs/EXERCISE_DEMOS.md).
 *
 * An exercise may point at one demonstration: a predefined animation in the client
 * registry (PROCEDURAL + demoKey) or a clip in a rigged model (GLB + demoModelUrl + demoClipName).
 *
 * Review gate: a demonstration reaches patient responses only when a physiotherapist has
 * APPROVED it. UNREVIEWED ones are sent only in preview mode (config.exerciseDemoPreview),
 * and the client labels them as unreviewed. REJECTED ones are never sent.
 */
import { DemoAnimationType, DemoReviewStatus, type Prisma } from '@prisma/client';
import { config } from '../config.js';
import { CATALOG_KEYS_WITH_DEMO } from '../data/demo-keys.js';

export const demoSelect = { demoType: true, demoKey: true, demoReviewStatus: true, demoModelUrl: true, demoClipName: true } satisfies Prisma.ExerciseSelect;
type DemoFields = Prisma.ExerciseGetPayload<{ select: typeof demoSelect }>;

/**
 * Demonstrations for starter-catalog entries, keyed by catalog key. Library copies of these
 * entries get the demonstration (still UNREVIEWED) when they are imported or seeded.
 * One animation per exercise: never point two different exercises at the same key.
 */
export const CATALOG_DEMOS: Readonly<Record<string, { demoType: DemoAnimationType; demoKey: string }>> = {
  ...Object.fromEntries(CATALOG_KEYS_WITH_DEMO.map((key) => [key, { demoType: DemoAnimationType.PROCEDURAL, demoKey: key }])),
  // The first demonstration predates the "demonstration key = catalog key" convention.
  'knee-heel-slides': { demoType: DemoAnimationType.PROCEDURAL, demoKey: 'heel-slides' },
};

/** The demonstration as the patient app receives it, or null when there is none to show. */
export function serializeDemo(exercise: DemoFields | null | undefined, preview = config.exerciseDemoPreview) {
  if (!exercise?.demoType || !exercise.demoKey) return null;
  if (exercise.demoType === DemoAnimationType.GLB && !exercise.demoModelUrl) return null;
  const visible = exercise.demoReviewStatus === DemoReviewStatus.APPROVED || (preview && exercise.demoReviewStatus === DemoReviewStatus.UNREVIEWED);
  if (!visible) return null;
  return {
    type: exercise.demoType,
    key: exercise.demoKey,
    reviewStatus: exercise.demoReviewStatus,
    modelUrl: exercise.demoModelUrl,
    clipName: exercise.demoClipName,
  };
}

export type DemoView = ReturnType<typeof serializeDemo>;
