# Kiến trúc Database — maxv_v2 (Bản chốt)

> Phần mềm kế toán **SaaS Cloud**, chạy trên **Windows Server 2025**, dùng **PostgreSQL + Prisma**.
> Hiện chưa khởi tạo Prisma — sẽ dựng mới từ đầu theo tài liệu này.

---

## 1. Quyết định kiến trúc cuối cùng

**Mỗi đơn vị (công ty) có 1 database riêng**, điều phối bởi 1 database trung tâm.

```
┌──────────────────────────────────────────────────┐
│  PostgreSQL trên Windows Server 2025               │
│                                                    │
│  db_sys  ◄── TRUNG TÂM ĐIỀU KHIỂN                  │
│    • users (mỗi user thuộc 1 công ty, n:1)         │
│    • don_vi               (DANH SÁCH TẤT CẢ DB)    │
│        - maSoThue, dbName, status, trialEndsAt     │
│                                                    │
│  db_8094889  ◄── toàn bộ data đơn vị A             │
│  db_0101243  ◄── toàn bộ data đơn vị B             │
│  db_...      ◄── (mỗi đơn vị 1 DB, tạo khi nhập MST)│
└──────────────────────────────────────────────────┘
```

**Về ý "db_app chứa thông tin các DB có sẵn":** đúng — nhưng *cái đó chính là bảng `don_vi` bên trong `db_sys`*. Mình gộp danh sách DB vào chung `db_sys` (thay vì tách `db_app` riêng) để **người dùng và đơn vị nằm cùng 1 DB**, tránh phải join chéo giữa hai database. `db_sys` vừa giữ người dùng, vừa là "sổ đăng ký" liệt kê mọi DB tenant đang tồn tại.

**Tóm tắt 2 tầng:**
- **`db_sys`** — control plane: ai là người dùng, vào được đơn vị nào, mỗi đơn vị data nằm ở DB nào, trạng thái gói. *Không chứa một dòng chứng từ nào.*
- **`db_<MST>`** — mỗi đơn vị 1 DB: toàn bộ nghiệp vụ (thiết lập, danh mục, chứng từ, bút toán).

---

## 2. Lợi ích của kiến trúc này (trên Windows Server 2025)

1. **Cô lập dữ liệu tuyệt đối.** Mỗi công ty 1 database — không thể lộ chéo sổ sách giữa các khách, kể cả khi code lỡ sót điều kiện lọc. Cực kỳ quan trọng với số liệu tài chính.

2. **Backup & bàn giao theo từng công ty.** Trên Windows Server 2025 chỉ cần:
   ```powershell
   pg_dump -U postgres -F c -f D:\backup\db_8094889.backup db_8094889
   ```
   → 1 file = trọn vẹn 1 công ty, bàn giao/khôi phục độc lập, không lẫn ai.

3. **Code đơn giản, an toàn.** Chỉ 1 đường đọc/ghi vào DB của đơn vị đang đăng nhập — không cần lọc `tenant_id` ở mọi câu query, không có rủi ro quên lọc.

4. **Nâng cấp gói cực nhẹ.** Khách từ dùng thử lên trả phí chỉ là `UPDATE status` trong `db_sys` — **không phải di chuyển/sao chép dữ liệu**, không rủi ro mất data.

5. **Hiệu năng tách bạch.** Bảng `chung_tu`, `but_toan` của mỗi công ty độc lập, index riêng, không "ông to đè ông nhỏ". Một công ty nhiều dữ liệu không làm chậm công ty khác.

6. **Dọn dẹp sạch sẽ.** Khách dùng thử bỏ → `DROP DATABASE` 1 lệnh, không để lại rác rải rác.

7. **Vận hành quen thuộc trên Windows.** PostgreSQL chạy như **Windows Service** (tự khởi động cùng server); các tác vụ định kỳ (dọn rác, đối soát) chạy bằng **Task Scheduler** của Windows Server 2025 — không cần cron Linux.

---

## 2b. Phân tích dưới góc nhìn BA & QA

Kiến trúc DB không chỉ là kỹ thuật — nó quyết định trực tiếp giá trị nghiệp vụ (BA) và chất lượng (QA).

### Góc nhìn BA — tối ưu giá trị & rủi ro nghiệp vụ

| Tiêu chí BA | DB-per-tenant tối ưu thế nào |
|---|---|
| Đáp ứng pháp lý/kế toán | Cô lập dữ liệu là yêu cầu bắt buộc với số liệu tài chính — thỏa mãn bằng *thiết kế*, không phụ thuộc lập trình viên nhớ lọc đúng |
| Giảm "blast radius" | Một công ty hỏng data/lỗi nghiệp vụ chỉ ảnh hưởng đúng công ty đó, không lan toàn hệ thống |
| Khớp chi phí với doanh thu | Trial bị GC tự xóa; chỉ khách trả tiền mới giữ DB sống → chi phí hạ tầng đi theo khách thật |
| Workflow kế toán dịch vụ | Backup/bàn giao riêng từng công ty (`pg_dump` 1 DB) là nghiệp vụ có thật → tăng giá trị cảm nhận |
| Phễu chuyển đổi mượt | Nâng cấp = đổi `status`, không di trú data → không gián đoạn dịch vụ → convert tốt hơn |
| Mở rộng kinh doanh | Onboard khách mới = tạo 1 DB, quy trình lặp lại, dễ dự báo năng lực |

### Góc nhìn QA — tối ưu khả năng kiểm thử & chất lượng

| Tiêu chí QA | DB-per-tenant tối ưu thế nào |
|---|---|
| Loại bỏ 1 class lỗi tận gốc | Bug "quên `WHERE tenant_id` → lộ sổ sách công ty khác" **không thể xảy ra về vật lý** (chỉ còn test IDOR ở tầng routing) |
| Test data độc lập, sạch | Mỗi test tạo 1 DB tenant tạm → `DROP` sau khi xong, đúng nguyên tắc QA cleanup |
| Tái hiện bug production | `pg_restore` đúng DB của khách về staging → dựng lại lỗi y hệt môi trường thật |
| Test template hóa | Mọi DB tenant cùng schema → 1 bộ test áp dụng đồng nhất |
| Performance test thật | Đo hiệu năng 1 tenant không bị nhiễu bởi data tenant khác |
| Cô lập khi chạy song song | Nhiều test suite chạy trên các DB khác nhau, không đụng nhau |

### Cái giá QA phải gánh thêm (đánh đổi)

Kiến trúc dời gánh nặng test từ "tầng dữ liệu" sang "tầng vận hành". QA bắt buộc bổ sung:

1. **Test migration trên nhiều DB** — 1 migration phải chạy đúng & nhất quán trên toàn bộ DB tenant; 1 DB lỗi không được làm kẹt deploy.
2. **Test saga provisioning** — đặc biệt nhánh `FAILED` (tạo DB nửa chừng) và retry.
3. **Test job GC + reconcile** — xóa nhầm DB sống là thảm họa; phải test kỹ điều kiện "trial hết hạn > 30 ngày & chưa nâng cấp".

> **Kết luận:** Dưới góc BA, kiến trúc tối ưu *rủi ro pháp lý + chi phí theo doanh thu + workflow kế toán dịch vụ*. Dưới góc QA, nó *loại bỏ class bug rò rỉ dữ liệu chéo + cho test data sạch/tái hiện được*, đổi lấy *tăng độ phức tạp test vận hành* (loại dễ kiểm soát bằng automation hơn). Đây là đánh đổi tốt với phần mềm tài chính.

---

## 2c. Chi phí & tối ưu tài nguyên (cần đọc kỹ)

**Sự thật cần thẳng thắn:** DB-per-tenant **KHÔNG tối ưu bộ nhớ** — ở quy mô lớn còn tốn RAM hơn 1 DB dùng chung. Nó tối ưu *cô lập / bảo mật / vận hành*, không phải *tài nguyên*.

### Chỗ CÓ tiết kiệm
| Khoản | Giải thích |
|---|---|
| Chỉ 1 server / 1 instance PostgreSQL | Không phải mỗi khách 1 server; `shared_buffers`, RAM cache, CPU, OS dùng chung — khoản tiết kiệm lớn nhất |
| DB rỗng ~0 chi phí đĩa | 1 DB tenant mới chỉ ~7–8MB |
| GC trial trả lại tài nguyên ngay | `DROP DATABASE` thu hồi đĩa + dừng autovacuum cho DB đó |
| Lazy | Chỉ tốn đĩa cho dữ liệu khách thật nhập |

### Chỗ KHÔNG tiết kiệm (thậm chí tốn hơn)
| Khoản | Vì sao tốn |
|---|---|
| **Kết nối = tiến trình = RAM** ⚠️ | Mỗi connection PostgreSQL là 1 process (~5–10MB). Dễ sinh 1 pool cho mỗi tenant hoạt động → RAM phình theo số tenant. **Đây mới là chi phí đáng lo, không phải đĩa** |
| Catalog + autovacuum lặp lại | Mỗi DB có catalog riêng + autovacuum worker riêng |
| Thời gian migration | Tăng tuyến tính theo số DB |
| Dung lượng backup | Tăng theo số tenant (nhưng dữ liệu này dù sao cũng phải lưu) |

### Điểm mấu chốt: xử lý bài toán kết nối ngay từ đầu
Đoạn routing `getTenantDb` (cache 1 PrismaClient mỗi `dbName`) nếu để nguyên sẽ **giữ pool sống mãi → rò rỉ RAM ở quy mô lớn**. Bắt buộc:

1. **PgBouncer trước PostgreSQL** (transaction pooling) — cách chuẩn chạy nhiều DB trên 1 instance mà không nổ RAM.
2. **Giới hạn pool nhỏ mỗi tenant** (vd `connection_limit=2`) thay vì để Prisma mở mặc định.
3. **Idle eviction** — tenant không hoạt động X phút → đóng pool, giải phóng RAM (Map hiện tại chưa làm; cần bổ sung).

### So sánh thẳng
Nếu mục tiêu **duy nhất** là tiết kiệm RAM tối đa → 1 DB dùng chung + cột `tenant_id` rẻ hơn (1 pool, 1 catalog, 1 autovacuum). Nhưng đánh đổi bằng rủi ro lộ data chéo + không backup riêng được — **không chấp nhận được với phần mềm kế toán**.

> **Chốt:** Ta trả thêm một ít RAM (giải quyết được bằng PgBouncer + idle eviction) để đổi lấy cô lập dữ liệu và backup theo công ty. Với dữ liệu tài chính đây là đánh đổi đúng — nhưng đừng kỳ vọng nó "nhẹ"; phải chủ động xử lý kết nối từ đầu.

---

## 3. Vòng đời 1 khách hàng

```
Landing → "Dùng thử"  →  Đăng ký: email + mật khẩu + TÊN CÔNG TY + MST
                          ↓     [db_sys: tạo user(OWNER) + don_vi(1 MST = 1 gói)]
                          ↓     [status=TRIAL, +7 ngày; URL: /maxv/8094889]
                          ↓     [TẠO db_8094889 ngay  — PROVISIONING → READY]
                          ↓
        Xác thực email     →  kích hoạt tài khoản (isActive=true)
                          ↓
        Nhập liệu          →  đăng nhập vào THẲNG công ty của mình → ghi db_8094889
                          ↓     (owner có thể mời nhân viên → admin duyệt → gửi mk qua email)
                          ↓
            ┌─────────────┴─────────────┐
     Nâng cấp gói                  Hết hạn, không nâng cấp
            ↓                              ↓
  UPDATE status = ACTIVE        Khóa truy cập, giữ 30 ngày
  (không sao chép gì)           → tự động DROP db_8094889
```

> **1 công ty = 1 gói = 1 tài khoản OWNER.** Làm nhiều công ty → đăng ký nhiều tài khoản (nhiều email). 1 công ty có thể thêm nhiều nhân viên (n:1) qua luồng admin duyệt.

**Thời điểm tạo DB:** ngay khi khách nhập tên công ty + mã số thuế (lúc đã có "danh tính" đơn vị và bắt đầu có data để lưu).

---

## 4. Ba nguyên tắc an toàn bắt buộc

1. **URL/MST chỉ để định tuyến, KHÔNG phải để xác thực.** `/maxv/8094889` ai cũng có thể đoán. **Mọi request phải kiểm tra `user.donViId` khớp với công ty trên URL** (user có thuộc đúng công ty đó không) trước khi cho truy cập DB.

2. **Tạo DB theo trạng thái (an toàn khi lỗi):** `PROVISIONING → READY` (thành công) hoặc `FAILED` (lỗi để xử lý lại). Chỉ cho vào đơn vị `READY`. Nhờ vậy `db_sys` luôn phản ánh đúng sự thật.

3. **Hai tác vụ định kỳ (Task Scheduler):**
   - **Dọn rác (GC):** trial hết hạn > 30 ngày & chưa nâng cấp → `DROP DATABASE` + xóa bản ghi. Giữ số DB sống ở mức hợp lý.
   - **Đối soát (reconcile):** so danh sách trong `db_sys` với DB thật trong PostgreSQL → phát hiện DB mồ côi / con trỏ chết.

---

## 5. `db_sys` — Prisma schema (control plane)

```prisma
datasource db { provider = "postgresql"; url = env("DB_SYS_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id         String      @id @default(uuid())
  email      String      @unique
  password   String      // hash bằng bcrypt/argon2
  hoTen      String
  role       Role        @default(KE_TOAN)   // OWNER = người mua gói; còn lại là nhân viên
  status     UserStatus  @default(PENDING)   // PENDING = nhân viên chờ admin duyệt
  isActive   Boolean     @default(false)     // true sau khi xác thực email / được duyệt
  donViId    String?                         // user thuộc ĐÚNG 1 công ty (n:1); ADMIN = null
  donVi      DonVi?      @relation(fields: [donViId], references: [id], onDelete: Cascade)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  @@index([donViId])
  @@map("users")
}

model DonVi {                                  // DANH SÁCH TẤT CẢ DB ("db_app" của bạn nằm ở đây)
  id            String       @id @default(uuid())
  maSoThue      String       @unique            // 1 MST = 1 công ty (1 gói) — chống đăng ký trùng
  slug          String       @unique            // dùng cho URL: "maxv-8094889"
  tenDonVi      String

  status        TenantStatus @default(TRIAL)
  plan          String?                         // "BASIC","PRO"...
  trialEndsAt   DateTime?                       // = ngày tạo + 7
  dbName        String?      @unique            // "db_8094889" — tên DB chứa data đơn vị
  provisionedAt DateTime?

  users         User[]                          // owner + nhân viên (nhiều user → 1 công ty)
  createdAt     DateTime     @default(now())
  @@map("don_vi")
}

enum Role         { ADMIN OWNER KE_TOAN_TRUONG KE_TOAN XEM }
enum UserStatus   { PENDING ACTIVE REJECTED }
enum TenantStatus { PROVISIONING READY TRIAL ACTIVE PAST_DUE SUSPENDED CANCELED FAILED }
```

> **Quan hệ:** mỗi `User` thuộc đúng 1 `DonVi` (n:1) — đã bỏ bảng `user_don_vi` n–n. `OWNER` = người mua gói/đăng ký công ty; nhân viên do owner mời → admin hệ thống duyệt → gửi mật khẩu qua email.

---

## 6. `db_<MST>` — schema mỗi đơn vị

Mỗi DB đơn vị có cùng 1 schema (clone từ template), gồm 3 lớp:

### 6.1. Thiết lập — menu "Hệ thống"
```prisma
model ThietLap {
  id              Int      @id @default(1)   // 1 dòng duy nhất
  ngayBatDauNTC   DateTime                   // Ngày bắt đầu năm tài chính
  ngayBatDauNhap  DateTime
  tenCongTy       String
  maSoThue        String?
  diaChi          String?
  thamSo          Json     @default("{}")    // Tham số tùy chọn
  @@map("thiet_lap")
}
```

### 6.2. Danh mục
`tai_khoan` (hệ thống TK theo TT200/TT133), `doi_tuong` (KH/NCC), `vat_tu`, `kho`, `nhan_vien`...

### 6.3. Chứng từ + Bút toán (trái tim hệ thống)
Dùng **1 bảng header chung + dòng chi tiết + 1 bảng sổ cái** mà mọi loại chứng từ đều ghi vào — không tạo bảng rời cho từng loại.

```prisma
model ChungTu {
  id        String        @id @default(uuid())
  loaiCt    String        // "PHIEU_THU","HD_BAN","NHAP_KHO"...
  soCt      String        // số chứng từ
  ngayCt    DateTime
  dienGiai  String?
  trangThai String        @default("GHI_SO")  // để Khóa sổ / đóng kỳ
  dongs     ChungTuDong[]
  butToans  ButToan[]
  @@unique([loaiCt, soCt])
  @@index([ngayCt])
  @@index([loaiCt, ngayCt])
  @@map("chung_tu")
}

model ChungTuDong {
  id         String   @id @default(uuid())
  chungTuId  String
  maVatTu    String?
  soLuong    Decimal? @db.Decimal(18, 4)
  donGia     Decimal? @db.Decimal(18, 2)
  thanhTien  Decimal? @db.Decimal(18, 2)
  chungTu    ChungTu  @relation(fields: [chungTuId], references: [id], onDelete: Cascade)
  @@index([chungTuId])
  @@map("chung_tu_dong")
}

model ButToan {                               // sổ cái — double entry, gốc của MỌI báo cáo
  id        String   @id @default(uuid())
  chungTuId String
  ngayCt    DateTime
  tkNo      String
  tkCo      String
  soTien    Decimal  @db.Decimal(18, 2)
  doiTuong  String?
  chungTu   ChungTu  @relation(fields: [chungTuId], references: [id], onDelete: Cascade)
  @@index([ngayCt]) @@index([tkNo]) @@index([tkCo])
  @@map("but_toan")
}
```

> Mọi chứng từ (Tiền, Bán hàng, Mua hàng, Tồn kho, Giá thành) cuối cùng đều quy về `ButToan`. Báo cáo tài chính, sổ cái, cân đối phát sinh chỉ truy vấn 1 bảng này.

---

## 7. Định tuyến kết nối động

```typescript
const clients = new Map<string, PrismaClient>();

function getTenantDb(dbName: string) {
  if (!clients.has(dbName)) {
    const url = process.env.DB_BASE_URL!.replace(/\/[^/]+$/, `/${dbName}`);
    clients.set(dbName, new PrismaClient({ datasources: { db: { url } } }));
  }
  return clients.get(dbName)!;
}
```

Luồng: đăng nhập → lấy `user.donViId` → tra `db_sys` lấy `dbName` của công ty đó → **kiểm tra công ty trên URL khớp `user.donViId`** → connect `db_<MST>`. (Không còn bước "chọn đơn vị" vì mỗi tài khoản chỉ thuộc 1 công ty.)

---

## 8. Danh mục chứng từ theo module

| Module | Chứng từ chính |
|--------|----------------|
| **Hệ thống** | Năm tài chính, Ngày/Thời gian nhập liệu, Thông tin công ty, Màn hình nhập, Đánh lại số chứng từ, Tham số, TK HĐĐT |
| **Tổng hợp** | Phiếu kế toán, Kết chuyển/Phân bổ tự động, Phân bổ định kỳ, Chênh lệch tỷ giá, Xóa dữ liệu |
| **Tiền** | Giấy báo có/nợ, Phiếu thu/chi, Tỷ giá ghi sổ |
| **Bán hàng** | HĐ bán hàng, Hàng bán trả lại, Điều chỉnh giá, HĐ dịch vụ (+trả lại), Giảm giá, Bù trừ công nợ, Phân bổ tiền thu, Tất toán, Đánh giá CLTG, Cập nhật giá bán |
| **Mua hàng** | HĐ mua trong nước/nhập khẩu/nhập-xuất thẳng, Phí mua hàng, Xuất trả lại NCC, Điều chỉnh giá, HĐ dịch vụ (+trả lại), Bù trừ công nợ, Phân bổ tiền trả, Tất toán, Đánh giá CLTG |
| **Tồn kho** | Nhập/Xuất kho, Xuất điều chuyển, Tính giá TB / TB di động / FIFO, Tính lại tồn tức thời |
| **Giá thành** | Định mức NVL, Lệnh sản xuất, Hệ số phân bổ, Vật tư thay thế, Đối tượng nhận phân bổ, Kiểm kê vật tư, SL dở dang, Tính giá thành |

---

## 9. Lộ trình triển khai (bắt đầu từ con số 0)

1. **Khởi tạo dự án + Prisma** — cài PostgreSQL trên Windows Server 2025 (chạy dạng Service), `npm i prisma @prisma/client`, `npx prisma init`.
2. **`db_sys`** — schema control plane + migration đầu tiên.
3. **Provisioning** — hàm tạo đơn vị: `CREATE DATABASE db_<MST>` + chạy migration template (saga PROVISIONING→READY).
4. **Schema `db_<MST>`** — template đầy đủ: thiết lập, danh mục, `chung_tu`/`but_toan`.
5. **Auth + định tuyến** — đăng ký (email+công ty+MST), đăng nhập vào thẳng công ty của mình, resolve `donViId`→DB, kiểm quyền; luồng mời nhân viên (admin duyệt).
6. **Task Scheduler** — tác vụ GC + reconcile.
