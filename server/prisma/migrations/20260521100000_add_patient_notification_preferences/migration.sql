CREATE TABLE "PatientNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyExerciseRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderTime" TEXT NOT NULL DEFAULT '09:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientNotificationPreference_userId_key" ON "PatientNotificationPreference"("userId");
CREATE INDEX "PatientNotificationPreference_userId_idx" ON "PatientNotificationPreference"("userId");

ALTER TABLE "PatientNotificationPreference"
ADD CONSTRAINT "PatientNotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
