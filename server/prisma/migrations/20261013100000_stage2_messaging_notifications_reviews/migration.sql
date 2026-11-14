-- Stage 2: contextual messaging, care-link end, notifications + outbox, review workspace (additive).

-- CreateEnum
CREATE TYPE "MessageContextType" AS ENUM ('TASK', 'COMPLETION', 'PLAN', 'REVIEW_ITEM');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('REMINDER', 'MESSAGE', 'REVIEW', 'PLAN', 'CARE');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'SUPPRESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'WEB_PUSH', 'DEV_LOG');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'ACCEPTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('FEEDBACK', 'STOPPED', 'UNANSWERED_MESSAGE', 'MISSED_ACTIVITY');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- DropIndex
DROP INDEX "Message_receiverId_idx";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "clientMessageId" TEXT,
ADD COLUMN     "contextId" TEXT,
ADD COLUMN     "contextType" "MessageContextType",
ADD COLUMN     "readAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PatientNotificationPreference" ADD COLUMN     "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quietHoursEnd" TEXT,
ADD COLUMN     "quietHoursStart" TEXT,
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TherapistPatient" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "endedById" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAcceptedAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB,
    "status" "OutboxStatus" NOT NULL DEFAULT 'QUEUED',
    "runAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "result" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "notificationId" TEXT,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" "ReviewKind" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "reasons" TEXT[],
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "firstEventAt" TIMESTAMP(3) NOT NULL,
    "lastEventAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSettings" (
    "therapistId" TEXT NOT NULL,
    "painThreshold" INTEGER NOT NULL DEFAULT 7,
    "flagTooHard" BOOLEAN NOT NULL DEFAULT true,
    "missedSessionsThreshold" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSettings_pkey" PRIMARY KEY ("therapistId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxJob_dedupeKey_key" ON "OutboxJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxJob_status_runAt_idx" ON "OutboxJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItem_dedupeKey_key" ON "ReviewItem"("dedupeKey");

-- CreateIndex
CREATE INDEX "ReviewItem_therapistId_status_lastEventAt_idx" ON "ReviewItem"("therapistId", "status", "lastEventAt");

-- CreateIndex
CREATE INDEX "ReviewItem_patientId_idx" ON "ReviewItem"("patientId");

-- CreateIndex
CREATE INDEX "Message_receiverId_readAt_idx" ON "Message"("receiverId", "readAt");

-- CreateIndex
CREATE INDEX "Message_senderId_receiverId_createdAt_idx" ON "Message"("senderId", "receiverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key" ON "Message"("senderId", "clientMessageId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxJob" ADD CONSTRAINT "OutboxJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OutboxJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSettings" ADD CONSTRAINT "ReviewSettings_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Messages sent before read tracking existed are treated as read (no false "unread" flood).
UPDATE "Message" SET "readAt" = "createdAt" WHERE "readAt" IS NULL;

-- Flagged exercise records become review items. Already reviewed records are resolved,
-- keeping the reviewer as the actor.
INSERT INTO "ReviewItem" ("id", "therapistId", "patientId", "kind", "sourceType", "sourceId", "dedupeKey", "reasons", "status",
  "resolvedAt", "resolvedById", "resolutionNote", "firstEventAt", "lastEventAt", "createdAt", "updatedAt")
SELECT 'ri' || substr(md5(c."id"), 1, 23), p."therapistId", c."patientId",
  CASE WHEN c."status" = 'STOPPED' OR (c."status" = 'SKIPPED' AND c."reason" = 'PAIN_OR_DISCOMFORT') THEN 'STOPPED'::"ReviewKind" ELSE 'FEEDBACK'::"ReviewKind" END,
  'COMPLETION', c."id", 'completion:' || c."id",
  array_remove(ARRAY[
    CASE WHEN c."status" = 'STOPPED' THEN 'Stopped because of discomfort' END,
    CASE WHEN c."status" = 'SKIPPED' AND c."reason" = 'PAIN_OR_DISCOMFORT' THEN 'Skipped because of pain or discomfort' END,
    CASE WHEN c."painLevel" >= 7 THEN 'Pain ' || c."painLevel" || '/10 is at or above the review threshold (7)' END,
    CASE WHEN c."difficulty" = 'TOO_HARD' THEN 'Reported as too hard' END
  ], NULL),
  CASE WHEN c."reviewedAt" IS NOT NULL THEN 'RESOLVED'::"ReviewStatus" ELSE 'OPEN'::"ReviewStatus" END,
  c."reviewedAt", c."reviewedById",
  CASE WHEN c."reviewedAt" IS NOT NULL THEN 'Marked reviewed before the review workspace existed' END,
  c."completedAt", c."completedAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "TaskCompletion" c
JOIN "RehabTask" t ON t."id" = c."taskId"
JOIN "RehabPlan" p ON p."id" = t."planId"
WHERE c."needsReview" = true;

ALTER TABLE "ReviewSettings" ADD CONSTRAINT "ReviewSettings_ranges_check" CHECK ("painThreshold" BETWEEN 1 AND 10 AND "missedSessionsThreshold" BETWEEN 1 AND 14);
ALTER TABLE "OutboxJob" ADD CONSTRAINT "OutboxJob_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" >= 1);
