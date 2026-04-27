-- AlterTable: add new columns to Role (companyId nullable first, then we backfill and make required)
ALTER TABLE "Role" ADD COLUMN "description" TEXT;
ALTER TABLE "Role" ADD COLUMN "otpAllowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN "companyId" TEXT;

-- Drop old global unique on name
DROP INDEX IF EXISTS "Role_name_key";

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Make companyId NOT NULL (safe if Role table is empty in dev)
ALTER TABLE "Role" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex: unique per company
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");
