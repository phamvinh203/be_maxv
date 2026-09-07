---
type: srs-erd
feature: auth
updated: 2026-09-04
---

# Auth — ERD

Sơ đồ quan hệ thực thể cho data model auth. Bảng mô tả chi tiết + schema Prisma nguồn ở [[docs/auth/architecture/auth-data-model.md|Auth Data Model]].

```mermaid
erDiagram
    USER ||--o{ SESSION : "có nhiều phiên đăng nhập"
    USER ||--o{ PASSWORD_RESET_TOKEN : "yêu cầu đặt lại mật khẩu"
    SESSION ||--o{ REFRESH_TOKEN : "mỗi phiên xoay vòng nhiều token"

    USER {
        uuid id PK "default uuid(4)"
        varchar_254 email UK "lowercase, unique"
        varchar_255 passwordHash "argon2id PHC string"
        varchar_100 name
        Role role "enum 4 vai trò, default EMPLOYEE"
        UserStatus status "enum ACTIVE_LOCKED_DISABLED"
        timestamptz lockedUntil "null khi không khóa"
        int failedLoginCount "default 0, reset khi login đúng"
        timestamptz lastLoginAt "null nếu chưa login"
        timestamptz createdAt
        timestamptz updatedAt
    }

    SESSION {
        uuid id PK "trùng claim sid trong access token"
        uuid userId FK "ON DELETE CASCADE"
        timestamptz idleExpiresAt "now + 8h, gia hạn lười"
        timestamptz revokedAt "null = phiên còn sống"
        varchar_45 ip
        varchar_255 userAgent
        timestamptz createdAt
    }

    REFRESH_TOKEN {
        uuid id PK
        uuid sessionId FK "ON DELETE CASCADE"
        char_64 tokenHash UK "SHA-256 hex của token raw"
        timestamptz expiresAt "createdAt + 8h"
        timestamptz revokedAt "rotation set cho token cũ"
        timestamptz createdAt
    }

    PASSWORD_RESET_TOKEN {
        uuid id PK
        uuid userId FK "ON DELETE CASCADE"
        char_64 tokenHash UK "SHA-256 hex của token raw"
        timestamptz expiresAt "createdAt + 24h"
        timestamptz usedAt "null = chưa dùng"
        timestamptz createdAt
    }

    AUDIT_LOG {
        uuid id PK
        AuditEvent event "enum 14 giá trị"
        uuid actorId "tham chiếu logic, không FK"
        varchar_254 actorEmail "denormalize"
        uuid targetUserId "tham chiếu logic, không FK"
        varchar_254 targetEmail "denormalize"
        uuid sessionId "tham chiếu logic, không FK"
        varchar_45 ip
        varchar_255 userAgent
        varchar_50 reason "phân loại lỗi ngắn"
        jsonb detail "không chứa secret"
        timestamptz createdAt "append-only"
    }
```

Ghi chú đọc diagram:

- **AUDIT_LOG đứng độc lập** — `actorId`/`targetUserId`/`sessionId` là tham chiếu **logic** (không FK) để xóa User không mất log (append-only, giữ 12 tháng theo NFR-auth-006). Line tới USER không vẽ để phản ánh đúng DB.
- **Role / UserStatus / AuditEvent** là enum Postgres, không phải bảng — vẽ trong attribute block (chi tiết giá trị enum ở data-model Mục 3 + 8).
- **Cardinality:** 1 User có nhiều Session; 1 Session có nhiều RefreshToken (rotation); 1 User có nhiều PasswordResetToken nhưng chỉ token mới nhất chưa dùng còn hợp lệ (yêu cầu mới revoke token cũ — FR-auth-008).
