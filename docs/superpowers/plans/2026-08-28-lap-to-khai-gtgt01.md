# Mô-đun "Tờ khai" — kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kế toán chọn kỳ, gán hóa đơn vào kỳ, soát bảng kê, rồi từ đó ra tờ khai thuế GTGT mẫu 01/GTGT.

**Architecture:** Ba tầng. (1) *Gán kỳ* — bảng `tokhai_ky_hoa_don` chỉ lưu QUYẾT ĐỊNH (hóa đơn nào thuộc kỳ nào, có kê khai không), không chép số tiền. (2) *Bảng kê* — join quyết định với `vct50view`/`vct60view` để luôn ra số mới nhất. (3) *Tờ khai* — lớp hàm thuần (`gomHoaDonGtgt`, `tinhGtgt01`) đọc bảng kê rồi ra bộ chỉ tiêu, test được bằng `node:test` không cần Postgres.

**Tech Stack:** Fastify + Prisma (multi-tenant) · React 19 + MUI + TanStack Query · `node:test` qua `npx tsx --test` · ExcelJS.

**Spec:** `docs/superpowers/specs/2026-08-28-lap-to-khai-gtgt01-design.md` — **lưu ý:** spec viết trước khi đổi hướng, nên mục 7.1/7.2 (suy kỳ từ ngày lập, điều kiện sẵn sàng) đã bị thay bằng cơ chế gán kỳ mô tả dưới đây. Phần công thức (7.6) và ánh xạ thuế suất (7.4) vẫn nguyên giá trị.

## Global Constraints

- **Mô-đun `tokhai` KHÔNG gọi cổng thuế.** Không file nào trong `services/client/to_khai/`, `controllers/client/to_khai/`, `routes/to_khai/` được import `config/gdt-client` hay đọc header `X-Gdt-Token`.
- **Khóa module là `tokhai`**, khai ở cả ba app: `be_maxv/src/constants/modules.ts`, `maxv/src/features/owners/modules.ts`, `hdđt_maxv/src/features/auth/types/index.ts`.
- **Kỳ là quyết định của người dùng, không suy từ ngày lập.** Mọi chỗ cần kỳ đều nhận `{nam, kyLoai, kySo}`.
- **Bảng `tokhai_ky_hoa_don` không bao giờ chứa số tiền.** Hóa đơn đổi (bị thay thế/điều chỉnh/hủy) sau khi kê khai là chuyện thường; chép số sang là tạo bản sao chết.
- **Cột tiền trong Prisma là `Decimal`** — luôn `Number(x ?? 0)` trước khi tính.
- **Ánh xạ thuế suất 8% → [32]/[33]** với số thuế THỰC TẾ; không tính lại bằng `[32] × 10%`.
- **Hóa đơn `tthai` 4 và 6 bị loại**; 1, 2, 3, 5 được tính. Nhóm `tthai=3` cộng vào tổng nhưng gom riêng để hiển thị.
- Frontend **không có test framework** — nghiệm thu bằng `npx tsc -b`, `npm run build`, `npx eslint` và kiểm tay.

---

## Phần A — Đã xong

Ba lát dưới đây đã chạy, typecheck/lint/build sạch, 201/206 test BE pass (5 ca `adminOwner` đỏ sẵn từ trước, cần Postgres đã seed).

### A1. Mô-đun `tokhai` trong gói đăng ký

`MODULE_KEYS` thêm `'tokhai'` ở cả ba app; `MODULE_META` bên admin có nhãn "Tờ khai"; route `/to-khai` bọc `ModuleRoute module="tokhai"`; nút "Tờ khai" trên `AppHeader`.

Kéo theo hai chỗ phải sửa vì `UserModules` có khóa thứ tư: `moduleQuyen.test.ts` (9 literal viết tay) và `pages/to_khai/ToKhai.tsx` (bỏ `import React` thừa). Test mới: `src/__tests__/moduleTokhai.test.ts` (4 ca).

### A2. Bảng kê 26 cột, bộ cột riêng

`features/to_khai/templates/{dauVao,dauRa,index}.ts` — chép từ `hddt/templates` rồi tách hẳn, sắp theo mẫu bảng kê: bỏ 5 cột thao tác, thêm Năm · Kỳ kê khai · Chỉ tiêu tăng giảm · Kê khai/không kê khai. Import trỏ ngược sang `hddt/` chỉ cho hạ tầng dùng chung (`InvoiceColumn`, `renderCell`, định dạng số, nhãn trạng thái).

### A3. Luồng kê khai theo kỳ

| Lớp | File | Việc |
|---|---|---|
| DB | `prisma/tenant/schema.prisma` | Model `tokhai_ky_hoa_don`, PK `[hoa_don_id, chieu]` |
| BE | `services/client/to_khai/kySoThue.ts` | Kỳ ↔ khoảng ngày (`{tuNgay, denNgay}` dạng `yyyy-MM-dd`), 8 ca test |
| BE | `services/client/to_khai/keKhaiKy.service.ts` | `danhDauKy` (upsert lô 200) · `layBangKeTheoKy` |
| BE | `controllers/client/to_khai/keKhaiKy.controller.ts` + `routes/to_khai/keKhaiKy.route.ts` | `POST /api/v1/to-khai/ke-khai` · `GET /api/v1/to-khai/hoa-don` |
| FE | `features/to_khai/ky.ts` | `Ky`, `ToKhaiRow`, `kyTuQuery`/`kyToQuery`, `kyMacDinh` |
| FE | `features/to_khai/api/{toKhai,toKhaiQueries}.ts` | Gọi hai endpoint trên |
| FE | `features/to_khai/components/DialogKeKhai.tsx` | Mở từ màn Hóa đơn điện tử; chọn kỳ → gán → điều hướng `/to-khai?…` |
| FE | `features/to_khai/components/{ChonKyPanel,ToKhaiInvoiceTabs}.tsx` | Chọn kỳ (trên query string) + hai tab bảng kê |

Hai quy ước đã chốt trong lớp này, các task sau phải giữ:

1. **Upsert khi kê khai lại**, không xóa-rồi-tạo — `ke_khai` / `chi_tieu_tang_giam` / `ghi_chu` là lựa chọn của kế toán, kê khai lại chỉ đổi *kỳ*.
2. **`layBangKeTheoKy` gọi lại `GDTService.getSavedInvoices`** thay vì tự truy vấn — hàm đó đã gánh việc bóc tên hàng từ `detail` và dựng mắt xích "bị thay thế bởi hóa đơn nào".

---

## Phần B — Còn phải làm

> **Trạng thái 2026-08-31:** Task 1–8 đã viết xong và qua kiểm tự động (typecheck · lint · build ·
> 241/246 test BE, 5 ca `adminOwner` đỏ sẵn từ trước). **Chưa làm: bước đối chiếu tay ở Task 8
> Step 4** — lập lại một kỳ đã nộp tờ khai thật rồi so từng chỉ tiêu với XML trong `dvc_ho_so`.
> Đó là phép thử duy nhất trả lời được hai câu hỏi mở ở mục 11 của spec (dấu hóa đơn điều chỉnh,
> [23]/[24] có gồm hóa đơn mua vào không chịu thuế không).

Thứ tự dưới đây có phụ thuộc: Task 1 mở đường cho kế toán loại hóa đơn khỏi kỳ, mà đó chính là đầu vào Task 2 dùng để tính.

### Task 1: Sửa được "Kê khai/không kê khai" và "Chỉ tiêu tăng giảm"

Hai cột này đang chỉ hiển thị. Chúng quyết định hóa đơn nào vào tờ khai, nên phải sửa được trước khi tính chỉ tiêu.

**Files:**
- Modify: `be_maxv/src/services/client/to_khai/keKhaiKy.service.ts` (thêm `capNhatQuyetDinh`)
- Modify: `be_maxv/src/controllers/client/to_khai/keKhaiKy.controller.ts` (thêm handler)
- Modify: `be_maxv/src/routes/to_khai/keKhaiKy.route.ts` (thêm route)
- Modify: `hdđt_maxv/src/features/to_khai/api/toKhai.ts` + `api/toKhaiQueries.ts`
- Modify: `hdđt_maxv/src/features/to_khai/templates/{dauVao,dauRa}.ts` (hai cột thành ô chọn)
- Test: `be_maxv/src/__tests__/quyetDinhKeKhai.test.ts`

**Interfaces:**
- Produces: `type ChiTieuTangGiam = "" | "tang" | "giam"`, `function locQuyetDinh(raw: unknown): { keKhai?: boolean; chiTieuTangGiam?: ChiTieuTangGiam; ghiChu?: string }`, `function capNhatQuyetDinh(db, hoaDonId, chieu, quyetDinh): Promise<void>`, `PATCH /api/v1/to-khai/hoa-don/:chieu/:id`

- [ ] **Step 1: Viết test cho bộ lọc payload**

```ts
// be_maxv/src/__tests__/quyetDinhKeKhai.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { locQuyetDinh } from "../services/client/to_khai/keKhaiKy.service";

test("giữ đúng ba field hợp lệ", () => {
  const kq = locQuyetDinh({ keKhai: false, chiTieuTangGiam: "giam", ghiChu: "hóa đơn hủy" });
  assert.deepEqual(kq, { keKhai: false, chiTieuTangGiam: "giam", ghiChu: "hóa đơn hủy" });
});

test("bỏ field lạ và giá trị sai kiểu", () => {
  const kq = locQuyetDinh({ keKhai: "yes", chiTieuTangGiam: "xoay", nam: 2026, ghiChu: 5 });
  assert.deepEqual(kq, {});
});

test("payload rỗng ra object rỗng, không ném", () => {
  assert.deepEqual(locQuyetDinh(null), {});
  assert.deepEqual(locQuyetDinh({}), {});
});

test("chiTieuTangGiam rỗng là giá trị hợp lệ (xóa lựa chọn cũ)", () => {
  assert.deepEqual(locQuyetDinh({ chiTieuTangGiam: "" }), { chiTieuTangGiam: "" });
});

test("ghi chú quá dài bị cắt, không làm hỏng cả lượt lưu", () => {
  assert.equal(locQuyetDinh({ ghiChu: "x".repeat(1000) }).ghiChu?.length, 512);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/quyetDinhKeKhai.test.ts`
Expected: FAIL — `locQuyetDinh` chưa tồn tại.

- [ ] **Step 3: Thêm vào `keKhaiKy.service.ts`**

```ts
/** Ba giá trị hợp lệ của cột "Chỉ tiêu tăng giảm"; rỗng = kế toán chưa chọn / xóa lựa chọn cũ. */
export type ChiTieuTangGiam = "" | "tang" | "giam";

const DAI_TOI_DA_GHI_CHU = 512;

/**
 * Lọc payload PATCH từ FE — cửa DUY NHẤT dữ liệu người dùng đi vào bảng quyết định, nên không tin
 * gì cả. Field vắng mặt nghĩa là "không đổi", khác hẳn field có mặt với giá trị rỗng.
 */
export function locQuyetDinh(raw: unknown): {
  keKhai?: boolean;
  chiTieuTangGiam?: ChiTieuTangGiam;
  ghiChu?: string;
} {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: { keKhai?: boolean; chiTieuTangGiam?: ChiTieuTangGiam; ghiChu?: string } = {};

  if (typeof o.keKhai === "boolean") out.keKhai = o.keKhai;
  if (o.chiTieuTangGiam === "" || o.chiTieuTangGiam === "tang" || o.chiTieuTangGiam === "giam") {
    out.chiTieuTangGiam = o.chiTieuTangGiam;
  }
  if (typeof o.ghiChu === "string") out.ghiChu = o.ghiChu.slice(0, DAI_TOI_DA_GHI_CHU);
  return out;
}

/**
 * Sửa quyết định của MỘT hóa đơn. Chỉ `update` chứ không `upsert`: hóa đơn chưa được gán kỳ thì
 * không có quyết định nào để sửa — tạo dòng ở đây sẽ sinh ra bản ghi thiếu kỳ.
 */
export async function capNhatQuyetDinh(
  db: PrismaClient,
  hoaDonId: string,
  chieu: Chieu,
  quyetDinh: ReturnType<typeof locQuyetDinh>,
): Promise<void> {
  if (Object.keys(quyetDinh).length === 0) return;
  await db.tokhai_ky_hoa_don.update({
    where: { hoa_don_id_chieu: { hoa_don_id: hoaDonId, chieu } },
    data: {
      ...(quyetDinh.keKhai === undefined ? {} : { ke_khai: quyetDinh.keKhai }),
      ...(quyetDinh.chiTieuTangGiam === undefined
        ? {}
        : { chi_tieu_tang_giam: quyetDinh.chiTieuTangGiam || null }),
      ...(quyetDinh.ghiChu === undefined ? {} : { ghi_chu: quyetDinh.ghiChu || null }),
    },
  });
}
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/quyetDinhKeKhai.test.ts`
Expected: PASS cả 5 ca.

- [ ] **Step 5: Thêm endpoint**

Controller:

```ts
export async function suaQuyetDinh(
  request: FastifyRequest<{ Params: { chieu?: string; id?: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(request);
  try {
    const chieu = docChieu(request.params.chieu);
    const id = String(request.params.id ?? "");
    if (!id) throw new Error("Thiếu id hóa đơn.");
    await KeKhai.capNhatQuyetDinh(db, id, chieu, KeKhai.locQuyetDinh(request.body));
    return reply.send({ ok: true });
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: err instanceof Error ? err.message : "Không lưu được thay đổi.",
    });
  }
}
```

Route: `fastify.patch("/hoa-don/:chieu/:id", { preHandler: guard, handler: suaQuyetDinh });`

- [ ] **Step 6: Hai cột thành ô chọn ở FE**

Trong `templates/{dauVao,dauRa}.ts`, đổi hai cột sang dùng `cell` (render component) thay vì `value` thuần — `value` vẫn giữ để file Excel có chữ:

```ts
    {
      key: "keKhai",
      header: "Kê khai/không kê khai",
      width: 20,
      webWidth: 155,
      value: (r) => (r.keKhai ? "Kê khai" : "Không kê khai"),
      cell: (r) => <OKeKhai row={r} />,
    },
```

`OKeKhai` và `OChiTieuTangGiam` đặt ở `features/to_khai/components/OQuyetDinh.tsx`, gọi mutation PATCH rồi `invalidateQueries` theo `toKhaiKeys.byCompany`.

- [ ] **Step 7: Kiểm chứng**

Run: `cd be_maxv && npm run typecheck && npx eslint src/services/client/to_khai src/controllers/client/to_khai src/routes/to_khai`
Run: `cd hdđt_maxv && npx tsc -b && npx eslint src/features/to_khai && npm run build`
Kiểm tay: đổi một dòng sang "Không kê khai", F5 — giá trị phải giữ.

- [ ] **Step 8: Commit**

```bash
git add be_maxv/src/services/client/to_khai be_maxv/src/controllers/client/to_khai be_maxv/src/routes/to_khai be_maxv/src/__tests__/quyetDinhKeKhai.test.ts "hdđt_maxv/src/features/to_khai"
git commit -m "🎉: Cho sửa cột kê khai và chỉ tiêu tăng giảm trên bảng kê"
```

---

### Task 2: `gomHoaDonGtgt.ts` — lọc trạng thái và gộp theo thuế suất

**Files:**
- Create: `be_maxv/src/services/client/to_khai/gomHoaDonGtgt.ts`
- Test: `be_maxv/src/__tests__/gomHoaDonGtgt.test.ts`

**Interfaces:**
- Produces: `HoaDonGom`, `TongBanRa`, `HoaDonTreo`, `KetQuaBanRa`, `KetQuaMuaVao`, `gomBanRa()`, `gomMuaVao()`, `duocTinh()`, `O_THEO_NHAN`

**Khác spec:** đầu vào là hóa đơn **đã gán kỳ và `ke_khai = true`** (Task 1), không phải mọi hóa đơn rơi vào khoảng ngày. Hóa đơn kế toán đã đánh "Không kê khai" bị loại TRƯỚC khi vào hàm này.

- [ ] **Step 1: Viết test thất bại**

```ts
// be_maxv/src/__tests__/gomHoaDonGtgt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { duocTinh, gomBanRa, gomMuaVao } from "../services/client/to_khai/gomHoaDonGtgt";
import type { HoaDonGom } from "../services/client/to_khai/gomHoaDonGtgt";

function hd(
  id: string,
  tthai: string,
  nhom: { tsuat: string; thtien: number; tthue: number }[],
  them: Partial<HoaDonGom> = {},
): HoaDonGom {
  return {
    id,
    tthai,
    dvtte: "VND",
    tgia: 1,
    tgtcthue: nhom.reduce((s, n) => s + n.thtien, 0),
    tgtthue: nhom.reduce((s, n) => s + n.tthue, 0),
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

test("hàng 8% vào [32]/[33] với số thuế THỰC TẾ", () => {
  const kq = gomBanRa([hd("a", "1", [{ tsuat: "8%", thtien: 1_000_000, tthue: 80_000 }])]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.tong.ct33, 80_000);
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

test("hóa đơn điều chỉnh cộng vào tổng nhưng gom riêng để hiển thị", () => {
  const kq = gomBanRa([
    hd("goc", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("dc", "3", [{ tsuat: "10%", thtien: 200_000, tthue: 20_000 }]),
  ]);
  assert.equal(kq.tong.ct32, 1_200_000);
  assert.equal(kq.dieuChinh.soHd, 1);
  assert.equal(kq.dieuChinh.giaTri, 200_000);
});

test("nhãn thuế suất lạ không cộng vào đâu, xếp vào nhóm treo", () => {
  const kq = gomBanRa([hd("la", "1", [{ tsuat: "???", thtien: 500_000, tthue: 0 }])]);
  assert.equal(kq.tong.ct32, 0);
  assert.equal(kq.treo.length, 1);
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
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `gomHoaDonGtgt.ts`**

```ts
/**
 * Lọc hóa đơn theo trạng thái rồi gộp tiền theo từng mức thuế suất, ra đúng các ô mẫu 01/GTGT.
 *
 * Hàm THUẦN: nhận mảng dòng đã đọc sẵn, không đụng DB. Đầu vào là hóa đơn ĐÃ GÁN KỲ và kế toán
 * để `ke_khai = true` — việc loại hóa đơn "không kê khai" làm ở tầng service, không ở đây.
 *
 * Số tách theo thuế suất chỉ có trong `detail.thttltsuat`; hóa đơn chưa tải chi tiết KHÔNG đoán
 * được là 8% hay 10% nên xếp vào `treo` thay vì cộng nhầm.
 */

export interface HoaDonGom {
  id: string;
  tthai: string | null;
  dvtte: string | null;
  tgia: unknown;
  tgtcthue: unknown;
  tgtthue: unknown;
  detail: unknown;
}

export interface TongBanRa {
  ct26: number; ct29: number; ct30: number; ct31: number;
  ct32: number; ct32a: number; ct33: number;
}

export interface HoaDonTreo {
  id: string;
  lyDo: string;
}

export interface KetQuaBanRa {
  tong: TongBanRa;
  treo: HoaDonTreo[];
  /** Nhóm `tthai=3` — ĐÃ cộng vào `tong`, tách ra chỉ để hiển thị và soát dấu. */
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  soHd: number;
}

export interface KetQuaMuaVao {
  ct23: number;
  ct24: number;
  treo: HoaDonTreo[];
  soHd: number;
}

/** 4 = đã bị thay thế, 6 = đã bị hủy — hai trạng thái duy nhất bị loại khỏi tờ khai. */
const TTHAI_LOAI = new Set(["4", "6"]);

export function duocTinh(tthai: string | null): boolean {
  return !TTHAI_LOAI.has(String(tthai ?? "").trim());
}

function so(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** "10", "10%", " KCT " -> "10%" / "KCT" — một dạng duy nhất để tra bảng ánh xạ. */
function chuanHoaNhan(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  const phanTram = Number(s.replace("%", ""));
  return Number.isFinite(phanTram) ? `${phanTram}%` : s;
}

/**
 * Nhãn thuế suất -> ô nhận giá trị và ô nhận tiền thuế. Sửa mức thuế suất mới CHỈ ở bảng này.
 * Export vì `toKhaiGtgt01.service.ts` suy ánh xạ NGƯỢC (chỉ tiêu -> nhãn) từ chính bảng này.
 */
export const O_THEO_NHAN: Record<string, { giaTri: keyof TongBanRa; thue?: keyof TongBanRa }> = {
  KCT: { giaTri: "ct26" },
  "0%": { giaTri: "ct29" },
  "5%": { giaTri: "ct30", thue: "ct31" },
  // 8% (giảm theo nghị quyết) kê chung dòng 10%; [33] lấy số thuế THỰC TẾ.
  "8%": { giaTri: "ct32", thue: "ct33" },
  "10%": { giaTri: "ct32", thue: "ct33" },
  KKKNT: { giaTri: "ct32a" },
};

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

/** Hệ số quy đổi về VND; `null` = ngoại tệ thiếu tỷ giá -> không đoán, cho treo. */
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

    if (coNhanLa) treo.push({ id: hd.id, lyDo: "Có mức thuế suất chưa nhận diện được" });
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
 * Mua vào chỉ cần tổng [23]/[24], không tách thuế suất nên KHÔNG cần `detail` — hóa đơn chưa tải
 * chi tiết vẫn cộng được (khác `gomBanRa`).
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

### Task 3: `tinhGtgt01.ts` — công thức chỉ tiêu

**Files:**
- Create: `be_maxv/src/services/client/to_khai/tinhGtgt01.ts`
- Test: `be_maxv/src/__tests__/tinhGtgt01.test.ts`

**Interfaces:**
- Consumes: `TongBanRa` (Task 2)
- Produces: `CtNhapTay`, `CT_NHAP_TAY`, `DauVaoGtgt01`, `CtGtgt01`, `tinhGtgt01()`

- [ ] **Step 1: Viết test thất bại**

```ts
// be_maxv/src/__tests__/tinhGtgt01.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { tinhGtgt01 } from "../services/client/to_khai/tinhGtgt01";
import type { TongBanRa } from "../services/client/to_khai/gomHoaDonGtgt";

const RONG: TongBanRa = { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0 };

test("[27] và [28] cộng đúng các dòng con", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct29: 1_000, ct30: 2_000, ct31: 100, ct32: 3_000, ct33: 300, ct32a: 4_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct27, 10_000);
  assert.equal(ct.ct28, 400);
});

test("[34] = [26] + [27] và [35] = [28]", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct26: 5_000, ct32: 3_000, ct33: 300 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct34, 8_000);
  assert.equal(ct.ct35, 300);
});

test("[25] mặc định bằng [24], nhập tay thì thắng", () => {
  assert.equal(tinhGtgt01({ banRa: RONG, muaVao: { ct23: 0, ct24: 1_000 }, nhapTay: {} }).ct25, 1_000);
  const ct = tinhGtgt01({ banRa: RONG, muaVao: { ct23: 0, ct24: 1_000 }, nhapTay: { ct25: 600 } });
  assert.equal(ct.ct25, 600);
  assert.equal(ct.ct36, -600);
});

test("phát sinh dương: [40a] mang số, [41] bằng 0", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 2_000_000, ct24: 200_000 },
    nhapTay: { ct22: 100_000 },
  });
  assert.equal(ct.ct36, 800_000);
  assert.equal(ct.ct40a, 700_000);
  assert.equal(ct.ct41, 0);
  assert.equal(ct.ct40, 700_000);
});

test("không phát sinh đầu ra: [41] = [22] + [25]", () => {
  // Dạng đã đối chiếu trên 5 hồ sơ thật của MST 0106200129 (spec mục 7.6).
  const ct = tinhGtgt01({
    banRa: RONG,
    muaVao: { ct23: 40_000_000, ct24: 4_407_359 },
    nhapTay: { ct22: 25_418_834 },
  });
  assert.equal(ct.ct41, 29_826_193);
  assert.equal(ct.ct40a, 0);
  assert.equal(ct.ct43, 29_826_193);
});

test("[40a] và [41] loại trừ nhau — không bao giờ cùng khác 0", () => {
  for (const ct24 of [0, 500, 1_000, 5_000]) {
    const ct = tinhGtgt01({
      banRa: { ...RONG, ct32: 10_000, ct33: 1_000 },
      muaVao: { ct23: 0, ct24 },
      nhapTay: {},
    });
    assert.ok(ct.ct40a === 0 || ct.ct41 === 0, `ct24=${ct24}`);
  }
});

test("điều chỉnh tăng giảm và bàn giao vào đúng công thức", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct37: 50_000, ct38: 30_000, ct39a: 20_000 },
  });
  assert.equal(ct.ct40a, 1_000_000);
});

test("[43] = [41] - [42] và [40] = [40a] - [40b]", () => {
  const a = tinhGtgt01({ banRa: RONG, muaVao: { ct23: 0, ct24: 1_000_000 }, nhapTay: { ct42: 400_000 } });
  assert.equal(a.ct43, 600_000);
  const b = tinhGtgt01({
    banRa: { ...RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct40b: 300_000 },
  });
  assert.equal(b.ct40, 700_000);
});

test("ô nhập tay không tính được vẫn có mặt trong kết quả", () => {
  const ct = tinhGtgt01({ banRa: RONG, muaVao: { ct23: 0, ct24: 0 }, nhapTay: { ct23a: 111, ct24a: 222 } });
  assert.equal(ct.ct23a, 111);
  assert.equal(ct.ct24a, 222);
});
```

- [ ] **Step 2: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/tinhGtgt01.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `tinhGtgt01.ts`**

```ts
/**
 * Công thức mẫu 01/GTGT (TT80/2021) — hàm THUẦN, không DB, không HTTP. Mọi con số đem đi nộp thuế
 * đều đi qua đây. Công thức lấy đúng nhãn in trên mẫu, xem `ToKhaiGtgt01Form.tsx` bên hdđt_maxv.
 */

import type { TongBanRa } from "./gomHoaDonGtgt";

export type CtNhapTay =
  | "ct22" | "ct23a" | "ct24a" | "ct25" | "ct37" | "ct38" | "ct39a" | "ct40b" | "ct42";

export const CT_NHAP_TAY: readonly CtNhapTay[] = [
  "ct22", "ct23a", "ct24a", "ct25", "ct37", "ct38", "ct39a", "ct40b", "ct42",
];

export interface DauVaoGtgt01 {
  banRa: TongBanRa;
  muaVao: { ct23: number; ct24: number };
  /** Ô đã nhập tay/ghi đè. `ct25` vắng mặt -> mặc định bằng [24]. */
  nhapTay: Partial<Record<CtNhapTay, number>>;
}

export type CtGtgt01 = Record<string, number>;

export function tinhGtgt01(dv: DauVaoGtgt01): CtGtgt01 {
  const tay = (k: CtNhapTay): number => Number(dv.nhapTay[k] ?? 0);

  const ct22 = tay("ct22");
  const ct23 = dv.muaVao.ct23;
  const ct24 = dv.muaVao.ct24;
  // Máy không biết hóa đơn nào không đủ điều kiện khấu trừ hay phải phân bổ -> mặc định khấu trừ
  // hết, kế toán sửa thì `nhapTay.ct25` thắng.
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

  // [40a] và [41] loại trừ nhau: cùng một hiệu số, dương thì phải nộp, âm thì còn được khấu trừ.
  const hieu = ct36 - ct22 + ct37 - ct38 - ct39a;
  const ct40a = hieu >= 0 ? hieu : 0;
  const ct41 = hieu < 0 ? -hieu : 0;

  return {
    ct22, ct23, ct23a: tay("ct23a"), ct24, ct24a: tay("ct24a"), ct25,
    ct26, ct27, ct28, ct29, ct30, ct31, ct32, ct32a, ct33, ct34, ct35, ct36,
    ct37, ct38, ct39a,
    ct40: ct40a - ct40b, ct40a, ct40b,
    ct41, ct42, ct43: ct41 - ct42,
  };
}
```

- [ ] **Step 4: Chạy lại test — phải xanh**

Run: `cd be_maxv && npx tsx --test src/__tests__/tinhGtgt01.test.ts`
Expected: PASS cả 9 ca. Ca "không phát sinh đầu ra" phải ra đúng 29.826.193 — con số hồ sơ thật.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/services/client/to_khai/tinhGtgt01.ts be_maxv/src/__tests__/tinhGtgt01.test.ts
git commit -m "🎉: Thêm công thức tính chỉ tiêu tờ khai 01/GTGT"
```

---

### Task 4: Bảng `tokhai_gtgt01` + service lập/lưu/chốt

**Files:**
- Modify: `be_maxv/prisma/tenant/schema.prisma`
- Create: `be_maxv/src/services/client/to_khai/toKhaiGtgt01.service.ts`
- Test: `be_maxv/src/__tests__/toKhaiGtgt01Ghide.test.ts`

**Interfaces:**
- Consumes: `khoangCuaKy`/`Ky` (A3), `gomBanRa`/`gomMuaVao` (Task 2), `tinhGtgt01` (Task 3)
- Produces: `GhiDeItem`, `BanToKhai`, `tinhVaLuu()`, `docBan()`, `luuGhiDe()`, `doiTrangThai()`, `layCt22KyTruoc()`, `locGhiDeHopLe()`, `KyChuaKeKhaiError`, `BanDaChotError`, `ChuaCoBanError`

**Khác spec mục 6:** thêm cột `so_hd_khong_ke_khai` (số hóa đơn kế toán đã đánh "Không kê khai") — có nó thì nhìn bản tờ khai là biết ngay kế toán đã loại bao nhiêu tờ, khỏi phải mở lại bảng kê.

- [ ] **Step 1: Thêm model vào `prisma/tenant/schema.prisma`**

```prisma
/// Một bản tờ khai 01/GTGT do phần mềm lập cho MỘT kỳ tính thuế.
/// `nhap` = mở lại là tính lại từ bảng kê; `chot` = đóng băng số đã nộp.
model tokhai_gtgt01 {
  nam     Int
  ky_loai String @db.VarChar(8) // thang | quy
  ky_so   Int

  trang_thai String @default("nhap") @db.VarChar(16) // nhap | chot

  /// Bộ chỉ tiêu CUỐI — số đem đi nộp: { ct22, ct23, ..., ct43 }.
  ct Json
  /// Số máy tự tính, giữ nguyên kể cả sau khi kế toán ghi đè — để đối chiếu.
  ct_may Json
  /// Ô kế toán sửa tay + lý do: { ct25: { gia: 1234, lyDo: "..." } }. Lượt tính lại KHÔNG xóa.
  ghi_de Json

  /// Bản sao ba khóa cùng tên trong `ct`, bóc ra cột để truy vấn.
  ct22 Decimal @default(0) @db.Decimal(18, 2)
  ct40 Decimal @default(0) @db.Decimal(18, 2)
  ct43 Decimal @default(0) @db.Decimal(18, 2)

  nguon_ct22 String @default("nhap_tay") @db.VarChar(16) // ky_truoc | nhap_tay

  so_hd_ban            Int @default(0)
  so_hd_mua            Int @default(0)
  /// Số hóa đơn kế toán đã đánh "Không kê khai" — nhìn bản tờ khai là biết đã loại bao nhiêu tờ.
  so_hd_khong_ke_khai  Int @default(0)
  /// Hóa đơn thiếu `detail` nên chưa tách được thuế suất; bản đáng tin phải là 0.
  hd_thieu_detail      Int @default(0)

  tinh_luc DateTime?

  datetime0 DateTime @default(now())
  datetime2 DateTime @updatedAt

  @@id([nam, ky_loai, ky_so])
}
```

- [ ] **Step 2: Sinh lại client và kiểm biên dịch**

Run: `cd be_maxv && npx prisma validate --schema=prisma/tenant/schema.prisma && npm run generate && npm run typecheck`
Expected: sạch. Khóa ghép Prisma sinh ra tên `nam_ky_loai_ky_so` (đã xác nhận ở lần push trước).

- [ ] **Step 3: Viết test cho bộ lọc ghi đè**

```ts
// be_maxv/src/__tests__/toKhaiGtgt01Ghide.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { locGhiDeHopLe } from "../services/client/to_khai/toKhaiGtgt01.service";

test("giữ đúng các ô hợp lệ", () => {
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

test("ô máy tự tính vẫn ghi đè được", () => {
  assert.equal(locGhiDeHopLe({ ct26: { gia: 123 } }).ct26.gia, 123);
});

test("lyDo quá dài bị cắt", () => {
  assert.equal(locGhiDeHopLe({ ct22: { gia: 1, lyDo: "x".repeat(1000) } }).ct22.lyDo?.length, 500);
});
```

- [ ] **Step 4: Chạy test để thấy nó đỏ**

Run: `cd be_maxv && npx tsx --test src/__tests__/toKhaiGtgt01Ghide.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 5: Viết `toKhaiGtgt01.service.ts`**

Điểm khác biệt lớn nhất so với bản spec: **nguồn hóa đơn là bảng kê của kỳ**, không phải khoảng ngày.

```ts
/**
 * Vòng đời một bản tờ khai 01/GTGT: tính từ BẢNG KÊ CỦA KỲ -> lưu nháp -> kế toán sửa tay -> chốt.
 *
 * Nguồn số liệu là hóa đơn ĐÃ GÁN KỲ và kế toán để `ke_khai = true` — không phải mọi hóa đơn rơi
 * vào khoảng ngày. Kỳ chưa bấm "Kê khai" thì không có gì để tính, và đó là lỗi người dùng thấy
 * được chứ không phải bản tờ khai rỗng khó hiểu.
 */

import type { PrismaClient, Prisma } from "../../../generated/tenant";
import { khoangCuaKy, kyLienTruoc, type Ky } from "./kySoThue";
import { gomBanRa, gomMuaVao, type HoaDonGom, type HoaDonTreo } from "./gomHoaDonGtgt";
import { tinhGtgt01, type CtGtgt01 } from "./tinhGtgt01";

export interface GhiDeItem { gia: number; lyDo?: string }

export interface BanToKhai {
  ky: Ky;
  trangThai: "nhap" | "chot";
  ct: CtGtgt01;
  ctMay: CtGtgt01;
  ghiDe: Record<string, GhiDeItem>;
  nguonCt22: "ky_truoc" | "nhap_tay";
  soHdBan: number;
  soHdMua: number;
  soHdKhongKeKhai: number;
  hdThieuDetail: number;
  treo: HoaDonTreo[];
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  tinhLuc: string | null;
}

const CT_HOP_LE = new Set([
  "ct22", "ct23", "ct23a", "ct24", "ct24a", "ct25", "ct26", "ct27", "ct28", "ct29",
  "ct30", "ct31", "ct32", "ct32a", "ct33", "ct34", "ct35", "ct36", "ct37", "ct38",
  "ct39a", "ct40", "ct40a", "ct40b", "ct41", "ct42", "ct43",
]);

const DAI_TOI_DA_LY_DO = 500;

/**
 * Cửa DUY NHẤT dữ liệu người dùng đi vào bộ chỉ tiêu — không tin gì cả, kể cả khóa
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

const SELECT_HD = {
  id: true, tthai: true, dvtte: true, tgia: true,
  tgtcthue: true, tgtthue: true, detail: true,
} satisfies Prisma.vct50viewSelect;

/**
 * Hóa đơn của kỳ, tách sẵn hai nhóm: nhóm đưa vào tính (`ke_khai = true`) và số tờ bị loại.
 * Đọc `tokhai_ky_hoa_don` trước để biết id nào thuộc kỳ, rồi lấy dòng hóa đơn theo id đó.
 */
async function docHoaDonCuaKy(
  db: PrismaClient,
  ky: Ky,
  chieu: "purchase" | "sold",
): Promise<{ rows: HoaDonGom[]; soLoai: number; soThieuDetail: number }> {
  const daGan = await db.tokhai_ky_hoa_don.findMany({
    where: { chieu, nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo },
    select: { hoa_don_id: true, ke_khai: true },
  });
  const idKeKhai = daGan.filter((d) => d.ke_khai).map((d) => d.hoa_don_id);
  const soLoai = daGan.length - idKeKhai.length;
  if (idKeKhai.length === 0) return { rows: [], soLoai, soThieuDetail: 0 };

  const where = { id: { in: idKeKhai } };
  const rows = (
    chieu === "purchase"
      ? await db.vct60view.findMany({ where, select: SELECT_HD })
      : await db.vct50view.findMany({ where, select: SELECT_HD })
  ) as unknown as HoaDonGom[];

  // Đếm thẳng ở đây thay vì soi chuỗi lý do trong `treo`: chuỗi đó là câu hiển thị cho người đọc,
  // đổi chữ một cái là con số này sai âm thầm. Chỉ bán ra mới cần `detail` (để tách thuế suất).
  const soThieuDetail = chieu === "sold" ? rows.filter((r) => r.detail == null).length : 0;
  return { rows, soLoai, soThieuDetail };
}

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

export async function tinhVaLuu(db: PrismaClient, ky: Ky): Promise<BanToKhai> {
  const hienCo = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
  });
  if (hienCo?.trang_thai === "chot") throw new BanDaChotError();
  const ghiDe = locGhiDeHopLe(hienCo?.ghi_de);

  const [ban, mua] = await Promise.all([
    docHoaDonCuaKy(db, ky, "sold"),
    docHoaDonCuaKy(db, ky, "purchase"),
  ]);
  if (ban.rows.length === 0 && mua.rows.length === 0) throw new KyChuaKeKhaiError();

  const banRa = gomBanRa(ban.rows);
  const muaVao = gomMuaVao(mua.rows);

  const ct22KyTruoc = ghiDe.ct22 ? null : await layCt22KyTruoc(db, ky);
  const nhapTay: Record<string, number> = {};
  for (const [khoa, item] of Object.entries(ghiDe)) nhapTay[khoa] = item.gia;
  if (ct22KyTruoc !== null) nhapTay.ct22 = ct22KyTruoc;

  const ctMay = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay: {} });
  const ct = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay });
  // Ô ghi đè không nằm trong công thức (vd [26] kế toán tự sửa) vẫn phải hiện đúng số đã sửa.
  for (const [khoa, item] of Object.entries(ghiDe)) ct[khoa] = item.gia;

  const nguonCt22: "ky_truoc" | "nhap_tay" = ct22KyTruoc !== null ? "ky_truoc" : "nhap_tay";
  const hdThieuDetail = ban.soThieuDetail;
  const duLieu = {
    trang_thai: "nhap",
    ct: ct as Prisma.InputJsonValue,
    ct_may: ctMay as Prisma.InputJsonValue,
    ghi_de: ghiDe as Prisma.InputJsonValue,
    ct22: ct.ct22, ct40: ct.ct40, ct43: ct.ct43,
    nguon_ct22: nguonCt22,
    so_hd_ban: banRa.soHd,
    so_hd_mua: muaVao.soHd,
    so_hd_khong_ke_khai: ban.soLoai + mua.soLoai,
    hd_thieu_detail: hdThieuDetail,
    tinh_luc: new Date(),
  };

  const luu = await db.tokhai_gtgt01.upsert({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    create: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo, ...duLieu },
    update: duLieu,
  });

  return {
    ky, trangThai: "nhap", ct, ctMay, ghiDe, nguonCt22,
    soHdBan: banRa.soHd, soHdMua: muaVao.soHd,
    soHdKhongKeKhai: ban.soLoai + mua.soLoai,
    hdThieuDetail,
    treo: [...banRa.treo, ...muaVao.treo],
    dieuChinh: banRa.dieuChinh,
    tinhLuc: luu.tinh_luc?.toISOString() ?? null,
  };
}

export class KyChuaKeKhaiError extends Error {
  constructor() {
    super('Kỳ này chưa có hóa đơn nào được kê khai. Sang màn Hóa đơn điện tử bấm "Kê khai" cho kỳ này trước.');
  }
}
export class BanDaChotError extends Error {
  constructor() { super("Tờ khai kỳ này đã chốt. Mở khóa trước khi sửa."); }
}
export class ChuaCoBanError extends Error {
  constructor() { super('Kỳ này chưa có bản tờ khai nào. Bấm "Lập tờ khai" trước.'); }
}
```

`docBan` / `luuGhiDe` / `doiTrangThai` / `danhSachKy` viết theo đúng khuôn cũ (đọc dòng, map field, update `trang_thai`), không có gì khác biệt đáng ghi.

`kyLienTruoc` chưa có trong `kySoThue.ts` hiện tại — thêm vào:

```ts
export function kyLienTruoc(ky: Ky): Ky {
  if (ky.kySo > 1) return { ...ky, kySo: ky.kySo - 1 };
  return { nam: ky.nam - 1, kyLoai: ky.kyLoai, kySo: ky.kyLoai === "thang" ? 12 : 4 };
}
```

kèm test: kỳ liền trước của T1/2026 là T12/2025, của Q1/2026 là Q4/2025.

- [ ] **Step 6: Chạy test + typecheck**

Run: `cd be_maxv && npx tsx --test src/__tests__/toKhaiGtgt01Ghide.test.ts src/__tests__/kySoThue.test.ts && npm run typecheck`
Expected: sạch.

- [ ] **Step 7: Đẩy schema lên tenant**

Run: `cd be_maxv && npm run sync:tenants`
Expected: tất cả tenant `✓`. Bảng mới hoàn toàn nên không có gì để mất.

- [ ] **Step 8: Commit**

```bash
git add be_maxv/prisma/tenant/schema.prisma be_maxv/src/services/client/to_khai be_maxv/src/__tests__/toKhaiGtgt01Ghide.test.ts
git commit -m "🎉: Thêm bảng và service lập tờ khai 01/GTGT từ bảng kê"
```

---

### Task 5: Endpoint tờ khai

**Files:**
- Modify: `be_maxv/src/controllers/client/to_khai/` (thêm `toKhaiGtgt01.controller.ts`)
- Modify: `be_maxv/src/routes/to_khai/keKhaiKy.route.ts` (hoặc tách `toKhaiGtgt01.route.ts` rồi register cùng prefix)

**Interfaces:**
- Produces:

| Method | Path | Việc |
|---|---|---|
| POST | `/api/v1/to-khai/gtgt01/tinh` | Body `{nam, kyLoai, kySo}` → tính từ bảng kê, ghi nháp |
| GET | `/api/v1/to-khai/gtgt01/danh-sach` | Các kỳ đã lập: kỳ, trạng thái, [40], [43] |
| GET | `/api/v1/to-khai/gtgt01/:nam/:kyLoai/:kySo` | Đọc bản đã lưu |
| PUT | `/api/v1/to-khai/gtgt01/:nam/:kyLoai/:kySo` | Lưu ô sửa tay + tính lại |
| POST | `/api/v1/to-khai/gtgt01/:…/chot` · `/mo-khoa` | Đóng băng / mở lại |

- [ ] **Step 1: Tách `docKy`/`docChieu` ra file dùng chung**

Hai hàm này đang là private trong `keKhaiKy.controller.ts`. Chuyển sang `controllers/client/to_khai/docThamSo.ts` và export, rồi cả hai controller cùng import — chép sang file thứ hai là có hai bản kiểm biên rồi một bản được vá còn bản kia không.

- [ ] **Step 2: Viết `toKhaiGtgt01.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveTenantDb } from "../../../helpers/resolveTenantDb";
import * as ToKhai from "../../../services/client/to_khai/toKhaiGtgt01.service";
import { docKy, type KyInput } from "./docThamSo";

/** Lỗi nghiệp vụ đã biết -> mã HTTP tương ứng; còn lại 400 kèm câu tiếng Việt. */
function traLoi(reply: FastifyReply, err: unknown, macDinh: string) {
  if (err instanceof ToKhai.KyChuaKeKhaiError) {
    return reply.status(409).send({ message: err.message, code: "chua_ke_khai" });
  }
  if (err instanceof ToKhai.BanDaChotError) {
    return reply.status(409).send({ message: err.message, code: "da_chot" });
  }
  if (err instanceof ToKhai.ChuaCoBanError) {
    return reply.status(404).send({ message: err.message, code: "chua_co_ban" });
  }
  return reply.status(400).send({ message: err instanceof Error ? err.message : macDinh });
}

export async function tinh(request: FastifyRequest<{ Body: KyInput }>, reply: FastifyReply) {
  const db = await resolveTenantDb(request);
  try {
    return reply.send(await ToKhai.tinhVaLuu(db, docKy(request.body ?? {})));
  } catch (err) {
    request.log.error(err);
    return traLoi(reply, err, "Không lập được tờ khai.");
  }
}

export async function doc(request: FastifyRequest<{ Params: KyInput }>, reply: FastifyReply) {
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
  request: FastifyRequest<{ Params: KyInput; Body: { ghiDe?: unknown } }>,
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
  return async function (request: FastifyRequest<{ Params: KyInput }>, reply: FastifyReply) {
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

- [ ] **Step 3: Đăng ký route** — `/gtgt01/danh-sach` phải khai TRƯỚC `/gtgt01/:nam/:kyLoai/:kySo`, không thì `danh-sach` bị nuốt thành `:nam`.

- [ ] **Step 4: Kiểm chứng**

Run: `cd be_maxv && npm run typecheck && npx eslint src/controllers/client/to_khai src/routes/to_khai && npx tsx --test src/__tests__/*.test.ts`
Expected: sạch; test xanh trừ 5 ca `adminOwner` đỏ sẵn.

- [ ] **Step 5: Commit**

```bash
git add be_maxv/src/controllers/client/to_khai be_maxv/src/routes/to_khai
git commit -m "🎉: Thêm API lập tờ khai 01/GTGT"
```

---

### Task 6: Frontend — tách layout mẫu in 01/GTGT dùng chung

Refactor thuần: màn Dịch vụ công phải giữ nguyên hành vi.

**Files:**
- Create: `hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.tsx`
- Modify: `hdđt_maxv/src/features/dich_vu_cong/components/ToKhaiGtgt01Form.tsx`
- Modify: `hdđt_maxv/src/features/dich_vu_cong/components/mauInFormat.ts`

- [ ] **Step 1: Chuyển `interface HangChiTieu` + mảng `HANG` (30 dòng chỉ tiêu, dòng 20-152 của `ToKhaiGtgt01Form.tsx`) sang file mới**, đổi tên mảng thành `HANG_GTGT01`, nới kiểu `giaTri`/`thue` từ `CtTagGtgt01` thành `string` để màn tờ khai dùng chung được. Chuyển luôn `maChiTieu` từ `mauInFormat.ts` sang, rồi cho `mauInFormat.ts` re-export để không phải sửa mọi nơi đang import.

- [ ] **Step 2: Cho `ToKhaiGtgt01Form.tsx` import mảng chung**, xóa bản cũ trong file.

- [ ] **Step 3: Kiểm chứng**

Run: `cd hdđt_maxv && npx tsc -b && npx eslint src/features/_shared src/features/dich_vu_cong`
Kiểm tay: mở một hồ sơ 01/GTGT bên Dịch vụ công — bảng phải hiện y như trước refactor, đủ 30 dòng, đúng số ngoặc `[NN]`, đúng thụt lề.

- [ ] **Step 4: Commit**

```bash
git add "hdđt_maxv/src/features/_shared" "hdđt_maxv/src/features/dich_vu_cong"
git commit -m "🔨: Tách layout mẫu in 01/GTGT ra dùng chung cho hai màn"
```

---

### Task 7: Frontend — tab "Tờ khai 01/GTGT"

Màn `/to-khai` hiện có hai tab bảng kê. Thêm tab thứ ba cho tờ khai, dùng chung kỳ đang chọn trên query string.

**Files:**
- Create: `hdđt_maxv/src/features/to_khai/api/gtgt01.ts` + `gtgt01Queries.ts`
- Create: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`
- Modify: `hdđt_maxv/src/features/to_khai/components/ToKhaiInvoiceTabs.tsx`

- [ ] **Step 1: Lớp gọi API + hook** — theo đúng khuôn `api/toKhai.ts` và `api/toKhaiQueries.ts` đã có: khóa query gắn `currentCompanyId`, mutation `invalidateQueries` theo `toKhaiKeys.byCompany`.

- [ ] **Step 2: Editor** — dựng bảng từ `HANG_GTGT01` (Task 6), đặt trong khổ giấy hẹp căn giữa (xem Step 3). Ba kiểu ô phân biệt bằng thị giác: máy tính (nền xám, sửa được), người nhập (viền nổi: [22] [23a] [24a] [37] [38] [39a] [40b] [42]), đã sửa tay (gạch cam, hover hiện "Máy tính: …").

Ba cảnh báo phải có trên đầu editor:

```tsx
{ban.soHdKhongKeKhai > 0 && (
  <Alert severity="info">
    {ban.soHdKhongKeKhai} hóa đơn trong kỳ được đánh "Không kê khai" nên không tính vào tờ khai.
  </Alert>
)}
{ban.dieuChinh.soHd > 0 && (
  <Alert severity="warning">
    Kỳ này có {ban.dieuChinh.soHd} hóa đơn điều chỉnh, tổng {fmt.format(ban.dieuChinh.giaTri)} —
    kiểm tra dấu trước khi chốt.
  </Alert>
)}
{ban.hdThieuDetail > 0 && (
  <Alert severity="error">
    {ban.hdThieuDetail} hóa đơn chưa tải chi tiết nên chưa tách được thuế suất — số [29]/[30]/[32]
    đang thiếu. Sang màn Hóa đơn điện tử bấm "Cập nhật từ Thuế điện tử" cho kỳ này.
  </Alert>
)}
```

- [ ] **Step 3: Thêm tab + bố cục riêng cho tab tờ khai**

Bảng kê và mẫu in có nhu cầu bố cục **ngược nhau**: bảng cần tràn ngang (26 cột, cuộn ngang), mẫu in cần khổ hẹp căn giữa. Để mẫu in tràn theo khung bảng, lại nằm dưới cả `ChonKyPanel` dạng `Paper` viền, thì nó trông như bị kẹp. Ba điều chỉnh:

1. **`ChonKyPanel` chỉ hiện đầy đủ ở hai tab bảng kê.** Sang tab tờ khai thu thành một dòng chữ.
2. **Mẫu in bọc trong khổ giấy hẹp căn giữa** — `max-width: 820px`, nền `surface`, không tràn theo khung bảng.
3. **Thanh hành động nằm cùng dòng với kỳ**, không thành hàng nút rời phía dưới.

```tsx
// ToKhaiInvoiceTabs.tsx
const [tab, setTab] = useState<InvoiceDirection | "to-khai">("purchase");
const laToKhai = tab === "to-khai";

// Panel đầy đủ chỉ cho hai tab bảng kê; tab tờ khai dùng dòng gọn bên trong editor.
{!laToKhai && <ChonKyPanel ky={ky} onChange={doiKy} />}

<Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
  <Tab value="purchase" label="Hóa đơn mua vào" sx={{ textTransform: "none" }} />
  <Tab value="sold" label="Hóa đơn bán ra" sx={{ textTransform: "none" }} />
  <Tab value="to-khai" label="Tờ khai 01/GTGT" sx={{ textTransform: "none" }} />
</Tabs>
```

```tsx
// ToKhaiGtgt01Editor.tsx — dòng kỳ gọn + thanh hành động, rồi khổ giấy
<Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
  <Typography variant="body2" color="text.secondary">Kỳ {nhanKy(ky)}</Typography>
  <Button size="small" onClick={onDoiKy} sx={{ textTransform: "none" }}>Đổi kỳ</Button>
  <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
    {/* Tính lại · Lưu nháp · Chốt · Xuất Excel */}
  </Stack>
</Stack>

<Box sx={{ maxWidth: 820, mx: "auto" }}>
  <Paper variant="outlined" sx={{ p: 3 }}>
    {/* mẫu in 01/GTGT dựng từ HANG_GTGT01 */}
  </Paper>
</Box>
```

"Đổi kỳ" mở lại `ChonKyPanel` dạng popover hoặc chuyển về tab bảng kê — cách nào cũng được, miễn không dựng khối chọn kỳ cố định trên đầu mẫu in.

- [ ] **Step 4: Kiểm chứng**

Run: `cd hdđt_maxv && npx tsc -b && npx eslint src/features/to_khai && npm run build`
Kiểm tay: kê khai một kỳ → sang tab Tờ khai → "Lập tờ khai" → số hiện đủ. Sửa [25], "Lưu nháp", rồi "Tính lại" — ô vừa sửa **không bị xóa**. "Chốt" khóa mọi ô.

- [ ] **Step 5: Commit**

```bash
git add "hdđt_maxv/src/features/to_khai"
git commit -m "🎉: Thêm tab lập tờ khai 01/GTGT trên màn Tờ khai"
```

---

### Task 8: Xuất Excel + đối chiếu số thật

**Files:**
- Create: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`
- Modify: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`

- [ ] **Step 1: Bộ dựng workbook** — dùng lại `HEADER_FILL` / `HEADER_HEIGHT` / `CELL_BORDER` đã export sẵn ở `features/hddt/exportXlsx.ts:20-39`. `HEADER_FILL` là **chuỗi ARGB**, phải bọc: `cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }`.

Cột: STT · Chỉ tiêu (thụt lề theo cấp) · Giá trị · Thuế · Ghi chú (ô nào kế toán sửa tay). Tên file `ToKhai01GTGT_{T7-2026}.xlsx`.

- [ ] **Step 2: Thêm nút "Xuất Excel"** vào thanh hành động của editor.

- [ ] **Step 3: Kiểm chứng**

Run: `cd hdđt_maxv && npx tsc -b && npx eslint src/features/to_khai && npm run build`
Kiểm tay: mở file — đủ 30 dòng chỉ tiêu, số canh phải theo `#,##0`, ô đã sửa tay có ghi chú.

- [ ] **Step 4: Đối chiếu với tờ khai thật — phép thử quan trọng nhất**

Chọn một kỳ mà công ty **đã nộp tờ khai 01/GTGT thật** và hồ sơ đó đã đồng bộ trong module Dịch vụ công. Kê khai kỳ đó, lập tờ khai, rồi mở màn Dịch vụ công xem tờ khai đã nộp của đúng kỳ và so từng chỉ tiêu.

Ghi kết quả vào mục 11 của spec:
- [23]/[24] lệch hay khớp → trả lời dứt điểm câu hỏi 11.2 (có gồm hóa đơn mua vào không chịu thuế không).
- Kỳ có hóa đơn điều chỉnh → xác nhận dấu, trả lời câu hỏi 11.1.

Lệch thì **dừng lại và báo**, đừng sửa engine cho khớp bằng mọi giá: có thể chính tờ khai đã nộp mới là bản kế toán điều chỉnh tay.

- [ ] **Step 5: Commit**

```bash
git add "hdđt_maxv/src/features/to_khai"
git commit -m "🎉: Thêm xuất Excel cho tờ khai 01/GTGT"
```

---

## Sau khi xong

Còn lại, không thuộc kế hoạch này: sinh XML nộp qua eTax (có sẵn hàng chục XML thật trong `dvc_ho_so` để đối chiếu ngược), hóa đơn mua vào lập kỳ trước nhưng kê ở kỳ này, nhiều bản cho một kỳ (chính thức + khai bổ sung), và các mẫu tờ khai khác (05/KK-TNCN lấy từ bảng lương HRM, 03/TNDN lấy từ sổ kế toán).

Trước khi giao cho người dùng thật: chạy `npm run sync:tenants` sau Task 4, và bật module `tokhai` trong gói đăng ký của các công ty được dùng.
