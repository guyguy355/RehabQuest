-- CreateEnum
CREATE TYPE "GoalKind" AS ENUM ('FUNCTIONAL', 'MEASUREMENT');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MeasurementDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');

-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('THERAPIST', 'PATIENT');

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "calmMode" BOOLEAN NOT NULL DEFAULT false,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklySessionGoal" INTEGER,
    "mascotCosmetic" TEXT NOT NULL DEFAULT 'classic',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MeasurementDefinition" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" "MeasurementDirection" NOT NULL,
    "minValue" DECIMAL(9,2) NOT NULL,
    "maxValue" DECIMAL(9,2) NOT NULL,
    "patientCanRecord" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasurementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "source" "MeasurementSource" NOT NULL,
    "value" DECIMAL(9,2) NOT NULL,
    "measuredOn" DATE NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "GoalKind" NOT NULL,
    "definitionId" TEXT,
    "baselineValue" DECIMAL(9,2),
    "targetValue" DECIMAL(9,2),
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "achievedAt" TIMESTAMP(3),
    "achievedById" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "targetDate" DATE,
    "achievedAt" TIMESTAMP(3),
    "achievedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyCheckIn" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "painTypical" INTEGER,
    "painWorst" INTEGER,
    "activityLimit" INTEGER,
    "confidence" INTEGER,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyGoalWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "goal" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "metAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyGoalWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationCard" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "latestVersion" INTEGER NOT NULL DEFAULT 1,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationCardVersion" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readingMinutes" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationCardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationAssignment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "taskId" TEXT,
    "note" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "EducationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationAcknowledgment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeasurementDefinition_patientId_idx" ON "MeasurementDefinition"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_idempotencyKey_key" ON "Measurement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Measurement_definitionId_measuredOn_idx" ON "Measurement"("definitionId", "measuredOn");

-- CreateIndex
CREATE INDEX "Measurement_patientId_measuredOn_idx" ON "Measurement"("patientId", "measuredOn");

-- CreateIndex
CREATE INDEX "Goal_patientId_status_idx" ON "Goal"("patientId", "status");

-- CreateIndex
CREATE INDEX "Milestone_goalId_idx" ON "Milestone"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheckIn_idempotencyKey_key" ON "WeeklyCheckIn"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheckIn_patientId_weekStart_key" ON "WeeklyCheckIn"("patientId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyGoalWeek_userId_weekStart_key" ON "WeeklyGoalWeek"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "EducationCard_ownerId_idx" ON "EducationCard"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "EducationCardVersion_cardId_number_key" ON "EducationCardVersion"("cardId", "number");

-- CreateIndex
CREATE INDEX "EducationAssignment_patientId_idx" ON "EducationAssignment"("patientId");

-- CreateIndex
CREATE INDEX "EducationAssignment_therapistId_idx" ON "EducationAssignment"("therapistId");

-- CreateIndex
CREATE UNIQUE INDEX "EducationAcknowledgment_assignmentId_versionId_key" ON "EducationAcknowledgment"("assignmentId", "versionId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementDefinition" ADD CONSTRAINT "MeasurementDefinition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementDefinition" ADD CONSTRAINT "MeasurementDefinition_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MeasurementDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MeasurementDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCheckIn" ADD CONSTRAINT "WeeklyCheckIn_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyGoalWeek" ADD CONSTRAINT "WeeklyGoalWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationCard" ADD CONSTRAINT "EducationCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationCardVersion" ADD CONSTRAINT "EducationCardVersion_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "EducationCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationCardVersion" ADD CONSTRAINT "EducationCardVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationAssignment" ADD CONSTRAINT "EducationAssignment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "EducationCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationAssignment" ADD CONSTRAINT "EducationAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationAssignment" ADD CONSTRAINT "EducationAssignment_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationAssignment" ADD CONSTRAINT "EducationAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RehabTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationAcknowledgment" ADD CONSTRAINT "EducationAcknowledgment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EducationAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationAcknowledgment" ADD CONSTRAINT "EducationAcknowledgment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EducationCardVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written additions (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- Value ranges. Missing answers are NULL, never 0.
ALTER TABLE "WeeklyCheckIn" ADD CONSTRAINT "WeeklyCheckIn_ranges_check" CHECK (
  ("painTypical" IS NULL OR "painTypical" BETWEEN 0 AND 10)
  AND ("painWorst" IS NULL OR "painWorst" BETWEEN 0 AND 10)
  AND ("painTypical" IS NULL OR "painWorst" IS NULL OR "painWorst" >= "painTypical")
  AND ("activityLimit" IS NULL OR "activityLimit" BETWEEN 0 AND 10)
  AND ("confidence" IS NULL OR "confidence" BETWEEN 1 AND 5)
);
-- Weeks start on Sunday (EXTRACT(DOW) = 0).
ALTER TABLE "WeeklyCheckIn" ADD CONSTRAINT "WeeklyCheckIn_weekStart_sunday_check" CHECK (EXTRACT(DOW FROM "weekStart") = 0);
ALTER TABLE "WeeklyGoalWeek" ADD CONSTRAINT "WeeklyGoalWeek_weekStart_sunday_check" CHECK (EXTRACT(DOW FROM "weekStart") = 0);
ALTER TABLE "WeeklyGoalWeek" ADD CONSTRAINT "WeeklyGoalWeek_values_check" CHECK ("goal" >= 1 AND "done" >= "goal");

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_weeklySessionGoal_check" CHECK ("weeklySessionGoal" IS NULL OR "weeklySessionGoal" BETWEEN 1 AND 7);

ALTER TABLE "MeasurementDefinition" ADD CONSTRAINT "MeasurementDefinition_range_check" CHECK ("minValue" < "maxValue");

-- A measurement goal needs a measurement and a target; a functional goal has neither.
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_kind_fields_check" CHECK (
  ("kind" = 'MEASUREMENT' AND "definitionId" IS NOT NULL AND "targetValue" IS NOT NULL)
  OR ("kind" = 'MEASUREMENT' AND "definitionId" IS NULL) -- the measurement was deleted later (ON DELETE SET NULL)
  OR ("kind" = 'FUNCTIONAL' AND "definitionId" IS NULL AND "targetValue" IS NULL AND "baselineValue" IS NULL)
);
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_achieved_check" CHECK (("status" = 'ACHIEVED') = ("achievedAt" IS NOT NULL));

ALTER TABLE "EducationCardVersion" ADD CONSTRAINT "EducationCardVersion_reading_check" CHECK ("readingMinutes" BETWEEN 1 AND 30);

-- One active assignment of a card per patient.
CREATE UNIQUE INDEX "EducationAssignment_active_card_patient_key" ON "EducationAssignment" ("cardId", "patientId") WHERE "removedAt" IS NULL;

-- New achievements (rules documented in docs/ACHIEVEMENTS.md and services/gamification.ts).
INSERT INTO "Badge" ("id", "name", "description", "icon") VALUES
  ('weekly-goal', 'Week Goal Met', 'Reached your weekly session goal in one week.', 'target'),
  ('weekly-goal-4', 'Four Good Weeks', 'Reached your weekly session goal in four different weeks.', 'calendar-heart'),
  ('welcome-back', 'Welcome Back', 'Finished a planned session after missing three or more planned sessions in a row.', 'sunrise'),
  ('first-check-in', 'Checked In', 'Sent your first weekly check-in.', 'clipboard-check'),
  ('check-in-4', 'Regular Check-ins', 'Sent weekly check-ins in four different weeks.', 'notebook-pen'),
  ('first-milestone', 'Milestone Reached', 'Your therapist confirmed your first milestone.', 'mountain')
ON CONFLICT ("id") DO NOTHING;
