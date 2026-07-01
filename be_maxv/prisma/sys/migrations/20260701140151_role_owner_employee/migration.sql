-- AddColumn: invite_requests.hoTen / chucVu (backfill placeholder cho dòng cũ, rồi bỏ default)
ALTER TABLE "invite_requests" ADD COLUMN "hoTen" TEXT NOT NULL DEFAULT '(chưa cập nhật)';
ALTER TABLE "invite_requests" ADD COLUMN "chucVu" TEXT NOT NULL DEFAULT '(chưa cập nhật)';
ALTER TABLE "invite_requests" ALTER COLUMN "hoTen" DROP DEFAULT;
ALTER TABLE "invite_requests" ALTER COLUMN "chucVu" DROP DEFAULT;

-- Backfill dữ liệu cũ (KE_TOAN_TRUONG/KE_TOAN/XEM) sang OWNER_EMPLOYEE trước khi thu hẹp enum Role.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);
ALTER TABLE "invite_requests" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invite_requests" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);

UPDATE "users" SET "role" = 'OWNER_EMPLOYEE' WHERE "role" IN ('KE_TOAN_TRUONG', 'KE_TOAN', 'XEM');
UPDATE "invite_requests" SET "role" = 'OWNER_EMPLOYEE' WHERE "role" IN ('KE_TOAN_TRUONG', 'KE_TOAN', 'XEM');

-- Recreate enum Role chỉ còn ADMIN / OWNER / OWNER_EMPLOYEE
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'OWNER', 'OWNER_EMPLOYEE');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::"Role_new");
ALTER TABLE "invite_requests" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'OWNER';
ALTER TABLE "invite_requests" ALTER COLUMN "role" SET DEFAULT 'OWNER_EMPLOYEE';
