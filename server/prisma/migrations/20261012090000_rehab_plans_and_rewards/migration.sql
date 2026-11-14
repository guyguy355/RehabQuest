-- RehabQuest: consolidate on therapist-approved plans, idempotent completions,
-- an XP ledger, achievements and an AI-summary audit log.
--
-- Data handling:
--   * RehabPlan / RehabTask / TaskCompletion rows are preserved. Their patient
--     references move from PatientProfile.id to User.id.
--   * Existing password reset tokens are preserved by hashing them in place.
--   * The legacy ad-hoc "PatientExercise" assignments and the redundant
--     "PatientProfile" table are dropped (superseded by plans). Old badge
--     definitions are replaced by the new achievement set.

-- Enums ---------------------------------------------------------------------
CREATE TYPE "CompletionStatus" AS ENUM ('COMPLETED', 'STOPPED');
CREATE TYPE "DifficultyRating" AS ENUM ('TOO_EASY', 'JUST_RIGHT', 'TOO_HARD');
CREATE TYPE "XpReason" AS ENUM ('TASK_COMPLETED', 'SESSION_COMPLETED');
CREATE TYPE "SummarySource" AS ENUM ('MODEL', 'RULE_BASED');

-- User ----------------------------------------------------------------------
ALTER TABLE "User"
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  ADD COLUMN "careCode" TEXT;
UPDATE "User" SET "careCode" = upper(substr(encode(sha256(convert_to(gen_random_uuid()::text || "id", 'UTF8')), 'hex'), 1, 8))
WHERE "role" = 'PATIENT';
CREATE UNIQUE INDEX "User_careCode_key" ON "User"("careCode");

-- Exercise ------------------------------------------------------------------
ALTER TABLE "Exercise"
  ADD COLUMN "instructions" TEXT,
  ADD COLUMN "safetyNotes" TEXT;

-- PasswordResetToken: store only a SHA-256 hash ------------------------------
DROP INDEX "PasswordResetToken_token_key";
ALTER TABLE "PasswordResetToken" ADD COLUMN "tokenHash" TEXT;
UPDATE "PasswordResetToken" SET "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
ALTER TABLE "PasswordResetToken" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "PasswordResetToken" DROP COLUMN "token";
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- RehabPlan: reference User directly, add schedule ---------------------------
ALTER TABLE "RehabPlan" DROP CONSTRAINT "RehabPlan_patientId_fkey";
ALTER TABLE "RehabPlan" DROP CONSTRAINT "RehabPlan_physioId_fkey";
DROP INDEX "RehabPlan_physioId_idx";

UPDATE "RehabPlan" p
SET "patientId" = pp."userId"
FROM "PatientProfile" pp
WHERE pp."id" = p."patientId";

ALTER TABLE "RehabPlan" RENAME COLUMN "physioId" TO "therapistId";
ALTER TABLE "RehabPlan" RENAME COLUMN "injuryType" TO "condition";
ALTER TABLE "RehabPlan"
  ADD COLUMN "therapistNotes" TEXT,
  ADD COLUMN "trainingWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  ALTER COLUMN "startDate" SET DATA TYPE DATE,
  ALTER COLUMN "endDate" SET DATA TYPE DATE;
ALTER TABLE "RehabPlan" ALTER COLUMN "trainingWeekdays" DROP DEFAULT;

-- Only one ACTIVE plan per patient may exist at a time. If legacy data has
-- several, keep the newest one active and pause the rest.
UPDATE "RehabPlan" p SET "status" = 'PAUSED'
WHERE p."status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM "RehabPlan" newer
    WHERE newer."patientId" = p."patientId"
      AND newer."status" = 'ACTIVE'
      AND (newer."createdAt", newer."id") > (p."createdAt", p."id")
  );
CREATE UNIQUE INDEX "RehabPlan_one_active_per_patient" ON "RehabPlan"("patientId") WHERE "status" = 'ACTIVE';
ALTER TABLE "RehabPlan" ADD CONSTRAINT "RehabPlan_dates_check" CHECK ("endDate" >= "startDate");

CREATE INDEX "RehabPlan_therapistId_idx" ON "RehabPlan"("therapistId");
ALTER TABLE "RehabPlan" ADD CONSTRAINT "RehabPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RehabPlan" ADD CONSTRAINT "RehabPlan_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RehabTask: same tasks on every training day, with an active window ---------
ALTER TABLE "RehabTask"
  ADD COLUMN "activeFrom" DATE,
  ADD COLUMN "activeUntil" DATE,
  ADD COLUMN "notes" TEXT;
UPDATE "RehabTask" t SET "activeFrom" = p."startDate" FROM "RehabPlan" p WHERE p."id" = t."planId";
ALTER TABLE "RehabTask" ALTER COLUMN "activeFrom" SET NOT NULL;
ALTER TABLE "RehabTask" DROP COLUMN "dayNumber";
ALTER TABLE "RehabTask" ADD CONSTRAINT "RehabTask_positive_check" CHECK ("sets" > 0 AND "reps" > 0 AND "durationSeconds" > 0);

-- TaskCompletion: one per task per patient-local day -------------------------
ALTER TABLE "TaskCompletion" DROP CONSTRAINT "TaskCompletion_patientId_fkey";
DROP INDEX "TaskCompletion_patientId_idx";
DROP INDEX "TaskCompletion_taskId_idx";

UPDATE "TaskCompletion" c
SET "patientId" = pp."userId"
FROM "PatientProfile" pp
WHERE pp."id" = c."patientId";

ALTER TABLE "TaskCompletion"
  ADD COLUMN "difficulty" "DifficultyRating",
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "prescribedDurationSecs" INTEGER,
  ADD COLUMN "prescribedReps" INTEGER,
  ADD COLUMN "prescribedSets" INTEGER,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "sessionDate" DATE,
  ADD COLUMN "status" "CompletionStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "xpAwarded" INTEGER NOT NULL DEFAULT 0;

UPDATE "TaskCompletion" c
SET "sessionDate" = (c."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::date,
    "prescribedSets" = t."sets",
    "prescribedReps" = t."reps",
    "prescribedDurationSecs" = t."durationSeconds",
    "needsReview" = c."painLevel" >= 7
FROM "RehabTask" t
WHERE t."id" = c."taskId";

-- Legacy data could contain several completions of a task on one day; keep the earliest.
DELETE FROM "TaskCompletion" c
USING "TaskCompletion" earlier
WHERE earlier."taskId" = c."taskId"
  AND earlier."sessionDate" = c."sessionDate"
  AND (earlier."completedAt", earlier."id") < (c."completedAt", c."id");

ALTER TABLE "TaskCompletion"
  ALTER COLUMN "sessionDate" SET NOT NULL,
  ALTER COLUMN "prescribedSets" SET NOT NULL,
  ALTER COLUMN "prescribedReps" SET NOT NULL,
  ALTER COLUMN "prescribedDurationSecs" SET NOT NULL;
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_pain_check" CHECK ("painLevel" BETWEEN 0 AND 10);
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_xp_check" CHECK ("xpAwarded" >= 0);

CREATE UNIQUE INDEX "TaskCompletion_taskId_sessionDate_key" ON "TaskCompletion"("taskId", "sessionDate");
CREATE INDEX "TaskCompletion_patientId_sessionDate_idx" ON "TaskCompletion"("patientId", "sessionDate");
CREATE INDEX "TaskCompletion_needsReview_idx" ON "TaskCompletion"("needsReview");
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop superseded tables ------------------------------------------------------
DROP TABLE "PatientExercise";
DROP TYPE "PatientExerciseStatus";
DROP TABLE "PatientProfile";

-- XP ledger -----------------------------------------------------------------
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "XpReason" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "XpEvent_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "XpEvent_sourceKey_key" ON "XpEvent"("sourceKey");
CREATE INDEX "XpEvent_userId_sessionDate_idx" ON "XpEvent"("userId", "sessionDate");
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Achievements --------------------------------------------------------------
DELETE FROM "Badge";
ALTER TABLE "Badge" DROP COLUMN "conditionType";
INSERT INTO "Badge" ("id", "name", "description", "icon") VALUES
  ('first-session', 'First Step', 'Finished your first planned session.', 'footprints'),
  ('steady-three', 'Steady Rhythm', 'Finished 3 planned sessions in a row. Rest days never break the rhythm.', 'waves'),
  ('full-week', 'Full Week', 'Finished every planned session in one plan week.', 'calendar-check'),
  ('halfway', 'Halfway There', 'Finished half of the planned sessions in a plan.', 'flag'),
  ('plan-complete', 'Plan Finisher', 'Finished the last planned session of a plan.', 'trophy');

-- AI summary audit log ------------------------------------------------------
CREATE TABLE "AiSummaryRequest" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "source" "SummarySource" NOT NULL,
    "fallbackReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSummaryRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiSummaryRequest_therapistId_createdAt_idx" ON "AiSummaryRequest"("therapistId", "createdAt");
ALTER TABLE "AiSummaryRequest" ADD CONSTRAINT "AiSummaryRequest_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSummaryRequest" ADD CONSTRAINT "AiSummaryRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
