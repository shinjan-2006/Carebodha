ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT, ADD COLUMN "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
ALTER TABLE "PatientProfile" ADD COLUMN "smsReminders" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reminder" ADD COLUMN "smsRequested" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "smsStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED', ADD COLUMN "smsProviderId" TEXT;
