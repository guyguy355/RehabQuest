-- Add therapist role for therapist-patient linking.
ALTER TYPE "Role" ADD VALUE 'THERAPIST';

-- CreateTable
CREATE TABLE "TherapistPatient" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapistPatient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TherapistPatient_therapistId_idx" ON "TherapistPatient"("therapistId");

-- CreateIndex
CREATE INDEX "TherapistPatient_patientId_idx" ON "TherapistPatient"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "TherapistPatient_therapistId_patientId_key" ON "TherapistPatient"("therapistId", "patientId");

-- AddForeignKey
ALTER TABLE "TherapistPatient" ADD CONSTRAINT "TherapistPatient_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistPatient" ADD CONSTRAINT "TherapistPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
