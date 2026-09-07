---
type: userstory-index
feature: auth
status: draft
updated: 2026-09-04
links:
  - docs/auth/srs/auth-spec.md
  - docs/auth/usecases/auth-usecase-index.md
---

# Auth — Story Index

Nguồn yêu cầu: [[docs/auth/srs/auth-spec.md|Auth SRS]]. Trạng thái khởi điểm: draft — chờ duyệt và chốt OQ.

## Stories

| ID | Title | Persona | FR | Priority | Status | Jira key | Updated |
|----|-------|---------|----|----------|--------|----------|---------|
| US-001 | Đăng nhập bằng email và mật khẩu | Mọi người dùng (Admin, HR, Kế toán, Nhân viên) | FR-auth-001…004 | P0 | draft | — | 2026-09-04 |
| US-002 | Đăng xuất an toàn | Người dùng đang đăng nhập | FR-auth-005 | P0 | draft | — | 2026-09-04 |
| US-003 | Duy trì phiên trong giờ làm việc | Người dùng đang đăng nhập | FR-auth-006 | P0 | draft | — | 2026-09-04 |
| US-004 | Tự đặt lại mật khẩu qua email | Người dùng quên mật khẩu | FR-auth-007…009 | P1 | draft | — | 2026-09-04 |
| US-005 | Đổi mật khẩu khi đang đăng nhập | Người dùng đang đăng nhập | FR-auth-010…011 | P1 | draft | — | 2026-09-04 |
| US-006 | Kiểm soát truy cập theo vai trò | Chủ doanh nghiệp / Admin hệ thống | FR-auth-012 | P0 | draft | — | 2026-09-04 |
| US-007 | Admin khóa và mở khóa tài khoản | Admin hệ thống | FR-auth-013 | P1 | draft | — | 2026-09-04 |
| US-008 | Tra cứu nhật ký xác thực | Admin hệ thống / kiểm toán nội bộ | FR-auth-014 | P1 | draft | — | 2026-09-04 |

## Ghi chú

- Ưu tiên bám PRD Mục 5: P0 = đăng nhập/đăng xuất/phiên/phân quyền (nền tảng), P1 = khôi phục/đổi mật khẩu/khóa/nhật ký.
- Mỗi story có Acceptance Criteria đánh số trong file (`us-001.md` → AC-001…, scope per-story).
- OQ tập trung tại [[docs/auth/srs/auth-spec.md|Auth SRS]] Mục 8; mỗi story chỉ liệt kê OQ liên quan đến mình.
