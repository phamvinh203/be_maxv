# Lập tờ khai 01/GTGT từ hóa đơn điện tử — kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng module `tokhai` — đọc hóa đơn mua vào/bán ra đã đồng bộ trong DB tenant, tổng hợp thành tờ khai thuế GTGT mẫu 01/GTGT cho kế toán soát, sửa tay, lưu và xuất Excel.

**Architecture:** Ba lớp tách bạch. Lớp thuần (`kySoThue`, `gomHoaDonGtgt`, `tinhGtgt01`) không đụng DB/HTTP nên test được bằng `node:test` không cần Postgres — mọi con số đem nộp thuế đều đi qua đây. Lớp service đọc `vct50view`/`vct60view`/`sync_log`, ghi bảng mới `tokhai_gtgt01`. Lớp HTTP là controller mỏng + route có `requireModule("tokhai")`. Frontend dùng lại layout mẫu in 01/GTGT đang có bên module Dịch vụ công, tách ra thành file dùng chung cho hai màn.

**Tech Stack:** Fastify + Prisma (multi-tenant, schema `prisma/tenant`) · React 19 + MUI + TanStack Query · `node:test` chạy qua `npx tsx --test` · ExcelJS (đã có sẵn trong `exportXlsx.ts`).

**Spec:** `docs/superpowers/specs/2026-08-28-lap-to-khai-gtgt01-design.md`

## Global Constraints

- **Module `tokhai` KHÔNG gọi cổng thuế.** Không file nào trong `services/client/to_khai/`, `controllers/client/to_khai/`, `routes/to_khai/` được import `config/gdt-client` hay đọc header `X-Gdt-Token`. Dữ liệu duy nhất là DB tenant.
- **Khóa module là `tokhai`** — phải giống hệt ở cả ba nơi: `be_maxv/src/constants/modules.ts`, `maxv/src/features/owners/modules.ts`, `hdđt_maxv/src/features/auth/types/index.ts`. Khóa này ghi vào `SubscriptionPlan.features` nên không đổi tên giữa chừng.
- **Route FE `/to-khai`**, prefix API `/api/v1/to-khai`, nhãn nút "Tờ khai" — đã có sẵn trong `AppHeader.tsx`, không đổi.
- **Comment và định danh nghiệp vụ viết tiếng Việt không dấu** theo đúng lối các file hiện có (`layChiTietToKhai`, `timHoSoDaDongBo`…).
- **Cột tiền trong Prisma là `Decimal`** — luôn `Number(x ?? 0)` trước khi tính, không cộng thẳng object Decimal.
- **Ánh xạ thuế suất 8% → [32]/[33]** với số thuế THỰC TẾ; không tính lại bằng `[32] × 10%`.
- **Hóa đơn `tthai` 4 và 6 bị loại**; `tthai` 1, 2, 3, 5 được tính. Nhóm `tthai=3` cộng vào tổng nhưng gom riêng để hiển thị.
- Frontend **không có test framework** (`hdđt_maxv` chỉ có `lint` + `build`). Task FE nghiệm thu bằng `npx tsc -b`, `npm run build`, `npx eslint` và kiểm bằng tay trên trình duyệt.

---

### Task 1: Khai module `tokhai` ở ba app + route `/to-khai`

Nút "Tờ khai" đã có trong `AppHeader.tsx` nhưng `modules.tokhai` chưa tồn tại trong kiểu `UserModules` — hiện `hdđt_maxv` **không biên dịch được**. Task này vá lỗi đó và mở đường vào màn hình.

**Files:**
- Modify: `be_maxv/src/constants/modules.ts:9`
- Modify: `maxv/src/features/owners/modules.ts:10` và `:22`
- Modify: `hdđt_maxv/src/features/auth/types/index.ts:20`
- Modify: `hdđt_maxv/src/routes/AppRouter.tsx` (thêm route sau khối `dich-vu-cong`)
- Modify: `be_maxv/src/__tests__/moduleQuyen.test.ts` (9 literal `UserModules` hardcode ba khóa — thêm `tokhai: false`)
- Modify: `hdđt_maxv/src/pages/to_khai/ToKhai.tsx` (bỏ `import React` không dùng, TS6133)
- Test: `be_maxv/src/__tests__/moduleTokhai.test.ts`

**Interfaces:**
- Consumes: `MODULE_KEYS`, `moduleCuaGoi()` (`services/shared/modules.service.ts`), `ModuleRoute` (`hdđt_maxv/src/routes/ModuleRoute.tsx`)
- Produces: khóa module `"tokhai"` dùng được ở `requireModule("tokhai")` (BE, Task 8) và `modules.tokhai` (FE)

- [ ] **Step 1: Viết test thất bại**

```ts
// be_maxv/src/__tests__/moduleTokhai.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_KEYS, khongCoModule } from "../constants/modules";
import { moduleCuaGoi } from "../services/shared/modules.service";

test("MODULE_KEYS có khóa tokhai", () => {
  assert.ok((MODULE_KEYS as readonly string[]).includes("tokhai"));
});

test("khongCoModule() tắt cả tokhai", () => {
  assert.equal(khongCoModule().tokhai, false);
});

test("gói bật tokhai trong features thì moduleCuaGoi trả tokhai=true", () => {
  const sub = {
    status: "ACTIVE" as const,
    ketThuc: null,
    plan: { features: { tokhai: true } },
  };
  assert.equal(moduleCuaGoi(sub).tokhai, true);
});

test("gói hết hạn thì tokhai=false dù features bật", () => {
  const sub = {
    status: "ACTIVE" as const,
    ketThuc: new Date("2020-01-01"),
    plan: { features: { tokhai: true } },
  };
  assert.equal(moduleCuaGoi(sub).tokhai, false);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/moduleTokhai.test.ts`
Expected: FAIL — `MODULE_KEYS` chưa có `"tokhai"`, và TypeScript báo `Property 'tokhai' does not exist`.

- [ ] **Step 3: Thêm khóa vào ba app**

```ts
// be_maxv/src/constants/modules.ts
export const MODULE_KEYS = ['hrm', 'accounting', 'dvc', 'tokhai'] as const;
```

```ts
// maxv/src/features/owners/modules.ts
export const MODULE_KEYS = ['hrm', 'accounting', 'dvc', 'tokhai'] as const;

// ... trong MODULE_META, thêm mục cuối:
  tokhai: {
    nhanNgan: 'Tờ khai',
    moTa: 'Lập tờ khai thuế GTGT mẫu 01/GTGT từ hóa đơn điện tử đã đồng bộ.',
  },
```

```ts
// hdđt_maxv/src/features/auth/types/index.ts
export const MODULE_KEYS = ["hrm", "accounting", "dvc", "tokhai"] as const;
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/moduleTokhai.test.ts`
Expected: PASS cả 4 ca.

- [ ] **Step 5: Thêm route `/to-khai`**

Trong `hdđt_maxv/src/routes/AppRouter.tsx`, thêm import và khối route ngay sau khối `dich-vu-cong`:

```tsx
import ToKhai from "../pages/to_khai/ToKhai";

// ...
          <Route
            path="to-khai"
            element={
              <ProtectedRoute>
                <ModuleRoute module="tokhai">
                  <ToKhai />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 6: Kiểm biên dịch cả ba app**

Run: `cd be_maxv && npm run typecheck`
Run: `cd hdđt_maxv && npx tsc -b`
Run: `cd maxv && npx tsc -b`
Expected: cả ba sạch. Đặc biệt `modules.tokhai` ở `AppHeader.tsx:81` hết đỏ.

Thêm khóa vào `MODULE_KEYS` làm `UserModules` có bốn khóa, nên hai chỗ sẽ gãy và **phải sửa trong task này**:

1. `src/__tests__/moduleQuyen.test.ts` — 9 literal `{ hrm, accounting, dvc }` viết tay: hai chỗ truyền vào `assertModuleAllowed` gãy typecheck, bảy chỗ còn lại là `expected` của `deepEqual` nên gãy lúc chạy. Thêm `tokhai: false` vào cả chín. Các object `features` (đầu vào của `goi()`) cố ý chỉ khai vài khóa — giữ nguyên, đừng đụng.
2. `hdđt_maxv/src/pages/to_khai/ToKhai.tsx` — khung tạm có `import React` không dùng, gãy `tsc -b` với TS6133. Bỏ dòng import (Task 11 sẽ viết lại cả file).

- [ ] **Step 7: Commit**

```bash
git add be_maxv/src/constants/modules.ts be_maxv/src/__tests__/moduleTokhai.test.ts be_maxv/src/__tests__/moduleQuyen.test.ts maxv/src/features/owners/modules.ts "hdđt_maxv/src/features/auth/types/index.ts" "hdđt_maxv/src/routes/AppRouter.tsx" "hdđt_maxv/src/components/AppHeader.tsx" "hdđt_maxv/src/pages/to_khai/ToKhai.tsx"
git commit -m "🎉: Thêm module tokhai vào gói đăng ký và route /to-khai"
```

---

### Task 2: Bảng `tokhai_gtgt01` trong schema tenant

**Files:**
- Modify: `be_maxv/prisma/tenant/schema.prisma` (thêm vào cuối file)

**Interfaces:**
- Produces: model Prisma `tokhai_gtgt01` với khóa ghép `[nam, ky_loai, ky_so]`, dùng ở Task 7

- [ ] **Step 1: Thêm model vào cuối `prisma/tenant/schema.prisma`**

```prisma
// ============================================================
//  TỜ KHAI › LẬP TỜ KHAI GTGT (mẫu 01/GTGT)
//  Chỉ đọc hóa đơn đã đồng bộ (vct50view/vct60view) — module này KHÔNG gọi cổng thuế.
// ============================================================

/// Một bản tờ khai 01/GTGT do phần mềm lập cho MỘT kỳ tính thuế.
/// `nhap` = mở lại là tính lại từ hóa đơn (ô đã ghi đè giữ nguyên); `chot` = đóng băng số.
model tokhai_gtgt01 {
  nam     Int
  ky_loai String @db.VarChar(8) // thang | quy
  ky_so   Int // 1..12 (tháng) hoặc 1..4 (quý)

  trang_thai String @default("nhap") @db.VarChar(16) // nhap | chot

  /// Bộ chỉ tiêu CUỐI — số đem đi nộp: { ct22, ct23, ..., ct43 }.
  ct Json
  /// Số máy tự tính, giữ nguyên kể cả sau khi kế toán ghi đè — để đối chiếu "máy ra bao nhiêu".
  ct_may Json
  /// Ô kế toán sửa tay + lý do: { ct25: { gia: 1234, lyDo: "..." } }. Lượt tính lại KHÔNG xóa.
  ghi_de Json

  /// Bản sao ba khóa cùng tên trong `ct`, bóc ra cột để truy vấn: `ct43` cho kỳ sau nối [22],
  /// `ct40`/`ct22` cho bảng danh sách kỳ. Ghi cùng lượt với `ct`, không có đường sửa riêng.
  ct22 Decimal @default(0) @db.Decimal(18, 2)
  ct40 Decimal @default(0) @db.Decimal(18, 2)
  ct43 Decimal @default(0) @db.Decimal(18, 2)

  /// [22] lấy ở đâu ra: ky_truoc (ct43 của bản đã chốt kỳ liền trước) | nhap_tay.
  nguon_ct22 String @default("nhap_tay") @db.VarChar(16)

  so_hd_ban       Int @default(0)
  so_hd_mua       Int @default(0)
  /// Số hóa đơn thiếu `detail` lúc tính — bản hợp lệ phải là 0 (xem `sanSangKy`).
  hd_thieu_detail Int @default(0)

  tinh_luc DateTime?

  datetime0 DateTime @default(now())
  datetime2 DateTime @updatedAt

  @@id([nam, ky_loai, ky_so])
}
```

- [ ] **Step 2: Sinh lại Prisma client**

Run: `cd be_maxv && npm run generate`
Expected: chạy xong không lỗi; `src/generated/tenant` có `tokhai_gtgt01`.

- [ ] **Step 3: Kiểm biên dịch**

Run: `cd be_maxv && npm run typecheck`
Expected: sạch.

- [ ] **Step 4: Commit**

```bash
git add be_maxv/prisma/tenant/schema.prisma be_maxv/src/generated
git commit -m "🎉: Thêm bảng tokhai_gtgt01 cho module lập tờ khai"
```

> **Bước thủ công, KHÔNG tự chạy:** đẩy schema lên các DB tenant bằng `npm run sync:tenants` — lệnh này đụng dữ liệu thật của mọi công ty, để người chủ dự án chạy khi thấy hợp lý.

---

### Task 3: `kySoThue.ts` — quy đổi kỳ tính thuế

**Files:**
- Create: `be_maxv/src/services/client/to_khai/kySoThue.ts`
- Test: `be_maxv/src/__tests__/kySoThue.test.ts`

**Interfaces:**
- Produces:
  - `type KyLoai = "thang" | "quy"`
  - `interface Ky { nam: number; kyLoai: KyLoai; kySo: number }`
  - `function khoangCuaKy(ky: Ky): { tuNgay: Date; denNgay: Date }` — `denNgay` là 23:59:59.999 của ngày cuối kỳ
  - `function kyLienTruoc(ky: Ky): Ky`
  - `function nhanKy(ky: Ky): string` — `"T7/2026"` / `"Q3/2026"`
  - `function kyHopLe(ky: Ky): boolean`

- [ ] **Step 1: Viết test thất bại**

```ts
// be_maxv/src/__tests__/kySoThue.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { khoangCuaKy, kyLienTruoc, nhanKy, kyHopLe } from "../services/client/to_khai/kySoThue";

const iso = (d: Date) => d.toISOString().slice(0, 10);

test("kỳ tháng 7/2026 ra đúng khoảng ngày", () => {
  const { tuNgay, denNgay } = khoangCuaKy({ nam: 2026, kyLoai: "thang", kySo: 7 });
  assert.equal(iso(tuNgay), "2026-07-01");
  assert.equal(iso(denNgay), "2026-07-31");
});

test("tháng 2 năm nhuận ra ngày 29", () => {
  const { denNgay } = khoangCuaKy({ nam: 2024, kyLoai: "thang", kySo: 2 });
  assert.equal(iso(denNgay), "2024-02-29");
});

test("tháng 12 không tràn sang năm sau", () => {
  const { tuNgay, denNgay } = khoangCuaKy({ nam: 2026, kyLoai: "thang", kySo: 12 });
  assert.equal(iso(tuNgay), "2026-12-01");
  assert.equal(iso(denNgay), "2026-12-31");
});

test("quý 3/2026 ra đúng khoảng ngày", () => {
  const { tuNgay, denNgay } = khoangCuaKy({ nam: 2026, kyLoai: "quy", kySo: 3 });
  assert.equal(iso(tuNgay), "2026-07-01");
  assert.equal(iso(denNgay), "2026-09-30");
});

test("quý 4/2026 kết thúc 31/12", () => {
  const { denNgay } = khoangCuaKy({ nam: 2026, kyLoai: "quy", kySo: 4 });
  assert.equal(iso(denNgay), "2026-12-31");
});

test("kỳ liền trước của T1 là T12 năm trước", () => {
  assert.deepEqual(kyLienTruoc({ nam: 2026, kyLoai: "thang", kySo: 1 }), {
    nam: 2025,
    kyLoai: "thang",
    kySo: 12,
  });
});

test("kỳ liền trước của Q1 là Q4 năm trước", () => {
  assert.deepEqual(kyLienTruoc({ nam: 2026, kyLoai: "quy", kySo: 1 }), {
    nam: 2025,
    kyLoai: "quy",
    kySo: 4,
  });
});

test("nhãn kỳ", () => {
  assert.equal(nhanKy({ nam: 2026, kyLoai: "thang", kySo: 7 }), "T7/2026");
  assert.equal(nhanKy({ nam: 2026, kyLoai: "quy", kySo: 3 }), "Q3/2026");
});

test("kỳ ngoài biên bị chặn", () => {
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "thang", kySo: 13 }), false);
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "quy", kySo: 5 }), false);
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "quy", kySo: 4 }), true);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/kySoThue.test.ts`
Expected: FAIL — không tìm thấy module `kySoThue`.

- [ ] **Step 3: Viết `kySoThue.ts`**

```ts
// be_maxv/src/services/client/to_khai/kySoThue.ts
/**
 * Quy đổi kỳ tính thuế <-> khoảng ngày. Dùng tại: `sanSangKy.ts` (đếm hóa đơn trong kỳ),
 * `toKhaiGtgt01.service.ts` (đọc hóa đơn, nối [22] từ kỳ trước).
 */

export type KyLoai = "thang" | "quy";

export interface Ky {
  nam: number;
  kyLoai: KyLoai;
  kySo: number;
}

/** Số kỳ tối đa theo loại — tháng 12, quý 4. */
function soKyToiDa(kyLoai: KyLoai): number {
  return kyLoai === "thang" ? 12 : 4;
}

export function kyHopLe(ky: Ky): boolean {
  if (!Number.isInteger(ky.nam) || ky.nam < 2000 || ky.nam > 2999) return false;
  if (ky.kyLoai !== "thang" && ky.kyLoai !== "quy") return false;
  return Number.isInteger(ky.kySo) && ky.kySo >= 1 && ky.kySo <= soKyToiDa(ky.kyLoai);
}

/**
 * Khoảng ngày của kỳ. `denNgay` lấy tới 23:59:59.999 của ngày cuối để so sánh `tdlap` (kiểu
 * DateTime, có giờ) không cắt mất hóa đơn lập chiều ngày cuối kỳ.
 */
export function khoangCuaKy(ky: Ky): { tuNgay: Date; denNgay: Date } {
  const thangDau = ky.kyLoai === "thang" ? ky.kySo : (ky.kySo - 1) * 3 + 1;
  const soThang = ky.kyLoai === "thang" ? 1 : 3;
  // Date.UTC với day=0 của tháng kế tiếp = ngày cuối cùng của tháng hiện tại (tự đúng năm nhuận).
  const tuNgay = new Date(Date.UTC(ky.nam, thangDau - 1, 1, 0, 0, 0, 0));
  const denNgay = new Date(Date.UTC(ky.nam, thangDau - 1 + soThang, 0, 23, 59, 59, 999));
  return { tuNgay, denNgay };
}

export function kyLienTruoc(ky: Ky): Ky {
  if (ky.kySo > 1) return { ...ky, kySo: ky.kySo - 1 };
  return { nam: ky.nam - 1, kyLoai: ky.kyLoai, kySo: soKyToiDa(ky.kyLoai) };
}

export function nhanKy(ky: Ky): string {
  return `${ky.kyLoai === "thang" ? "T" : "Q"}${ky.kySo}/${ky.nam}`;
}
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/kySoThue.test.ts`
Expected: PASS cả 9 ca.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/services/client/to_khai/kySoThue.ts be_maxv/src/__tests__/kySoThue.test.ts
git commit -m "🎉: Thêm quy đổi kỳ tính thuế cho module tờ khai"
```

---

### Task 4: `gomHoaDonGtgt.ts` — lọc trạng thái và gộp theo thuế suất

**Files:**
- Create: `be_maxv/src/services/client/to_khai/gomHoaDonGtgt.ts`
- Test: `be_maxv/src/__tests__/gomHoaDonGtgt.test.ts`

**Interfaces:**
- Produces:
  - `interface HoaDonGom { id: string; tthai: string | null; dvtte: string | null; tgia: unknown; tgtcthue: unknown; tgtthue: unknown; detail: unknown }`
  - `interface TongBanRa { ct26: number; ct29: number; ct30: number; ct31: number; ct32: number; ct32a: number; ct33: number }`
  - `interface HoaDonTreo { id: string; lyDo: string }`
  - `interface KetQuaBanRa { tong: TongBanRa; treo: HoaDonTreo[]; dieuChinh: { soHd: number; giaTri: number; thue: number }; soHd: number }`
  - `interface KetQuaMuaVao { ct23: number; ct24: number; treo: HoaDonTreo[]; soHd: number }`
  - `function gomBanRa(rows: HoaDonGom[]): KetQuaBanRa`
  - `function gomMuaVao(rows: HoaDonGom[]): KetQuaMuaVao`
  - `function duocTinh(tthai: string | null): boolean`

- [ ] **Step 1: Viết test thất bại**

```ts
// be_maxv/src/__tests__/gomHoaDonGtgt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { duocTinh, gomBanRa, gomMuaVao } from "../services/client/to_khai/gomHoaDonGtgt";
import type { HoaDonGom } from "../services/client/to_khai/gomHoaDonGtgt";

/** Dựng 1 hóa đơn bán ra với các nhóm thuế suất cho sẵn. */
function hd(
  id: string,
  tthai: string,
  nhom: { tsuat: string; thtien: number; tthue: number }[],
  them: Partial<HoaDonGom> = {},
): HoaDonGom {
  const giaTri = nhom.reduce((s, n) => s + n.thtien, 0);
  const thue = nhom.reduce((s, n) => s + n.tthue, 0);
  return {
    id,
    tthai,
    dvtte: "VND",
    tgia: 1,
    tgtcthue: giaTri,
    tgtthue: thue,
    detail: { thttltsuat: nhom },
    ...them,
  };
}

test("loại hóa đơn đã bị thay thế (4) và đã bị hủy (6)", () => {
  assert.equal(duocTinh("1"), true);
  assert.equal(duocTinh("2"), true);
  assert.equal(duocTinh("3"), true);
  assert.equal(duocTinh("4"), false);
  assert.equal(duocTinh("5"), true);
  assert.equal(duocTinh("6"), false);
});

test("gộp bán ra theo từng mức thuế suất", () => {
  const kq = gomBanRa([
    hd("a", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("b", "1", [{ tsuat: "5%", thtien: 2_000_000, tthue: 100_000 }]),
    hd("c", "1", [{ tsuat: "0%", thtien: 3_000_000, tthue: 0 }]),
    hd("d", "1", [{ tsuat: "KCT", thtien: 4_000_000, tthue: 0 }]),
    hd("e", "1", [{ tsuat: "KKKNT", thtien: 5_000_000, tthue: 0 }]),
  ]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.tong.ct33, 100_000);
  assert.equal(kq.tong.ct30, 2_000_000);
  assert.equal(kq.tong.ct31, 100_000);
  assert.equal(kq.tong.ct29, 3_000_000);
  assert.equal(kq.tong.ct26, 4_000_000);
  assert.equal(kq.tong.ct32a, 5_000_000);
  assert.equal(kq.soHd, 5);
});

test("hàng 8% vào [32]/[33] với số thuế THỰC TẾ, không phải 10%", () => {
  const kq = gomBanRa([hd("a", "1", [{ tsuat: "8%", thtien: 1_000_000, tthue: 80_000 }])]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.tong.ct33, 80_000);
  assert.notEqual(kq.tong.ct33, 100_000);
});

test("hóa đơn bị loại không được cộng vào tổng", () => {
  const kq = gomBanRa([
    hd("giu", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("bothaythe", "4", [{ tsuat: "10%", thtien: 9_000_000, tthue: 900_000 }]),
    hd("dahuy", "6", [{ tsuat: "10%", thtien: 8_000_000, tthue: 800_000 }]),
  ]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.soHd, 1);
});

test("hóa đơn điều chỉnh vẫn cộng vào tổng nhưng gom riêng để hiển thị", () => {
  const kq = gomBanRa([
    hd("goc", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("dc", "3", [{ tsuat: "10%", thtien: 200_000, tthue: 20_000 }]),
  ]);
  assert.equal(kq.tong.ct32, 1_200_000);
  assert.equal(kq.dieuChinh.soHd, 1);
  assert.equal(kq.dieuChinh.giaTri, 200_000);
  assert.equal(kq.dieuChinh.thue, 20_000);
});

test("nhãn thuế suất lạ không cộng vào đâu, xếp vào nhóm treo", () => {
  const kq = gomBanRa([hd("la", "1", [{ tsuat: "???", thtien: 500_000, tthue: 0 }])]);
  assert.equal(kq.tong.ct32, 0);
  assert.equal(kq.tong.ct26, 0);
  assert.equal(kq.treo.length, 1);
  assert.equal(kq.treo[0].id, "la");
});

test("hóa đơn chưa tải chi tiết xếp vào nhóm treo", () => {
  const kq = gomBanRa([{ ...hd("x", "1", []), detail: null }]);
  assert.equal(kq.treo.length, 1);
  assert.match(kq.treo[0].lyDo, /chi tiết/i);
});

test("hóa đơn ngoại tệ quy đổi theo tỷ giá", () => {
  const kq = gomBanRa([
    hd("usd", "1", [{ tsuat: "10%", thtien: 100, tthue: 10 }], { dvtte: "USD", tgia: 25_000 }),
  ]);
  assert.equal(kq.tong.ct32, 2_500_000);
  assert.equal(kq.tong.ct33, 250_000);
});

test("ngoại tệ thiếu tỷ giá thì treo, không quy đổi bừa", () => {
  const kq = gomBanRa([
    hd("usd", "1", [{ tsuat: "10%", thtien: 100, tthue: 10 }], { dvtte: "USD", tgia: null }),
  ]);
  assert.equal(kq.tong.ct32, 0);
  assert.equal(kq.treo.length, 1);
});

test("mua vào cộng tổng chưa thuế và tiền thuế", () => {
  const kq = gomMuaVao([
    hd("a", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("b", "6", [{ tsuat: "10%", thtien: 7_000_000, tthue: 700_000 }]),
  ]);
  assert.equal(kq.ct23, 1_000_000);
  assert.equal(kq.ct24, 100_000);
  assert.equal(kq.soHd, 1);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/gomHoaDonGtgt.test.ts`
Expected: FAIL — không tìm thấy module `gomHoaDonGtgt`.

- [ ] **Step 3: Viết `gomHoaDonGtgt.ts`**

```ts
// be_maxv/src/services/client/to_khai/gomHoaDonGtgt.ts
/**
 * Lọc hóa đơn theo trạng thái rồi gộp tiền theo từng mức thuế suất, ra đúng các ô của mẫu 01/GTGT.
 *
 * Hàm THUẦN: nhận mảng dòng đã đọc sẵn từ `vct50view`/`vct60view`, không đụng DB. Dùng tại:
 * `toKhaiGtgt01.service.ts`. Test: `src/__tests__/gomHoaDonGtgt.test.ts`.
 *
 * Số tách theo thuế suất chỉ có trong `detail.thttltsuat` — hóa đơn chưa tải chi tiết KHÔNG đoán
 * được là 8% hay 10%, nên xếp vào `treo` thay vì cộng nhầm.
 */

/** Dòng hóa đơn tối giản mà engine cần — khớp `select` của `toKhaiGtgt01.service.ts`. */
export interface HoaDonGom {
  id: string;
  tthai: string | null;
  dvtte: string | null;
  /** Prisma trả Decimal; ép qua `so()` trước khi tính. */
  tgia: unknown;
  tgtcthue: unknown;
  tgtthue: unknown;
  detail: unknown;
}

export interface TongBanRa {
  ct26: number;
  ct29: number;
  ct30: number;
  ct31: number;
  ct32: number;
  ct32a: number;
  ct33: number;
}

export interface HoaDonTreo {
  id: string;
  lyDo: string;
}

export interface KetQuaBanRa {
  tong: TongBanRa;
  treo: HoaDonTreo[];
  /** Nhóm `tthai=3` — ĐÃ cộng vào `tong`, tách ra đây chỉ để hiển thị và soát dấu (spec mục 11.1). */
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  soHd: number;
}

export interface KetQuaMuaVao {
  ct23: number;
  ct24: number;
  treo: HoaDonTreo[];
  soHd: number;
}

/** Trạng thái hóa đơn bị loại khỏi tờ khai: 4 = đã bị thay thế, 6 = đã bị hủy. */
const TTHAI_LOAI = new Set(["4", "6"]);

export function duocTinh(tthai: string | null): boolean {
  return !TTHAI_LOAI.has(String(tthai ?? "").trim());
}

/** Decimal/số/chuỗi -> number; không đọc được -> 0. */
function so(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Chuẩn hóa nhãn thuế suất cổng trả ("10", "10%", " KCT ") về một dạng duy nhất để tra bảng ánh xạ.
 * Mức số ra `"10%"`; mã chữ ra chữ hoa không dấu cách.
 */
function chuanHoaNhan(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  const soPhanTram = Number(s.replace("%", ""));
  return Number.isFinite(soPhanTram) ? `${soPhanTram}%` : s;
}

/**
 * Nhãn thuế suất -> ô nhận giá trị và ô nhận tiền thuế. Sửa mức thuế suất mới CHỈ ở bảng này.
 * Export vì `toKhaiGtgt01.service.ts` suy ánh xạ NGƯỢC (chỉ tiêu -> nhãn) từ chính bảng này cho
 * bảng kê — hai chiều dùng chung một nguồn thì không bao giờ lệch nhau.
 */
export const O_THEO_NHAN: Record<string, { giaTri: keyof TongBanRa; thue?: keyof TongBanRa }> = {
  KCT: { giaTri: "ct26" },
  "0%": { giaTri: "ct29" },
  "5%": { giaTri: "ct30", thue: "ct31" },
  // 8% (giảm theo nghị quyết) kê chung dòng 10%; [33] lấy số thuế THỰC TẾ, không nhân lại 10%.
  "8%": { giaTri: "ct32", thue: "ct33" },
  "10%": { giaTri: "ct32", thue: "ct33" },
  KKKNT: { giaTri: "ct32a" },
};

/** Các nhóm thuế suất của một hóa đơn; `null` = hóa đơn chưa có chi tiết. */
function nhomThueSuat(detail: unknown): { nhan: string; thtien: number; tthue: number }[] | null {
  if (!detail || typeof detail !== "object") return null;
  const ds = (detail as Record<string, unknown>).thttltsuat;
  if (!Array.isArray(ds)) return null;
  return ds.map((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    return {
      nhan: chuanHoaNhan(o.ltsuat ?? o.tsuat ?? o.thuesuat),
      thtien: so(o.thtien),
      tthue: so(o.tthue),
    };
  });
}

/** Hệ số quy đổi về VND; `null` = ngoại tệ mà thiếu tỷ giá -> không đoán, cho hóa đơn treo. */
function heSoQuyDoi(hd: HoaDonGom): number | null {
  const dvt = String(hd.dvtte ?? "").trim().toUpperCase();
  if (!dvt || dvt === "VND") return 1;
  const tg = so(hd.tgia);
  return tg > 0 ? tg : null;
}

export function gomBanRa(rows: HoaDonGom[]): KetQuaBanRa {
  const tong: TongBanRa = { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0 };
  const treo: HoaDonTreo[] = [];
  const dieuChinh = { soHd: 0, giaTri: 0, thue: 0 };
  let soHd = 0;

  for (const hd of rows) {
    if (!duocTinh(hd.tthai)) continue;

    const heSo = heSoQuyDoi(hd);
    if (heSo === null) {
      treo.push({ id: hd.id, lyDo: `Hóa đơn ngoại tệ ${hd.dvtte} nhưng thiếu tỷ giá` });
      continue;
    }

    const nhom = nhomThueSuat(hd.detail);
    if (nhom === null || nhom.length === 0) {
      treo.push({ id: hd.id, lyDo: "Hóa đơn chưa tải chi tiết nên chưa tách được thuế suất" });
      continue;
    }

    let coNhanLa = false;
    let giaTriHd = 0;
    let thueHd = 0;
    for (const g of nhom) {
      const o = O_THEO_NHAN[g.nhan];
      if (!o) {
        coNhanLa = true;
        continue;
      }
      const giaTri = g.thtien * heSo;
      const thue = g.tthue * heSo;
      tong[o.giaTri] += giaTri;
      if (o.thue) tong[o.thue] += thue;
      giaTriHd += giaTri;
      thueHd += thue;
    }

    if (coNhanLa) {
      treo.push({ id: hd.id, lyDo: "Có mức thuế suất chưa nhận diện được" });
    }
    soHd += 1;
    if (String(hd.tthai ?? "").trim() === "3") {
      dieuChinh.soHd += 1;
      dieuChinh.giaTri += giaTriHd;
      dieuChinh.thue += thueHd;
    }
  }

  return { tong, treo, dieuChinh, soHd };
}

/**
 * Mua vào chỉ cần tổng: [23] giá trị, [24] tiền thuế. Không tách theo thuế suất nên KHÔNG cần
 * `detail` — hóa đơn chưa tải chi tiết vẫn cộng được (khác `gomBanRa`).
 */
export function gomMuaVao(rows: HoaDonGom[]): KetQuaMuaVao {
  const treo: HoaDonTreo[] = [];
  let ct23 = 0;
  let ct24 = 0;
  let soHd = 0;

  for (const hd of rows) {
    if (!duocTinh(hd.tthai)) continue;
    const heSo = heSoQuyDoi(hd);
    if (heSo === null) {
      treo.push({ id: hd.id, lyDo: `Hóa đơn ngoại tệ ${hd.dvtte} nhưng thiếu tỷ giá` });
      continue;
    }
    ct23 += so(hd.tgtcthue) * heSo;
    ct24 += so(hd.tgtthue) * heSo;
    soHd += 1;
  }

  return { ct23, ct24, treo, soHd };
}
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/gomHoaDonGtgt.test.ts`
Expected: PASS cả 10 ca.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/services/client/to_khai/gomHoaDonGtgt.ts be_maxv/src/__tests__/gomHoaDonGtgt.test.ts
git commit -m "🎉: Thêm bộ gộp hóa đơn theo thuế suất cho tờ khai 01/GTGT"
```

---

### Task 5: `tinhGtgt01.ts` — công thức chỉ tiêu

**Files:**
- Create: `be_maxv/src/services/client/to_khai/tinhGtgt01.ts`
- Test: `be_maxv/src/__tests__/tinhGtgt01.test.ts`

**Interfaces:**
- Consumes: `TongBanRa` (Task 4)
- Produces:
  - `type CtNhapTay = "ct22" | "ct23a" | "ct24a" | "ct25" | "ct37" | "ct38" | "ct39a" | "ct40b" | "ct42"`
  - `interface DauVaoGtgt01 { banRa: TongBanRa; muaVao: { ct23: number; ct24: number }; nhapTay: Partial<Record<CtNhapTay, number>> }`
  - `type CtGtgt01 = Record<string, number>`
  - `function tinhGtgt01(dv: DauVaoGtgt01): CtGtgt01`
  - `const CT_NHAP_TAY: readonly CtNhapTay[]`

- [ ] **Step 1: Viết test thất bại**

```ts
// be_maxv/src/__tests__/tinhGtgt01.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { tinhGtgt01 } from "../services/client/to_khai/tinhGtgt01";
import type { TongBanRa } from "../services/client/to_khai/gomHoaDonGtgt";

const BAN_RA_RONG: TongBanRa = { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0 };

test("[27] và [28] cộng đúng các dòng con", () => {
  const ct = tinhGtgt01({
    banRa: { ...BAN_RA_RONG, ct29: 1_000, ct30: 2_000, ct31: 100, ct32: 3_000, ct33: 300, ct32a: 4_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct27, 10_000);
  assert.equal(ct.ct28, 400);
});

test("[34] = [26] + [27] và [35] = [28]", () => {
  const ct = tinhGtgt01({
    banRa: { ...BAN_RA_RONG, ct26: 5_000, ct32: 3_000, ct33: 300 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct34, 8_000);
  assert.equal(ct.ct35, 300);
});

test("[25] mặc định bằng [24]", () => {
  const ct = tinhGtgt01({ banRa: BAN_RA_RONG, muaVao: { ct23: 10_000, ct24: 1_000 }, nhapTay: {} });
  assert.equal(ct.ct25, 1_000);
});

test("[25] nhập tay thì thắng số mặc định", () => {
  const ct = tinhGtgt01({
    banRa: BAN_RA_RONG,
    muaVao: { ct23: 10_000, ct24: 1_000 },
    nhapTay: { ct25: 600 },
  });
  assert.equal(ct.ct25, 600);
  assert.equal(ct.ct36, -600);
});

test("phát sinh dương: [40a] mang số, [41] bằng 0", () => {
  const ct = tinhGtgt01({
    banRa: { ...BAN_RA_RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 2_000_000, ct24: 200_000 },
    nhapTay: { ct22: 100_000 },
  });
  assert.equal(ct.ct36, 800_000);
  assert.equal(ct.ct40a, 700_000);
  assert.equal(ct.ct41, 0);
  assert.equal(ct.ct40, 700_000);
  assert.equal(ct.ct43, 0);
});

test("không phát sinh đầu ra: [41] = [22] + [25], [40a] = 0", () => {
  // Đây là dạng đã đối chiếu trên 5 hồ sơ thật của MST 0106200129 (spec mục 7.6).
  const ct = tinhGtgt01({
    banRa: BAN_RA_RONG,
    muaVao: { ct23: 40_000_000, ct24: 4_407_359 },
    nhapTay: { ct22: 25_418_834 },
  });
  assert.equal(ct.ct41, 29_826_193);
  assert.equal(ct.ct40a, 0);
  assert.equal(ct.ct40, 0);
  assert.equal(ct.ct43, 29_826_193);
});

test("[40a] và [41] loại trừ nhau — không bao giờ cùng khác 0", () => {
  for (const ct24 of [0, 500, 1_000, 5_000]) {
    const ct = tinhGtgt01({
      banRa: { ...BAN_RA_RONG, ct32: 10_000, ct33: 1_000 },
      muaVao: { ct23: 0, ct24 },
      nhapTay: {},
    });
    assert.ok(ct.ct40a === 0 || ct.ct41 === 0, `ct24=${ct24}`);
  }
});

test("điều chỉnh tăng giảm và bàn giao vào đúng công thức", () => {
  const ct = tinhGtgt01({
    banRa: { ...BAN_RA_RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct22: 0, ct37: 50_000, ct38: 30_000, ct39a: 20_000 },
  });
  // X = 1.000.000 - 0 + 50.000 - 30.000 - 20.000
  assert.equal(ct.ct40a, 1_000_000);
});

test("[43] = [41] - [42] và [40] = [40a] - [40b]", () => {
  const ct = tinhGtgt01({
    banRa: BAN_RA_RONG,
    muaVao: { ct23: 0, ct24: 1_000_000 },
    nhapTay: { ct42: 400_000 },
  });
  assert.equal(ct.ct41, 1_000_000);
  assert.equal(ct.ct43, 600_000);

  const ct2 = tinhGtgt01({
    banRa: { ...BAN_RA_RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct40b: 300_000 },
  });
  assert.equal(ct2.ct40a, 1_000_000);
  assert.equal(ct2.ct40, 700_000);
});

test("ô nhập tay không tính được vẫn có mặt trong kết quả", () => {
  const ct = tinhGtgt01({
    banRa: BAN_RA_RONG,
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct23a: 111, ct24a: 222 },
  });
  assert.equal(ct.ct23a, 111);
  assert.equal(ct.ct24a, 222);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/tinhGtgt01.test.ts`
Expected: FAIL — không tìm thấy module `tinhGtgt01`.

- [ ] **Step 3: Viết `tinhGtgt01.ts`**

```ts
// be_maxv/src/services/client/to_khai/tinhGtgt01.ts
/**
 * Công thức mẫu 01/GTGT (TT80/2021) — hàm THUẦN, không DB, không HTTP. Mọi con số đem đi nộp thuế
 * đều đi qua đây, nên đây cũng là chỗ đặt toàn bộ test công thức
 * (`src/__tests__/tinhGtgt01.test.ts`).
 *
 * Công thức lấy đúng theo nhãn in trên mẫu, xem `ToKhaiGtgt01Form.tsx` bên hdđt_maxv.
 */

import type { TongBanRa } from "./gomHoaDonGtgt";

/** Ô người dùng tự nhập — máy không suy được từ hóa đơn. */
export type CtNhapTay =
  | "ct22"
  | "ct23a"
  | "ct24a"
  | "ct25"
  | "ct37"
  | "ct38"
  | "ct39a"
  | "ct40b"
  | "ct42";

export const CT_NHAP_TAY: readonly CtNhapTay[] = [
  "ct22",
  "ct23a",
  "ct24a",
  "ct25",
  "ct37",
  "ct38",
  "ct39a",
  "ct40b",
  "ct42",
];

export interface DauVaoGtgt01 {
  banRa: TongBanRa;
  muaVao: { ct23: number; ct24: number };
  /** Ô đã nhập tay/ghi đè. `ct25` vắng mặt -> lấy mặc định bằng [24]. */
  nhapTay: Partial<Record<CtNhapTay, number>>;
}

export type CtGtgt01 = Record<string, number>;

export function tinhGtgt01(dv: DauVaoGtgt01): CtGtgt01 {
  const tay = (k: CtNhapTay): number => Number(dv.nhapTay[k] ?? 0);

  const ct22 = tay("ct22");
  const ct23 = dv.muaVao.ct23;
  const ct24 = dv.muaVao.ct24;
  // Máy không biết hóa đơn nào không đủ điều kiện khấu trừ hay phải phân bổ -> mặc định khấu trừ
  // hết, kế toán sửa lại thì `nhapTay.ct25` thắng.
  const ct25 = dv.nhapTay.ct25 == null ? ct24 : Number(dv.nhapTay.ct25);

  const { ct26, ct29, ct30, ct31, ct32, ct32a, ct33 } = dv.banRa;
  const ct27 = ct29 + ct30 + ct32 + ct32a;
  const ct28 = ct31 + ct33;
  const ct34 = ct26 + ct27;
  const ct35 = ct28;
  const ct36 = ct35 - ct25;

  const ct37 = tay("ct37");
  const ct38 = tay("ct38");
  const ct39a = tay("ct39a");
  const ct40b = tay("ct40b");
  const ct42 = tay("ct42");

  // Hai ô [40a] và [41] loại trừ nhau: cùng một hiệu số, dương thì phải nộp, âm thì còn được
  // khấu trừ. Hỏng chỗ này là sai hẳn nghĩa vụ thuế.
  const hieu = ct36 - ct22 + ct37 - ct38 - ct39a;
  const ct40a = hieu >= 0 ? hieu : 0;
  const ct41 = hieu < 0 ? -hieu : 0;

  const ct40 = ct40a - ct40b;
  const ct43 = ct41 - ct42;

  return {
    ct22,
    ct23,
    ct23a: tay("ct23a"),
    ct24,
    ct24a: tay("ct24a"),
    ct25,
    ct26,
    ct27,
    ct28,
    ct29,
    ct30,
    ct31,
    ct32,
    ct32a,
    ct33,
    ct34,
    ct35,
    ct36,
    ct37,
    ct38,
    ct39a,
    ct40,
    ct40a,
    ct40b,
    ct41,
    ct42,
    ct43,
  };
}
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/tinhGtgt01.test.ts`
Expected: PASS cả 10 ca. Ca "không phát sinh đầu ra" phải ra đúng 29.826.193 — con số của hồ sơ thật.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/services/client/to_khai/tinhGtgt01.ts be_maxv/src/__tests__/tinhGtgt01.test.ts
git commit -m "🎉: Thêm công thức tính chỉ tiêu tờ khai 01/GTGT"
```

---

### Task 6: `sanSangKy.ts` — kỳ đã đủ dữ liệu chưa

**Files:**
- Create: `be_maxv/src/services/client/to_khai/sanSangKy.ts`
- Test: `be_maxv/src/__tests__/sanSangKy.test.ts`

**Interfaces:**
- Consumes: `Ky`, `khoangCuaKy()` (Task 3)
- Produces:
  - `type TrangThaiKy = "chua_dong_bo" | "thieu_chi_tiet" | "san_sang"`
  - `interface DongBoRef { direction: string; tu_ngay: Date; den_ngay: Date }`
  - `function kyDaPhuBoiLog(logs: DongBoRef[], khoang: { tuNgay: Date; denNgay: Date }): boolean`
  - `interface KetQuaSanSang { trangThai: TrangThaiKy; soHdBan: number; soHdMua: number; hdThieuDetail: number }`
  - `function kiemTraSanSang(db: PrismaClient, ky: Ky): Promise<KetQuaSanSang>`

- [ ] **Step 1: Viết test thất bại cho phần thuần**

```ts
// be_maxv/src/__tests__/sanSangKy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { kyDaPhuBoiLog } from "../services/client/to_khai/sanSangKy";

const KHOANG = { tuNgay: new Date("2026-07-01T00:00:00Z"), denNgay: new Date("2026-07-31T23:59:59Z") };

test("thiếu chiều nào cũng là chưa phủ", () => {
  assert.equal(
    kyDaPhuBoiLog(
      [{ direction: "purchase", tu_ngay: new Date("2026-07-01"), den_ngay: new Date("2026-07-31") }],
      KHOANG,
    ),
    false,
  );
});

test("đủ hai chiều phủ trọn khoảng thì phủ", () => {
  const logs = [
    { direction: "purchase", tu_ngay: new Date("2026-07-01"), den_ngay: new Date("2026-07-31") },
    { direction: "sold", tu_ngay: new Date("2026-06-01"), den_ngay: new Date("2026-08-31") },
  ];
  assert.equal(kyDaPhuBoiLog(logs, KHOANG), true);
});

test("direction=all phủ cả hai chiều", () => {
  const logs = [{ direction: "all", tu_ngay: new Date("2026-07-01"), den_ngay: new Date("2026-07-31") }];
  assert.equal(kyDaPhuBoiLog(logs, KHOANG), true);
});

test("khoảng đồng bộ hụt một ngày cuối là chưa phủ", () => {
  const logs = [
    { direction: "purchase", tu_ngay: new Date("2026-07-01"), den_ngay: new Date("2026-07-30") },
    { direction: "sold", tu_ngay: new Date("2026-07-01"), den_ngay: new Date("2026-07-30") },
  ];
  assert.equal(kyDaPhuBoiLog(logs, KHOANG), false);
});

test("nhiều lượt ghép lại vẫn không vá được lỗ hổng giữa kỳ", () => {
  // Quý 3 gồm 3 tháng; chỉ đồng bộ tháng 7 và tháng 9 -> tháng 8 thủng.
  const khoangQuy = {
    tuNgay: new Date("2026-07-01T00:00:00Z"),
    denNgay: new Date("2026-09-30T23:59:59Z"),
  };
  const logs = [
    { direction: "all", tu_ngay: new Date("2026-07-01"), den_ngay: new Date("2026-07-31") },
    { direction: "all", tu_ngay: new Date("2026-09-01"), den_ngay: new Date("2026-09-30") },
  ];
  assert.equal(kyDaPhuBoiLog(logs, khoangQuy), false);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/sanSangKy.test.ts`
Expected: FAIL — không tìm thấy module `sanSangKy`.

- [ ] **Step 3: Viết `sanSangKy.ts`**

```ts
// be_maxv/src/services/client/to_khai/sanSangKy.ts
/**
 * Kỳ đã đủ dữ liệu để lập tờ khai chưa — CHỈ đọc DB, không gọi cổng thuế.
 *
 * Hai điều kiện, khác nhau và đều cần:
 *  1. Kỳ đã được lượt "Đồng bộ" phủ trọn (bảng `sync_log`) — nếu không, DB đơn giản là thiếu hóa đơn.
 *  2. Không còn hóa đơn BÁN RA nào `detail IS NULL` — thiếu `detail` thì không tách được thuế suất
 *     (xem `gomHoaDonGtgt.ts`), số [29]/[30]/[32] sẽ hụt mà nhìn bảng không ra.
 */

import type { PrismaClient } from "../../../generated/tenant";
import { khoangCuaKy, type Ky } from "./kySoThue";

export type TrangThaiKy = "chua_dong_bo" | "thieu_chi_tiet" | "san_sang";

/** Dòng `sync_log` rút gọn — chỉ phần cần để xét độ phủ. */
export interface DongBoRef {
  direction: string;
  tu_ngay: Date;
  den_ngay: Date;
}

export interface KetQuaSanSang {
  trangThai: TrangThaiKy;
  soHdBan: number;
  soHdMua: number;
  hdThieuDetail: number;
}

/**
 * Kỳ có được các lượt đồng bộ HOÀN THÀNH phủ trọn không, xét RIÊNG từng chiều mua/bán.
 *
 * Cố ý KHÔNG ghép nhiều lượt để vá một kỳ: mỗi lượt phải tự phủ trọn khoảng. Ghép khoảng rời rạc
 * đòi một bộ hợp-khoảng đúng đắn, mà sai ở đây thì kết luận "đủ dữ liệu" sai — hỏng âm thầm. Kỳ bị
 * đồng bộ làm nhiều đợt thì bấm "Đồng bộ" lại trọn kỳ một lượt, rẻ hơn nhiều so với một con số sai.
 */
export function kyDaPhuBoiLog(
  logs: DongBoRef[],
  khoang: { tuNgay: Date; denNgay: Date },
): boolean {
  const phu = (chieu: string) =>
    logs.some(
      (l) =>
        (l.direction === chieu || l.direction === "all") &&
        l.tu_ngay.getTime() <= khoang.tuNgay.getTime() &&
        // So theo NGÀY: `den_ngay` trong sync_log là mốc 12:00 của ngày cuối (xem createSyncLogRow),
        // còn `khoang.denNgay` là 23:59:59 — so thẳng sẽ trượt oan.
        cuoiNgay(l.den_ngay).getTime() >= khoang.denNgay.getTime(),
    );
  return phu("purchase") && phu("sold");
}

function cuoiNgay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export async function kiemTraSanSang(db: PrismaClient, ky: Ky): Promise<KetQuaSanSang> {
  const khoang = khoangCuaKy(ky);
  const trongKy = { tdlap: { gte: khoang.tuNgay, lte: khoang.denNgay } };

  const [logs, soHdBan, soHdMua, hdThieuDetail] = await Promise.all([
    db.sync_log.findMany({
      where: { trang_thai: "done", dien_giai: { startsWith: "Đồng bộ" } },
      select: { direction: true, tu_ngay: true, den_ngay: true },
      orderBy: { created_at: "desc" },
      take: 200,
    }),
    db.vct50view.count({ where: trongKy }),
    db.vct60view.count({ where: trongKy }),
    db.vct50view.count({ where: { ...trongKy, detail: { equals: null } } }),
  ]);

  const daPhu = kyDaPhuBoiLog(logs as DongBoRef[], khoang);
  const trangThai: TrangThaiKy = !daPhu
    ? "chua_dong_bo"
    : hdThieuDetail > 0
      ? "thieu_chi_tiet"
      : "san_sang";

  return { trangThai, soHdBan, soHdMua, hdThieuDetail };
}
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/sanSangKy.test.ts`
Expected: PASS cả 5 ca.

- [ ] **Step 5: Kiểm biên dịch (phần chạm Prisma)**

Run: `cd be_maxv && npm run typecheck`
Expected: sạch. Nếu `detail: { equals: null }` báo lỗi kiểu, đổi sang `detail: { equals: Prisma.DbNull }` và import `Prisma` từ `../../../generated/tenant` — cùng lối `buildSavedWhere` đang dùng ở `gdt.service.ts:1234`.

- [ ] **Step 6: Commit**

```bash
git add be_maxv/src/services/client/to_khai/sanSangKy.ts be_maxv/src/__tests__/sanSangKy.test.ts
git commit -m "🎉: Thêm kiểm tra kỳ đã đủ dữ liệu để lập tờ khai"
```

---

### Task 7: `toKhaiGtgt01.service.ts` — đọc, tính, lưu, chốt

**Files:**
- Create: `be_maxv/src/services/client/to_khai/toKhaiGtgt01.service.ts`
- Test: `be_maxv/src/__tests__/toKhaiGtgt01Ghép.test.ts`

**Interfaces:**
- Consumes: `Ky`/`khoangCuaKy`/`kyLienTruoc` (Task 3), `gomBanRa`/`gomMuaVao`/`HoaDonGom` (Task 4), `tinhGtgt01`/`CT_NHAP_TAY`/`CtNhapTay` (Task 5), `kiemTraSanSang` (Task 6)
- Produces:
  - `interface GhiDeItem { gia: number; lyDo?: string }`
  - `interface BanToKhai { ky: Ky; trangThai: "nhap" | "chot"; ct: CtGtgt01; ctMay: CtGtgt01; ghiDe: Record<string, GhiDeItem>; nguonCt22: "ky_truoc" | "nhap_tay"; soHdBan: number; soHdMua: number; hdThieuDetail: number; treo: HoaDonTreo[]; dieuChinh: { soHd: number; giaTri: number; thue: number }; tinhLuc: string | null }`
  - `function tinhVaLuu(db: PrismaClient, ky: Ky): Promise<BanToKhai>`
  - `function docBan(db: PrismaClient, ky: Ky): Promise<BanToKhai | null>`
  - `function luuGhiDe(db: PrismaClient, ky: Ky, ghiDe: Record<string, GhiDeItem>): Promise<BanToKhai>`
  - `function doiTrangThai(db: PrismaClient, ky: Ky, trangThai: "nhap" | "chot"): Promise<BanToKhai>`
  - `function layCt22KyTruoc(db: PrismaClient, ky: Ky): Promise<number | null>`
  - `function locGhiDeHopLe(raw: unknown): Record<string, GhiDeItem>`

- [ ] **Step 1: Viết test thất bại cho phần lọc ghi đè**

`locGhiDeHopLe` là cửa duy nhất dữ liệu người dùng đi vào `ct`, nên phải test riêng — nó chạy được mà không cần DB.

```ts
// be_maxv/src/__tests__/toKhaiGtgt01Ghép.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { locGhiDeHopLe } from "../services/client/to_khai/toKhaiGtgt01.service";

test("giữ đúng các ô nhập tay hợp lệ", () => {
  const kq = locGhiDeHopLe({ ct22: { gia: 1000, lyDo: "kỳ trước" }, ct25: { gia: 500 } });
  assert.equal(kq.ct22.gia, 1000);
  assert.equal(kq.ct22.lyDo, "kỳ trước");
  assert.equal(kq.ct25.gia, 500);
});

test("bỏ khóa không phải chỉ tiêu 01/GTGT", () => {
  const kq = locGhiDeHopLe({ ct999: { gia: 1 }, __proto__: { gia: 2 }, trang_thai: { gia: 3 } });
  assert.deepEqual(Object.keys(kq), []);
});

test("bỏ giá trị không phải số hữu hạn", () => {
  const kq = locGhiDeHopLe({
    ct22: { gia: "abc" },
    ct25: { gia: Number.NaN },
    ct37: { gia: Number.POSITIVE_INFINITY },
    ct38: { gia: 7 },
  });
  assert.deepEqual(Object.keys(kq), ["ct38"]);
});

test("ô máy tự tính vẫn ghi đè được (kế toán có quyền sửa)", () => {
  const kq = locGhiDeHopLe({ ct26: { gia: 123 } });
  assert.equal(kq.ct26.gia, 123);
});

test("lyDo quá dài bị cắt, không làm hỏng cả lượt lưu", () => {
  const kq = locGhiDeHopLe({ ct22: { gia: 1, lyDo: "x".repeat(1000) } });
  assert.equal(kq.ct22.lyDo?.length, 500);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/toKhaiGtgt01Ghép.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết `toKhaiGtgt01.service.ts`**

```ts
// be_maxv/src/services/client/to_khai/toKhaiGtgt01.service.ts
/**
 * Vòng đời một bản tờ khai 01/GTGT: tính từ hóa đơn -> lưu nháp -> kế toán sửa tay -> chốt.
 *
 * CHỈ đọc DB tenant (`vct50view`, `vct60view`, `sync_log`, `tokhai_gtgt01`). Không gọi cổng thuế,
 * không nhận token GDT — xem ràng buộc ở spec mục 5.
 */

import type { PrismaClient, Prisma } from "../../../generated/tenant";
import { khoangCuaKy, kyLienTruoc, type Ky } from "./kySoThue";
import { gomBanRa, gomMuaVao, type HoaDonGom, type HoaDonTreo } from "./gomHoaDonGtgt";
import { tinhGtgt01, type CtGtgt01 } from "./tinhGtgt01";
import { kiemTraSanSang } from "./sanSangKy";

export interface GhiDeItem {
  gia: number;
  lyDo?: string;
}

export interface BanToKhai {
  ky: Ky;
  trangThai: "nhap" | "chot";
  ct: CtGtgt01;
  ctMay: CtGtgt01;
  ghiDe: Record<string, GhiDeItem>;
  nguonCt22: "ky_truoc" | "nhap_tay";
  soHdBan: number;
  soHdMua: number;
  hdThieuDetail: number;
  treo: HoaDonTreo[];
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  tinhLuc: string | null;
}

/** Mọi chỉ tiêu của mẫu — dùng để chặn khóa lạ lọt vào `ghi_de`. */
const CT_HOP_LE = new Set([
  "ct22", "ct23", "ct23a", "ct24", "ct24a", "ct25", "ct26", "ct27", "ct28", "ct29",
  "ct30", "ct31", "ct32", "ct32a", "ct33", "ct34", "ct35", "ct36", "ct37", "ct38",
  "ct39a", "ct40", "ct40a", "ct40b", "ct41", "ct42", "ct43",
]);

const DAI_TOI_DA_LY_DO = 500;

/**
 * Lọc payload `ghi_de` từ FE: chỉ giữ khóa là chỉ tiêu thật và giá trị là số hữu hạn. Đây là cửa
 * DUY NHẤT dữ liệu người dùng đi vào bộ chỉ tiêu, nên không tin gì cả — kể cả khóa
 * (`Object.create(null)` chặn luôn `__proto__`).
 */
export function locGhiDeHopLe(raw: unknown): Record<string, GhiDeItem> {
  const out: Record<string, GhiDeItem> = Object.create(null) as Record<string, GhiDeItem>;
  if (!raw || typeof raw !== "object") return out;

  for (const [khoa, giaTri] of Object.entries(raw as Record<string, unknown>)) {
    if (!CT_HOP_LE.has(khoa)) continue;
    if (!giaTri || typeof giaTri !== "object") continue;
    const o = giaTri as Record<string, unknown>;
    const gia = Number(o.gia);
    if (!Number.isFinite(gia)) continue;
    const lyDo = typeof o.lyDo === "string" ? o.lyDo.slice(0, DAI_TOI_DA_LY_DO) : undefined;
    out[khoa] = lyDo === undefined ? { gia } : { gia, lyDo };
  }
  return out;
}

/** Các cột engine cần đọc — giữ hẹp vì `detail` là JSON nặng. */
const SELECT_HD = {
  id: true,
  tthai: true,
  dvtte: true,
  tgia: true,
  tgtcthue: true,
  tgtthue: true,
  detail: true,
} satisfies Prisma.vct50viewSelect;

/** [22] của kỳ này = [43] của bản ĐÃ CHỐT kỳ liền trước; chưa có -> null (kế toán nhập tay). */
export async function layCt22KyTruoc(db: PrismaClient, ky: Ky): Promise<number | null> {
  const truoc = kyLienTruoc(ky);
  const ban = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: truoc.nam, ky_loai: truoc.kyLoai, ky_so: truoc.kySo } },
    select: { trang_thai: true, ct43: true },
  });
  if (!ban || ban.trang_thai !== "chot") return null;
  return Number(ban.ct43);
}

/**
 * Tính lại toàn bộ chỉ tiêu từ hóa đơn trong kỳ rồi ghi đè bản nháp. Ô đã `ghi_de` được GIỮ
 * NGUYÊN và áp lại lên số máy — đây là lý do một lượt "Tính lại" không xóa công sức sửa tay.
 * Ném lỗi khi kỳ chưa sẵn sàng: không sinh ra con số nửa vời.
 */
export async function tinhVaLuu(db: PrismaClient, ky: Ky): Promise<BanToKhai> {
  const sanSang = await kiemTraSanSang(db, ky);
  if (sanSang.trangThai !== "san_sang") {
    throw new KyChuaSanSangError(sanSang.trangThai, sanSang.hdThieuDetail);
  }

  const hienCo = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
  });
  if (hienCo?.trang_thai === "chot") {
    throw new BanDaChotError();
  }
  const ghiDe = locGhiDeHopLe(hienCo?.ghi_de);

  const khoang = khoangCuaKy(ky);
  const trongKy = { tdlap: { gte: khoang.tuNgay, lte: khoang.denNgay } };
  const [rowsBan, rowsMua] = await Promise.all([
    db.vct50view.findMany({ where: trongKy, select: SELECT_HD }),
    db.vct60view.findMany({ where: trongKy, select: SELECT_HD }),
  ]);

  const banRa = gomBanRa(rowsBan as HoaDonGom[]);
  const muaVao = gomMuaVao(rowsMua as HoaDonGom[]);

  // [22]: ưu tiên ô kế toán đã ghi đè, sau đó tới [43] kỳ trước đã chốt.
  const ct22KyTruoc = ghiDe.ct22 ? null : await layCt22KyTruoc(db, ky);
  const nhapTay: Record<string, number> = {};
  for (const [khoa, item] of Object.entries(ghiDe)) nhapTay[khoa] = item.gia;
  if (ct22KyTruoc !== null) nhapTay.ct22 = ct22KyTruoc;

  const ctMay = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay: {} });
  const ct = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay });
  // Ô ghi đè không nằm trong công thức (vd [26] kế toán tự sửa) vẫn phải hiện đúng số đã sửa.
  for (const [khoa, item] of Object.entries(ghiDe)) ct[khoa] = item.gia;

  const nguonCt22: "ky_truoc" | "nhap_tay" = ct22KyTruoc !== null ? "ky_truoc" : "nhap_tay";
  const duLieu = {
    trang_thai: "nhap",
    ct: ct as Prisma.InputJsonValue,
    ct_may: ctMay as Prisma.InputJsonValue,
    ghi_de: ghiDe as Prisma.InputJsonValue,
    ct22: ct.ct22,
    ct40: ct.ct40,
    ct43: ct.ct43,
    nguon_ct22: nguonCt22,
    so_hd_ban: banRa.soHd,
    so_hd_mua: muaVao.soHd,
    hd_thieu_detail: sanSang.hdThieuDetail,
    tinh_luc: new Date(),
  };

  const luu = await db.tokhai_gtgt01.upsert({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    create: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo, ...duLieu },
    update: duLieu,
  });

  return {
    ky,
    trangThai: "nhap",
    ct,
    ctMay,
    ghiDe,
    nguonCt22,
    soHdBan: banRa.soHd,
    soHdMua: muaVao.soHd,
    hdThieuDetail: sanSang.hdThieuDetail,
    treo: [...banRa.treo, ...muaVao.treo],
    dieuChinh: banRa.dieuChinh,
    tinhLuc: luu.tinh_luc?.toISOString() ?? null,
  };
}

export async function docBan(db: PrismaClient, ky: Ky): Promise<BanToKhai | null> {
  const row = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
  });
  if (!row) return null;
  return {
    ky,
    trangThai: row.trang_thai === "chot" ? "chot" : "nhap",
    ct: (row.ct ?? {}) as CtGtgt01,
    ctMay: (row.ct_may ?? {}) as CtGtgt01,
    ghiDe: locGhiDeHopLe(row.ghi_de),
    nguonCt22: row.nguon_ct22 === "ky_truoc" ? "ky_truoc" : "nhap_tay",
    soHdBan: row.so_hd_ban,
    soHdMua: row.so_hd_mua,
    hdThieuDetail: row.hd_thieu_detail,
    // `treo`/`dieuChinh` là kết quả của lượt TÍNH, không lưu DB — đọc lại bản cũ thì để rỗng,
    // bấm "Tính lại" sẽ có ngay.
    treo: [],
    dieuChinh: { soHd: 0, giaTri: 0, thue: 0 },
    tinhLuc: row.tinh_luc?.toISOString() ?? null,
  };
}

/** Lưu ô sửa tay rồi tính lại — bản đã chốt phải mở khóa trước. */
export async function luuGhiDe(
  db: PrismaClient,
  ky: Ky,
  ghiDeMoi: Record<string, GhiDeItem>,
): Promise<BanToKhai> {
  const row = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    select: { trang_thai: true },
  });
  if (!row) throw new ChuaCoBanError();
  if (row.trang_thai === "chot") throw new BanDaChotError();

  await db.tokhai_gtgt01.update({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    data: { ghi_de: locGhiDeHopLe(ghiDeMoi) as Prisma.InputJsonValue },
  });
  return tinhVaLuu(db, ky);
}

export async function doiTrangThai(
  db: PrismaClient,
  ky: Ky,
  trangThai: "nhap" | "chot",
): Promise<BanToKhai> {
  const ban = await docBan(db, ky);
  if (!ban) throw new ChuaCoBanError();
  await db.tokhai_gtgt01.update({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    data: { trang_thai: trangThai },
  });
  return { ...ban, trangThai };
}

/** Danh sách kỳ đã lập, mới nhất trước. */
export async function danhSachKy(db: PrismaClient) {
  const rows = await db.tokhai_gtgt01.findMany({
    orderBy: [{ nam: "desc" }, { ky_so: "desc" }],
    take: 100,
    select: {
      nam: true, ky_loai: true, ky_so: true, trang_thai: true,
      ct40: true, ct43: true, tinh_luc: true,
    },
  });
  return rows.map((r) => ({
    nam: r.nam,
    kyLoai: r.ky_loai as Ky["kyLoai"],
    kySo: r.ky_so,
    trangThai: r.trang_thai,
    ct40: Number(r.ct40),
    ct43: Number(r.ct43),
    tinhLuc: r.tinh_luc?.toISOString() ?? null,
  }));
}

export class KyChuaSanSangError extends Error {
  constructor(
    public readonly trangThai: string,
    public readonly hdThieuDetail: number,
  ) {
    super(
      trangThai === "chua_dong_bo"
        ? "Kỳ này chưa được đồng bộ hóa đơn. Sang màn Hóa đơn điện tử đồng bộ trọn kỳ rồi quay lại."
        : `Kỳ này còn ${hdThieuDetail} hóa đơn chưa tải chi tiết nên chưa tách được thuế suất.`,
    );
  }
}

export class BanDaChotError extends Error {
  constructor() {
    super("Tờ khai kỳ này đã chốt. Mở khóa trước khi sửa.");
  }
}

export class ChuaCoBanError extends Error {
  constructor() {
    super("Kỳ này chưa có bản tờ khai nào. Bấm \"Lập tờ khai\" trước.");
  }
}
```

- [ ] **Step 4: Chạy lại test + typecheck**

Run: `cd be_maxv && npx tsx --test src/__tests__/toKhaiGtgt01Ghép.test.ts`
Expected: PASS cả 5 ca.
Run: `cd be_maxv && npm run typecheck`
Expected: sạch. Tên khóa ghép Prisma sinh ra là `nam_ky_loai_ky_so` — nếu khác, sửa theo đúng tên trong `src/generated/tenant/index.d.ts`.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/services/client/to_khai/toKhaiGtgt01.service.ts be_maxv/src/__tests__/toKhaiGtgt01Ghép.test.ts
git commit -m "🎉: Thêm service lập, lưu và chốt tờ khai 01/GTGT"
```

---

### Task 8: Controller + route + đăng ký prefix

**Files:**
- Create: `be_maxv/src/controllers/client/to_khai/toKhaiGtgt01.controller.ts`
- Create: `be_maxv/src/routes/to_khai/toKhaiGtgt01.route.ts`
- Modify: `be_maxv/src/routes/index.route.ts` (thêm import + `register`)

**Interfaces:**
- Consumes: mọi hàm export ở Task 6 và 7; `resolveTenantDb` (`helpers/resolveTenantDb`), `requireModule` (`services/shared/modules.service`)
- Produces: 8 endpoint dưới `/api/v1/to-khai` như spec mục 8

- [ ] **Step 1: Viết controller**

```ts
// be_maxv/src/controllers/client/to_khai/toKhaiGtgt01.controller.ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveTenantDb } from "../../../helpers/resolveTenantDb";
import { kyHopLe, type Ky, type KyLoai } from "../../../services/client/to_khai/kySoThue";
import { kiemTraSanSang } from "../../../services/client/to_khai/sanSangKy";
import * as ToKhai from "../../../services/client/to_khai/toKhaiGtgt01.service";

interface KyQuery {
  nam?: string;
  kyLoai?: string;
  kySo?: string;
}

/** Đọc kỳ từ query/params rồi kiểm biên — kỳ sai thì dừng ngay, không đi tới DB. */
function docKy(raw: KyQuery): Ky {
  const ky: Ky = {
    nam: Number(raw.nam),
    kyLoai: String(raw.kyLoai) as KyLoai,
    kySo: Number(raw.kySo),
  };
  if (!kyHopLe(ky)) throw new Error("Kỳ tính thuế không hợp lệ.");
  return ky;
}

/** Lỗi nghiệp vụ đã biết -> mã HTTP tương ứng; còn lại 400 kèm câu tiếng Việt. */
function traLoi(reply: FastifyReply, err: unknown, macDinh: string) {
  if (err instanceof ToKhai.KyChuaSanSangError) {
    return reply.status(409).send({ message: err.message, code: err.trangThai });
  }
  if (err instanceof ToKhai.BanDaChotError) {
    return reply.status(409).send({ message: err.message, code: "da_chot" });
  }
  if (err instanceof ToKhai.ChuaCoBanError) {
    return reply.status(404).send({ message: err.message, code: "chua_co_ban" });
  }
  return reply.status(400).send({ message: err instanceof Error ? err.message : macDinh });
}

export async function sanSang(request: FastifyRequest<{ Querystring: KyQuery }>, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    return reply.send(await kiemTraSanSang(db, docKy(request.query)));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không kiểm tra được dữ liệu của kỳ.");
  }
}

export async function tinh(request: FastifyRequest<{ Body: KyQuery }>, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    return reply.send(await ToKhai.tinhVaLuu(db, docKy(request.body ?? {})));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lập được tờ khai.");
  }
}

export async function doc(request: FastifyRequest<{ Params: KyQuery }>, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    const ban = await ToKhai.docBan(db, docKy(request.params));
    if (!ban) return reply.status(404).send({ message: "Kỳ này chưa có bản tờ khai nào." });
    return reply.send(ban);
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không đọc được tờ khai.");
  }
}

export async function luu(
  request: FastifyRequest<{ Params: KyQuery; Body: { ghiDe?: unknown } }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const ghiDe = ToKhai.locGhiDeHopLe(request.body?.ghiDe);
    return reply.send(await ToKhai.luuGhiDe(db, docKy(request.params), ghiDe));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lưu được tờ khai.");
  }
}

function doiTrangThaiHandler(trangThai: "nhap" | "chot") {
  return async function (request: FastifyRequest<{ Params: KyQuery }>, reply: FastifyReply) {
    const db = await resolveTenantDb(request);
    try {
      return reply.send(await ToKhai.doiTrangThai(db, docKy(request.params), trangThai));
    } catch (err) {
      request.log.error(err);
      return traLoi(reply, err, "Không đổi được trạng thái tờ khai.");
    }
  };
}

export const chot = doiTrangThaiHandler("chot");
export const moKhoa = doiTrangThaiHandler("nhap");

export async function danhSach(request: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    return reply.send(await ToKhai.danhSachKy(db));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lấy được danh sách kỳ đã lập.");
  }
}
```

- [ ] **Step 2: Viết route**

```ts
// be_maxv/src/routes/to_khai/toKhaiGtgt01.route.ts
import { FastifyInstance } from "fastify";
import {
  chot,
  danhSach,
  doc,
  luu,
  moKhoa,
  sanSang,
  tinh,
} from "../../controllers/client/to_khai/toKhaiGtgt01.controller";
import { requireModule } from "../../services/shared/modules.service";

/**
 * Module "Tờ khai" — lập tờ khai 01/GTGT từ hóa đơn đã đồng bộ.
 *
 * KHÔNG route nào ở đây gọi cổng thuế: mọi thứ đọc từ DB tenant, nên cũng không cần token GDT.
 * Guard `requireModule("tokhai")` chặn ở BE vì ẩn nút trên header chỉ là lớp hiển thị.
 */
export default async function (fastify: FastifyInstance) {
  const guard = [fastify.authenticate, requireModule("tokhai")];

  fastify.get("/gtgt01/san-sang", { preHandler: guard, handler: sanSang });
  fastify.post("/gtgt01/tinh", { preHandler: guard, handler: tinh });
  fastify.get("/gtgt01/danh-sach", { preHandler: guard, handler: danhSach });
  fastify.get("/gtgt01/:nam/:kyLoai/:kySo", { preHandler: guard, handler: doc });
  fastify.put("/gtgt01/:nam/:kyLoai/:kySo", { preHandler: guard, handler: luu });
  fastify.post("/gtgt01/:nam/:kyLoai/:kySo/chot", { preHandler: guard, handler: chot });
  fastify.post("/gtgt01/:nam/:kyLoai/:kySo/mo-khoa", { preHandler: guard, handler: moKhoa });
}
```

> Thứ tự khai quan trọng: `/gtgt01/danh-sach` phải đứng TRƯỚC `/gtgt01/:nam/:kyLoai/:kySo`, không thì `danh-sach` bị nuốt thành `:nam`.

- [ ] **Step 3: Đăng ký prefix**

Trong `be_maxv/src/routes/index.route.ts`, thêm cạnh dòng đăng ký `gdtDvcRoutes`:

```ts
import toKhaiRoutes from './to_khai/toKhaiGtgt01.route';
// ...
  await app.register(toKhaiRoutes, { prefix: '/api/v1/to-khai' });
```

- [ ] **Step 4: Kiểm biên dịch và lint**

Run: `cd be_maxv && npm run typecheck`
Run: `cd be_maxv && npx eslint src/services/client/to_khai src/controllers/client/to_khai src/routes/to_khai`
Expected: cả hai sạch.

- [ ] **Step 5: Chạy toàn bộ test BE để chắc không gãy chỗ khác**

Run: `cd be_maxv && npx tsx --test src/__tests__/*.test.ts`
Expected: mọi test xanh trừ 5 ca `adminOwner.test.ts` vốn đã đỏ sẵn (cần Postgres đã seed).

- [ ] **Step 6: Commit**

```bash
git add be_maxv/src/controllers/client/to_khai be_maxv/src/routes/to_khai be_maxv/src/routes/index.route.ts
git commit -m "🎉: Thêm API lập tờ khai 01/GTGT"
```

---

### Task 9: Frontend — lớp gọi API và TanStack Query

**Files:**
- Create: `hdđt_maxv/src/features/to_khai/api/toKhai.ts`
- Create: `hdđt_maxv/src/features/to_khai/api/toKhaiQueries.ts`

**Interfaces:**
- Consumes: `apiFetch` (`src/lib/http.ts`), `useAuth` (`features/auth/useAuth`)
- Produces:
  - `interface Ky { nam: number; kyLoai: "thang" | "quy"; kySo: number }`
  - `interface KetQuaSanSang { trangThai: "chua_dong_bo" | "thieu_chi_tiet" | "san_sang"; soHdBan: number; soHdMua: number; hdThieuDetail: number }`
  - `interface BanToKhai` (khớp field BE trả ở Task 7)
  - `useSanSangQuery(ky)`, `useBanToKhaiQuery(ky)`, `useDanhSachKyQuery()`, `useTinhToKhai()`, `useLuuToKhai()`, `useDoiTrangThai()`

- [ ] **Step 1: Viết lớp gọi API**

```ts
// hdđt_maxv/src/features/to_khai/api/toKhai.ts
import { apiFetch } from "../../../lib/http";

export type KyLoai = "thang" | "quy";

export interface Ky {
  nam: number;
  kyLoai: KyLoai;
  kySo: number;
}

export type TrangThaiKy = "chua_dong_bo" | "thieu_chi_tiet" | "san_sang";

export interface KetQuaSanSang {
  trangThai: TrangThaiKy;
  soHdBan: number;
  soHdMua: number;
  hdThieuDetail: number;
}

export interface GhiDeItem {
  gia: number;
  lyDo?: string;
}

export interface HoaDonTreo {
  id: string;
  lyDo: string;
}

export interface BanToKhai {
  ky: Ky;
  trangThai: "nhap" | "chot";
  ct: Record<string, number>;
  ctMay: Record<string, number>;
  ghiDe: Record<string, GhiDeItem>;
  nguonCt22: "ky_truoc" | "nhap_tay";
  soHdBan: number;
  soHdMua: number;
  hdThieuDetail: number;
  treo: HoaDonTreo[];
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  tinhLuc: string | null;
}

export interface DongKyDaLap {
  nam: number;
  kyLoai: KyLoai;
  kySo: number;
  trangThai: string;
  ct40: number;
  ct43: number;
  tinhLuc: string | null;
}

/** `2026/thang/7` — dùng chung cho mọi endpoint có kỳ trên path. */
function duongDanKy(ky: Ky): string {
  return `${ky.nam}/${ky.kyLoai}/${ky.kySo}`;
}

export async function getSanSang(ky: Ky): Promise<KetQuaSanSang> {
  const q = new URLSearchParams({
    nam: String(ky.nam),
    kyLoai: ky.kyLoai,
    kySo: String(ky.kySo),
  });
  return apiFetch<KetQuaSanSang>(`/to-khai/gtgt01/san-sang?${q.toString()}`);
}

export async function postTinh(ky: Ky): Promise<BanToKhai> {
  return apiFetch<BanToKhai>("/to-khai/gtgt01/tinh", { method: "POST", body: ky });
}

export async function getBan(ky: Ky): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(`/to-khai/gtgt01/${duongDanKy(ky)}`);
}

export async function putGhiDe(ky: Ky, ghiDe: Record<string, GhiDeItem>): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(`/to-khai/gtgt01/${duongDanKy(ky)}`, {
    method: "PUT",
    body: { ghiDe },
  });
}

export async function postDoiTrangThai(ky: Ky, chot: boolean): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(
    `/to-khai/gtgt01/${duongDanKy(ky)}/${chot ? "chot" : "mo-khoa"}`,
    { method: "POST" },
  );
}

export async function getDanhSachKy(): Promise<DongKyDaLap[]> {
  return apiFetch<DongKyDaLap[]>("/to-khai/gtgt01/danh-sach");
}
```

> Kiểm `apiFetch` nhận `body` dạng object hay chuỗi đã `JSON.stringify` — mở `src/lib/http.ts` xem `ApiFetchOptions` rồi truyền cho khớp; các file `features/hddt/api/*.ts` là ví dụ sẵn có.

- [ ] **Step 2: Viết hook TanStack Query**

```ts
// hdđt_maxv/src/features/to_khai/api/toKhaiQueries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import {
  getBan,
  getDanhSachKy,
  getSanSang,
  postDoiTrangThai,
  postTinh,
  putGhiDe,
  type GhiDeItem,
  type Ky,
} from "./toKhai";

// Khóa gắn `companyId` vì tờ khai nằm ở DB riêng từng tenant — đổi công ty là đổi key, không rò
// dữ liệu công ty cũ (cùng quy ước `invoiceKeys` bên module hóa đơn).
export const toKhaiKeys = {
  byCompany: (companyId: string | null) => ["toKhai", companyId] as const,
  sanSang: (companyId: string | null, ky: Ky) => ["toKhai", companyId, "sanSang", ky] as const,
  ban: (companyId: string | null, ky: Ky) => ["toKhai", companyId, "ban", ky] as const,
  danhSach: (companyId: string | null) => ["toKhai", companyId, "danhSach"] as const,
};

export function useSanSangQuery(ky: Ky, enabled = true) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: toKhaiKeys.sanSang(currentCompanyId, ky),
    queryFn: () => getSanSang(ky),
    enabled: enabled && isAuthenticated && !!currentCompanyId,
  });
}

/** Bản tờ khai của kỳ; kỳ chưa lập thì BE trả 404 -> `retry: false` để không thử lại vô ích. */
export function useBanToKhaiQuery(ky: Ky, enabled = true) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: toKhaiKeys.ban(currentCompanyId, ky),
    queryFn: () => getBan(ky),
    enabled: enabled && isAuthenticated && !!currentCompanyId,
    retry: false,
  });
}

export function useDanhSachKyQuery() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: toKhaiKeys.danhSach(currentCompanyId),
    queryFn: getDanhSachKy,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Mọi mutation đều làm mới cùng một prefix — bản mới trả về đã đủ, chỉ cần đồng bộ cache. */
function useLamMoi() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return () => qc.invalidateQueries({ queryKey: toKhaiKeys.byCompany(currentCompanyId) });
}

export function useTinhToKhai() {
  const lamMoi = useLamMoi();
  return useMutation({ mutationFn: (ky: Ky) => postTinh(ky), onSuccess: lamMoi });
}

export function useLuuToKhai() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; ghiDe: Record<string, GhiDeItem> }) => putGhiDe(v.ky, v.ghiDe),
    onSuccess: lamMoi,
  });
}

export function useDoiTrangThai() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; chot: boolean }) => postDoiTrangThai(v.ky, v.chot),
    onSuccess: lamMoi,
  });
}
```

- [ ] **Step 3: Kiểm biên dịch**

Run: `cd hdđt_maxv && npx tsc -b`
Expected: sạch.

- [ ] **Step 4: Commit**

```bash
git add "hdđt_maxv/src/features/to_khai/api"
git commit -m "🎉: Thêm lớp gọi API tờ khai 01/GTGT cho frontend"
```

---

### Task 10: Frontend — tách layout mẫu in 01/GTGT dùng chung

Refactor thuần: màn Dịch vụ công phải giữ nguyên hành vi, chỉ đổi chỗ lấy mảng `HANG`.

**Files:**
- Create: `hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.tsx`
- Modify: `hdđt_maxv/src/features/dich_vu_cong/components/ToKhaiGtgt01Form.tsx`

**Interfaces:**
- Produces:
  - `interface HangChiTieu { stt: string; nhan: string; giaTri?: string; thue?: string; header?: boolean; indent?: number }`
  - `const HANG_GTGT01: HangChiTieu[]` — 30 dòng chỉ tiêu, chuyển nguyên từ file cũ
  - `function maChiTieu(tag: string): string` — `"ct32a"` → `"32a"`

- [ ] **Step 1: Chuyển mảng `HANG` sang file dùng chung**

Tạo `hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.tsx`, copy **nguyên văn** `interface HangChiTieu` và mảng `HANG` từ `ToKhaiGtgt01Form.tsx` (dòng 20-152), đổi tên mảng thành `HANG_GTGT01` và export cả hai. Kiểu của `giaTri`/`thue` nới từ `CtTagGtgt01` thành `string` để màn lập tờ khai (không phụ thuộc kiểu của API DVC) dùng chung được.

```tsx
// hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.tsx
/**
 * Layout MẪU IN 01/GTGT (TT80/2021) — nguồn DUY NHẤT cho cả hai màn dùng mẫu này:
 *  - `dich_vu_cong/components/ToKhaiGtgt01Form.tsx` (chỉ đọc, số bóc từ XML đã nộp)
 *  - `to_khai/components/ToKhaiGtgt01Editor.tsx` (nhập được, số tính từ hóa đơn)
 * Chép mảng này sang file thứ hai là cầm chắc hai bản trôi lệch khi mẫu tờ khai đổi.
 */
export interface HangChiTieu {
  stt: string;
  nhan: string;
  /** Tên thẻ `ctNN` đổ vào cột "Giá trị hàng hóa, dịch vụ". */
  giaTri?: string;
  /** Tên thẻ `ctNN` đổ vào cột "Thuế giá trị gia tăng". */
  thue?: string;
  header?: boolean;
  indent?: number;
}

export const HANG_GTGT01: HangChiTieu[] = [
  // ... copy nguyên văn 30 phần tử từ ToKhaiGtgt01Form.tsx
];

/** `"ct32a"` -> `"32a"` — số ngoặc in trên mẫu, suy từ tên thẻ để nhãn và số không gõ lệch nhau. */
export function maChiTieu(tag: string): string {
  return tag.replace(/^ct/, "");
}
```

`maChiTieu` chuyển từ `dich_vu_cong/components/mauInFormat.ts` sang đây (hai màn cùng cần). Để không phải sửa mọi chỗ đang import, cho `mauInFormat.ts` re-export lại:

```ts
// hdđt_maxv/src/features/dich_vu_cong/components/mauInFormat.ts
// (xóa phần thân `maChiTieu` cũ, thay bằng dòng dưới — `fmtSoTien` giữ nguyên tại chỗ)
export { maChiTieu } from "../../_shared/to_khai/gtgt01Layout";
```

- [ ] **Step 2: Cho `ToKhaiGtgt01Form.tsx` dùng mảng chung**

Xóa `interface HangChiTieu` và mảng `HANG` khỏi file cũ, thay bằng:

```tsx
import { HANG_GTGT01, type HangChiTieu } from "../../_shared/to_khai/gtgt01Layout";
```

rồi đổi mọi chỗ lặp `HANG.map(...)` thành `HANG_GTGT01.map(...)`. Giữ nguyên `OHangTien` và phần JSX tiêu đề — chúng phụ thuộc kiểu `DvcChiTietGtgt01` của module DVC.

- [ ] **Step 3: Kiểm biên dịch và lint**

Run: `cd hdđt_maxv && npx tsc -b`
Run: `cd hdđt_maxv && npx eslint src/features/_shared src/features/dich_vu_cong`
Expected: sạch.

- [ ] **Step 4: Kiểm bằng tay — màn cũ không đổi**

Chạy `npm run dev`, vào Dịch vụ công, mở một hồ sơ 01/GTGT đã có XML bằng cột "Tờ khai / Phụ lục".
Expected: bảng chỉ tiêu hiện y như trước lúc refactor — đủ 30 dòng, đúng số ngoặc `[NN]`, đúng thụt lề.

- [ ] **Step 5: Commit**

```bash
git add "hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.tsx" "hdđt_maxv/src/features/dich_vu_cong/components/ToKhaiGtgt01Form.tsx"
git commit -m "🔨: Tách layout mẫu in 01/GTGT ra dùng chung cho hai màn"
```

---

### Task 11: Frontend — chọn kỳ và banner tình trạng kỳ

**Files:**
- Create: `hdđt_maxv/src/features/to_khai/components/ChonKyPanel.tsx`
- Create: `hdđt_maxv/src/features/to_khai/components/TrangThaiKyBanner.tsx`
- Modify: `hdđt_maxv/src/pages/to_khai/ToKhai.tsx`

**Interfaces:**
- Consumes: `useSanSangQuery`, `useTinhToKhai`, `useBanToKhaiQuery` (Task 9)
- Produces: `<ChonKyPanel ky onChange />`, `<TrangThaiKyBanner kq onSangManHoaDon />`

- [ ] **Step 1: Viết `ChonKyPanel.tsx`**

```tsx
// hdđt_maxv/src/features/to_khai/components/ChonKyPanel.tsx
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import type { Ky, KyLoai } from "../api/toKhai";

/** Chọn kỳ tính thuế. Đổi loại kỳ thì kẹp lại số kỳ cho khỏi treo "quý 7". */
export default function ChonKyPanel({
  ky,
  onChange,
  disabled,
}: {
  ky: Ky;
  onChange: (ky: Ky) => void;
  disabled?: boolean;
}) {
  const soKyToiDa = ky.kyLoai === "thang" ? 12 : 4;
  const danhSachKySo = Array.from({ length: soKyToiDa }, (_, i) => i + 1);
  const namHienTai = new Date().getFullYear();
  const danhSachNam = Array.from({ length: 6 }, (_, i) => namHienTai - i);

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      <TextField
        select
        size="small"
        label="Loại kỳ"
        value={ky.kyLoai}
        disabled={disabled}
        onChange={(e) => {
          const kyLoai = e.target.value as KyLoai;
          const max = kyLoai === "thang" ? 12 : 4;
          onChange({ ...ky, kyLoai, kySo: Math.min(ky.kySo, max) });
        }}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="thang">Tháng</MenuItem>
        <MenuItem value="quy">Quý</MenuItem>
      </TextField>

      <TextField
        select
        size="small"
        label={ky.kyLoai === "thang" ? "Tháng" : "Quý"}
        value={ky.kySo}
        disabled={disabled}
        onChange={(e) => onChange({ ...ky, kySo: Number(e.target.value) })}
        sx={{ minWidth: 120 }}
      >
        {danhSachKySo.map((n) => (
          <MenuItem key={n} value={n}>
            {n}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label="Năm"
        value={ky.nam}
        disabled={disabled}
        onChange={(e) => onChange({ ...ky, nam: Number(e.target.value) })}
        sx={{ minWidth: 120 }}
      >
        {danhSachNam.map((n) => (
          <MenuItem key={n} value={n}>
            {n}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
```

- [ ] **Step 2: Viết `TrangThaiKyBanner.tsx`**

```tsx
// hdđt_maxv/src/features/to_khai/components/TrangThaiKyBanner.tsx
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import type { KetQuaSanSang } from "../api/toKhai";

/**
 * Ba trạng thái của kỳ (xem spec mục 7.2). Chưa sẵn sàng thì KHÔNG tính — module tờ khai không tự
 * gọi cổng thuế, việc đồng bộ/tải chi tiết nằm bên màn Hóa đơn điện tử.
 */
export default function TrangThaiKyBanner({
  kq,
  onSangManHoaDon,
}: {
  kq: KetQuaSanSang;
  onSangManHoaDon: () => void;
}) {
  if (kq.trangThai === "san_sang") {
    return (
      <Alert severity="success">
        Kỳ đã đủ dữ liệu: {kq.soHdBan} hóa đơn bán ra, {kq.soHdMua} hóa đơn mua vào.
      </Alert>
    );
  }

  const laChuaDongBo = kq.trangThai === "chua_dong_bo";
  return (
    <Alert
      severity={laChuaDongBo ? "warning" : "error"}
      action={
        <Button color="inherit" size="small" onClick={onSangManHoaDon}>
          Sang màn Hóa đơn điện tử
        </Button>
      }
    >
      <AlertTitle>{laChuaDongBo ? "Kỳ chưa được đồng bộ" : "Thiếu chi tiết hóa đơn"}</AlertTitle>
      {laChuaDongBo
        ? "Đồng bộ trọn kỳ này bên màn Hóa đơn điện tử rồi quay lại."
        : `Còn ${kq.hdThieuDetail} hóa đơn chưa tải chi tiết nên chưa tách được thuế suất — bấm "Cập nhật từ Thuế điện tử" cho kỳ này.`}
    </Alert>
  );
}
```

- [ ] **Step 3: Ráp vào trang `ToKhai.tsx`**

```tsx
// hdđt_maxv/src/pages/to_khai/ToKhai.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { toast } from "react-toastify";
import ChonKyPanel from "../../features/to_khai/components/ChonKyPanel";
import TrangThaiKyBanner from "../../features/to_khai/components/TrangThaiKyBanner";
import { useBanToKhaiQuery, useSanSangQuery, useTinhToKhai } from "../../features/to_khai/api/toKhaiQueries";
import type { Ky } from "../../features/to_khai/api/toKhai";

/** Kỳ mặc định: kỳ tháng LIỀN TRƯỚC — kỳ đang chạy thường chưa đủ hóa đơn để lập. */
function kyMacDinh(): Ky {
  const now = new Date();
  const thang = now.getMonth(); // 0-based -> chính là tháng trước dạng 1-based
  return thang === 0
    ? { nam: now.getFullYear() - 1, kyLoai: "thang", kySo: 12 }
    : { nam: now.getFullYear(), kyLoai: "thang", kySo: thang };
}

export default function ToKhai() {
  const [ky, setKy] = useState<Ky>(kyMacDinh);
  const navigate = useNavigate();
  const sanSang = useSanSangQuery(ky);
  const ban = useBanToKhaiQuery(ky);
  const tinh = useTinhToKhai();

  const daSanSang = sanSang.data?.trangThai === "san_sang";
  const dangChay = tinh.isPending || sanSang.isFetching;

  const bamTinh = () => {
    tinh.mutate(ky, {
      onSuccess: () => toast.success("Đã lập tờ khai."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Không lập được tờ khai."),
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Tờ khai thuế GTGT — mẫu 01/GTGT
      </Typography>

      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <ChonKyPanel ky={ky} onChange={setKy} disabled={dangChay} />
          <Button variant="contained" disabled={!daSanSang || dangChay} onClick={bamTinh}>
            {ban.data ? "Tính lại" : "Lập tờ khai"}
          </Button>
          {dangChay && <CircularProgress size={20} />}
        </Stack>

        {sanSang.data && (
          <TrangThaiKyBanner
            kq={sanSang.data}
            onSangManHoaDon={() => navigate("/hoa-don-dien-tu")}
          />
        )}
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Kiểm biên dịch, lint, build**

Run: `cd hdđt_maxv && npx tsc -b`
Run: `cd hdđt_maxv && npx eslint src/features/to_khai src/pages/to_khai`
Run: `cd hdđt_maxv && npm run build`
Expected: cả ba sạch.

- [ ] **Step 5: Kiểm bằng tay**

Bật module `tokhai` cho tài khoản test (bên admin `maxv`, form gói), đăng nhập `hdđt_maxv`, bấm nút "Tờ khai".
Expected: chọn được kỳ; kỳ chưa đồng bộ hiện banner vàng và nút "Lập tờ khai" mờ; kỳ đã đồng bộ đủ hiện banner xanh kèm số hóa đơn.

- [ ] **Step 6: Commit**

```bash
git add "hdđt_maxv/src/features/to_khai/components" "hdđt_maxv/src/pages/to_khai/ToKhai.tsx"
git commit -m "🎉: Thêm màn chọn kỳ và kiểm tra dữ liệu kỳ cho tờ khai"
```

---

### Task 12: Frontend — form 01/GTGT nhập được

**Files:**
- Create: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`
- Modify: `hdđt_maxv/src/pages/to_khai/ToKhai.tsx`

**Interfaces:**
- Consumes: `HANG_GTGT01`, `maChiTieu` (Task 10); `BanToKhai`, `GhiDeItem` (Task 9); `useLuuToKhai`, `useDoiTrangThai` (Task 9)
- Produces: `<ToKhaiGtgt01Editor ban onLuu onChot onMoKhoa />`

- [ ] **Step 1: Viết editor**

```tsx
// hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx
import { useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { HANG_GTGT01, maChiTieu, type HangChiTieu } from "../../_shared/to_khai/gtgt01Layout";
import type { BanToKhai, GhiDeItem } from "../api/toKhai";

/** Ô người dùng tự nhập — khớp `CT_NHAP_TAY` bên BE (`tinhGtgt01.ts`). */
const O_NHAP_TAY = new Set([
  "ct22", "ct23a", "ct24a", "ct25", "ct37", "ct38", "ct39a", "ct40b", "ct42",
]);

const fmt = new Intl.NumberFormat("vi-VN");

export default function ToKhaiGtgt01Editor({
  ban,
  onLuu,
  onDoiTrangThai,
  dangLuu,
}: {
  ban: BanToKhai;
  onLuu: (ghiDe: Record<string, GhiDeItem>) => void;
  onDoiTrangThai: (chot: boolean) => void;
  dangLuu: boolean;
}) {
  const [nhap, setNhap] = useState<Record<string, string>>({});
  const khoa = ban.trangThai === "chot";

  const giaHienThi = (tag: string): string => {
    if (tag in nhap) return nhap[tag];
    const v = ban.ct[tag];
    return v == null ? "" : String(v);
  };

  const luu = () => {
    const ghiDe: Record<string, GhiDeItem> = { ...ban.ghiDe };
    for (const [tag, chuoi] of Object.entries(nhap)) {
      const gia = Number(chuoi.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(gia)) ghiDe[tag] = { gia };
    }
    onLuu(ghiDe);
    setNhap({});
  };

  const oTien = (tag?: string) => {
    if (!tag) return <TableCell />;
    const daGhiDe = tag in ban.ghiDe;
    const suaDuoc = !khoa;
    const soMay = ban.ctMay[tag];

    return (
      <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap", minWidth: 150 }}>
        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
          [{maChiTieu(tag)}]
        </Typography>
        <Tooltip title={daGhiDe && soMay != null ? `Máy tính: ${fmt.format(soMay)}` : ""}>
          <TextField
            size="small"
            variant="standard"
            disabled={!suaDuoc}
            value={giaHienThi(tag)}
            onChange={(e) => setNhap((cu) => ({ ...cu, [tag]: e.target.value }))}
            slotProps={{
              input: { style: { textAlign: "right" } },
            }}
            sx={{
              width: 130,
              // Ô nhập tay viền nổi; ô đã ghi đè có chấm cam để nhìn ra ngay số nào người sửa.
              "& .MuiInput-root": {
                bgcolor: O_NHAP_TAY.has(tag) ? "action.hover" : "transparent",
                borderBottom: daGhiDe ? "2px solid" : undefined,
                borderColor: daGhiDe ? "warning.main" : undefined,
              },
            }}
          />
        </Tooltip>
      </TableCell>
    );
  };

  const hang = (h: HangChiTieu, i: number) => (
    <TableRow key={`${h.stt}-${i}`}>
      <TableCell sx={{ width: 60 }}>{h.stt}</TableCell>
      <TableCell sx={{ pl: 2 + (h.indent ?? 0) * 2, fontWeight: h.header ? 700 : 400 }}>
        {h.nhan}
      </TableCell>
      {h.header ? (
        <>
          <TableCell />
          <TableCell />
        </>
      ) : (
        <>
          {oTien(h.giaTri)}
          {oTien(h.thue)}
        </>
      )}
    </TableRow>
  );

  return (
    <Stack spacing={2}>
      {ban.dieuChinh.soHd > 0 && (
        <Alert severity="warning">
          Kỳ này có {ban.dieuChinh.soHd} hóa đơn điều chỉnh, tổng{" "}
          {fmt.format(ban.dieuChinh.giaTri)} — kiểm tra dấu trước khi chốt.
        </Alert>
      )}
      {ban.treo.length > 0 && (
        <Alert severity="warning">
          {ban.treo.length} hóa đơn chưa gộp được vào tờ khai (thiếu tỷ giá hoặc mức thuế suất chưa
          nhận diện) — xem bảng kê để xử lý.
        </Alert>
      )}
      {ban.nguonCt22 === "nhap_tay" && (
        <Alert severity="info">
          Chỉ tiêu [22] chưa nối được từ kỳ trước (kỳ trước chưa chốt trong phần mềm) — nhập tay rồi
          lưu.
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>STT</TableCell>
              <TableCell>Chỉ tiêu</TableCell>
              <TableCell align="right">Giá trị HHDV</TableCell>
              <TableCell align="right">Thuế GTGT</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{HANG_GTGT01.map(hang)}</TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={luu} disabled={khoa || dangLuu}>
          Lưu nháp
        </Button>
        <Button
          variant="outlined"
          color={khoa ? "warning" : "primary"}
          onClick={() => onDoiTrangThai(!khoa)}
          disabled={dangLuu}
        >
          {khoa ? "Mở khóa" : "Chốt"}
        </Button>
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 2: Ráp editor vào trang**

Trong `ToKhai.tsx`, thêm dưới banner:

```tsx
import ToKhaiGtgt01Editor from "../../features/to_khai/components/ToKhaiGtgt01Editor";
import { useDoiTrangThai, useLuuToKhai } from "../../features/to_khai/api/toKhaiQueries";

// ... trong component:
  const luu = useLuuToKhai();
  const doiTrangThai = useDoiTrangThai();

// ... trong JSX, sau <TrangThaiKyBanner />:
        {ban.data && (
          <ToKhaiGtgt01Editor
            ban={ban.data}
            dangLuu={luu.isPending || doiTrangThai.isPending}
            onLuu={(ghiDe) =>
              luu.mutate(
                { ky, ghiDe },
                {
                  onSuccess: () => toast.success("Đã lưu tờ khai."),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Không lưu được tờ khai."),
                },
              )
            }
            onDoiTrangThai={(chot) =>
              doiTrangThai.mutate(
                { ky, chot },
                {
                  onSuccess: () => toast.success(chot ? "Đã chốt tờ khai." : "Đã mở khóa tờ khai."),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Không đổi được trạng thái."),
                },
              )
            }
          />
        )}
```

- [ ] **Step 3: Kiểm biên dịch, lint, build**

Run: `cd hdđt_maxv && npx tsc -b`
Run: `cd hdđt_maxv && npx eslint src/features/to_khai src/pages/to_khai`
Run: `cd hdđt_maxv && npm run build`
Expected: cả ba sạch.

- [ ] **Step 4: Kiểm bằng tay**

Với một kỳ đã đồng bộ đủ: bấm "Lập tờ khai" → form hiện đủ 30 dòng có số. Sửa ô [25], bấm "Lưu nháp" → số cập nhật, ô có gạch cam, hover hiện "Máy tính: …". Bấm "Tính lại" → ô [25] vừa sửa **không bị xóa**. Bấm "Chốt" → mọi ô khóa, nút đổi thành "Mở khóa".

- [ ] **Step 5: Commit**

```bash
git add "hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx" "hdđt_maxv/src/pages/to_khai/ToKhai.tsx"
git commit -m "🎉: Thêm form nhập tờ khai 01/GTGT với ô sửa tay"
```

---

### Task 13: Bảng kê hóa đơn theo chỉ tiêu

**Files:**
- Modify: `be_maxv/src/services/client/to_khai/toKhaiGtgt01.service.ts` (thêm `bangKeChiTieu`)
- Modify: `be_maxv/src/controllers/client/to_khai/toKhaiGtgt01.controller.ts` (thêm handler `bangKe`)
- Modify: `be_maxv/src/routes/to_khai/toKhaiGtgt01.route.ts` (thêm route)
- Modify: `hdđt_maxv/src/features/to_khai/api/toKhai.ts` + `toKhaiQueries.ts`
- Create: `hdđt_maxv/src/features/to_khai/components/BangKeHoaDonDialog.tsx`
- Test: `be_maxv/src/__tests__/bangKeChiTieu.test.ts`

**Interfaces:**
- Produces:
  - `function nhanThuocChiTieu(chiTieu: string): string[]` — `"ct32"` → `["8%", "10%"]`
  - `function bangKeChiTieu(db, ky, chiTieu): Promise<DongBangKe[]>`
  - `interface DongBangKe { id: string; khhdon: string; shdon: string; tdlap: string; mstDoiTac: string; tenDoiTac: string; tthai: string | null; giaTri: number; thue: number }`
  - `useBangKeQuery(ky, chiTieu)` bên FE

- [ ] **Step 1: Viết test cho ánh xạ ngược chỉ tiêu → nhãn thuế suất**

```ts
// be_maxv/src/__tests__/bangKeChiTieu.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nhanThuocChiTieu } from "../services/client/to_khai/toKhaiGtgt01.service";

test("[32] gồm cả 8% và 10%", () => {
  assert.deepEqual(nhanThuocChiTieu("ct32").sort(), ["10%", "8%"]);
  assert.deepEqual(nhanThuocChiTieu("ct33").sort(), ["10%", "8%"]);
});

test("[30]/[31] chỉ có 5%", () => {
  assert.deepEqual(nhanThuocChiTieu("ct30"), ["5%"]);
  assert.deepEqual(nhanThuocChiTieu("ct31"), ["5%"]);
});

test("[26] là hàng không chịu thuế, [29] là 0%, [32a] là KKKNT", () => {
  assert.deepEqual(nhanThuocChiTieu("ct26"), ["KCT"]);
  assert.deepEqual(nhanThuocChiTieu("ct29"), ["0%"]);
  assert.deepEqual(nhanThuocChiTieu("ct32a"), ["KKKNT"]);
});

test("chỉ tiêu không phải bán ra thì không có nhãn nào", () => {
  assert.deepEqual(nhanThuocChiTieu("ct40"), []);
  assert.deepEqual(nhanThuocChiTieu("ct22"), []);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/bangKeChiTieu.test.ts`
Expected: FAIL — `nhanThuocChiTieu` chưa tồn tại.

- [ ] **Step 3: Thêm `nhanThuocChiTieu` và `bangKeChiTieu` vào service**

```ts
// thêm vào cuối be_maxv/src/services/client/to_khai/toKhaiGtgt01.service.ts
// (bổ sung `O_THEO_NHAN` vào dòng import sẵn có từ "./gomHoaDonGtgt")

export interface DongBangKe {
  id: string;
  khhdon: string;
  shdon: string;
  tdlap: string;
  mstDoiTac: string;
  tenDoiTac: string;
  tthai: string | null;
  giaTri: number;
  thue: number;
}

/**
 * Ánh xạ NGƯỢC "chỉ tiêu -> các nhãn thuế suất rót vào nó", suy thẳng từ bảng `O_THEO_NHAN` để hai
 * chiều không bao giờ lệch nhau (thêm mức thuế suất mới chỉ sửa một bảng).
 */
export function nhanThuocChiTieu(chiTieu: string): string[] {
  return Object.entries(O_THEO_NHAN)
    .filter(([, o]) => o.giaTri === chiTieu || o.thue === chiTieu)
    .map(([nhan]) => nhan);
}

/** Ô thuế đi kèm ô giá trị (`ct32` -> `ct33`); ô không có cột thuế -> null. */
function oThueCuaChiTieu(chiTieu: string): string | null {
  const cap = Object.values(O_THEO_NHAN).find((o) => o.giaTri === chiTieu);
  return cap?.thue ?? null;
}

/** Hóa đơn cấu thành một chỉ tiêu bán ra — nhóm điều chỉnh (`tthai=3`) xếp lên đầu để dễ soát. */
export async function bangKeChiTieu(
  db: PrismaClient,
  ky: Ky,
  chiTieu: string,
): Promise<DongBangKe[]> {
  const nhan = new Set(nhanThuocChiTieu(chiTieu));
  if (nhan.size === 0) return [];

  const khoang = khoangCuaKy(ky);
  const rows = await db.vct50view.findMany({
    where: { tdlap: { gte: khoang.tuNgay, lte: khoang.denNgay } },
    select: {
      id: true, khhdon: true, shdon: true, tdlap: true, nmmst: true, nmten: true,
      tthai: true, dvtte: true, tgia: true, tgtcthue: true, tgtthue: true, detail: true,
    },
  });

  const oThue = oThueCuaChiTieu(chiTieu);
  const ds: DongBangKe[] = [];
  for (const r of rows as unknown as (HoaDonGom & Record<string, unknown>)[]) {
    // Gộp RIÊNG từng hóa đơn rồi đọc đúng ô đang xem — dùng lại y hệt bộ gộp của lượt tính, nên
    // tổng cột trong bảng kê luôn khớp con số trên form (không có đường tính thứ hai để lệch).
    const rieng = gomBanRa([r]) as unknown as { tong: Record<string, number> };
    const giaTri = Number(rieng.tong[chiTieu] ?? 0);
    if (giaTri === 0) continue;
    const thue = oThue ? Number(rieng.tong[oThue] ?? 0) : 0;
    ds.push({
      id: r.id,
      khhdon: String(r.khhdon ?? ""),
      shdon: String(r.shdon ?? ""),
      tdlap: r.tdlap instanceof Date ? r.tdlap.toISOString() : String(r.tdlap ?? ""),
      mstDoiTac: String(r.nmmst ?? ""),
      tenDoiTac: String(r.nmten ?? ""),
      tthai: r.tthai,
      giaTri,
      thue,
    });
  }

  return ds.sort((a, b) => Number(b.tthai === "3") - Number(a.tthai === "3"));
}
```

Trong `gomHoaDonGtgt.ts`, export bảng ánh xạ để dùng chung hai chiều:

```ts
// gomHoaDonGtgt.ts — đổi khai báo hằng thành export
export const O_THEO_NHAN_PUBLIC = O_THEO_NHAN;
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/bangKeChiTieu.test.ts`
Expected: PASS cả 4 ca.

- [ ] **Step 5: Thêm endpoint**

Controller:

```ts
export async function bangKe(
  request: FastifyRequest<{ Params: KyQuery; Querystring: { chiTieu?: string } }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const chiTieu = String(request.query.chiTieu ?? "");
    return reply.send(await ToKhai.bangKeChiTieu(db, docKy(request.params), chiTieu));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lấy được bảng kê hóa đơn.");
  }
}
```

Route (đặt cùng nhóm các route có kỳ trên path):

```ts
  fastify.get("/gtgt01/:nam/:kyLoai/:kySo/bang-ke", { preHandler: guard, handler: bangKe });
```

- [ ] **Step 6: Thêm lớp gọi API và dialog bên FE**

`toKhai.ts`:

```ts
export interface DongBangKe {
  id: string;
  khhdon: string;
  shdon: string;
  tdlap: string;
  mstDoiTac: string;
  tenDoiTac: string;
  tthai: string | null;
  giaTri: number;
  thue: number;
}

export async function getBangKe(ky: Ky, chiTieu: string): Promise<DongBangKe[]> {
  return apiFetch<DongBangKe[]>(
    `/to-khai/gtgt01/${duongDanKy(ky)}/bang-ke?chiTieu=${encodeURIComponent(chiTieu)}`,
  );
}
```

`toKhaiQueries.ts`:

```ts
export function useBangKeQuery(ky: Ky, chiTieu: string | null) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: ["toKhai", currentCompanyId, "bangKe", ky, chiTieu],
    queryFn: () => getBangKe(ky, chiTieu as string),
    enabled: isAuthenticated && !!currentCompanyId && !!chiTieu,
  });
}
```

`BangKeHoaDonDialog.tsx`:

```tsx
// hdđt_maxv/src/features/to_khai/components/BangKeHoaDonDialog.tsx
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import { useBangKeQuery } from "../api/toKhaiQueries";
import type { Ky } from "../api/toKhai";

const fmt = new Intl.NumberFormat("vi-VN");

/** Hóa đơn cấu thành một chỉ tiêu. Hóa đơn điều chỉnh gắn nhãn để soát dấu (spec mục 11.1). */
export default function BangKeHoaDonDialog({
  ky,
  chiTieu,
  onClose,
}: {
  ky: Ky;
  chiTieu: string | null;
  onClose: () => void;
}) {
  const bangKe = useBangKeQuery(ky, chiTieu);

  return (
    <Dialog open={!!chiTieu} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Hóa đơn cấu thành chỉ tiêu [{chiTieu?.replace(/^ct/, "")}]</DialogTitle>
      <DialogContent>
        {bangKe.isPending ? (
          <CircularProgress size={24} />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ký hiệu</TableCell>
                <TableCell>Số HĐ</TableCell>
                <TableCell>Ngày lập</TableCell>
                <TableCell>MST người mua</TableCell>
                <TableCell>Tên người mua</TableCell>
                <TableCell align="right">Giá trị</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(bangKe.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.khhdon}</TableCell>
                  <TableCell>
                    {r.shdon}
                    {r.tthai === "3" && (
                      <Chip size="small" color="warning" label="Điều chỉnh" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>{r.tdlap.slice(0, 10)}</TableCell>
                  <TableCell>{r.mstDoiTac}</TableCell>
                  <TableCell>{r.tenDoiTac}</TableCell>
                  <TableCell align="right">{fmt.format(r.giaTri)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Trong `ToKhaiGtgt01Editor.tsx`, thêm state `const [xemChiTieu, setXemChiTieu] = useState<string | null>(null);`, gắn `onDoubleClick={() => setXemChiTieu(tag)}` lên `TableCell` của ô tiền, và render `<BangKeHoaDonDialog ky={ban.ky} chiTieu={xemChiTieu} onClose={() => setXemChiTieu(null)} />`.

- [ ] **Step 7: Kiểm biên dịch cả hai đầu**

Run: `cd be_maxv && npm run typecheck && npx eslint src/services/client/to_khai src/controllers/client/to_khai src/routes/to_khai`
Run: `cd hdđt_maxv && npx tsc -b && npm run build`
Expected: sạch.

- [ ] **Step 8: Kiểm bằng tay**

Nháy đúp vào số ở ô [32] → dialog liệt kê hóa đơn, tổng cột "Giá trị" phải bằng đúng số trên ô [32]. Hóa đơn điều chỉnh có chip cam và nằm trên đầu.

- [ ] **Step 9: Commit**

```bash
git add be_maxv/src/services/client/to_khai be_maxv/src/controllers/client/to_khai be_maxv/src/routes/to_khai be_maxv/src/__tests__/bangKeChiTieu.test.ts "hdđt_maxv/src/features/to_khai"
git commit -m "🎉: Thêm bảng kê hóa đơn cấu thành từng chỉ tiêu tờ khai"
```

---

### Task 14: Xuất Excel tờ khai

**Files:**
- Create: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`
- Modify: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx` (thêm nút)

**Interfaces:**
- Consumes: `HEADER_FILL`, `HEADER_HEIGHT`, `CELL_BORDER` (`features/hddt/exportXlsx.ts`), `HANG_GTGT01` (Task 10), `BanToKhai` (Task 9)
- Produces: `function xuatToKhaiGtgt01(ban: BanToKhai): Promise<void>` — tải file `ToKhai01GTGT_{T7-2026}.xlsx`

- [ ] **Step 1: Viết bộ dựng workbook**

```ts
// hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts
import ExcelJS from "exceljs";
import { HEADER_FILL, HEADER_HEIGHT, CELL_BORDER } from "../hddt/exportXlsx";
import { HANG_GTGT01 } from "../_shared/to_khai/gtgt01Layout";
import type { BanToKhai } from "./api/toKhai";

/**
 * Xuất tờ khai đang xem ra Excel — bố cục bám mẫu in: STT, chỉ tiêu (thụt lề theo cấp), giá trị,
 * thuế, kèm cột đánh dấu ô nào kế toán đã sửa tay để người soát biết chỗ cần hỏi.
 * Dùng lại ba hằng định dạng của `exportXlsx.ts`, không khai bản riêng.
 */
export async function xuatToKhaiGtgt01(ban: BanToKhai): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("01-GTGT");

  const nhanKy = `${ban.ky.kyLoai === "thang" ? "T" : "Q"}${ban.ky.kySo}/${ban.ky.nam}`;
  ws.addRow([`TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT) — Kỳ ${nhanKy}`]);
  ws.addRow([`Trạng thái: ${ban.trangThai === "chot" ? "Đã chốt" : "Bản nháp"}`]);
  ws.addRow([]);

  const dongTieuDe = ws.addRow(["STT", "Chỉ tiêu", "Giá trị HHDV", "Thuế GTGT", "Ghi chú"]);
  dongTieuDe.height = HEADER_HEIGHT;
  dongTieuDe.eachCell((c) => {
    // HEADER_FILL là chuỗi ARGB, phải bọc trong object fill — đúng cách `exportXlsx.ts:155` và
    // `xuatChiTieuExcel.ts:45` đang dùng.
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = CELL_BORDER;
    c.font = { bold: true };
  });

  for (const h of HANG_GTGT01) {
    const soGiaTri = h.giaTri ? (ban.ct[h.giaTri] ?? null) : null;
    const soThue = h.thue ? (ban.ct[h.thue] ?? null) : null;
    const daSua = [h.giaTri, h.thue].filter((t): t is string => !!t && t in ban.ghiDe);
    const row = ws.addRow([
      h.stt,
      `${"    ".repeat(h.indent ?? 0)}${h.nhan}`,
      soGiaTri,
      soThue,
      daSua.length > 0 ? `Sửa tay: ${daSua.map((t) => `[${t.replace(/^ct/, "")}]`).join(", ")}` : "",
    ]);
    row.eachCell((c) => (c.border = CELL_BORDER));
    if (h.header) row.font = { bold: true };
    row.getCell(3).numFmt = "#,##0";
    row.getCell(4).numFmt = "#,##0";
  }

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 78;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 20;
  ws.getColumn(5).width = 28;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ToKhai01GTGT_${nhanKy.replace("/", "-")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
```

> Ba hằng `HEADER_FILL`/`HEADER_HEIGHT`/`CELL_BORDER` đã được export sẵn ở `exportXlsx.ts:20-39`, không phải sửa file đó. Module Dịch vụ công đang dùng chung đúng kiểu này — xem `xuat_excel/xuatChiTieuExcel.ts:45`.

- [ ] **Step 2: Thêm nút vào editor**

Trong thanh hành động của `ToKhaiGtgt01Editor.tsx`:

```tsx
import { xuatToKhaiGtgt01 } from "../xuatToKhaiExcel";

// ...
        <Button variant="outlined" onClick={() => void xuatToKhaiGtgt01(ban)}>
          Xuất Excel
        </Button>
```

- [ ] **Step 3: Kiểm biên dịch, lint, build**

Run: `cd hdđt_maxv && npx tsc -b && npx eslint src/features/to_khai && npm run build`
Expected: sạch.

- [ ] **Step 4: Kiểm bằng tay**

Bấm "Xuất Excel" → mở file: dòng tiêu đề có tên mẫu và kỳ, đủ 30 dòng chỉ tiêu, số canh phải theo `#,##0`, ô đã sửa tay có ghi chú ở cột cuối.

- [ ] **Step 5: Commit**

```bash
git add "hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts" "hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx"
git commit -m "🎉: Thêm xuất Excel cho tờ khai 01/GTGT"
```

---

### Task 15: Danh sách kỳ đã lập, dọn folder cũ và đối chiếu số thật

**Files:**
- Create: `hdđt_maxv/src/features/to_khai/components/DanhSachKyDaLap.tsx`
- Modify: `hdđt_maxv/src/pages/to_khai/ToKhai.tsx`
- Delete: 5 folder rỗng `lap_to_khai/`

**Interfaces:**
- Consumes: `useDanhSachKyQuery` (Task 9)
- Produces: `<DanhSachKyDaLap onChonKy />`

- [ ] **Step 1: Viết bảng danh sách kỳ**

```tsx
// hdđt_maxv/src/features/to_khai/components/DanhSachKyDaLap.tsx
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useDanhSachKyQuery } from "../api/toKhaiQueries";
import type { Ky } from "../api/toKhai";

const fmt = new Intl.NumberFormat("vi-VN");

/** Các kỳ đã lập — bấm một dòng để mở lại kỳ đó. */
export default function DanhSachKyDaLap({ onChonKy }: { onChonKy: (ky: Ky) => void }) {
  const ds = useDanhSachKyQuery();
  if (!ds.data || ds.data.length === 0) return null;

  return (
    <>
      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
        Các kỳ đã lập
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Kỳ</TableCell>
            <TableCell>Trạng thái</TableCell>
            <TableCell align="right">[40] Phải nộp</TableCell>
            <TableCell align="right">[43] Chuyển kỳ sau</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ds.data.map((r) => (
            <TableRow
              key={`${r.nam}-${r.kyLoai}-${r.kySo}`}
              hover
              sx={{ cursor: "pointer" }}
              onClick={() => onChonKy({ nam: r.nam, kyLoai: r.kyLoai, kySo: r.kySo })}
            >
              <TableCell>
                {r.kyLoai === "thang" ? "T" : "Q"}
                {r.kySo}/{r.nam}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={r.trangThai === "chot" ? "success" : "default"}
                  label={r.trangThai === "chot" ? "Đã chốt" : "Nháp"}
                />
              </TableCell>
              <TableCell align="right">{fmt.format(r.ct40)}</TableCell>
              <TableCell align="right">{fmt.format(r.ct43)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
```

Ráp vào cuối `<Stack>` của `ToKhai.tsx`: `<DanhSachKyDaLap onChonKy={setKy} />`.

- [ ] **Step 2: Xóa 5 folder rỗng của lần chuẩn bị trước**

```bash
rmdir be_maxv/src/controllers/client/hddt/lap_to_khai be_maxv/src/routes/hddt/lap_to_khai be_maxv/src/services/client/hddt/lap_to_khai "hdđt_maxv/src/features/hddt/lap_to_khai" "hdđt_maxv/src/components/lap_to_khai"
```

Git không theo dõi folder rỗng nên bước này chỉ dọn máy làm việc, không sinh thay đổi để commit.

- [ ] **Step 3: Chạy toàn bộ kiểm tra**

Run: `cd be_maxv && npm run typecheck && npm run lint && npx tsx --test src/__tests__/*.test.ts`
Run: `cd hdđt_maxv && npx tsc -b && npm run lint && npm run build`
Run: `cd maxv && npx tsc -b`
Expected: sạch; test BE xanh trừ 5 ca `adminOwner.test.ts` vốn đã đỏ từ trước (cần Postgres đã seed).

- [ ] **Step 4: Đối chiếu với tờ khai thật — phép thử quan trọng nhất**

Chọn một kỳ mà công ty **đã nộp tờ khai 01/GTGT thật** và hồ sơ đó đã đồng bộ trong module Dịch vụ công. Lập tờ khai kỳ đó bằng module mới, rồi mở màn Dịch vụ công xem tờ khai đã nộp của đúng kỳ đó và so từng chỉ tiêu.

Ghi kết quả đối chiếu vào mục 11 của spec:
- [23]/[24] lệch hay khớp → trả lời dứt điểm câu hỏi 11.2 (có gồm hóa đơn mua vào không chịu thuế không).
- Nếu kỳ đó có hóa đơn điều chỉnh → xác nhận dấu, trả lời câu hỏi 11.1.

Lệch thì **dừng lại và báo**, đừng sửa engine cho khớp bằng mọi giá: có thể chính tờ khai đã nộp mới là bản có điều chỉnh tay của kế toán.

- [ ] **Step 5: Commit**

```bash
git add "hdđt_maxv/src/features/to_khai/components/DanhSachKyDaLap.tsx" "hdđt_maxv/src/pages/to_khai/ToKhai.tsx"
git commit -m "🎉: Thêm danh sách kỳ đã lập tờ khai"
```

---

## Sau khi xong

Việc còn lại nằm ở mục 12 của spec, không thuộc kế hoạch này: sinh XML nộp qua eTax, hóa đơn mua vào sót kỳ trước, nhiều bản cho một kỳ (khai bổ sung), và các mẫu tờ khai khác.

Trước khi giao cho người dùng thật, nhớ chạy `npm run sync:tenants` để bảng `tokhai_gtgt01` có mặt trên mọi DB tenant, và bật module `tokhai` trong gói đăng ký của các công ty được dùng chức năng này.
