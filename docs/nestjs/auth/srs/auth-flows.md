---
type: srs-flows
feature: auth
updated: 2026-09-04
---

# Auth — Flows (Sequence & Activity)

Các luồng tương tác giữa người dùng và hệ thống cho feature auth. Giá trị số bám [[docs/auth/srs/auth-spec.md|Auth SRS]] (BR-auth-001, BR-auth-004, BR-auth-005).

## Flow: Đăng nhập thành công

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant S as Hệ thống
    participant L as Nhật ký xác thực
    U->>S: Nhập email + mật khẩu, chọn Đăng nhập
    S->>S: Kiểm tra email tồn tại, tài khoản đang hoạt động
    S->>S: So khớp mật khẩu
    S->>S: Xóa bộ đếm nhập sai (BR-auth-001)
    S->>S: Mở phiên đăng nhập gắn vai trò (FR-auth-001)
    S->>L: Ghi "đăng nhập thành công" (FR-auth-004)
    S-->>U: Đăng nhập thành công — vào màn hình theo vai trò
```

## Flow: Đăng nhập sai mật khẩu dẫn đến khóa tài khoản

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant S as Hệ thống
    participant L as Nhật ký xác thực
    U->>S: Nhập email + mật khẩu sai
    S->>S: So khớp thất bại
    S->>S: Bộ đếm sai +1 (cửa sổ 15 phút, BR-auth-001)
    S->>L: Ghi "đăng nhập thất bại — sai mật khẩu"
    S-->>U: "Email hoặc mật khẩu không đúng." (E-auth-001)
    U->>S: Nhập lại sai (đến lần thứ 5 trong 15 phút)
    S->>S: Bộ đếm đạt 5 → khóa tài khoản 15 phút
    S->>L: Ghi "khóa tự động — quá 5 lần sai"
    S-->>U: "Tài khoản đang bị khóa tạm thời..." (E-auth-002)
    U->>S: Thử đăng nhập lại khi đang khóa
    S-->>U: Từ chối — E-auth-002, không cộng bộ đếm
    Note over S: Hết 15 phút → tự mở khóa, bộ đếm về 0
```

## Flow: Đăng nhập khi tài khoản bị vô hiệu hóa

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant S as Hệ thống
    participant L as Nhật ký xác thực
    U->>S: Nhập email + mật khẩu đúng
    S->>S: Email tồn tại, mật khẩu khớp
    S->>S: Trạng thái tài khoản = vô hiệu hóa (BR-auth-002)
    S->>L: Ghi "đăng nhập từ chối — tài khoản vô hiệu hóa"
    S-->>U: "Tài khoản đã bị vô hiệu hóa..." (E-auth-003)
    Note over S: Không cộng bộ đếm nhập sai (FR-auth-003)
```

## Flow: Làm mới phiên đăng nhập

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant S as Hệ thống
    participant L as Nhật ký xác thực
    U->>S: Yêu cầu chức năng nghiệp vụ với phiên hiện có
    alt Phiên còn hợp lệ, sắp hết hạn
        S->>S: Gia hạn phiên (BR-auth-004, FR-auth-006)
        S-->>U: Tiếp tục làm việc, không đăng nhập lại
    else Phiên đã hết hạn
        S-->>U: "Phiên đăng nhập đã hết hạn..." (E-auth-012)
        U->>S: Đăng nhập lại
    end
    opt Mật khẩu vừa được đổi/đặt lại ở thiết bị khác
        S->>S: Thu hồi phiên (BR-auth-009)
        S-->>U: Yêu cầu đăng nhập lại (E-auth-012)
    end
```

## Flow: Đặt lại mật khẩu qua email

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant S as Hệ thống
    participant E as Dịch vụ email
    participant L as Nhật ký xác thực
    U->>S: Nhập email, yêu cầu đặt lại mật khẩu
    S->>S: Kiểm tra tần suất gửi (NFR-auth-008: ≤3 email/giờ)
    S->>L: Ghi "yêu cầu đặt lại mật khẩu"
    S-->>U: "Nếu email tồn tại, link đã được gửi." (E-auth-005)
    alt Email tồn tại, tài khoản đang hoạt động
        S->>E: Gửi link đặt lại (1 lần dùng, hết hạn 24h — BR-auth-005)
        S->>S: Vô hiệu link cũ (nếu còn hạn) theo FR-auth-008
        E-->>U: Email chứa link đặt lại
    else Email không tồn tại
        Note over S: Không làm gì thêm — phản hồi đã thống nhất (NFR-auth-004)
    end
    U->>S: Mở link, nhập mật khẩu mới
    alt Link còn hạn và chưa dùng
        S->>S: Kiểm tra chính sách mật khẩu (BR-auth-003)
        S->>S: Cập nhật mật khẩu mới
        S->>S: Thu hồi mọi phiên đang có (BR-auth-009)
        S->>S: Vô hiệu mọi link còn lại, xóa bộ đếm sai
        S->>L: Ghi "đặt lại mật khẩu thành công"
        S-->>U: Đặt lại thành công — mời đăng nhập lại
    else Link hết hạn hoặc đã dùng
        S-->>U: "Link không còn hiệu lực..." (E-auth-006)
    end
```

## Flow: Hoạt động xác thực (Activity tổng hợp)

```mermaid
flowchart TD
    A[Người dùng mở màn đăng nhập] --> B{Email + mật khẩu đủ?}
    B -- Không --> C[Hiện E-auth-004]
    C --> A
    B -- Đủ --> D{Email tồn tại?}
    D -- Không --> E1[Cộng bộ đếm? Không. Ghi log] --> E2[Hiện E-auth-001 thống nhất]
    D -- Có --> F{Tài khoản đang hoạt động?}
    F -- Khóa tạm --> G[Hiện E-auth-002, không cộng bộ đếm]
    F -- Vô hiệu hóa --> H[Hiện E-auth-003, không cộng bộ đếm]
    F -- Đang hoạt động --> I{Mật khẩu khớp?}
    I -- Không --> J[Bộ đếm sai +1, ghi log]
    J --> K{Đạt 5 lần trong 15 phút?}
    K -- Có --> L[Khóa tài khoản 15 phút, hiện E-auth-002]
    K -- Không --> M[Hiện E-auth-001]
    L --> A
    M --> A
    I -- Có --> N[Xóa bộ đếm, mở phiên gắn vai trò, ghi log]
    N --> O[Người dùng làm việc]
    O --> P{Phiên hết hạn 8 giờ idle?}
    P -- Có --> Q[E-auth-012, đăng nhập lại]
    Q --> A
    P -- Không --> O
    O --> R[Đăng xuất]
    R --> S1[Kết thúc phiên, ghi log]
```

## Flow: Khôi phục mật khẩu (Activity)

```mermaid
flowchart TD
    A[Người dùng chọn Quên mật khẩu] --> B[Nhập email]
    B --> C{Vượt giới hạn 3 email/giờ?}
    C -- Có --> D[Hiện E-auth-010, dừng]
    C -- Không --> E{Email tồn tại + tài khoản hoạt động?}
    E -- Có --> F[Gửi link, vô hiệu link cũ, ghi log]
    E -- Không --> G[Không gửi, ghi log yêu cầu]
    F --> H[Hiện E-auth-005 thống nhất]
    G --> H
    H --> I[Người dùng mở email, bấm link]
    I --> J{Link còn hạn và chưa dùng?}
    J -- Không --> K[Hiện E-auth-006, mời yêu cầu link mới]
    K --> A
    J -- Có --> L[Nhập mật khẩu mới]
    L --> M{Đạt chính sách BR-auth-003?}
    M -- Không --> N[Hiện E-auth-007]
    N --> L
    M -- Có --> O[Cập nhật mật khẩu, thu hồi mọi phiên, vô hiệu link, xóa bộ đếm, ghi log]
    O --> P[Mời đăng nhập lại]
```
