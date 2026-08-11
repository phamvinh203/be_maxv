# Thiết kế — Lưu & tự dùng mật khẩu cổng thuế (GDT) theo MST

**Ngày:** 2026-08-05
**Phạm vi:** `be_maxv` (backend) + `hdđt_maxv` (frontend hóa đơn điện tử)
**Trạng thái:** đã duyệt thiết kế, chờ lập kế hoạch triển khai

## 1. Vấn đề

Khi đăng nhập Thuế điện tử qua `components/dialogLoginHddt.tsx`, người dùng nhập MST +
mật khẩu + captcha. Backend proxy sang cổng thuế (`/security-taxpayer/authenticate`) và
trả về **token sống ngắn (~5 phút)**. Token đó lưu ở `sessionStorage` theo từng tab
(`GdtSessionProvider.tsx`, key `hddt_gdt_tokens`). **Mật khẩu MST không được lưu ở bất kỳ
đâu.**

Hệ quả: đổi trình duyệt / máy khác / hết phiên là phải đi tìm và gõ lại mật khẩu MST mỗi
lần. Người dùng muốn lưu mật khẩu để lần sau không phải nhập lại.

## 2. Mục tiêu

1. Người dùng có thể **chủ động lưu** mật khẩu cổng thuế cho một MST, để lần sau (kể cả
   trên trình duyệt khác) không phải gõ lại.
2. Lưu **an toàn**: mật khẩu là credential thật của cơ quan thuế → mã hóa có thể giải ngược
   (không hash), khóa mã hóa không nằm trong DB/repo, và mật khẩu thật **không rời server**.
3. Giữ nguyên vòng đời token và luồng captcha hiện tại — chỉ bỏ bước gõ lại mật khẩu.

### Ngoài phạm vi

- **Đăng nhập tự động hoàn toàn** (BE tự lấy captcha + giải + login khi cần token, không
  cần mở dialog). Đã cân nhắc và loại ở bước brainstorm: phải chuyển việc giải captcha sang
  BE và xử lý khi giải sai — nhiều việc và rủi ro hơn. Có thể làm sau trên nền thiết kế này.
- **Lưu riêng theo từng người dùng.** Đã chọn phạm vi *dùng chung theo MST* (xem mục 4).
- Đổi cơ chế lưu token GDT (vẫn `sessionStorage`, ~5 phút, không đụng tới).

## 3. Quyết định đã chốt (bước brainstorm)

| Quyết định | Lựa chọn | Ghi chú |
|---|---|---|
| Mức tự động | **Tự điền sẵn** (không phải auto-login) | Thay đổi ít, rủi ro thấp |
| Phạm vi lưu | **Dùng chung theo MST** | 1 mật khẩu/MST, mọi user có quyền đều dùng được |
| Xin phép lưu | **Có ô tick "Ghi nhớ mật khẩu"** | Chỉ lưu khi người dùng chủ động tick |
| Kiểu điền sẵn | **Hiện "đã lưu", dùng ở server** | Mật khẩu thật không gửi về trình duyệt |
| Nơi lưu | **`DonVi` (sys DB)** | Đơn giản, khớp "shared/MST", 1 migration (xem mục 4) |

## 4. Nơi lưu & mã hóa

### 4.1. Vì sao `DonVi` (sys DB) chứ không phải DB tenant

`DonVi` (trong `maxv2_sys`, khóa `maSoThue` unique) đúng là thực thể "một bản ghi cho mỗi
MST, dùng chung bởi owner + nhân viên (qua `DonViAccess`)". Lưu ở đây:

- Chỉ cần **1 migration** trên sys DB, không phải fan-out qua N DB tenant.
- Handler login lấy được bản ghi qua `request.user.donViId` (JWT app) — không phải resolve
  DB tenant.

Phương án DB tenant (bảng riêng trong `maxv2_<MST>_app`) cô lập tốt hơn về mặt lý thuyết,
nhưng **khóa mã hóa dùng chung mọi tenant** nên nếu khóa rò thì mọi bản đều lộ bất kể nằm ở
DB nào — lợi ích cô lập gần như bằng 0. Loại vì phức tạp hơn mà không an toàn hơn.

### 4.2. Cột thêm vào `DonVi`

```prisma
model DonVi {
  // ... các cột hiện có ...

  // Mật khẩu cổng thuế (GDT) đã lưu — mã hóa AES-256-GCM, dùng chung cho mọi user có quyền
  // trên MST này. null = chưa lưu. KHÔNG bao giờ lưu plaintext; KHÔNG hash (phải giải ngược
  // để đăng nhập hộ). Xem services/.../gdtCredential.ts.
  gdtPasswordCipher String? // ciphertext (base64)
  gdtPasswordIv     String? // IV/nonce 12 byte (base64)
  gdtPasswordTag    String? // GCM auth tag (base64)
}
```

Ba cột đều `null` hoặc đều có giá trị (bất biến "cả ba cùng có" được đảm bảo ở tầng service,
không ở DB). Migration: `ALTER TABLE don_vi ADD COLUMN ...` — an toàn, không đụng dữ liệu cũ.

### 4.3. Mã hóa

- Thuật toán **AES-256-GCM** (Node `crypto`), khóa 32 byte đọc từ env
  **`GDT_CRED_ENC_KEY`** (chuỗi base64 32 byte). Thêm vào `config/env.ts` (đọc qua `env`,
  không `process.env` trực tiếp — nhất quán với phần còn lại) và tài liệu `.env` mẫu. **Không
  commit khóa thật.**
- Mỗi lần mã hóa sinh IV ngẫu nhiên mới (12 byte). Lưu ciphertext + iv + tag.
- Module riêng `services/client/hddt/gdtCredential.ts`:
  - `encryptGdtPassword(plain: string): { cipher, iv, tag } | null`
  - `decryptGdtPassword({ cipher, iv, tag }): string | null`
  - `isEncryptionConfigured(): boolean`
- **Tắt mềm khi thiếu khóa:** `GDT_CRED_ENC_KEY` không đặt (hoặc sai độ dài) → `encrypt`
  trả `null` (không lưu được, không ném lỗi làm hỏng login), `decrypt` trả `null`. Đổi khóa
  → bản cũ giải ra `null` (tag không khớp) → coi như "chưa lưu", nhắc nhập lại. Không crash.

### 4.4. Mô hình rủi ro

- Rò **DB** mà không rò **khóa** → mật khẩu vẫn an toàn (ciphertext vô dụng).
- Mật khẩu thật chỉ đi **server → cổng thuế**, không bao giờ **server → trình duyệt**.
- Chấp nhận (đúng lựa chọn "dùng chung/MST"): mọi user có quyền trên MST dùng được mật khẩu
  đã lưu — họ vốn đã đăng nhập GDT cho MST đó được. Không hiển thị lại plaintext cho ai.

## 5. Backend

### 5.1. `GET /gdt/credential/status` (mới, authenticated)

- preHandler `fastify.authenticate`. Đọc `DonVi` theo `request.user.donViId`.
- Trả `{ saved: boolean }` — `true` nếu cả ba cột `gdtPassword*` có giá trị **và**
  `isEncryptionConfigured()`. FE gọi khi mở dialog để quyết định hiển thị trạng thái "đã lưu".

### 5.2. `POST /gdt/login` (sửa: thêm authenticate + dùng/lưu mật khẩu)

- **Thêm `fastify.authenticate`** vào route. An toàn: dialog chỉ mở trong app đã đăng nhập,
  và `loginGdt` (FE) gọi qua `apiFetch` nên cookie httpOnly đã được gửi kèm sẵn.
- Body mở rộng: `{ mst, captcha, key, password?, useSaved?: boolean, remember?: boolean }`.
- Logic:
  1. Xác định mật khẩu dùng để gọi cổng thuế:
     - `useSaved === true` (và không gõ mật khẩu mới) → nạp `DonVi` theo `donViId`, kiểm
       `DonVi.maSoThue === mst`, giải mã. Giải ra `null` (mất khóa / chưa lưu) → trả lỗi
       "Chưa có mật khẩu đã lưu, vui lòng nhập lại".
     - Ngược lại → dùng `password` trong body (bắt buộc phải có).
  2. Gọi `GDTService.login` như hiện tại với mật khẩu đã xác định.
  3. Đăng nhập OK **và** `remember === true` **và** `DonVi.maSoThue === mst` → mã hóa
     `password` (chỉ nhánh gõ mật khẩu mới; `useSaved` thì đã có sẵn, khỏi ghi lại) và
     `update` ba cột vào `DonVi`. `encrypt` trả `null` (thiếu khóa) → **bỏ qua việc lưu**,
     không làm hỏng login (login vẫn thành công, chỉ là không lưu được).
  4. **Guard MST lệch:** nếu `mst` khác `DonVi.maSoThue` của công ty đang chọn → **không**
     dùng và **không** lưu mật khẩu đã lưu (tránh rò/ghi chéo tenant); vẫn cho login bằng
     `password` gõ tay như luồng cũ.
- Giữ nguyên contract trả về `{ token }` / ném lỗi kèm message.

### 5.3. `DELETE /gdt/credential` (mới, authenticated)

- preHandler `fastify.authenticate`. `update` ba cột `gdtPassword*` về `null` trên `DonVi`
  theo `donViId`. Trả `{ removed: true }`. Dùng cho link "Xóa mật khẩu đã lưu".

## 6. Frontend — `dialogLoginHddt.tsx`

- **Query trạng thái:** thêm `credentialStatusQuery` (`GET /gdt/credential/status`), enabled
  khi `open && !!username` (MST đã biết). Có `saved` để lái UI.
- **Trạng thái "đã lưu":** khi `saved` và người dùng chưa gõ mật khẩu:
  - Ô mật khẩu để **trống**, `placeholder="•••••• (đã lưu)"`, state `useSaved = true`.
  - Hiển thị link nhỏ **"Xóa mật khẩu đã lưu"** → gọi `DELETE /gdt/credential` (mutation),
    invalidate `credentialStatusQuery`.
  - Người dùng gõ vào ô mật khẩu → `useSaved = false` (ghi đè bằng mật khẩu mới).
- **Checkbox "Ghi nhớ mật khẩu":** hiện khi đang ở nhánh gõ mật khẩu mới
  (`!useSaved`), **mặc định không tick**. Chỉ cần tick 1 lần đầu (khi đã lưu, các lần sau ở
  trạng thái "đã lưu" nên không phải tick nữa).
- **Submit (`handleSubmit`):**
  - Nới validation: cho submit khi `useSaved` dù ô mật khẩu trống (server đã có mật khẩu).
    Vẫn yêu cầu `captcha` + `captcha.key` như cũ.
  - `useSaved` → gửi `{ mst, captcha, key, useSaved: true }` (không kèm `password`).
  - Ngược lại → gửi `{ mst, captcha, key, password, remember: <checkbox> }`.
- **API layer:** cập nhật `features/hddt/api/gdt.ts` (`loginGdt` nhận thêm field) + thêm
  `getGdtCredentialStatus` / `deleteGdtCredential`. Đặt query/mutation ở
  `features/*/api/*Queries.ts` theo quy ước TanStack Query của dự án.
- **Không đổi** `GdtSessionProvider` / vòng đời token / auto-solve captcha.

## 7. Test

Thư mục `be_maxv/src/__tests__/` đã có sẵn các test gdt. Thêm `gdtCredential.test.ts`:

1. `encrypt` → `decrypt` round-trip trả đúng plaintext.
2. Thiếu `GDT_CRED_ENC_KEY` → `encrypt`/`decrypt` trả `null`, `isEncryptionConfigured()`
   `false` (tắt mềm, không ném).
3. Giải mã với khóa khác (tag không khớp) → `null`, không ném.
4. Login `remember: true` + MST khớp → ghi ba cột; đọc lại giải ra đúng mật khẩu.
5. Login `useSaved: true` → dùng mật khẩu đã lưu để gọi service (mock `GDTService.login`).
6. MST lệch công ty đang chọn → **không** lưu và **không** dùng mật khẩu đã lưu.

## 8. Các bước triển khai (tóm tắt, chi tiết ở kế hoạch)

1. `be_maxv`: env `GDT_CRED_ENC_KEY` + `gdtCredential.ts` (encrypt/decrypt) + test đơn vị.
2. `be_maxv`: migration thêm 3 cột `gdtPassword*` vào `DonVi` (prisma/sys) + regenerate client.
3. `be_maxv`: sửa controller/route `login` (authenticate + dùng/lưu), thêm
   `credentialStatus` + `deleteCredential` (controller/service/route) + test.
4. `hdđt_maxv`: API + queries (`credential/status`, `deleteCredential`, `loginGdt` mở rộng).
5. `hdđt_maxv`: `dialogLoginHddt.tsx` — trạng thái "đã lưu", checkbox, submit, link xóa.
6. Kiểm thử tay: lưu → đổi trình duyệt → mở dialog thấy "đã lưu" → login không gõ mật khẩu.
