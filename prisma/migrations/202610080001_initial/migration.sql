-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "dataMode" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "largeText" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianPatientAssignment" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicianPatientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT,
    "sourceText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "kind" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dataMode" TEXT NOT NULL,
    "approvedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "documentId" TEXT,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "CarePlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareInstruction" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "medicationName" TEXT,
    "dose" TEXT,
    "unit" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "timing" TEXT,
    "duration" TEXT,
    "followUpAt" TIMESTAMP(3),
    "sourcePassage" TEXT NOT NULL,
    "sourceLocation" TEXT,
    "reviewState" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceUnclear" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CareInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructionExplanation" (
    "id" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceFields" TEXT[],
    "method" TEXT NOT NULL,

    CONSTRAINT "InstructionExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachBackAttempt" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "answeredById" TEXT NOT NULL,
    "personType" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL,
    "transcriptConfirmed" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachBackAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachBackFinding" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "approvedValue" TEXT NOT NULL,
    "statedValue" TEXT NOT NULL,
    "supportingQuote" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "clarification" TEXT NOT NULL,

    CONSTRAINT "TeachBackFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyInvitation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "permissions" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyAccessGrant" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "permissions" TEXT[],
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationRequest" (
    "id" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "respondedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ClarificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notifiedAt" TIMESTAMP(3),
    "reportedCompletedAt" TIMESTAMP(3),
    "reportedById" TEXT,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentGuard" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,

    CONSTRAINT "EnvironmentGuard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianPatientAssignment_clinicianId_patientId_key" ON "ClinicianPatientAssignment"("clinicianId", "patientId");

-- CreateIndex
CREATE INDEX "Document_patientId_createdAt_idx" ON "Document"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingJob_idempotencyKey_key" ON "ProcessingJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_runAt_leaseUntil_idx" ON "ProcessingJob"("status", "runAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "CarePlan_approvedVersionId_key" ON "CarePlan"("approvedVersionId");

-- CreateIndex
CREATE INDEX "CarePlan_patientId_idx" ON "CarePlan"("patientId");

-- CreateIndex
CREATE INDEX "CarePlanVersion_status_idx" ON "CarePlanVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CarePlanVersion_planId_number_key" ON "CarePlanVersion"("planId", "number");

-- CreateIndex
CREATE INDEX "CareInstruction_versionId_reviewState_idx" ON "CareInstruction"("versionId", "reviewState");

-- CreateIndex
CREATE UNIQUE INDEX "InstructionExplanation_instructionId_language_key" ON "InstructionExplanation"("instructionId", "language");

-- CreateIndex
CREATE INDEX "TeachBackAttempt_instructionId_createdAt_idx" ON "TeachBackAttempt"("instructionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvitation_tokenHash_key" ON "FamilyInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "FamilyInvitation_patientId_idx" ON "FamilyInvitation"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyAccessGrant_patientId_familyId_key" ON "FamilyAccessGrant"("patientId", "familyId");

-- CreateIndex
CREATE INDEX "ClarificationRequest_status_createdAt_idx" ON "ClarificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Reminder_status_scheduledAt_idx" ON "Reminder"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_resourceId_createdAt_idx" ON "AuditEvent"("resourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianPatientAssignment" ADD CONSTRAINT "ClinicianPatientAssignment_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianPatientAssignment" ADD CONSTRAINT "ClinicianPatientAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "CarePlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlanVersion" ADD CONSTRAINT "CarePlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CarePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlanVersion" ADD CONSTRAINT "CarePlanVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareInstruction" ADD CONSTRAINT "CareInstruction_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CarePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructionExplanation" ADD CONSTRAINT "InstructionExplanation_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "CareInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CarePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachBackAttempt" ADD CONSTRAINT "TeachBackAttempt_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CarePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachBackAttempt" ADD CONSTRAINT "TeachBackAttempt_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "CareInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachBackAttempt" ADD CONSTRAINT "TeachBackAttempt_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachBackFinding" ADD CONSTRAINT "TeachBackFinding_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TeachBackAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAccessGrant" ADD CONSTRAINT "FamilyAccessGrant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAccessGrant" ADD CONSTRAINT "FamilyAccessGrant_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "CareInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "CareInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
