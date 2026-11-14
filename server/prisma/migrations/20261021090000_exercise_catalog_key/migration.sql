-- Exercises copied from the built-in starter catalog remember which catalog entry they came from.
ALTER TABLE "Exercise" ADD COLUMN "catalogKey" TEXT;

-- One copy of each catalog entry per therapist (NULLs, i.e. custom exercises, are not constrained).
CREATE UNIQUE INDEX "Exercise_createdById_catalogKey_key" ON "Exercise"("createdById", "catalogKey");
