-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('HOURLY', 'SALARY', 'CASUAL', 'COMMISSION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "isKeyHolder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nickName" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payType" "PayType",
    "payRate" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "bankAccountName" TEXT,
    "bankBsb" TEXT,
    "bankAccountNumber" TEXT,
    "superFund" TEXT,
    "superMemberNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNextOfKin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNextOfKin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPay_userId_key" ON "UserPay"("userId");

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPay" ADD CONSTRAINT "UserPay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNextOfKin" ADD CONSTRAINT "UserNextOfKin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNote" ADD CONSTRAINT "UserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrompt" ADD CONSTRAINT "UserPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
