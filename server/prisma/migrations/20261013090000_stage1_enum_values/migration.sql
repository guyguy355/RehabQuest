-- Stage 1: new enum values. Kept in its own migration because PostgreSQL only allows
-- a new enum value to be used after the statement that adds it has been committed.
ALTER TYPE "CompletionStatus" ADD VALUE 'PARTIAL';
ALTER TYPE "CompletionStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "PlanStatus" ADD VALUE 'DRAFT';
ALTER TYPE "PlanStatus" ADD VALUE 'ARCHIVED';
