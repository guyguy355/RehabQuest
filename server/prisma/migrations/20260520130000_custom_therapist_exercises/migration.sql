ALTER TABLE "Exercise" RENAME COLUMN "name" TO "title";
ALTER TABLE "Exercise" RENAME COLUMN "targetArea" TO "bodyPart";
ALTER TABLE "Exercise" RENAME COLUMN "defaultSets" TO "sets";
ALTER TABLE "Exercise" RENAME COLUMN "defaultReps" TO "reps";
ALTER TABLE "Exercise" RENAME COLUMN "defaultDurationSeconds" TO "durationSeconds";

ALTER TABLE "Exercise" DROP COLUMN "instructions";
ALTER TABLE "Exercise" DROP COLUMN "safetyNotes";
ALTER TABLE "Exercise" ADD COLUMN "createdById" TEXT;

DO $$
DECLARE
    therapist_id TEXT;
BEGIN
    SELECT "id" INTO therapist_id FROM "User" WHERE "role" = 'THERAPIST' LIMIT 1;

    IF therapist_id IS NULL AND EXISTS (SELECT 1 FROM "Exercise" LIMIT 1) THEN
        INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt")
        VALUES ('seed_therapist_exercise_owner', 'Exercise Library Therapist', 'exercise-owner@rehabquest.com', 'seed-only', 'THERAPIST', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("email") DO UPDATE SET "role" = 'THERAPIST'
        RETURNING "id" INTO therapist_id;
    END IF;

    IF therapist_id IS NOT NULL THEN
        UPDATE "Exercise" SET "createdById" = therapist_id WHERE "createdById" IS NULL;
    END IF;
END $$;

ALTER TABLE "Exercise" ALTER COLUMN "createdById" SET NOT NULL;

CREATE INDEX "Exercise_createdById_idx" ON "Exercise"("createdById");

ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
