-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OWNER', 'KE_TOAN_TRUONG', 'KE_TOAN', 'XEM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PROVISIONING', 'READY', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'KE_TOAN',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "donViId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "don_vi" (
    "id" TEXT NOT NULL,
    "maSoThue" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tenDonVi" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'PROVISIONING',
    "plan" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "dbName" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "don_vi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_donViId_idx" ON "users"("donViId");

-- CreateIndex
CREATE UNIQUE INDEX "don_vi_maSoThue_key" ON "don_vi"("maSoThue");

-- CreateIndex
CREATE UNIQUE INDEX "don_vi_slug_key" ON "don_vi"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "don_vi_dbName_key" ON "don_vi"("dbName");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_donViId_fkey" FOREIGN KEY ("donViId") REFERENCES "don_vi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
