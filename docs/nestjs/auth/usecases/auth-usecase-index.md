---
type: usecase-index
feature: auth
status: draft
updated: 2026-09-04
links:
  - docs/auth/srs/auth-spec.md
  - docs/auth/userstories/auth-story-index.md
---

# Auth — Use Case Index

Nguồn yêu cầu: [[docs/auth/srs/auth-spec.md|Auth SRS]]. Cột Screen để trống — frontend deferred (quyết định 2026-09-04).

## Use cases

| UC | Slug | Actor | FR liên quan | Error liên quan | OQ liên quan | Screen | Priority | Updated |
|----|------|-------|--------------|-----------------|--------------|--------|----------|---------|
| UC-login | login | Mọi người dùng (Admin, HR, Kế toán, Nhân viên) | FR-auth-001…004 | E-auth-001…004, E-auth-012 | OQ-1, OQ-3, OQ-5 | — | P0 | 2026-09-04 |
| UC-logout | logout | Người dùng đang đăng nhập | FR-auth-005 | E-auth-012 | OQ-4 | — | P0 | 2026-09-04 |
| UC-refresh-session | refresh-session | Người dùng đang đăng nhập | FR-auth-006 | E-auth-012 | OQ-4, OQ-10 | — | P0 | 2026-09-04 |
| UC-reset-password | reset-password | Người dùng quên mật khẩu | FR-auth-007…009 | E-auth-005…007, E-auth-010 | OQ-6, OQ-10 | — | P1 | 2026-09-04 |
| UC-change-password | change-password | Người dùng đang đăng nhập | FR-auth-010…011 | E-auth-007…009 | OQ-5, OQ-10 | — | P1 | 2026-09-04 |

## Note — phần SRS chưa có UC riêng

- FR-auth-012 (phân quyền theo vai trò) và FR-auth-014 (nhật ký xác thực) là yêu cầu nền cắt ngang — kiểm chứng qua kiểm thử phân quyền, không qua 1 UC riêng. Ma trận "chức năng × vai trò" chi tiết sẽ định nghĩa trong từng phân hệ nghiệp vụ.
- FR-auth-013 (khóa/mở khóa thủ công bởi Admin) hiện chưa có UC fully-dressed riêng — cần bổ sung UC `uc-manage-account-lock` khi chốt OQ-3 và OQ-8 (ranh giới giữa auth và module quản lý người dùng).

## Actors

| Actor | Mô tả | UC sử dụng |
|-------|-------|-----------|
| Admin hệ thống | Quản trị vận hành — khóa/mở khóa tài khoản, theo dõi nhật ký | UC-login, UC-logout, UC-refresh-session, UC-change-password; (khóa/mở khóa: xem Note) |
| HR | Quản trị nhân sự | UC-login, UC-logout, UC-refresh-session, UC-reset-password, UC-change-password |
| Kế toán | Sử dụng số liệu tài chính | UC-login, UC-logout, UC-refresh-session, UC-reset-password, UC-change-password |
| Nhân viên | Xem thông tin cá nhân | UC-login, UC-logout, UC-refresh-session, UC-reset-password, UC-change-password |

## Diagram

Chưa có — use case diagram sẽ bổ sung sau khi chốt OQ-1/OQ-2 (2FA/social login có thể thay đổi tập UC và actor).
