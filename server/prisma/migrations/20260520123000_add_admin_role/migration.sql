UPDATE "User" SET "role" = 'THERAPIST' WHERE "role" = 'PHYSIO';

CREATE TYPE "Role_new" AS ENUM ('PATIENT', 'THERAPIST', 'ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
