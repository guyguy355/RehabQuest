-- Optional animated 3D demonstration attached to an exercise (docs/EXERCISE_DEMOS.md).
-- Additive only: existing exercises, plans and completions are untouched.
CREATE TYPE "DemoAnimationType" AS ENUM ('PROCEDURAL', 'GLB');
CREATE TYPE "DemoReviewStatus" AS ENUM ('UNREVIEWED', 'APPROVED', 'REJECTED');

ALTER TABLE "Exercise"
  ADD COLUMN "demoType" "DemoAnimationType",
  ADD COLUMN "demoKey" TEXT,
  ADD COLUMN "demoReviewStatus" "DemoReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN "demoModelUrl" TEXT,
  ADD COLUMN "demoClipName" TEXT;

-- Library copies of the starter-catalog "Heel slides" entry get the first demonstration.
-- It stays UNREVIEWED (hidden from normal patient screens) until a physiotherapist approves it.
UPDATE "Exercise" SET "demoType" = 'PROCEDURAL', "demoKey" = 'heel-slides' WHERE "catalogKey" = 'knee-heel-slides';
