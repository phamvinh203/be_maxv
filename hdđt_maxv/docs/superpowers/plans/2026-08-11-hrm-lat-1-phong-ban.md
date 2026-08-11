# HRM lát cắt 1 — Cây phòng ban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng khu `/hrm` trong `hdđt_maxv` với màn hình Phòng ban dạng cây (trực thuộc, cấp, số nhân viên), chạy trên bảng `dmpb` dùng chung mà không gây hồi quy cho `fe_maxv`.

**Architecture:** Thêm đúng một cột `ma_pb_me` vào `dmpb` và tạo bảng `hrm_nhan_vien` (lát này chỉ dùng để đếm). Toàn bộ logic cây và sinh mã tách thành hàm thuần có test riêng; service Prisma chỉ ghép chúng lại. Backend cấp endpoint `/api/v1/hrm/phong-ban` **riêng** — không tái dùng `/tong-hop/phong-ban` vì validator bên đó sẽ xóa trắng các cột kế toán. Frontend dùng route lồng dưới `/hrm` với layout riêng.

**Tech Stack:** Fastify 5 + Prisma 7 + PostgreSQL (DB-per-tenant) · React 19 + MUI v9 + react-router-dom v7 + TanStack Query v5 · test bằng `node:test` chạy qua `tsx`.

## Global Constraints

- **Tenant schema không dùng Prisma `@relation`.** Liên kết bằng cột chuỗi trần + comment; ràng buộc toàn vẹn viết tay ở service.
- **Ngày dùng `DateTime?` trần, không `@db.Date`** — khớp `m81.ngay_ct` và mọi bảng hiện có.
- **Mọi danh mục có bộ ba cột chuẩn:** `status String @default("1") @db.VarChar(1)`, `datetime0 DateTime @default(now())`, `datetime2 DateTime @default(now())`.
- **Sửa `prisma/tenant/schema.prisma` xong phải chạy `npm run generate` rồi `npm run sync:tenants`.** Bỏ bước hai thì công ty mới chạy tốt còn mọi công ty cũ lỗi P2022.
- **Response backend luôn bọc envelope** `{ success, data }` qua `sendOk`/`sendCreated` → frontend dùng `apiFetchData`, không dùng `apiFetch`.
- **Mọi `queryKey` phải chứa `currentCompanyId`** — thiếu là dữ liệu nhân sự rò giữa các MST khi đổi công ty trên header.
- **MUI v9:** dùng `slotProps`, không `InputProps` / `PaperProps`.
- **Thông báo dùng `react-toastify`** (`ToastContainer` đã gắn ở `App.tsx`); `Alert` inline chỉ cho lỗi tải danh sách.
- **Không sửa bất cứ file nào trong `fe_maxv/`.**
- Ngôn ngữ comment và chuỗi hiển thị: **tiếng Việt**, khớp phong cách file xung quanh.
- **Nháy: `hdđt_maxv` dùng nháy kép, `be_maxv` dùng nháy đơn.** Code trong plan viết nháy đơn đồng loạt; đổi sang nháy kép khi dán vào `hdđt_maxv`. Không project nào có prettier hay rule ESLint ép quote nên đây thuần túy là nhất quán mắt nhìn, không phải lỗi build.

## Sai lệch có chủ ý so với spec

- **Không tạo `hooks/useTableFilter.ts`.** Spec dự kiến hook lọc dùng chung cho bốn bảng, nhưng lát 1 chỉ có **một** bảng — viết hook lúc này là thiết kế cho tương lai chưa biết hình thù. Lọc nằm trong `useMemo` của `PhongBanTable`; lát 2 khi có bảng thứ hai và thứ ba thì rút ra hook từ code thật.
- **`<Route index>` trỏ về `phong-ban`** thay vì `nhan-vien` như spec — màn hình nhân viên chưa tồn tại ở lát 1. Lát 2 đổi lại.

## File Structure

**Backend `be_maxv/`**

| File | Trách nhiệm |
|---|---|
| `prisma/tenant/schema.prisma` (sửa) | Thêm `dmpb.ma_pb_me`; thêm model `hrm_nhan_vien` |
| `src/services/client/hrm/phongBanCay.ts` (mới) | Hàm thuần: dựng cây + tính cấp, tập con cháu |
| `src/services/client/hrm/sinhMa.ts` (mới) | Hàm thuần: sinh mã phòng ban |
| `src/services/client/hrm/phongBan.service.ts` (mới) | Truy vấn Prisma + ràng buộc toàn vẹn |
| `src/validators/hrm/phongBan.validator.ts` (mới) | Zod schema |
| `src/controllers/client/hrm/phongBan.controller.ts` (mới) | Ghép validate + resolveTenantDb + service |
| `src/routes/hrm/phongBan.route.ts` (mới) | Khai báo path |
| `src/routes/index.route.ts` (sửa) | Đăng ký prefix `/api/v1/hrm` |
| `src/constants/messages.ts` (sửa) | Khối `HRM` |
| `src/__tests__/hrmPhongBanCay.test.ts` (mới) | Test cây |
| `src/__tests__/hrmSinhMa.test.ts` (mới) | Test sinh mã |

**Frontend `hdđt_maxv/`**

| File | Trách nhiệm |
|---|---|
| `src/features/hrm/types/index.ts` (mới) | Kiểu `PhongBan`, `PhongBanFormValues` |
| `src/features/hrm/api/phongBanApi.ts` (mới) | 4 hàm gọi HTTP + `hrmKeys` |
| `src/features/hrm/api/phongBanQueries.ts` (mới) | Hook query/mutation |
| `src/features/hrm/components/HrmNav.tsx` (mới) | Thanh điều hướng trong khu HRM |
| `src/features/hrm/components/phong_ban/PhongBanTable.tsx` (mới) | Bảng + toolbar + xóa |
| `src/features/hrm/components/phong_ban/PhongBanFormDialog.tsx` (mới) | Form thêm/sửa |
| `src/pages/hrm/HrmPage.tsx` (sửa — đang rỗng) | Layout: AppHeader + HrmNav + Outlet |
| `src/pages/hrm/PhongBanPage.tsx` (mới) | Trang mỏng, chỉ render `PhongBanTable` |
| `src/pages/hrm/Dashboard.tsx`, `src/pages/hrm/employee.tsx` | **Xóa** — rỗng, ngoài phạm vi lát 1 |
| `src/routes/AppRouter.tsx` (sửa) | Route lồng dưới `/hrm` |

Tách `PhongBanTable` (dữ liệu + bảng) khỏi `PhongBanFormDialog` (form) vì hai thứ này đổi vì lý do khác nhau: bảng đổi khi thêm cột, form đổi khi thêm trường. `PhongBanPage` cố ý mỏng để lát 2 thêm trang mới không phải đụng gì.

## Ngoài phạm vi lát 1

Không làm trong lát này, đừng "tiện tay": nút **Gán nhanh phòng ban** (lát 2, cần có nhân viên mới thử được), màn hình Nhân viên / Chức vụ / Người phụ thuộc, `sinhMaNhanVien`, endpoint `/hrm/nhan-vien/*`.

---

### Task 1: Schema tenant — cột trực thuộc và bảng nhân viên

**Files:**
- Modify: `be_maxv/prisma/tenant/schema.prisma:520-534` (model `dmpb`) và cuối file

**Interfaces:**
- Consumes: —
- Produces: model Prisma `dmpb` có thêm `ma_pb_me: string | null`; model `hrm_nhan_vien` với các cột `ma_nv`, `ho_ten`, `ma_pb`, `status`. Task 4 dùng `db.dmpb` và `db.hrm_nhan_vien`.

- [ ] **Step 1: Thêm cột `ma_pb_me` vào `dmpb`**

Trong `be_maxv/prisma/tenant/schema.prisma`, thay khối `model dmpb { … }` hiện có bằng:

```prisma
/// Danh mục phòng ban (dmpb) — thuộc Tổng hợp, dùng CHUNG với HRM.
/// fe_maxv nhập các cột kế toán (dia_chi, ma_td1…); HRM nhập ten_pb / ma_pb_me / ghi_chu.
model dmpb {
  ma_pb      String  @id @db.VarChar(24)
  ten_pb     String  @db.VarChar(254)
  ten_pb2    String? @db.VarChar(254) // tên khác
  dia_chi    String? @db.VarChar(254)
  dien_thoai String? @db.VarChar(32)
  ma_td1     String? @db.VarChar(24) // TK chi phí (dmtk)
  ten_tk     String? @db.VarChar(254) // tên tài khoản
  ghi_chu    String? @db.VarChar(512) // HRM hiển thị dưới nhãn "Mô tả"
  ma_pb_me   String? @db.VarChar(24) // trực thuộc — null = phòng ban gốc (dmpb.ma_pb)

  status    String   @default("1") @db.VarChar(1)
  datetime0 DateTime @default(now())
  datetime2 DateTime @default(now())

  @@index([ma_pb_me])
}
```

- [ ] **Step 2: Thêm model `hrm_nhan_vien` vào cuối file**

```prisma
// ============================================================
//  HRM › DANH MỤC NHÂN SỰ
//  Phòng ban KHÔNG có bảng riêng — dùng chung dmpb (cột ma_pb_me).
//  Lát 1 chỉ tạo bảng nhân viên để đếm; màn hình nhân viên ở lát 2.
// ============================================================

/// Danh mục nhân viên (HRM). Liên kết dmpb qua ma_pb, hrm_chuc_vu qua ma_cv (lát 2).
model hrm_nhan_vien {
  ma_nv  String @id @db.VarChar(24)
  ho_ten String @db.VarChar(254)

  // Thông tin cá nhân
  so_cccd     String?   @db.VarChar(24) // KHÔNG unique: hồ sơ nhập dần, nhiều NV chưa có CCCD
  mst_ca_nhan String?   @db.VarChar(24)
  ngay_sinh   DateTime?
  gioi_tinh   String?   @db.VarChar(8) // nam | nu | khac
  dien_thoai  String?   @db.VarChar(32)
  email       String?   @db.VarChar(254)
  dia_chi     String?   @db.VarChar(254)
  ghi_chu     String?   @db.VarChar(512)

  // Công việc & lương
  ma_pb     String?   @db.VarChar(24) // phòng ban (dmpb)
  ma_cv     String?   @db.VarChar(24) // chức vụ (hrm_chuc_vu — lát 2)
  cap_bac   String?   @db.VarChar(64) // chữ tự do, không phải danh mục
  cong_doan Boolean   @default(false) // trích 1% phí công đoàn trên lương đóng BHXH
  ngay_vao  DateTime?

  // Tài khoản ngân hàng
  ngan_hang String? @db.VarChar(128)
  so_tk     String? @db.VarChar(32)
  chu_tk    String? @db.VarChar(254)

  status    String   @default("1") @db.VarChar(1) // 1 đang làm, 0 đã nghỉ
  datetime0 DateTime @default(now())
  datetime2 DateTime @default(now())

  @@index([ma_pb])
}
```

- [ ] **Step 3: Sinh lại Prisma client**

```bash
cd be_maxv && npm run generate
```

Expected: hai dòng "Generated Prisma Client", không có lỗi.

- [ ] **Step 4: Kiểm tra TypeScript thấy model mới**

```bash
cd be_maxv && npm run typecheck
```

Expected: PASS, không lỗi.

- [ ] **Step 5: Đẩy schema lên mọi DB tenant**

```bash
cd be_maxv && npm run sync:tenants
```

Expected: mỗi tenant một dòng `✓`, kết thúc "Xong: N thành công, 0 lỗi". Có dòng `✗` thì **dừng lại** — bỏ qua sẽ khiến công ty đó lỗi P2022 ở Task 4.

- [ ] **Step 6: Commit**

```bash
git add be_maxv/prisma/tenant/schema.prisma be_maxv/src/generated
git commit -m "🎉 Add dmpb.ma_pb_me and hrm_nhan_vien to tenant schema"
```

---

### Task 2: Hàm thuần — dựng cây phòng ban và tính cấp

**Files:**
- Create: `be_maxv/src/services/client/hrm/phongBanCay.ts`
- Test: `be_maxv/src/__tests__/hrmPhongBanCay.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `interface PhongBanNode { ma_pb: string; ma_pb_me: string | null }`
  - `type WithCap<T> = T & { cap: number }`
  - `sapXepTheoCay<T extends PhongBanNode>(rows: T[]): WithCap<T>[]`
  - `taoTapConChau(rows: PhongBanNode[], maPb: string): Set<string>`

- [ ] **Step 1: Viết test thất bại**

Tạo `be_maxv/src/__tests__/hrmPhongBanCay.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sapXepTheoCay,
  taoTapConChau,
} from '../services/client/hrm/phongBanCay';

/**
 * Khóa hai bất biến của cây phòng ban:
 *  - MỌI dòng đọc từ dmpb đều phải xuất hiện đúng 1 lần ở kết quả, kể cả dữ liệu hỏng
 *    (cha đã bị xóa, hoặc chu trình do sửa tay trong DB);
 *  - không có nhánh nào làm hàm chạy vô hạn.
 * Mất một trong hai là phòng ban "biến mất" khỏi giao diện hoặc request treo.
 *
 *   npx tsx --test src/__tests__/hrmPhongBanCay.test.ts
 */

const pb = (ma_pb: string, ma_pb_me: string | null = null) => ({ ma_pb, ma_pb_me });

test('sapXepTheoCay: gốc là cấp 1, con là cấp 2, cha đứng ngay trước con', () => {
  const kq = sapXepTheoCay([
    pb('PB02'),
    pb('PB01.01', 'PB01'),
    pb('PB01'),
  ]);

  assert.deepEqual(
    kq.map((r) => [r.ma_pb, r.cap]),
    [
      ['PB01', 1],
      ['PB01.01', 2],
      ['PB02', 1],
    ],
  );
});

test('sapXepTheoCay: cấp tăng đúng ở độ sâu 3', () => {
  const kq = sapXepTheoCay([
    pb('PB01'),
    pb('PB01.01', 'PB01'),
    pb('PB01.01.01', 'PB01.01'),
  ]);

  assert.deepEqual(kq.map((r) => r.cap), [1, 2, 3]);
});

test('sapXepTheoCay: anh em cùng cha sắp theo mã tăng dần', () => {
  const kq = sapXepTheoCay([
    pb('PB01.03', 'PB01'),
    pb('PB01.01', 'PB01'),
    pb('PB01.02', 'PB01'),
    pb('PB01'),
  ]);

  assert.deepEqual(kq.map((r) => r.ma_pb), [
    'PB01',
    'PB01.01',
    'PB01.02',
    'PB01.03',
  ]);
});

test('sapXepTheoCay: node mồ côi (cha đã bị xóa) được coi là gốc, không biến mất', () => {
  // PB09 trỏ tới PB07 không còn trong bảng — nếu lọc theo "ma_pb_me == null" thì nó mất tăm.
  const kq = sapXepTheoCay([pb('PB01'), pb('PB09', 'PB07')]);

  assert.deepEqual(
    kq.map((r) => [r.ma_pb, r.cap]),
    [
      ['PB01', 1],
      ['PB09', 1],
    ],
  );
});

test('sapXepTheoCay: chu trình không gây lặp vô hạn và không mất dòng nào', () => {
  // A -> B -> A: không node nào tới được từ gốc.
  const kq = sapXepTheoCay([pb('PBA', 'PBB'), pb('PBB', 'PBA'), pb('PB01')]);

  assert.equal(kq.length, 3);
  assert.deepEqual([...new Set(kq.map((r) => r.ma_pb))].sort(), [
    'PB01',
    'PBA',
    'PBB',
  ]);
});

test('sapXepTheoCay: giữ nguyên các trường khác của dòng', () => {
  const kq = sapXepTheoCay([
    { ma_pb: 'PB01', ma_pb_me: null, ten_pb: 'Kế toán' },
  ]);

  assert.equal(kq[0].ten_pb, 'Kế toán');
  assert.equal(kq[0].cap, 1);
});

test('sapXepTheoCay: danh sách rỗng trả mảng rỗng', () => {
  assert.deepEqual(sapXepTheoCay([]), []);
});

test('taoTapConChau: gồm chính nó và toàn bộ con cháu', () => {
  const rows = [
    pb('PB01'),
    pb('PB01.01', 'PB01'),
    pb('PB01.01.01', 'PB01.01'),
    pb('PB02'),
  ];

  assert.deepEqual([...taoTapConChau(rows, 'PB01')].sort(), [
    'PB01',
    'PB01.01',
    'PB01.01.01',
  ]);
});

test('taoTapConChau: lá chỉ gồm chính nó', () => {
  const rows = [pb('PB01'), pb('PB01.01', 'PB01')];

  assert.deepEqual([...taoTapConChau(rows, 'PB01.01')], ['PB01.01']);
});

test('taoTapConChau: dừng được khi dữ liệu có chu trình', () => {
  const rows = [pb('PBA', 'PBB'), pb('PBB', 'PBA')];

  assert.deepEqual([...taoTapConChau(rows, 'PBA')].sort(), ['PBA', 'PBB']);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
cd be_maxv && npx tsx --test src/__tests__/hrmPhongBanCay.test.ts
```

Expected: FAIL — không tìm thấy module `../services/client/hrm/phongBanCay`.

- [ ] **Step 3: Viết cài đặt tối thiểu**

Tạo `be_maxv/src/services/client/hrm/phongBanCay.ts`:

```ts
/**
 * Logic cây phòng ban, tách khỏi Prisma để test được không cần DB.
 * "Cấp" KHÔNG lưu trong bảng — tính lại mỗi lần đọc, vì lưu cứng sẽ sai ngay lần đầu
 * ai đó đổi trực thuộc của một nhánh (phải cập nhật xuống toàn bộ con cháu).
 */

/** Phần tối thiểu của 1 dòng dmpb mà thuật toán cần. */
export interface PhongBanNode {
  ma_pb: string;
  ma_pb_me: string | null;
}

/** Dòng đã gắn cấp (gốc = 1). */
export type WithCap<T> = T & { cap: number };

/**
 * Sắp danh sách phẳng theo thứ tự duyệt cây (cha đứng ngay trước con) và gắn `cap`.
 *
 * Hai nhánh phòng thủ cho dữ liệu hỏng — bỏ đi là phòng ban biến mất khỏi giao diện mà
 * không có lỗi nào báo lên:
 *  - `ma_pb_me` trỏ tới mã không còn tồn tại  -> coi như gốc;
 *  - node nằm trong chu trình (không tới được từ gốc) -> vẫn trả về, đặt ở cấp 1.
 */
export function sapXepTheoCay<T extends PhongBanNode>(rows: T[]): WithCap<T>[] {
  const tonTai = new Set(rows.map((r) => r.ma_pb));

  const conCua = new Map<string | null, T[]>();
  for (const r of rows) {
    const cha = r.ma_pb_me && tonTai.has(r.ma_pb_me) ? r.ma_pb_me : null;
    const ds = conCua.get(cha);
    if (ds) ds.push(r);
    else conCua.set(cha, [r]);
  }
  for (const ds of conCua.values()) {
    ds.sort((a, b) => a.ma_pb.localeCompare(b.ma_pb));
  }

  const ketQua: WithCap<T>[] = [];
  const daDuyet = new Set<string>();

  const duyet = (cha: string | null, cap: number): void => {
    for (const r of conCua.get(cha) ?? []) {
      if (daDuyet.has(r.ma_pb)) continue; // chặn chu trình
      daDuyet.add(r.ma_pb);
      ketQua.push({ ...r, cap });
      duyet(r.ma_pb, cap + 1);
    }
  };
  duyet(null, 1);

  for (const r of rows) {
    if (!daDuyet.has(r.ma_pb)) {
      daDuyet.add(r.ma_pb);
      ketQua.push({ ...r, cap: 1 });
    }
  }
  return ketQua;
}

/**
 * Tập mã gồm `maPb` và toàn bộ con cháu của nó. Dùng để (a) chặn đặt cha là chính nó hoặc
 * con cháu nó, (b) loại khỏi danh sách chọn "Trực thuộc" trên giao diện.
 *
 * Lặp tới điểm bất động thay vì đệ quy: dừng được cả khi dữ liệu đã có sẵn chu trình.
 */
export function taoTapConChau(
  rows: PhongBanNode[],
  maPb: string,
): Set<string> {
  const ketQua = new Set<string>([maPb]);
  let themMoi = true;
  while (themMoi) {
    themMoi = false;
    for (const r of rows) {
      if (r.ma_pb_me && ketQua.has(r.ma_pb_me) && !ketQua.has(r.ma_pb)) {
        ketQua.add(r.ma_pb);
        themMoi = true;
      }
    }
  }
  return ketQua;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
cd be_maxv && npx tsx --test src/__tests__/hrmPhongBanCay.test.ts
```

Expected: PASS, 10/10.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/services/client/hrm/phongBanCay.ts be_maxv/src/__tests__/hrmPhongBanCay.test.ts
git commit -m "🎉 Add HRM department tree builder with cycle and orphan handling"
```

---

### Task 3: Hàm thuần — sinh mã phòng ban

**Files:**
- Create: `be_maxv/src/services/client/hrm/sinhMa.ts`
- Test: `be_maxv/src/__tests__/hrmSinhMa.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `sinhMaPhongBan(maCha: string | null, maDaCo: string[]): string`. Ném `Error` khi mã vượt 24 ký tự (giới hạn `dmpb.ma_pb`).

- [ ] **Step 1: Viết test thất bại**

Tạo `be_maxv/src/__tests__/hrmSinhMa.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinhMaPhongBan } from '../services/client/hrm/sinhMa';

/**
 * Mã phòng ban do server sinh (form HRM không có ô Mã). Quy tắc: gốc PB01, PB02…;
 * con của PB01 là PB01.01, PB01.02…
 *
 * Bất biến quan trọng nhất: KHÔNG tái dùng mã đã xóa. Mã phòng ban nằm trên chứng từ kế
 * toán cũ bên fe_maxv, cấp lại mã cũ cho một phòng ban khác là gán sai lịch sử chi phí.
 *
 *   npx tsx --test src/__tests__/hrmSinhMa.test.ts
 */

test('sinhMaPhongBan: bảng rỗng -> PB01', () => {
  assert.equal(sinhMaPhongBan(null, []), 'PB01');
});

test('sinhMaPhongBan: gốc kế tiếp', () => {
  assert.equal(sinhMaPhongBan(null, ['PB01', 'PB02']), 'PB03');
});

test('sinhMaPhongBan: KHÔNG lấp chỗ trống của mã đã xóa', () => {
  // PB02 từng tồn tại rồi bị xóa -> vẫn phải nhảy sang PB04, không cấp lại PB02.
  assert.equal(sinhMaPhongBan(null, ['PB01', 'PB03']), 'PB04');
});

test('sinhMaPhongBan: con đầu tiên của một phòng ban', () => {
  assert.equal(sinhMaPhongBan('PB01', ['PB01', 'PB02']), 'PB01.01');
});

test('sinhMaPhongBan: con kế tiếp', () => {
  assert.equal(
    sinhMaPhongBan('PB01', ['PB01', 'PB01.01', 'PB01.02']),
    'PB01.03',
  );
});

test('sinhMaPhongBan: mã gốc không bị cháu tính nhầm là anh em', () => {
  // PB01.01 và PB01.01.01 đều bắt đầu bằng "PB01" nhưng không phải anh em của PB02.
  assert.equal(
    sinhMaPhongBan(null, ['PB01', 'PB01.01', 'PB01.01.01']),
    'PB02',
  );
});

test('sinhMaPhongBan: cháu không bị tính là con', () => {
  assert.equal(
    sinhMaPhongBan('PB01', ['PB01', 'PB01.01', 'PB01.01.01']),
    'PB01.02',
  );
});

test('sinhMaPhongBan: vượt quá 24 ký tự thì báo lỗi thay vì tạo mã bị cắt cụt', () => {
  // dmpb.ma_pb là VarChar(24). "PB01.01.01.01.01.01.01" + ".01" = 25 ký tự.
  const cha = 'PB01.01.01.01.01.01.01';
  assert.equal(cha.length, 22);
  assert.throws(() => sinhMaPhongBan(cha, [cha]), /quá sâu/);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

```bash
cd be_maxv && npx tsx --test src/__tests__/hrmSinhMa.test.ts
```

Expected: FAIL — không tìm thấy module `../services/client/hrm/sinhMa`.

- [ ] **Step 3: Viết cài đặt tối thiểu**

Tạo `be_maxv/src/services/client/hrm/sinhMa.ts`:

```ts
/** Giới hạn cột dmpb.ma_pb. */
const DO_DAI_MA_PB_TOI_DA = 24;

/** Thoát ký tự đặc biệt của regex — mã cha chứa dấu chấm, để nguyên sẽ khớp cả ký tự bất kỳ. */
function thoatRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mã phòng ban kế tiếp. Gốc: `PB01`, `PB02`… Con của `PB01`: `PB01.01`, `PB01.02`…
 *
 * Lấy `max + 1` chứ KHÔNG lấp chỗ trống: mã đã xóa vẫn nằm trên chứng từ kế toán cũ bên
 * `fe_maxv`, cấp lại cho phòng ban khác là gán sai lịch sử chi phí.
 *
 * Chỉ đếm anh em TRỰC TIẾP — `PB01.01` không được tính khi sinh mã gốc, và `PB01.01.01`
 * không được tính khi sinh con của `PB01`.
 *
 * Dùng: `createPhongBanHrm` (services/client/hrm/phongBan.service.ts).
 */
export function sinhMaPhongBan(
  maCha: string | null,
  maDaCo: string[],
): string {
  const tienTo = maCha ? `${maCha}.` : 'PB';
  const mau = new RegExp(`^${thoatRegex(tienTo)}(\\d+)$`);

  let lonNhat = 0;
  for (const ma of maDaCo) {
    const khop = mau.exec(ma);
    if (khop) lonNhat = Math.max(lonNhat, Number(khop[1]));
  }

  const ma = `${tienTo}${String(lonNhat + 1).padStart(2, '0')}`;
  if (ma.length > DO_DAI_MA_PB_TOI_DA) {
    throw new Error(
      `Cây phòng ban quá sâu: mã "${ma}" vượt ${DO_DAI_MA_PB_TOI_DA} ký tự`,
    );
  }
  return ma;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
cd be_maxv && npx tsx --test src/__tests__/hrmSinhMa.test.ts
```

Expected: PASS, 8/8.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/services/client/hrm/sinhMa.ts be_maxv/src/__tests__/hrmSinhMa.test.ts
git commit -m "🎉 Add HRM department code generator"
```

---

### Task 4: API `/api/v1/hrm/phong-ban`

**Files:**
- Create: `be_maxv/src/validators/hrm/phongBan.validator.ts`
- Create: `be_maxv/src/services/client/hrm/phongBan.service.ts`
- Create: `be_maxv/src/controllers/client/hrm/phongBan.controller.ts`
- Create: `be_maxv/src/routes/hrm/phongBan.route.ts`
- Modify: `be_maxv/src/constants/messages.ts:91` (sau khối `TONG_HOP`)
- Modify: `be_maxv/src/routes/index.route.ts`

**Interfaces:**
- Consumes: `sapXepTheoCay`, `taoTapConChau` (Task 2); `sinhMaPhongBan` (Task 3); `db.dmpb`, `db.hrm_nhan_vien` (Task 1).
- Produces: bốn endpoint dưới `/api/v1/hrm/phong-ban`. Kiểu dòng trả về:
  `{ ma_pb: string; ten_pb: string; ma_pb_me: string | null; ten_pb_me: string | null; ghi_chu: string | null; status: string; cap: number; so_nv: number }`.
  Task 5 khai báo lại kiểu này ở frontend.

- [ ] **Step 1: Thêm thông điệp lỗi**

Trong `be_maxv/src/constants/messages.ts`, chèn ngay **sau** khối `TONG_HOP: { … },`:

```ts
  HRM: {
    PHONG_BAN_NOT_FOUND: 'Không tìm thấy phòng ban',
    PHONG_BAN_ME_NOT_FOUND: 'Không tìm thấy phòng ban trực thuộc',
    PHONG_BAN_CHU_TRINH:
      'Không thể đặt phòng ban trực thuộc chính nó hoặc phòng ban cấp dưới của nó',
    PHONG_BAN_CON_CON: 'Phòng ban còn phòng ban cấp dưới, không xóa được',
    PHONG_BAN_CON_NHAN_VIEN: 'Phòng ban còn nhân viên, không xóa được',
    SINH_MA_THAT_BAI: 'Không sinh được mã phòng ban, vui lòng thử lại',
  },
```

- [ ] **Step 2: Viết validator**

Tạo `be_maxv/src/validators/hrm/phongBan.validator.ts`:

```ts
import { z } from 'zod';
import { optText } from '../shared/primitives';

/**
 * Thân request tạo phòng ban từ HRM. KHÔNG có `ma_pb` — server tự sinh (xem `sinhMaPhongBan`).
 * Cũng KHÔNG có các cột kế toán (dia_chi, ma_td1…) để không đụng dữ liệu của fe_maxv.
 */
export const hrmPhongBanCreateSchema = z.object({
  ten_pb: z.string().trim().min(1, 'Tên phòng ban không được để trống'),
  ma_pb_me: optText,
  ghi_chu: optText, // giao diện HRM gọi là "Mô tả"
});

/** Sửa: thêm trạng thái; mã không đổi được. */
export const hrmPhongBanUpdateSchema = hrmPhongBanCreateSchema.extend({
  status: z.enum(['0', '1']).default('1'),
});

/** Param :ma_pb. */
export const hrmPhongBanParamSchema = z.object({
  ma_pb: z.string().min(1),
});

export type HrmPhongBanCreateInput = z.infer<typeof hrmPhongBanCreateSchema>;
export type HrmPhongBanUpdateInput = z.infer<typeof hrmPhongBanUpdateSchema>;
```

- [ ] **Step 3: Viết service**

Tạo `be_maxv/src/services/client/hrm/phongBan.service.ts`:

```ts
import type { PrismaClient } from '../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../helpers/errors';
import { findOrThrow } from '../../../helpers/crudGuards';
import { MESSAGES } from '../../../constants/messages';
import { sapXepTheoCay, taoTapConChau } from './phongBanCay';
import { sinhMaPhongBan } from './sinhMa';
import type {
  HrmPhongBanCreateInput,
  HrmPhongBanUpdateInput,
} from '../../../validators/hrm/phongBan.validator';

/** 1 dòng bảng phòng ban trên giao diện HRM. `cap` và `so_nv` là suy ra, không có trong DB. */
export interface PhongBanHrmRow {
  ma_pb: string;
  ten_pb: string;
  ma_pb_me: string | null;
  ten_pb_me: string | null;
  ghi_chu: string | null;
  status: string;
  cap: number;
  so_nv: number;
}

/** Số lần tính lại mã khi có người khác chèn ngang giữa lúc đọc và ghi. */
const SO_LAN_THU_LAI = 5;

/** Prisma P2002 = vi phạm ràng buộc duy nhất (ở đây là khóa chính ma_pb). */
function laLoiTrungKhoa(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

/**
 * GET danh sách — trả PHẲNG nhưng đã sắp theo thứ tự duyệt cây và gắn `cap`, `so_nv`.
 * Dựng cây ở server để frontend không tính lại: cùng một phép tính làm ở hai nơi thì sớm
 * muộn cũng lệch.
 *
 * `so_nv` chỉ đếm nhân viên ĐANG LÀM (`status = '1'`) — cột này để biết phòng ban có bao
 * nhiêu người, không phải để thống kê lịch sử.
 */
export async function listPhongBanHrm(
  db: PrismaClient,
): Promise<PhongBanHrmRow[]> {
  const [rows, dem] = await Promise.all([
    db.dmpb.findMany({
      select: {
        ma_pb: true,
        ten_pb: true,
        ma_pb_me: true,
        ghi_chu: true,
        status: true,
      },
      orderBy: { ma_pb: 'asc' },
    }),
    db.hrm_nhan_vien.groupBy({
      by: ['ma_pb'],
      where: { ma_pb: { not: null }, status: '1' },
      _count: { _all: true },
    }),
  ]);

  const soNv = new Map(dem.map((d) => [d.ma_pb as string, d._count._all]));
  const tenTheoMa = new Map(rows.map((r) => [r.ma_pb, r.ten_pb]));

  return sapXepTheoCay(rows).map((r) => ({
    ...r,
    ten_pb_me: r.ma_pb_me ? (tenTheoMa.get(r.ma_pb_me) ?? null) : null,
    so_nv: soNv.get(r.ma_pb) ?? 0,
  }));
}

/**
 * POST tạo mới — mã do server sinh.
 *
 * Hai người bấm "Thêm phòng ban" cùng lúc sẽ cùng đọc ra mã kế tiếp giống nhau. Không khóa
 * bảng, mà bắt lỗi trùng khóa của Postgres rồi tính lại — rẻ hơn và không chặn ai.
 */
export async function createPhongBanHrm(
  db: PrismaClient,
  body: HrmPhongBanCreateInput,
): Promise<{ ma_pb: string }> {
  if (body.ma_pb_me) {
    await findOrThrow(
      () =>
        db.dmpb.findUnique({
          where: { ma_pb: body.ma_pb_me as string },
          select: { ma_pb: true },
        }),
      new NotFoundError(MESSAGES.HRM.PHONG_BAN_ME_NOT_FOUND),
    );
  }

  for (let lan = 0; lan < SO_LAN_THU_LAI; lan++) {
    const daCo = await db.dmpb.findMany({ select: { ma_pb: true } });
    const maPb = sinhMaPhongBan(
      body.ma_pb_me,
      daCo.map((r) => r.ma_pb),
    );
    try {
      await db.dmpb.create({
        data: {
          ma_pb: maPb,
          ten_pb: body.ten_pb,
          ma_pb_me: body.ma_pb_me,
          ghi_chu: body.ghi_chu,
        },
      });
      return { ma_pb: maPb };
    } catch (err) {
      if (!laLoiTrungKhoa(err)) throw err;
    }
  }
  throw new ConflictError(MESSAGES.HRM.SINH_MA_THAT_BAI);
}

/**
 * PUT sửa — chỉ ghi 4 cột của HRM.
 *
 * KHÔNG dùng `data: body`: các cột kế toán (dia_chi, dien_thoai, ma_td1, ten_tk, ten_pb2)
 * do fe_maxv nhập, ghi đè bằng undefined/null ở đây là xóa trắng dữ liệu của họ.
 */
export async function updatePhongBanHrm(
  db: PrismaClient,
  maPb: string,
  body: HrmPhongBanUpdateInput,
): Promise<{ ma_pb: string }> {
  await findOrThrow(
    () =>
      db.dmpb.findUnique({ where: { ma_pb: maPb }, select: { ma_pb: true } }),
    new NotFoundError(MESSAGES.HRM.PHONG_BAN_NOT_FOUND),
  );

  if (body.ma_pb_me) {
    await findOrThrow(
      () =>
        db.dmpb.findUnique({
          where: { ma_pb: body.ma_pb_me as string },
          select: { ma_pb: true },
        }),
      new NotFoundError(MESSAGES.HRM.PHONG_BAN_ME_NOT_FOUND),
    );

    const tatCa = await db.dmpb.findMany({
      select: { ma_pb: true, ma_pb_me: true },
    });
    if (taoTapConChau(tatCa, maPb).has(body.ma_pb_me)) {
      throw new ConflictError(MESSAGES.HRM.PHONG_BAN_CHU_TRINH);
    }
  }

  await db.dmpb.update({
    where: { ma_pb: maPb },
    data: {
      ten_pb: body.ten_pb,
      ma_pb_me: body.ma_pb_me,
      ghi_chu: body.ghi_chu,
      status: body.status,
      datetime2: new Date(),
    },
  });
  return { ma_pb: maPb };
}

/** DELETE — chặn khi còn cấp dưới hoặc còn nhân viên (kể cả nhân viên đã nghỉ). */
export async function deletePhongBanHrm(
  db: PrismaClient,
  maPb: string,
): Promise<{ ma_pb: string }> {
  await findOrThrow(
    () =>
      db.dmpb.findUnique({ where: { ma_pb: maPb }, select: { ma_pb: true } }),
    new NotFoundError(MESSAGES.HRM.PHONG_BAN_NOT_FOUND),
  );

  const [soCon, soNv] = await Promise.all([
    db.dmpb.count({ where: { ma_pb_me: maPb } }),
    db.hrm_nhan_vien.count({ where: { ma_pb: maPb } }),
  ]);
  if (soCon > 0) throw new ConflictError(MESSAGES.HRM.PHONG_BAN_CON_CON);
  if (soNv > 0) throw new ConflictError(MESSAGES.HRM.PHONG_BAN_CON_NHAN_VIEN);

  await db.dmpb.delete({ where: { ma_pb: maPb } });
  return { ma_pb: maPb };
}
```

- [ ] **Step 4: Viết controller**

Tạo `be_maxv/src/controllers/client/hrm/phongBan.controller.ts`:

```ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateBody, validateParams } from '../../../utils/validate';
import { sendCreated, sendOk } from '../../../helpers/response';
import { resolveTenantDb } from '../../../helpers/resolveTenantDb';
import {
  createPhongBanHrm,
  deletePhongBanHrm,
  listPhongBanHrm,
  updatePhongBanHrm,
} from '../../../services/client/hrm/phongBan.service';
import {
  hrmPhongBanCreateSchema,
  hrmPhongBanParamSchema,
  hrmPhongBanUpdateSchema,
} from '../../../validators/hrm/phongBan.validator';

// GET /api/v1/hrm/phong-ban
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await listPhongBanHrm(db));
}

// POST /api/v1/hrm/phong-ban
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(hrmPhongBanCreateSchema, req.body);
  return sendCreated(reply, await createPhongBanHrm(db, body));
}

// PUT /api/v1/hrm/phong-ban/:ma_pb
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_pb } = validateParams(hrmPhongBanParamSchema, req.params);
  const body = validateBody(hrmPhongBanUpdateSchema, req.body);
  return sendOk(
    reply,
    await updatePhongBanHrm(db, decodeURIComponent(ma_pb), body),
  );
}

// DELETE /api/v1/hrm/phong-ban/:ma_pb
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_pb } = validateParams(hrmPhongBanParamSchema, req.params);
  return sendOk(reply, await deletePhongBanHrm(db, decodeURIComponent(ma_pb)));
}
```

- [ ] **Step 5: Viết route**

Tạo `be_maxv/src/routes/hrm/phongBan.route.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/hrm/phongBan.controller';

/**
 * HRM › Danh mục › Phòng ban — chạy trên bảng `dmpb` dùng chung với Tổng hợp.
 * Tách khỏi `/tong-hop/phong-ban` vì HRM tự sinh mã, trả cây, và chỉ được ghi 4 cột
 * (xem comment ở `updatePhongBanHrm`).
 */
export async function hrmPhongBanRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/phong-ban', ctrl.list);
  app.post('/phong-ban', ctrl.create);
  app.put('/phong-ban/:ma_pb', ctrl.update);
  app.delete('/phong-ban/:ma_pb', ctrl.remove);
}
```

- [ ] **Step 6: Đăng ký route**

Trong `be_maxv/src/routes/index.route.ts`, thêm import cạnh các import route khác:

```ts
import { hrmPhongBanRoutes } from './hrm/phongBan.route';
```

và thêm khối đăng ký **sau** khối `// Bán hàng`:

```ts
  // HRM
  await app.register(hrmPhongBanRoutes, { prefix: '/api/v1/hrm' });
```

- [ ] **Step 7: Kiểm tra biên dịch và lint**

```bash
cd be_maxv && npm run typecheck && npm run lint
```

Expected: cả hai PASS.

- [ ] **Step 8: Chạy lại toàn bộ test đã có**

```bash
cd be_maxv && npx tsx --test src/__tests__/hrmPhongBanCay.test.ts src/__tests__/hrmSinhMa.test.ts
```

Expected: PASS, 18/18.

- [ ] **Step 9: Kiểm thử tay bốn endpoint**

Backend phải đang chạy. **Không tự khởi động hay tắt dev server** — nếu chưa chạy thì nhờ người dùng chạy `npm run dev` trong `be_maxv`.

Đăng nhập trên trình duyệt để có cookie, rồi mở DevTools › Console của tab `hdđt_maxv` và chạy:

```js
const api = (p, o) => fetch('/api/v1/hrm' + p, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...o }).then(r => r.json().then(b => ({ status: r.status, body: b })));

// 1. Tạo gốc + con
await api('/phong-ban', { method: 'POST', body: JSON.stringify({ ten_pb: 'Khối văn phòng' }) });
await api('/phong-ban', { method: 'POST', body: JSON.stringify({ ten_pb: 'Kế toán', ma_pb_me: 'PB01' }) });

// 2. Danh sách — kỳ vọng PB01 cap 1, PB01.01 cap 2, so_nv 0
await api('/phong-ban');

// 3. Chu trình — kỳ vọng 409
await api('/phong-ban/PB01', { method: 'PUT', body: JSON.stringify({ ten_pb: 'Khối văn phòng', ma_pb_me: 'PB01.01', status: '1' }) });

// 4. Xóa cha còn con — kỳ vọng 409
await api('/phong-ban/PB01', { method: 'DELETE' });

// 5. Xóa con rồi xóa cha — kỳ vọng 200 cả hai
await api('/phong-ban/PB01.01', { method: 'DELETE' });
await api('/phong-ban/PB01', { method: 'DELETE' });
```

Expected: đúng như ghi chú từng dòng.

- [ ] **Step 10: Xác nhận không hồi quy `fe_maxv`**

Mở `fe_maxv`, vào **Tổng hợp › Danh mục phòng ban**. Sửa một phòng ban bất kỳ có địa chỉ/điện thoại, lưu, rồi gọi lại `await api('/phong-ban')` ở bước 9.

Expected: trang `fe_maxv` lưu bình thường, và ngược lại — phòng ban tạo từ HRM hiện ra bên `fe_maxv` với địa chỉ trống.

- [ ] **Step 11: Commit**

```bash
git add be_maxv/src/validators/hrm be_maxv/src/services/client/hrm/phongBan.service.ts be_maxv/src/controllers/client/hrm be_maxv/src/routes/hrm be_maxv/src/routes/index.route.ts be_maxv/src/constants/messages.ts
git commit -m "🎉 Add HRM department API with tree, auto code and integrity guards"
```

---

### Task 5: Nền frontend — kiểu, API client, layout HRM, định tuyến

**Files:**
- Create: `hdđt_maxv/src/features/hrm/types/index.ts`
- Create: `hdđt_maxv/src/features/hrm/api/phongBanApi.ts`
- Create: `hdđt_maxv/src/features/hrm/api/phongBanQueries.ts`
- Create: `hdđt_maxv/src/features/hrm/components/HrmNav.tsx`
- Modify: `hdđt_maxv/src/pages/hrm/HrmPage.tsx` (đang rỗng)
- Create: `hdđt_maxv/src/pages/hrm/PhongBanPage.tsx`
- Delete: `hdđt_maxv/src/pages/hrm/Dashboard.tsx`, `hdđt_maxv/src/pages/hrm/employee.tsx`
- Modify: `hdđt_maxv/src/routes/AppRouter.tsx:68-76`

**Interfaces:**
- Consumes: API từ Task 4.
- Produces:
  - `interface PhongBan { ma_pb; ten_pb; ma_pb_me; ten_pb_me; ghi_chu; status; cap; so_nv }`
  - `interface PhongBanFormValues { ten_pb: string; ma_pb_me: string; ghi_chu: string; status: string }`
  - `EMPTY_PHONG_BAN_FORM: PhongBanFormValues`, `phongBanToForm(pb): PhongBanFormValues`
  - `hrmKeys.phongBan(companyId)`
  - `usePhongBanQuery()`, `useCreatePhongBanMutation()`, `useUpdatePhongBanMutation()`, `useDeletePhongBanMutation()`

  Task 6 dùng toàn bộ các tên trên.

- [ ] **Step 1: Khai báo kiểu**

Tạo `hdđt_maxv/src/features/hrm/types/index.ts`:

```ts
/**
 * 1 dòng phòng ban HRM — GET /hrm/phong-ban.
 * `cap` và `so_nv` do backend suy ra, không có cột tương ứng trong DB.
 */
export interface PhongBan {
  ma_pb: string;
  ten_pb: string;
  ma_pb_me: string | null;
  /** Tên phòng ban cha, backend tra sẵn để bảng khỏi phải tự nối. */
  ten_pb_me: string | null;
  /** Giao diện gọi là "Mô tả". */
  ghi_chu: string | null;
  status: string;
  /** Gốc = 1. */
  cap: number;
  /** Số nhân viên đang làm thuộc phòng ban này. */
  so_nv: number;
}

/** Giá trị form thêm/sửa. Không có `ma_pb` — server sinh mã. */
export interface PhongBanFormValues {
  ten_pb: string;
  ma_pb_me: string;
  ghi_chu: string;
  status: string;
}

export const EMPTY_PHONG_BAN_FORM: PhongBanFormValues = {
  ten_pb: '',
  ma_pb_me: '',
  ghi_chu: '',
  status: '1',
};

/** Dòng đang chọn -> giá trị form (null -> ''). */
export function phongBanToForm(pb: PhongBan): PhongBanFormValues {
  return {
    ten_pb: pb.ten_pb,
    ma_pb_me: pb.ma_pb_me ?? '',
    ghi_chu: pb.ghi_chu ?? '',
    status: pb.status || '1',
  };
}
```

- [ ] **Step 2: Viết API client**

Tạo `hdđt_maxv/src/features/hrm/api/phongBanApi.ts`:

```ts
import { apiFetchData } from '../../../lib/http';
import type { PhongBan, PhongBanFormValues } from '../types';

/**
 * Key cache của khu HRM. MỌI key phải chứa `companyId`: cùng một URL trả dữ liệu khác nhau
 * tùy công ty đang chọn trên header, thiếu companyId là dữ liệu nhân sự của MST này hiện
 * ra khi người dùng đã đổi sang MST khác.
 */
export const hrmKeys = {
  phongBan: (companyId: string | null) =>
    ['hrm', companyId, 'phong-ban'] as const,
};

/** Chuỗi rỗng trên form = "không có cha" -> gửi null, không gửi "". */
function toPayload(values: PhongBanFormValues) {
  return {
    ten_pb: values.ten_pb,
    ma_pb_me: values.ma_pb_me || null,
    ghi_chu: values.ghi_chu || null,
    status: values.status,
  };
}

/** GET /hrm/phong-ban — danh sách phẳng đã sắp theo cây, kèm `cap` và `so_nv`. */
export function listPhongBan(): Promise<PhongBan[]> {
  return apiFetchData<PhongBan[]>('/hrm/phong-ban');
}

/** POST /hrm/phong-ban — mã do server sinh, trả về mã vừa tạo. */
export function createPhongBan(
  values: PhongBanFormValues,
): Promise<{ ma_pb: string }> {
  return apiFetchData<{ ma_pb: string }>('/hrm/phong-ban', {
    method: 'POST',
    body: JSON.stringify(toPayload(values)),
  });
}

/** PUT /hrm/phong-ban/:ma_pb — chỉ đụng 4 cột của HRM, cột kế toán giữ nguyên. */
export function updatePhongBan(
  maPb: string,
  values: PhongBanFormValues,
): Promise<{ ma_pb: string }> {
  return apiFetchData<{ ma_pb: string }>(
    `/hrm/phong-ban/${encodeURIComponent(maPb)}`,
    { method: 'PUT', body: JSON.stringify(toPayload(values)) },
  );
}

/** DELETE /hrm/phong-ban/:ma_pb — 409 nếu còn cấp dưới hoặc còn nhân viên. */
export function deletePhongBan(maPb: string): Promise<{ ma_pb: string }> {
  return apiFetchData<{ ma_pb: string }>(
    `/hrm/phong-ban/${encodeURIComponent(maPb)}`,
    { method: 'DELETE' },
  );
}
```

- [ ] **Step 3: Viết hook query**

Tạo `hdđt_maxv/src/features/hrm/api/phongBanQueries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import {
  createPhongBan,
  deletePhongBan,
  hrmKeys,
  listPhongBan,
  updatePhongBan,
} from './phongBanApi';
import type { PhongBanFormValues } from '../types';

/** Danh sách phòng ban của công ty đang chọn. */
export function usePhongBanQuery() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hrmKeys.phongBan(currentCompanyId),
    queryFn: () => listPhongBan(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/**
 * Làm mới danh sách sau mỗi lần ghi. Dùng ở `onSettled` chứ không `onSuccess`: khi ghi
 * thất bại vì 404 (phòng ban vừa bị người khác xóa) thì màn hình đang lệch với server,
 * nạp lại mới đúng — thành công hay thất bại đều cần làm mới.
 */
function useInvalidatePhongBan() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return () =>
    void qc.invalidateQueries({
      queryKey: hrmKeys.phongBan(currentCompanyId),
    });
}

export function useCreatePhongBanMutation() {
  const invalidate = useInvalidatePhongBan();
  return useMutation({
    mutationFn: (values: PhongBanFormValues) => createPhongBan(values),
    onSettled: invalidate,
  });
}

export function useUpdatePhongBanMutation() {
  const invalidate = useInvalidatePhongBan();
  return useMutation({
    mutationFn: (vars: { maPb: string; values: PhongBanFormValues }) =>
      updatePhongBan(vars.maPb, vars.values),
    onSettled: invalidate,
  });
}

export function useDeletePhongBanMutation() {
  const invalidate = useInvalidatePhongBan();
  return useMutation({
    mutationFn: (maPb: string) => deletePhongBan(maPb),
    onSettled: invalidate,
  });
}
```

- [ ] **Step 4: Viết thanh điều hướng HRM**

Tạo `hdđt_maxv/src/features/hrm/components/HrmNav.tsx`:

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

/**
 * Điều hướng giữa các màn hình HRM. Dùng route con (không phải state như `SettingsPage`)
 * vì HRM là cụm màn hình: cần gửi link tới đúng màn hình và F5 phải giữ nguyên vị trí.
 * Lát 2 thêm mục chỉ việc nối vào mảng này.
 */
const MUC = [{ label: 'Phòng ban', to: '/hrm/phong-ban' }];

export default function HrmNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Path lạ (vd vừa xóa mục) -> về tab đầu thay vì để Tabs cảnh báo value ngoài danh sách.
  const hienTai = MUC.find((m) => pathname.startsWith(m.to))?.to ?? MUC[0].to;

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
      <Tabs value={hienTai} onChange={(_, to: string) => navigate(to)}>
        {MUC.map((m) => (
          <Tab
            key={m.to}
            value={m.to}
            label={m.label}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
```

Dùng `onChange` + `useNavigate` chứ không `component={NavLink}`: `Tab` với prop `component` kéo theo generic `OverridableComponent`, dễ vướng lỗi kiểu khi truyền `to`. Đánh đổi là mất khả năng bấm chuột giữa mở tab mới — chấp nhận được cho điều hướng nội bộ.

- [ ] **Step 5: Viết layout HRM**

Ghi đè `hdđt_maxv/src/pages/hrm/HrmPage.tsx` (file đang rỗng):

```tsx
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import AppHeader from '../../components/AppHeader';
import HrmNav from '../../features/hrm/components/HrmNav';

/**
 * Layout khu HRM. `AppHeader` render ở trang chứ không ở `App.tsx` — các trang đăng nhập
 * không có header (xem docs chương 13, mục 13.4).
 */
export default function HrmPage() {
  return (
    <>
      <AppHeader />
      <HrmNav />
      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </>
  );
}
```

- [ ] **Step 6: Tạo trang Phòng ban tạm thời**

Tạo `hdđt_maxv/src/pages/hrm/PhongBanPage.tsx` — bản tạm để kiểm định tuyến trước, Task 6 thay ruột:

```tsx
import Typography from '@mui/material/Typography';

export default function PhongBanPage() {
  return (
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Phòng ban
    </Typography>
  );
}
```

- [ ] **Step 7: Xóa hai file rỗng ngoài phạm vi**

```bash
cd hdđt_maxv && rm src/pages/hrm/Dashboard.tsx src/pages/hrm/employee.tsx
```

Cả hai đang rỗng (0 dòng) nên không mất nội dung nào. `Dashboard` không nằm trong thiết kế; màn hình nhân viên sẽ được tạo mới ở lát 2 với tên `NhanVienPage.tsx` đúng quy ước PascalCase.

- [ ] **Step 8: Khai báo route lồng**

Trong `hdđt_maxv/src/routes/AppRouter.tsx`, thêm import cạnh các import trang khác:

```tsx
import HrmPage from "../pages/hrm/HrmPage";
import PhongBanPage from "../pages/hrm/PhongBanPage";
```

Thay khối `<Route path="hrm" …>` hiện tại (element đang rỗng) bằng:

```tsx
          <Route
            path="hrm"
            element={
              <ProtectedRoute>
                <HrmPage />
              </ProtectedRoute>
            }
          >
            {/* Lát 2 đổi đích sang "nhan-vien" khi màn hình đó có thật. */}
            <Route index element={<Navigate to="phong-ban" replace />} />
            <Route path="phong-ban" element={<PhongBanPage />} />
          </Route>
```

`Navigate` đã được import sẵn ở đầu file. Giữ khối này **trước** `<Route path="*">`.

- [ ] **Step 9: Kiểm tra biên dịch và lint**

```bash
cd hdđt_maxv && npx tsc -b --noEmit && npm run lint
```

Expected: cả hai PASS.

- [ ] **Step 10: Kiểm thử tay điều hướng**

Frontend phải đang chạy — **không tự khởi động hay tắt dev server**, nếu chưa chạy thì nhờ người dùng chạy `npm run dev` trong `hdđt_maxv`.

1. Bấm nút **HRM** trên header → tự chuyển tới `/hrm/phong-ban`, thấy tab "Phòng ban" và chữ "Phòng ban".
2. Nhấn F5 tại `/hrm/phong-ban` → vẫn ở đúng trang, không nháy về trang chủ.
3. Gõ thẳng `/hrm` vào thanh địa chỉ → chuyển về `/hrm/phong-ban`.
4. Header vẫn đổi được công ty và đăng xuất được.

- [ ] **Step 11: Commit**

```bash
git add hdđt_maxv/src/features/hrm hdđt_maxv/src/pages/hrm hdđt_maxv/src/routes/AppRouter.tsx
git commit -m "🎉 Add HRM layout, nested routes and department API client"
```

---

### Task 6: Màn hình Phòng ban

**Files:**
- Create: `hdđt_maxv/src/features/hrm/components/phong_ban/PhongBanFormDialog.tsx`
- Create: `hdđt_maxv/src/features/hrm/components/phong_ban/PhongBanTable.tsx`
- Modify: `hdđt_maxv/src/pages/hrm/PhongBanPage.tsx`

**Interfaces:**
- Consumes: `PhongBan`, `PhongBanFormValues`, `EMPTY_PHONG_BAN_FORM`, `phongBanToForm` (Task 5 types); `usePhongBanQuery`, `useCreatePhongBanMutation`, `useUpdatePhongBanMutation`, `useDeletePhongBanMutation` (Task 5 queries); `getErrorMessage` từ `src/lib/errors.ts`.
- Produces: `PhongBanTable` (không nhận prop), `PhongBanFormDialog` (props `{ open, current, danhSach, onClose }`).

- [ ] **Step 1: Viết form dialog**

Tạo `hdđt_maxv/src/features/hrm/components/phong_ban/PhongBanFormDialog.tsx`:

```tsx
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { toast } from 'react-toastify';
import { getErrorMessage } from '../../../../lib/errors';
import {
  useCreatePhongBanMutation,
  useUpdatePhongBanMutation,
} from '../../api/phongBanQueries';
import {
  EMPTY_PHONG_BAN_FORM,
  phongBanToForm,
  type PhongBan,
  type PhongBanFormValues,
} from '../../types';

interface Props {
  open: boolean;
  /** null = thêm mới. */
  current: PhongBan | null;
  /** Toàn bộ danh sách — để dựng ô "Trực thuộc". */
  danhSach: PhongBan[];
  onClose: () => void;
}

/**
 * Form thêm/sửa phòng ban. KHÔNG có ô Mã — server sinh mã.
 * Ô Trạng thái chỉ hiện khi sửa: phòng ban mới luôn "Đang dùng".
 */
export default function PhongBanFormDialog({
  open,
  current,
  danhSach,
  onClose,
}: Props) {
  const [values, setValues] = useState<PhongBanFormValues>(EMPTY_PHONG_BAN_FORM);
  const [loiTen, setLoiTen] = useState('');
  const taoMoi = useCreatePhongBanMutation();
  const capNhat = useUpdatePhongBanMutation();
  const dangLuu = taoMoi.isPending || capNhat.isPending;

  // Nạp lại mỗi lần mở, nếu không thì lần mở thứ hai còn giữ dữ liệu của lần trước.
  useEffect(() => {
    if (!open) return;
    setValues(current ? phongBanToForm(current) : EMPTY_PHONG_BAN_FORM);
    setLoiTen('');
  }, [open, current]);

  /**
   * Không cho chọn chính nó hoặc con cháu nó làm cha — backend cũng chặn (409), nhưng chặn
   * ở đây thì người dùng không phải bấm Lưu mới biết.
   */
  const chonDuoc = useMemo(() => {
    if (!current) return danhSach;
    const cam = new Set<string>([current.ma_pb]);
    let themMoi = true;
    while (themMoi) {
      themMoi = false;
      for (const pb of danhSach) {
        if (pb.ma_pb_me && cam.has(pb.ma_pb_me) && !cam.has(pb.ma_pb)) {
          cam.add(pb.ma_pb);
          themMoi = true;
        }
      }
    }
    return danhSach.filter((pb) => !cam.has(pb.ma_pb));
  }, [current, danhSach]);

  const setField =
    (key: keyof PhongBanFormValues) => (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
    };

  function handleSubmit() {
    const ten = values.ten_pb.trim();
    if (!ten) {
      setLoiTen('Tên phòng ban không được để trống');
      return;
    }

    const payload = { ...values, ten_pb: ten };
    const onSuccess = () => {
      toast.success(current ? 'Đã cập nhật phòng ban' : 'Đã thêm phòng ban');
      onClose();
    };
    const onError = (err: unknown) =>
      toast.error(getErrorMessage(err, 'Lưu phòng ban thất bại.'));

    if (current) {
      capNhat.mutate(
        { maPb: current.ma_pb, values: payload },
        { onSuccess, onError },
      );
    } else {
      taoMoi.mutate(payload, { onSuccess, onError });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{current ? 'Sửa phòng ban' : 'Thêm phòng ban'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Tên phòng ban"
            value={values.ten_pb}
            onChange={setField('ten_pb')}
            error={!!loiTen}
            helperText={loiTen}
            required
            fullWidth
            size="small"
          />
          <TextField
            select
            label="Trực thuộc phòng ban"
            value={values.ma_pb_me}
            onChange={setField('ma_pb_me')}
            fullWidth
            size="small"
            helperText="Để trống nếu đây là phòng ban cấp cao nhất"
          >
            <MenuItem value="">— Không trực thuộc —</MenuItem>
            {chonDuoc.map((pb) => (
              {/* Thụt bằng padding, KHÔNG bằng khoảng trắng trong text — HTML gộp chúng lại. */}
              <MenuItem
                key={pb.ma_pb}
                value={pb.ma_pb}
                sx={{ pl: 2 + (pb.cap - 1) * 2 }}
              >
                {pb.ma_pb} — {pb.ten_pb}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Mô tả"
            value={values.ghi_chu}
            onChange={setField('ghi_chu')}
            fullWidth
            size="small"
            multiline
            minRows={2}
          />
          {current && (
            <TextField
              select
              label="Trạng thái"
              value={values.status}
              onChange={setField('status')}
              fullWidth
              size="small"
            >
              <MenuItem value="1">Đang dùng</MenuItem>
              <MenuItem value="0">Ngừng</MenuItem>
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={dangLuu}>
          Hủy
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={dangLuu}>
          {dangLuu ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Viết bảng**

Tạo `hdđt_maxv/src/features/hrm/components/phong_ban/PhongBanTable.tsx`:

```tsx
import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddRounded from '@mui/icons-material/AddRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import { toast } from 'react-toastify';
import { getErrorMessage } from '../../../../lib/errors';
import {
  useDeletePhongBanMutation,
  usePhongBanQuery,
} from '../../api/phongBanQueries';
import type { PhongBan } from '../../types';
import PhongBanFormDialog from './PhongBanFormDialog';

export default function PhongBanTable() {
  const { data, isLoading, isError, error } = usePhongBanQuery();
  const xoa = useDeletePhongBanMutation();

  const [tuKhoa, setTuKhoa] = useState('');
  const [form, setForm] = useState<{ open: boolean; current: PhongBan | null }>(
    { open: false, current: null },
  );
  const [sapXoa, setSapXoa] = useState<PhongBan | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  /**
   * Lọc KHÔNG đụng tới thứ tự cây do server trả về. Khi đang tìm kiếm thì cột "Cấp" vẫn là
   * cấp thật của phòng ban, chỉ có cha của nó có thể không hiển thị — chấp nhận được, đổi
   * lại người dùng luôn thấy đúng vị trí của phòng ban trong tổ chức.
   */
  const hienThi = useMemo(() => {
    const q = tuKhoa.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.ma_pb.toLowerCase().includes(q) || r.ten_pb.toLowerCase().includes(q),
    );
  }, [rows, tuKhoa]);

  function xacNhanXoa() {
    if (!sapXoa) return;
    xoa.mutate(sapXoa.ma_pb, {
      onSuccess: () => {
        toast.success(`Đã xóa phòng ban ${sapXoa.ma_pb}`);
        setSapXoa(null);
      },
      onError: (err) =>
        toast.error(getErrorMessage(err, 'Xóa phòng ban thất bại.')),
    });
  }

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mr: 'auto' }}>
          Phòng ban
        </Typography>
        <TextField
          size="small"
          placeholder="Tìm mã / tên phòng ban…"
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
        />
        {/* Gán nhanh hoàn thiện ở lát 2 — cần có nhân viên mới dùng được. */}
        <Tooltip title="Có ở bản sau, khi đã có danh mục nhân viên">
          <span>
            <Button variant="outlined" disabled>
              Gán nhanh phòng ban
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => setForm({ open: true, current: null })}
        >
          Thêm phòng ban
        </Button>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getErrorMessage(error, 'Không tải được danh sách phòng ban.')}
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã</TableCell>
              <TableCell>Tên phòng ban</TableCell>
              <TableCell>Trực thuộc</TableCell>
              <TableCell align="center">Cấp</TableCell>
              <TableCell align="right">Nhân viên</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
              <TableCell align="center">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  Đang tải…
                </TableCell>
              </TableRow>
            )}

            {hienThi.map((r) => (
              <TableRow
                key={r.ma_pb}
                hover
                onDoubleClick={() => setForm({ open: true, current: r })}
                sx={{ opacity: r.status === '0' ? 0.55 : 1 }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{r.ma_pb}</TableCell>
                <TableCell sx={{ pl: 2 + (r.cap - 1) * 3 }}>
                  {r.ten_pb}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {r.ten_pb_me ?? '—'}
                </TableCell>
                <TableCell align="center">{r.cap}</TableCell>
                <TableCell align="right">{r.so_nv}</TableCell>
                <TableCell align="center">
                  <Chip
                    size="small"
                    variant="outlined"
                    label={r.status === '1' ? 'Đang dùng' : 'Ngừng'}
                    color={r.status === '1' ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    title="Sửa"
                    onClick={() => setForm({ open: true, current: r })}
                  >
                    <EditRounded fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Xóa"
                    color="error"
                    onClick={() => setSapXoa(r)}
                  >
                    <DeleteRounded fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}

            {!isLoading && hienThi.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ py: 6, color: 'text.secondary' }}
                >
                  {tuKhoa
                    ? 'Không tìm thấy phòng ban phù hợp'
                    : 'Chưa có phòng ban nào'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <PhongBanFormDialog
        open={form.open}
        current={form.current}
        danhSach={rows}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />

      <Dialog open={!!sapXoa} onClose={() => setSapXoa(null)}>
        <DialogTitle>Xóa phòng ban</DialogTitle>
        <DialogContent>
          <Typography>
            Xóa phòng ban &quot;{sapXoa?.ma_pb} — {sapXoa?.ten_pb}&quot;? Hành
            động này không thể hoàn tác.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSapXoa(null)} disabled={xoa.isPending}>
            Hủy
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={xacNhanXoa}
            disabled={xoa.isPending}
          >
            {xoa.isPending ? 'Đang xóa…' : 'Xóa'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

- [ ] **Step 3: Nối vào trang**

Ghi đè `hdđt_maxv/src/pages/hrm/PhongBanPage.tsx`:

```tsx
import PhongBanTable from '../../features/hrm/components/phong_ban/PhongBanTable';

/** Trang mỏng — toàn bộ logic nằm trong `PhongBanTable`. */
export default function PhongBanPage() {
  return <PhongBanTable />;
}
```

- [ ] **Step 4: Kiểm tra biên dịch và lint**

```bash
cd hdđt_maxv && npx tsc -b --noEmit && npm run lint
```

Expected: cả hai PASS.

- [ ] **Step 5: Kiểm thử tay trên giao diện**

Dev server của cả `be_maxv` và `hdđt_maxv` phải đang chạy — **không tự khởi động hay tắt**, nhờ người dùng nếu cần. Xóa hết phòng ban thử nghiệm từ Task 4 trước khi bắt đầu.

1. **Thêm gốc** — bấm "Thêm phòng ban", nhập tên "Khối văn phòng", để trống Trực thuộc, Lưu. Kỳ vọng: toast xanh, dòng mới có mã `PB01`, Cấp `1`, Nhân viên `0`, Trạng thái "Đang dùng".
2. **Thêm con** — thêm "Kế toán", chọn Trực thuộc = `PB01`. Kỳ vọng: mã `PB01.01`, Cấp `2`, tên thụt vào, cột Trực thuộc hiện "Khối văn phòng", nằm ngay dưới `PB01`.
3. **Thêm cháu** — thêm "Kế toán thuế" trực thuộc `PB01.01`. Kỳ vọng: mã `PB01.01.01`, Cấp `3`, thụt sâu hơn.
4. **Chặn chu trình** — sửa `PB01`, mở ô Trực thuộc. Kỳ vọng: `PB01`, `PB01.01`, `PB01.01.01` **không** có trong danh sách chọn.
5. **Ngừng hoạt động** — sửa `PB01.01.01`, đặt Trạng thái "Ngừng", Lưu. Kỳ vọng: dòng mờ đi, chip đổi thành "Ngừng".
6. **Chặn xóa cha** — xóa `PB01`. Kỳ vọng: toast đỏ "Phòng ban còn phòng ban cấp dưới, không xóa được", dòng vẫn còn.
7. **Xóa từ dưới lên** — xóa `PB01.01.01`, rồi `PB01.01`, rồi `PB01`. Kỳ vọng: cả ba thành công.
8. **Tìm kiếm** — thêm lại vài phòng ban, gõ vào ô tìm. Kỳ vọng: lọc đúng theo mã và tên; xóa từ khóa thì danh sách trở lại đầy đủ.
9. **Đổi công ty** — đổi MST trên header. Kỳ vọng: danh sách phòng ban đổi theo, **không** hiện phòng ban của MST cũ.
10. **Nút Gán nhanh** — kỳ vọng: mờ, di chuột thấy tooltip "Có ở bản sau…".

- [ ] **Step 6: Commit**

```bash
git add hdđt_maxv/src/features/hrm/components/phong_ban hdđt_maxv/src/pages/hrm/PhongBanPage.tsx
git commit -m "🎉 Add HRM department screen with tree view and CRUD"
```

---

### Task 7: Tài liệu và kiểm tra hồi quy

**Files:**
- Modify: `hdđt_maxv/docs/14-hop-dong-api.md`
- Modify: `hdđt_maxv/docs/09-dinh-tuyen.md`

**Interfaces:**
- Consumes: endpoint từ Task 4, route từ Task 5.
- Produces: —

- [ ] **Step 1: Ghi hợp đồng API**

Trong `hdđt_maxv/docs/14-hop-dong-api.md`, thêm dòng vào bảng "Tiền tố" ở mục 14.1:

```markdown
| HRM (nhân sự) | `/api/v1/hrm` | `routes/hrm/*.route.ts` |
```

Thêm bốn dòng vào **bảng tổng hợp ở mục 14.8**, tiếp số sau dòng `| 30 |`:

```markdown
| 31 | GET | `/hrm/phong-ban` | ✔ | ✖ |
| 32 | POST | `/hrm/phong-ban` | ✔ | ✖ |
| 33 | PUT | `/hrm/phong-ban/:ma_pb` | ✔ | ✖ |
| 34 | DELETE | `/hrm/phong-ban/:ma_pb` | ✔ | ✖ |
```

Câu chốt ngay dưới bảng ("Đúng **ba** endpoint cần token Thuế điện tử…") vẫn đúng — bốn
endpoint mới đều không cần token GDT, giữ nguyên.

Rồi thêm mục mới **`## 14.9`** vào cuối tài liệu, đặt **trước** dòng điều hướng
`**Trước:** [13 — Hướng dẫn mở rộng]…`:

```markdown
## 14.9. HRM › Phòng ban — `/hrm/phong-ban`

Chạy trên bảng `dmpb` **dùng chung** với "Tổng hợp › Danh mục phòng ban" của `fe_maxv`.
Endpoint tách riêng vì HRM tự sinh mã, trả cây, và chỉ được ghi 4 cột — `PUT` của
`/tong-hop/phong-ban` dùng `optText` nên sẽ xóa trắng các cột kế toán.

| Method | Path | Auth | Client | Hàm FE |
|---|---|---|---|---|
| GET | `/hrm/phong-ban` | cookie | `apiFetchData` | `listPhongBan()` |
| POST | `/hrm/phong-ban` | cookie | `apiFetchData` | `createPhongBan()` |
| PUT | `/hrm/phong-ban/:ma_pb` | cookie | `apiFetchData` | `updatePhongBan()` |
| DELETE | `/hrm/phong-ban/:ma_pb` | cookie | `apiFetchData` | `deletePhongBan()` |

`GET` trả danh sách **phẳng đã sắp theo thứ tự duyệt cây**, mỗi dòng kèm `cap` (gốc = 1) và
`so_nv` (số nhân viên đang làm). Cả hai đều suy ra, không có cột trong DB.

`POST` **không nhận `ma_pb`** — server sinh: gốc `PB01`, `PB02`…; con của `PB01` là
`PB01.01`… Không tái dùng mã đã xóa.

`PUT` chỉ ghi `ten_pb`, `ma_pb_me`, `ghi_chu`, `status`.

Mã lỗi riêng: **409** khi đặt trực thuộc thành chính nó hoặc cấp dưới của nó, khi xóa phòng
ban còn cấp dưới, hoặc khi xóa phòng ban còn nhân viên.
```

- [ ] **Step 2: Ghi ngoại lệ định tuyến**

Trong `hdđt_maxv/docs/09-dinh-tuyen.md`, thêm vào **cuối mục 9.7** — ngay trước dòng
`## 9.8. Thêm một route mới`:

```markdown
> **Ngoại lệ: khu HRM.** `/hrm` dùng route con (`/hrm/phong-ban`…) với layout `HrmPage`
> thay vì state cục bộ. Lý do: HRM là cụm màn hình chứ không phải một trang nhiều tab —
> cần gửi link tới đúng màn hình và F5 phải giữ nguyên vị trí. Quy ước ở mục này vẫn áp
> dụng cho các tab **bên trong** một màn hình HRM (vd dialog nhân viên ở lát 2).
```

- [ ] **Step 3: Chạy toàn bộ kiểm tra**

```bash
cd be_maxv && npm run typecheck && npm run lint && npx tsx --test src/__tests__/hrmPhongBanCay.test.ts src/__tests__/hrmSinhMa.test.ts
```

Expected: typecheck PASS, lint PASS, test 18/18 PASS.

```bash
cd hdđt_maxv && npx tsc -b --noEmit && npm run lint
```

Expected: cả hai PASS.

- [ ] **Step 4: Kiểm tra hồi quy `fe_maxv`**

Mở `fe_maxv` → **Tổng hợp › Danh mục phòng ban**:

1. Danh sách hiện đủ cả phòng ban tạo từ HRM (địa chỉ / điện thoại trống).
2. Sửa một phòng ban tạo từ HRM: điền Địa chỉ và Điện thoại, Lưu.
3. Quay lại HRM, sửa **tên** phòng ban đó rồi Lưu.
4. Về `fe_maxv`, tải lại trang. **Kỳ vọng: Địa chỉ và Điện thoại vẫn còn nguyên** — đây chính là điều mà việc tách endpoint bảo vệ. Mất dữ liệu ở bước này nghĩa là `updatePhongBanHrm` đang ghi cả cột kế toán.

- [ ] **Step 5: Commit**

```bash
git add hdđt_maxv/docs/14-hop-dong-api.md hdđt_maxv/docs/09-dinh-tuyen.md
git commit -m "📝 Document HRM department API contract and routing exception"
```

---

## Định nghĩa hoàn thành lát 1

- [ ] Tạo được cây phòng ban ba cấp, sửa trực thuộc, xóa bị chặn đúng khi còn cấp dưới hoặc còn nhân viên.
- [ ] Trang Phòng ban của `fe_maxv` vẫn chạy nguyên vẹn, các cột kế toán không bị mất khi sửa từ HRM.
- [ ] `npm run typecheck` và `npm run lint` PASS ở cả hai project.
- [ ] 18 test HRM PASS.
- [ ] `npm run sync:tenants` báo 0 lỗi.
- [ ] Đổi công ty trên header thì danh sách phòng ban đổi theo, không rò dữ liệu giữa MST.
