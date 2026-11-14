-- Plan deletion (and account deletion, which cascades to plans) must remove tasks, versions,
-- items and completions together. RESTRICT is checked immediately during the cascade chain;
-- NO ACTION still forbids orphans but is checked at the end of the statement.
-- DropForeignKey
ALTER TABLE "PlanVersionItem" DROP CONSTRAINT "PlanVersionItem_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCompletion" DROP CONSTRAINT "TaskCompletion_planVersionItemId_fkey";

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_planVersionItemId_fkey" FOREIGN KEY ("planVersionItemId") REFERENCES "PlanVersionItem"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersionItem" ADD CONSTRAINT "PlanVersionItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RehabTask"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

