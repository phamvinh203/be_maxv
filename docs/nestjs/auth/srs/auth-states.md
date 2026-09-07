---
type: srs-states
feature: auth
updated: 2026-09-04
---

# Auth — States (State Diagrams)

Vòng đời của Tài khoản và Phiên đăng nhập. Trigger bám [[docs/auth/srs/auth-spec.md|Auth SRS]] (FR-auth-013, BR-auth-001, BR-auth-002, BR-auth-004).

## State: Tài khoản

```mermaid
stateDiagram-v2
    [*] --> Active : Admin cấp tài khoản ban đầu (ngoài hệ thống — A-1)

    Active --> Locked : Đạt 5 lần sai mật khẩu trong 15 phút (BR-auth-001)
    Active --> Locked : Admin khóa thủ công (bắt buộc lý do — BR-auth-008)
    Locked --> Active : Hết 15 phút — tự mở khóa
    Locked --> Active : Admin mở khóa thủ công
    Active --> Disabled : Admin vô hiệu hóa (vd nghỉ việc — BR-auth-002)
    Disabled --> Active : Admin kích hoạt lại (vd quay lại làm việc)
    Disabled --> [*] : Nghỉ việc lâu dài — Admin quyết định xử lý (OQ-8)

    note right of Locked
        Khóa tạm: tự mở sau thời hạn
        Sai mật khẩu khi đang khóa không kéo dài thời hạn
    end note
    note right of Disabled
        Vô hiệu hóa: không tự mở
        Chỉ Admin mở được
    end note
```

Trạng thái:

| Trạng thái | Ý nghĩa | Ai mở được |
|-----------|---------|-----------|
| Active | Đang hoạt động — đăng nhập bình thường | — |
| Locked | Khóa tạm do sai mật khẩu lặp lại hoặc Admin khóa | Tự mở khi hết hạn, hoặc Admin |
| Disabled | Vô hiệu hóa do Admin quyết định | Chỉ Admin |

## State: Phiên đăng nhập

```mermaid
stateDiagram-v2
    [*] --> Active : Đăng nhập thành công (FR-auth-001)
    Active --> Active : Gia hạn khi người dùng hoạt động (FR-auth-006)
    Active --> Revoked : Đăng xuất (FR-auth-005)
    Active --> Revoked : Mật khẩu bị đổi/đặt lại ở bất kỳ thiết bị nào (BR-auth-009)
    Active --> Expired : Quá 8 giờ không hoạt động (BR-auth-004)
    Expired --> [*] : Người dùng đăng nhập lại → phiên mới
    Revoked --> [*] : Phiên không dùng lại được (NFR-auth-005)

    note right of Revoked
        Thu hồi có hiệu lực tức thì
        Dùng phiên đã thu hồi → E-auth-012
    end note
```

Trạng thái:

| Trạng thái | Ý nghĩa | Chuyển tiếp được phép |
|-----------|---------|----------------------|
| Active | Đang hiệu lực, được gia hạn khi hoạt động | Revoked, Expired |
| Expired | Hết hạn do quá thời gian idle | Kết thúc (đăng nhập lại tạo phiên mới) |
| Revoked | Thu hồi do đăng xuất hoặc đổi/đặt lại mật khẩu | Kết thúc — không khôi phục |
