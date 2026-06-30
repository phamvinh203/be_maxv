-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sdt" TEXT,
ALTER COLUMN "role" SET DEFAULT 'OWNER';
