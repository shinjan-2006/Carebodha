-- CreateIndex
CREATE INDEX "TeachBackFinding_attemptId_idx" ON "TeachBackFinding"("attemptId");

-- AddForeignKey
ALTER TABLE "TeachBackFinding" ADD CONSTRAINT "TeachBackFinding_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "CareInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachBackFinding" ADD CONSTRAINT "TeachBackFinding_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "CarePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
