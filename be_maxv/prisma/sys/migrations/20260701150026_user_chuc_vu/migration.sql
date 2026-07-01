-- AlterTable: cot chuc vu tu do cho User (nullable, khong can backfill)
ALTER TABLE "users" ADD COLUMN "chucVu" TEXT;
