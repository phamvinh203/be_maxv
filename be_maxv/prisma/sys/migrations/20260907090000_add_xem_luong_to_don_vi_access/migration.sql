-- QĐ #8 + QĐ #17 (BR-hrm-059, BR-hrm-068, BR-hrm-069) — data-model.md M-13, ADR-007.
--
-- Quyền XEM DỮ LIỆU LƯƠNG là thuộc tính của cặp (người dùng, công ty), nên nó sống ở control
-- plane, cùng chỗ với việc cấp quyền vào công ty. Đây là thay đổi cấu trúc DUY NHẤT của đợt
-- P0 chạm control plane; mọi ràng buộc HRM khác nằm ở DB tenant và đi qua script riêng
-- (src/services/shared/hrmTenantConstraints.ts) vì tenant không có thư mục migrations.

-- AlterTable
ALTER TABLE "don_vi_access" ADD COLUMN     "xemLuong" BOOLEAN NOT NULL DEFAULT false;

-- BƯỚC CHUYỂN DỮ LIỆU — BẮT BUỘC, KHÔNG ĐƯỢC BỎ (QĐ #17, BR-hrm-069).
--
-- Cột mang mặc định "không được xem" để SIẾT NGƯỜI MỚI, nhưng mọi bản ghi phân quyền ĐANG
-- TỒN TẠI phải được GIỮ NGUYÊN khả năng xem lương. Thiếu câu dưới đây thì đúng ngày triển
-- khai, mọi kế toán đang làm việc mất màn hợp đồng cùng lúc (403 E-hrm-058) trong khi màn
-- cấp quyền có thể chưa kịp lên.
--
-- Từ thời điểm này trở đi, bản ghi phân quyền MỚI nhận false theo mặc định của cột và phải
-- được chủ tài khoản cấp riêng.
UPDATE "don_vi_access" SET "xemLuong" = true;
