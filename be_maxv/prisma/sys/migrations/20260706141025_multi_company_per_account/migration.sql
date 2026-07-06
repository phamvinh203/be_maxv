-- DropForeignKey
ALTER TABLE "invite_requests" DROP CONSTRAINT "invite_requests_donViId_fkey";

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_donViId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_donViId_fkey";

-- DropIndex
DROP INDEX "invite_requests_donViId_idx";

-- DropIndex
DROP INDEX "subscription_donViId_key";

-- DropIndex
DROP INDEX "subscription_history_donViId_idx";

-- DropIndex
DROP INDEX "users_donViId_idx";

-- AlterTable
ALTER TABLE "don_vi" ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "invite_requests" DROP COLUMN "donViId",
ADD COLUMN     "donViIds" TEXT[],
ADD COLUMN     "lyDoTuChoi" TEXT,
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subscription" DROP COLUMN "donViId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subscription_history" DROP COLUMN "donViId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "soMstToiDa" INTEGER;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "donViId",
ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "don_vi_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "donViId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "don_vi_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "don_vi_access_donViId_idx" ON "don_vi_access"("donViId");

-- CreateIndex
CREATE UNIQUE INDEX "don_vi_access_userId_donViId_key" ON "don_vi_access"("userId", "donViId");

-- CreateIndex
CREATE INDEX "don_vi_ownerId_idx" ON "don_vi"("ownerId");

-- CreateIndex
CREATE INDEX "invite_requests_ownerId_idx" ON "invite_requests"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_ownerId_key" ON "subscription"("ownerId");

-- CreateIndex
CREATE INDEX "subscription_history_ownerId_idx" ON "subscription_history"("ownerId");

-- CreateIndex
CREATE INDEX "users_ownerId_idx" ON "users"("ownerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "don_vi" ADD CONSTRAINT "don_vi_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "don_vi_access" ADD CONSTRAINT "don_vi_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "don_vi_access" ADD CONSTRAINT "don_vi_access_donViId_fkey" FOREIGN KEY ("donViId") REFERENCES "don_vi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
