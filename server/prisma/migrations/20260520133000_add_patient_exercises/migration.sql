CREATE TYPE "PatientExerciseStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'SKIPPED');

CREATE TABLE "PatientExercise" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "PatientExerciseStatus" NOT NULL DEFAULT 'ASSIGNED',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientExercise_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientExercise_patientId_idx" ON "PatientExercise"("patientId");
CREATE INDEX "PatientExercise_exerciseId_idx" ON "PatientExercise"("exerciseId");
CREATE INDEX "PatientExercise_assignedById_idx" ON "PatientExercise"("assignedById");

ALTER TABLE "PatientExercise" ADD CONSTRAINT "PatientExercise_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientExercise" ADD CONSTRAINT "PatientExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientExercise" ADD CONSTRAINT "PatientExercise_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
