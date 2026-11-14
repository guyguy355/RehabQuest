-- Stage 1: plan versions, templates, pauses, audit trail (additive).
-- Generated DDL followed by an explicit backfill that preserves history.

-- CreateEnum
CREATE TYPE "OutcomeReason" AS ENUM ('PAIN_OR_DISCOMFORT', 'TIRED', 'NO_TIME', 'FORGOT', 'NO_EQUIPMENT', 'UNSURE_HOW', 'OTHER');

-- CreateEnum
CREATE TYPE "CompletionSource" AS ENUM ('ONLINE', 'OFFLINE_SYNC');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.



-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.



-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "mediaAlt" TEXT;

-- AlterTable
ALTER TABLE "RehabPlan" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TaskCompletion" ADD COLUMN     "activeSeconds" INTEGER,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "occurredAt" TIMESTAMP(3),
ADD COLUMN     "planVersionItemId" TEXT,
ADD COLUMN     "prescribedHoldSecs" INTEGER,
ADD COLUMN     "prescribedRestSecs" INTEGER,
ADD COLUMN     "reason" "OutcomeReason",
ADD COLUMN     "repsPerSet" INTEGER[],
ADD COLUMN     "setsCompleted" INTEGER,
ADD COLUMN     "source" "CompletionSource" NOT NULL DEFAULT 'ONLINE',
ALTER COLUMN "painLevel" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProgramTemplate" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "description" TEXT,
    "trainingWeekdays" INTEGER[],
    "durationWeeks" INTEGER NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "holdSeconds" INTEGER,
    "restSeconds" INTEGER,
    "durationSeconds" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ProgramTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" INTEGER,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "therapistNotes" TEXT,
    "trainingWeekdays" INTEGER[],
    "restDates" DATE[],
    "effectiveFrom" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "changeNote" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "templateId" TEXT,
    "basedOnVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersionItem" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "taskId" TEXT,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "holdSeconds" INTEGER,
    "restSeconds" INTEGER,
    "durationSeconds" INTEGER NOT NULL,
    "notes" TEXT,
    "exerciseTitle" TEXT NOT NULL,
    "exerciseDescription" TEXT NOT NULL,
    "instructions" TEXT,
    "safetyNotes" TEXT,
    "bodyPart" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "videoUrl" TEXT,
    "imageUrl" TEXT,
    "mediaAlt" TEXT,

    CONSTRAINT "PlanVersionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPause" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "patientId" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramTemplate_therapistId_idx" ON "ProgramTemplate"("therapistId");

-- CreateIndex
CREATE INDEX "ProgramTemplateItem_templateId_idx" ON "ProgramTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "PlanVersion_planId_status_idx" ON "PlanVersion"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_number_key" ON "PlanVersion"("planId", "number");

-- CreateIndex
CREATE INDEX "PlanVersionItem_versionId_idx" ON "PlanVersionItem"("versionId");

-- CreateIndex
CREATE INDEX "PlanVersionItem_taskId_idx" ON "PlanVersionItem"("taskId");

-- CreateIndex
CREATE INDEX "PlanPause_planId_idx" ON "PlanPause"("planId");

-- CreateIndex
CREATE INDEX "AuditEvent_patientId_createdAt_idx" ON "AuditEvent"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_idempotencyKey_key" ON "TaskCompletion"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_planVersionItemId_fkey" FOREIGN KEY ("planVersionItemId") REFERENCES "PlanVersionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplate" ADD CONSTRAINT "ProgramTemplate_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplateItem" ADD CONSTRAINT "ProgramTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplateItem" ADD CONSTRAINT "ProgramTemplateItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RehabPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersionItem" ADD CONSTRAINT "PlanVersionItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersionItem" ADD CONSTRAINT "PlanVersionItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RehabTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersionItem" ADD CONSTRAINT "PlanVersionItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPause" ADD CONSTRAINT "PlanPause_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RehabPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPause" ADD CONSTRAINT "PlanPause_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
-- At most one open draft per plan.
CREATE UNIQUE INDEX "PlanVersion_one_draft_per_plan" ON "PlanVersion"("planId") WHERE "status" = 'DRAFT';
-- Published versions always have a number.
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_published_number_check" CHECK ("status" <> 'PUBLISHED' OR "number" IS NOT NULL);
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_dates_check" CHECK ("endDate" >= "effectiveFrom");
ALTER TABLE "PlanVersionItem" ADD CONSTRAINT "PlanVersionItem_positive_check" CHECK ("sets" > 0 AND "reps" > 0 AND "durationSeconds" > 0 AND COALESCE("holdSeconds", 0) >= 0 AND COALESCE("restSeconds", 0) >= 0);
ALTER TABLE "ProgramTemplateItem" ADD CONSTRAINT "ProgramTemplateItem_positive_check" CHECK ("sets" > 0 AND "reps" > 0 AND "durationSeconds" > 0);
ALTER TABLE "PlanPause" ADD CONSTRAINT "PlanPause_dates_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

-- ---------------------------------------------------------------------------
-- Backfill: one published version per period in which the set of active tasks
-- was constant. Period boundaries are the plan start and every task activeFrom /
-- activeUntil + 1 inside the plan. This reproduces what each patient was
-- prescribed on each past date. (Earlier parameter edits were made in place, so
-- backfilled versions carry the parameters stored at migration time; completions
-- keep their own prescribed snapshot.)
-- ---------------------------------------------------------------------------
WITH bounds AS (
  SELECT p."id" AS plan_id, p."startDate" AS d FROM "RehabPlan" p
  UNION
  SELECT t."planId", t."activeFrom"
  FROM "RehabTask" t JOIN "RehabPlan" p ON p."id" = t."planId"
  WHERE t."activeFrom" > p."startDate" AND t."activeFrom" <= p."endDate"
  UNION
  SELECT t."planId", t."activeUntil" + 1
  FROM "RehabTask" t JOIN "RehabPlan" p ON p."id" = t."planId"
  WHERE t."activeUntil" IS NOT NULL AND t."activeUntil" + 1 > p."startDate" AND t."activeUntil" + 1 <= p."endDate"
),
numbered AS (
  SELECT plan_id, d, row_number() OVER (PARTITION BY plan_id ORDER BY d) AS n FROM bounds
)
INSERT INTO "PlanVersion" ("id", "planId", "number", "status", "title", "condition", "therapistNotes", "trainingWeekdays",
  "restDates", "effectiveFrom", "endDate", "changeNote", "createdById", "publishedById", "publishedAt", "createdAt", "updatedAt")
SELECT 'pv' || substr(md5(numbered.plan_id || numbered.d::text), 1, 23), numbered.plan_id, numbered.n, 'PUBLISHED', p."title", p."condition",
  p."therapistNotes", p."trainingWeekdays", '{}', numbered.d, p."endDate", 'Created from existing plan data during upgrade',
  p."therapistId", p."therapistId", p."createdAt", p."createdAt", CURRENT_TIMESTAMP
FROM numbered JOIN "RehabPlan" p ON p."id" = numbered.plan_id;

INSERT INTO "PlanVersionItem" ("id", "versionId", "taskId", "exerciseId", "orderIndex", "sets", "reps", "holdSeconds", "restSeconds",
  "durationSeconds", "notes", "exerciseTitle", "exerciseDescription", "instructions", "safetyNotes", "bodyPart", "difficulty",
  "videoUrl", "imageUrl", "mediaAlt")
SELECT 'pi' || substr(md5(v."id" || t."id"), 1, 23), v."id", t."id", t."exerciseId", t."orderIndex", t."sets", t."reps", NULL, NULL,
  t."durationSeconds", t."notes", e."title", e."description", e."instructions", e."safetyNotes", e."bodyPart", e."difficulty",
  e."videoUrl", e."imageUrl", NULL
FROM "PlanVersion" v
JOIN "RehabTask" t ON t."planId" = v."planId"
  AND t."activeFrom" <= v."effectiveFrom"
  AND (t."activeUntil" IS NULL OR t."activeUntil" >= v."effectiveFrom")
JOIN "Exercise" e ON e."id" = t."exerciseId";

-- Bind each existing completion to the item that was prescribed on its date.
UPDATE "TaskCompletion" c
SET "planVersionItemId" = i."id"
FROM "RehabTask" t, "PlanVersionItem" i
WHERE t."id" = c."taskId"
  AND i."taskId" = c."taskId"
  AND i."versionId" = (
    SELECT v2."id" FROM "PlanVersion" v2
    WHERE v2."planId" = t."planId" AND v2."status" = 'PUBLISHED' AND v2."effectiveFrom" <= c."sessionDate"
    ORDER BY v2."effectiveFrom" DESC, v2."number" DESC
    LIMIT 1
  );

-- Plans that are paused today have no recorded pause start; record an open pause from
-- the day of their last update (best available information).
INSERT INTO "PlanPause" ("id", "planId", "startDate", "endDate", "reason", "createdById", "createdAt")
SELECT 'pp' || substr(md5(p."id"), 1, 23), p."id", (p."updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::date, NULL,
  'Recorded during upgrade (pause start date approximated)', p."therapistId", CURRENT_TIMESTAMP
FROM "RehabPlan" p WHERE p."status" = 'PAUSED';
