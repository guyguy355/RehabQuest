-- Correct delete rules for plan/account deletion (the previous NO ACTION change was not enough:
-- PostgreSQL checks it at the end of each nested cascade statement).
-- * A version item is removed together with its task slot (both only disappear with the plan).
-- * A completion never disappears because an item is removed: its item link is set to NULL.
-- DropForeignKey
ALTER TABLE "PlanVersionItem" DROP CONSTRAINT "PlanVersionItem_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCompletion" DROP CONSTRAINT "TaskCompletion_planVersionItemId_fkey";

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_planVersionItemId_fkey" FOREIGN KEY ("planVersionItemId") REFERENCES "PlanVersionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersionItem" ADD CONSTRAINT "PlanVersionItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RehabTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

