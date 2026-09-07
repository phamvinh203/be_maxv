---
type: adr
feature: auth
status: accepted
updated: 2026-09-04
---

# ADR-003 — Password hashing: argon2id qua `@node-rs/argon2`

## Context

Spec yêu cầu mật khẩu hash một chiều (NFR implicit qua BR-auth-003 password policy 8+ ký tự, chữ thường/HOA/số) và chống timing attack (NFR-auth-004: thời gian phản hồi login như nhau giữa email tồn tại / không tồn tại). Backend chạy Docker `node:24-alpine`, deploy Render free (CPU 0.1 vCPU, RAM 512MB — tài nguyên ít). Repo chưa có hashing library nào — tự do chọn.

## Decision

1. **Thuật toán: argon2id** — parameter m=19MiB (19456 KiB), t=2, p=1 (tham số tối thiểu OWASP Password Storage Cheat Sheet khuyến nghị cho argon2id, cấu hình 2: "m=19 MiB, t=2, p=1").
2. **Library: `@node-rs/argon2`** — binding Rust napi, có prebuilt binary cho `linux-x64-gnu`/`musl` (chạy được trên alpine không cần compile).
3. Lưu dạng **PHC string** (`$argon2id$v=19$m=19456,t=2,p=1$salt$hash`) trong `User.passwordHash` — tham số encode sẵn trong hash, nâng cấp tham số sau này không cần migration.
4. **Dummy verify chống timing attack:** lúc boot sinh 1 dummy hash từ password ngẫu nhiên; login với email không tồn tại vẫn chạy `verify(dummyHash, password)` trước khi trả `E-auth-001` → thời gian phản hồi như đường email tồn tại (NFR-auth-004).

## Alternatives

| Phương án | So sánh |
|-----------|---------|
| **argon2id qua `@node-rs/argon2`** ✓ | Winner 2015 Password Hashing Competition; kháng GPU/ASIC tấn công tốt nhất trong nhóm (memory-hard); binding Rust nhanh, prebuilt binary cho alpine; API đơn giản `hash`/`verify` |
| bcrypt qua `bcryptjs` | Truyền thống, ổn định; nhưng bcryptjs là pure-JS → **chậm gấp 10-20 lần** (trên Render free 0.1 vCPU là vấn đề thật); `bcrypt` native cần node-gyp compile trên alpine (khó CI); memory-hard thấp hơn argon2 |
| bcrypt qua native `bcrypt` | Ổn định nhưng build native trên alpine/node:24 dễ gãy CI, thêm bước compile; security ngang bcryptjs nhưng mất tính portable |
| scrypt qua node crypto builtin | Không thêm dependency (crypto builtin) — nhưng API raw hơn, ít wrapper chuẩn, tham số dễ cấu hình sai; cộng đồng dùng ít hơn cả 2 trên |
| PBKDF2 | Bị OWASP xếp dưới cùng nhóm (cần iteration rất cao); không memory-hard — GPU attack dễ |

## Trade-offs

- **Nhận:** `@node-rs/argon2` binding native — thêm binary dependency (~1-2MB prebuilt). Lock version chặt trong package.json để tránh breaking change napi.
- **Nhận:** m=19MiB × t=2 ≈ ~50-100ms/verify trên CPU nhỏ — cố ý (chống brute-force), có nghĩa mỗi login tốn thêm 1 khoảng tính. Với traffic hiện tại không thành vấn đề; nếu sau này login throughput tăng, cân nhắc giảm về m=15MiB t=2 (vẫn trong khuyến nghị OWASP cấu hình 1).
- **Đổi lấy:** Security class cao nhất practical cho password storage; PHC string tự mô tả tham số; không lo compile native trên alpine/CI.

## Consequences

- `User.passwordHash` là `varchar(255)` — đủ chứa PHC string (thường ~97-114 ký tự).
- Validate password policy (BR-auth-003) chạy **trước** hash khi tạo/đổi mật khẩu; hash chạy sau verify ở login/change/reset.
- Dummy hash sinh 1 lần lúc boot, không persist — không leak.
- Seed admin hash cùng code path + cùng tham số với app (không hash riêng lệch tham số — architecture doc Mục 8).
- Hash không bao giờ trả ra API response, không ghi vào audit log (NFR-auth-003).
