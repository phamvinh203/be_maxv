# Ghép API Thuế điện tử (ETAX) vào đồng bộ DVC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một lượt "Đồng bộ" ở trang Dịch vụ công lấy được cả hồ sơ nộp trước 01/07/2025 (nguồn ETAX) lẫn từ 01/07/2025 (nguồn DVC), gộp vào cùng một bảng.

**Architecture:** Thêm khái niệm `NguonHoSo = "dvc" | "tdt"` xuyên suốt. Ba lượt gọi cổng đã có (trang chi tiết, tải tờ khai, tải thông báo) chỉ khác URL/Referer nên tham số hoá qua một bảng `DUONG_DAN`. Riêng tra cứu ETAX là hàm mới (POST form-encoded) nhưng dùng lại `gopCacTrangHoSo` sẵn có. Khoảng ngày vắt qua mốc 01/07/2025 bị cắt đôi, gọi hai nguồn rồi gộp bảng về một bộ cột chuẩn.

**Tech Stack:** TypeScript, Fastify, Prisma 7 (`be_maxv`); `node:test` + `tsx` cho test.

**Spec:** `docs/superpowers/specs/2026-08-24-dvc-ghep-api-thue-dien-tu-design.md`

## Global Constraints

- Chú thích viết **tiếng Việt**, giải thích **VÌ SAO** chứ không phải cái gì. Bám sát giọng file xung quanh.
- `idTbao` và `maHoSo` **luôn là chuỗi**, không bao giờ đi qua `Number()` — id 17 chữ số vượt `Number.MAX_SAFE_INTEGER` (`11320250320068493` → `...492`).
- Mọi call cổng đi qua `dvcSend`, tức đã qua pacer làn `dvc` (sàn 800ms, concurrency 1). Không tự thêm `fetch`.
- Ngày gửi cổng dạng `dd/MM/yyyy` — dùng `toDvcDate` sẵn có.
- Test chạy bằng `npx tsx --test <file>` từ thư mục `be_maxv`.
- Lệnh kiểm chứng sau mỗi task: `npx tsc --noEmit` và `npx tsx --test src/__tests__/*.test.ts` (5 fail của `adminOwner.test.ts` là có sẵn, cần Postgres seed — bỏ qua).
- Không commit trừ khi người dùng yêu cầu.

---

### Task 1: Kiểu `NguonHoSo` + bảng đường dẫn theo nguồn

**Files:**
- Modify: `be_maxv/src/services/client/dich_vu_cong/gdt-dvc.service.ts` (thay `chiTietHoSoUrl` ở dòng ~909; sửa `taiXmlHoSoThuc` ~1018, `taiThongBaoThuc` ~1101, `layChiTietHoSoHtml` ~1130 và ba hàm export bọc chúng)
- Test: `be_maxv/src/__tests__/dvcNguon.test.ts` (tạo mới)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `export type NguonHoSo = "dvc" | "tdt"`
  - `export function duongDanChiTiet(maHoSo: string, nguon: NguonHoSo): string` — URL tuyệt đối, dùng làm Referer
  - `export function duongDanTaiHoSo(nguon: NguonHoSo): string` — path tương đối
  - `export function duongDanTaiThongBao(nguon: NguonHoSo): string` — path tương đối
  - Ba hàm export đổi chữ ký, thêm tham số cuối `nguon: NguonHoSo = "dvc"`:
    - `taiXmlHoSo(p: DvcPhien, maHoSo: string, nguon?: NguonHoSo): Promise<DvcTepTaiVe>`
    - `taiThongBao(p: DvcPhien, maHoSo: string, idTbao: string, nguon?: NguonHoSo): Promise<DvcTepTaiVe>`
    - `layDanhSachThongBao(p: DvcPhien, maHoSo: string, nguon?: NguonHoSo): Promise<ThongBaoDaBoc[]>`

Mặc định `"dvc"` để mọi nơi gọi cũ (controller, `dongBoChiTietHoSo`) không phải đổi trong task này.

- [ ] **Step 1: Viết test thất bại**

Tạo `be_maxv/src/__tests__/dvcNguon.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  duongDanChiTiet,
  duongDanTaiHoSo,
  duongDanTaiThongBao,
} from "../services/client/dich_vu_cong/gdt-dvc.service";

/**
 * Test BẢNG ĐƯỜNG DẪN theo nguồn hồ sơ.
 *
 * Đáng khoá vì Referer của lượt tải phải mang đúng `?loai=ETAX`: thiếu là cổng từ chối bằng lỗi
 * rất khó lần ra, mà không có gì trong code nhắc.
 *
 *   npx tsx --test src/__tests__/dvcNguon.test.ts
 */

test("chi tiết: DVC dùng loai rỗng, TDT dùng loai=ETAX", () => {
  assert.equal(
    duongDanChiTiet("G12.18-260729-00015489", "dvc"),
    "https://dichvucong.gdt.gov.vn/tthc/tchs/files/detail/G12.18-260729-00015489?loai=",
  );
  assert.equal(
    duongDanChiTiet("11320250320068493", "tdt"),
    "https://dichvucong.gdt.gov.vn/tthc/tchs/files/detail/11320250320068493?loai=ETAX",
  );
});

test("chi tiết: mã hồ sơ được encode", () => {
  assert.ok(duongDanChiTiet("A/B C", "dvc").includes("A%2FB%20C"));
});

test("tải tờ khai + tải thông báo: TDT có endpoint riêng kèm loaiTraCuu", () => {
  assert.equal(duongDanTaiHoSo("dvc"), "/tchs/downloadhoso");
  assert.equal(duongDanTaiHoSo("tdt"), "/tchs/downloadhoso-tdt?loaiTraCuu=ETAX");
  assert.equal(duongDanTaiThongBao("dvc"), "/tchs/downloadthongbao");
  assert.equal(duongDanTaiThongBao("tdt"), "/tchs/downloadthongbao-tdt?loaiTraCuu=ETAX");
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

Run: `npx tsx --test src/__tests__/dvcNguon.test.ts`
Expected: FAIL — `duongDanChiTiet` chưa tồn tại.

- [ ] **Step 3: Cài đặt bảng đường dẫn**

Trong `gdt-dvc.service.ts`, **thay** hàm `chiTietHoSoUrl` hiện tại bằng:

```ts
/**
 * Nguồn dữ liệu của một hồ sơ trên cổng.
 *
 *  - `dvc`: tab "Dịch vụ công", hồ sơ nộp TỪ 01/07/2025.
 *  - `tdt`: tab "Thuế điện tử" (cổng gọi là ETAX), hồ sơ nộp TRƯỚC 01/07/2025.
 *
 * Hai nguồn dùng CHUNG phiên và captcha, chỉ khác endpoint — xem `DUONG_DAN`.
 */
export type NguonHoSo = "dvc" | "tdt";

/**
 * Endpoint của từng nguồn. Gom một bảng thay vì rải `if (nguon === "tdt")` ở ba hàm tải, vì hai
 * nửa của hợp đồng phải đi cùng nhau: lượt tải TDT chỉ chạy khi Referer cũng mang `?loai=ETAX`.
 * Tách rời là kiểu sửa một chỗ rồi cổng từ chối bằng lỗi không nói lên điều gì.
 */
const DUONG_DAN: Record<
  NguonHoSo,
  { loaiChiTiet: string; taiHoSo: string; taiThongBao: string }
> = {
  dvc: {
    loaiChiTiet: "",
    taiHoSo: "/tchs/downloadhoso",
    taiThongBao: "/tchs/downloadthongbao",
  },
  tdt: {
    loaiChiTiet: "ETAX",
    taiHoSo: "/tchs/downloadhoso-tdt?loaiTraCuu=ETAX",
    taiThongBao: "/tchs/downloadthongbao-tdt?loaiTraCuu=ETAX",
  },
};

/** URL trang chi tiết hồ sơ — vừa là trang để bóc danh sách thông báo, vừa là Referer bắt buộc của
 * cả ba lượt tải file. */
export function duongDanChiTiet(maHoSo: string, nguon: NguonHoSo): string {
  return `${DVC_BASE_URL}/tchs/files/detail/${encodeURIComponent(maHoSo)}?loai=${DUONG_DAN[nguon].loaiChiTiet}`;
}

export function duongDanTaiHoSo(nguon: NguonHoSo): string {
  return DUONG_DAN[nguon].taiHoSo;
}

export function duongDanTaiThongBao(nguon: NguonHoSo): string {
  return DUONG_DAN[nguon].taiThongBao;
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

Run: `npx tsx --test src/__tests__/dvcNguon.test.ts`
Expected: PASS 3/3.

- [ ] **Step 5: Nối `nguon` qua ba hàm tải**

`taiXmlHoSoThuc` — đổi chữ ký và hai chỗ dùng:

```ts
async function taiXmlHoSoThuc(
  session: DvcSession,
  maHoSo: string,
  nguon: NguonHoSo,
): Promise<DvcTepTaiVe> {
  const response = await dvcSend(duongDanTaiHoSo(nguon), session, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: duongDanChiTiet(maHoSo, nguon),
      [session.csrfHeader]: session.csrfToken,
    },
    body: JSON.stringify({ maHoSo }),
  });
  // ... phần bóc ZIP giữ NGUYÊN, không đổi dòng nào
```

`taiThongBaoThuc` — tương tự:

```ts
async function taiThongBaoThuc(
  session: DvcSession,
  maHoSo: string,
  idTbao: string,
  nguon: NguonHoSo,
): Promise<DvcTepTaiVe> {
  const response = await dvcSend(duongDanTaiThongBao(nguon), session, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: duongDanChiTiet(maHoSo, nguon),
      [session.csrfHeader]: session.csrfToken,
    },
    // `idTbao` gửi dạng CHUỖI, KHÔNG ép `Number`: id 17 chữ số vượt Number.MAX_SAFE_INTEGER
    // (`11320250320068493` -> `...492`). Trình duyệt của cổng gửi dạng số và tình cờ chạy vì id
    // trong mẫu là số chẵn — đừng chép theo.
    body: JSON.stringify({ idTbao, loaiTBao: "" }),
  });

  return docTepTuResponse(response, `thong-bao-${idTbao}.xml`, "application/xml");
}
```

`layChiTietHoSoHtml`:

```ts
async function layChiTietHoSoHtml(
  p: DvcPhien,
  maHoSo: string,
  nguon: NguonHoSo,
): Promise<string> {
  const session = requireSession(p);

  const response = await dvcSend(
    duongDanChiTiet(maHoSo, nguon).replace(DVC_BASE_URL, ""),
    session,
    { headers: { Accept: "text/html", Referer: `${DVC_BASE_URL}/tchs` } },
  );

  return response.text();
}
```

Ba hàm export bọc ngoài, thêm tham số có mặc định:

```ts
export async function taiXmlHoSo(
  p: DvcPhien,
  maHoSo: string,
  nguon: NguonHoSo = "dvc",
): Promise<DvcTepTaiVe> {
  const session = requireSession(p);
  return voiTuDangNhapLai(p.key, session, () => taiXmlHoSoThuc(session, maHoSo, nguon));
}

export async function taiThongBao(
  p: DvcPhien,
  maHoSo: string,
  idTbao: string,
  nguon: NguonHoSo = "dvc",
): Promise<DvcTepTaiVe> {
  const session = requireSession(p);
  return voiTuDangNhapLai(p.key, session, () => taiThongBaoThuc(session, maHoSo, idTbao, nguon));
}

export async function layDanhSachThongBao(
  p: DvcPhien,
  maHoSo: string,
  nguon: NguonHoSo = "dvc",
): Promise<ThongBaoDaBoc[]> {
  const session = requireSession(p);
  const html = await voiTuDangNhapLai(p.key, session, () => layChiTietHoSoHtml(p, maHoSo, nguon));
  return parseDanhSachThongBao(html);
}
```

- [ ] **Step 6: Kiểm chứng không hồi quy**

Run: `npx tsc --noEmit`
Expected: sạch.

Run: `npx tsx --test src/__tests__/*.test.ts`
Expected: `# pass` tăng đúng 3 so với trước (140 → 143), `# fail 5` không đổi.

---

### Task 2: Bóc pager kiểu ETAX

**Files:**
- Modify: `be_maxv/src/services/client/dich_vu_cong/hoSoHtml.ts:50` (`TONG_TRANG_RE`) và `:59` (`bocPhanTrang`)
- Test: `be_maxv/src/__tests__/dvcPhanTrang.test.ts` (bổ sung vào file có sẵn)

**Interfaces:**
- Consumes: `PhanTrangDaBoc` (đã có).
- Produces: `bocPhanTrang` giữ nguyên chữ ký, nay hiểu thêm markup ETAX.

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `be_maxv/src/__tests__/dvcPhanTrang.test.ts`:

```ts
// Markup THẬT của tab Thuế điện tử — khác DVC: không có `id="totalPage"`, và dùng em-dash.
const HTML_TDT = `<div class="order-3 order-md-2 d-none d-md-block flex-grow-1 text-center">
 <span class="fw-bold small"> Trang <span>1</span>/ <span>1</span> — Tổng số bản ghi: <span>10</span> </span>
 </div>`;

test("bocPhanTrang: đọc được pager kiểu ETAX (không có id=totalPage)", () => {
  assert.deepEqual(bocPhanTrang(HTML_TDT), { tongSoBanGhi: 10, tongSoTrang: 1 });
});

test("bocPhanTrang: pager ETAX nhiều trang", () => {
  const html = HTML_TDT.replace("<span>1</span>/ <span>1</span>", "<span>2</span>/ <span>7</span>");
  assert.deepEqual(bocPhanTrang(html), { tongSoBanGhi: 10, tongSoTrang: 7 });
});

test("bocPhanTrang: dạng DVC vẫn ưu tiên khi có cả hai", () => {
  const html = `<span id="totalPage">3</span> - Tổng số bản ghi: <span>25</span>` + HTML_TDT;
  assert.deepEqual(bocPhanTrang(html), { tongSoBanGhi: 25, tongSoTrang: 3 });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

Run: `npx tsx --test src/__tests__/dvcPhanTrang.test.ts`
Expected: FAIL 2 test đầu (`tongSoTrang` ra `null` thay vì `1`/`7`).

- [ ] **Step 3: Thêm pattern thứ hai**

Thay khối regex ở `hoSoHtml.ts:49-50` bằng:

```ts
const TONG_BAN_GHI_RE = /Tổng số bản ghi:\s*<span[^>]*>\s*([\d.,]+)\s*<\/span>/i;

/** Pager tab Dịch vụ công: `<span id="totalPage">2</span>`. */
const TONG_TRANG_DVC_RE = /id="totalPage"[^>]*>\s*([\d.,]+)\s*</i;

/**
 * Pager tab Thuế điện tử: `Trang <span>1</span>/ <span>1</span> — Tổng số bản ghi: …`.
 *
 * Không có `id` nào để bám nên phải neo vào chữ "Trang" và dấu `/`. Hai tab của CÙNG một cổng lại
 * viết pager khác nhau — không gộp được thành một biểu thức mà vẫn đọc hiểu được.
 */
const TONG_TRANG_TDT_RE = /Trang\s*<span[^>]*>\s*[\d.,]+\s*<\/span>\s*\/\s*<span[^>]*>\s*([\d.,]+)\s*<\/span>/i;
```

Và `bocPhanTrang`:

```ts
export function bocPhanTrang(html: string): PhanTrangDaBoc {
  return {
    tongSoBanGhi: soNguyen(TONG_BAN_GHI_RE.exec(html)?.[1]),
    // Thử dạng DVC trước rồi mới tới ETAX — thứ tự chỉ có ý nghĩa nếu một mảnh HTML lỡ chứa cả
    // hai, khi đó dạng có `id` là dạng đáng tin hơn.
    tongSoTrang:
      soNguyen(TONG_TRANG_DVC_RE.exec(html)?.[1]) ?? soNguyen(TONG_TRANG_TDT_RE.exec(html)?.[1]),
  };
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

Run: `npx tsx --test src/__tests__/dvcPhanTrang.test.ts`
Expected: PASS 8/8 (5 cũ + 3 mới).

- [ ] **Step 5: Kiểm chứng không hồi quy**

Run: `npx tsx --test src/__tests__/dvcGopTrang.test.ts src/__tests__/dvcPhanTrang.test.ts`
Expected: PASS 18/18.

---

### Task 3: Cắt khoảng ngày theo mốc 01/07/2025

**Files:**
- Create: `be_maxv/src/services/client/dich_vu_cong/nguonTheoNgay.ts`
- Test: `be_maxv/src/__tests__/dvcNguonTheoNgay.test.ts`

**Interfaces:**
- Consumes: `NguonHoSo` từ Task 1.
- Produces:
  - `export const MOC_TDT = "2025-07-01"`
  - `export interface DoanTraCuu { nguon: NguonHoSo; tuNgay: string; denNgay: string }`
  - `export function chiaDoanTheoNguon(tuNgay: string, denNgay: string): DoanTraCuu[]` — ngày dạng `yyyy-mm-dd`, trả 1 hoặc 2 đoạn, luôn theo thứ tự thời gian tăng dần.

- [ ] **Step 1: Viết test thất bại**

Tạo `be_maxv/src/__tests__/dvcNguonTheoNgay.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chiaDoanTheoNguon } from "../services/client/dich_vu_cong/nguonTheoNgay";

/**
 * Test CẮT KHOẢNG theo mốc 01/07/2025 — hồ sơ nộp trước mốc nằm ở cổng Thuế điện tử, từ mốc trở
 * đi nằm ở Dịch vụ công.
 *
 * Đáng khoá vì cắt sai một ngày là mất trọn một đoạn dữ liệu mà không có gì báo.
 *
 *   npx tsx --test src/__tests__/dvcNguonTheoNgay.test.ts
 */

test("trọn vẹn TRƯỚC mốc -> chỉ TDT", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-01-01", "2025-06-30"), [
    { nguon: "tdt", tuNgay: "2025-01-01", denNgay: "2025-06-30" },
  ]);
});

test("trọn vẹn TỪ mốc -> chỉ DVC", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-07-01", "2026-12-31"), [
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2026-12-31" },
  ]);
});

test("vắt qua mốc -> cắt đôi, TDT trước rồi DVC", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-01-01", "2026-12-31"), [
    { nguon: "tdt", tuNgay: "2025-01-01", denNgay: "2025-06-30" },
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2026-12-31" },
  ]);
});

test("đúng ngày mốc: 30/06 thuộc TDT, 01/07 thuộc DVC", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-06-30", "2025-06-30"), [
    { nguon: "tdt", tuNgay: "2025-06-30", denNgay: "2025-06-30" },
  ]);
  assert.deepEqual(chiaDoanTheoNguon("2025-07-01", "2025-07-01"), [
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2025-07-01" },
  ]);
});

test("khoảng ôm sát hai bên mốc -> hai đoạn một ngày", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-06-30", "2025-07-01"), [
    { nguon: "tdt", tuNgay: "2025-06-30", denNgay: "2025-06-30" },
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2025-07-01" },
  ]);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

Run: `npx tsx --test src/__tests__/dvcNguonTheoNgay.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Cài đặt**

Tạo `be_maxv/src/services/client/dich_vu_cong/nguonTheoNgay.ts`:

```ts
import type { NguonHoSo } from "./gdt-dvc.service";

/**
 * Mốc chia hai nguồn hồ sơ trên cổng.
 *
 * Cổng ghi rõ trên tab Thuế điện tử: chỉ hỗ trợ tra cứu tờ khai nộp TRƯỚC ngày này. Từ mốc trở đi
 * hồ sơ nằm ở tab Dịch vụ công. Đây là quy ước của CỔNG, không phải lựa chọn của app.
 */
export const MOC_TDT = "2025-07-01";

/** Ngày cuối cùng còn thuộc nguồn TDT. */
const NGAY_CUOI_TDT = "2025-06-30";

export interface DoanTraCuu {
  nguon: NguonHoSo;
  /** `yyyy-mm-dd`. */
  tuNgay: string;
  denNgay: string;
}

/**
 * Cắt `[tuNgay, denNgay]` thành các đoạn kèm nguồn phải hỏi.
 *
 * Khoảng vắt qua mốc bị cắt ĐÔI và gọi cả hai nguồn, chứ không định tuyến theo mỗi ngày bắt đầu:
 * chọn 01/01/2025–31/12/2026 mà chỉ hỏi một nguồn là mất trọn nửa kia, im lặng.
 *
 * So sánh chuỗi `yyyy-mm-dd` trực tiếp — dạng này sắp xếp theo từ điển đúng bằng sắp theo thời
 * gian, nên khỏi dựng `Date` và khỏi dính lệch múi giờ.
 */
export function chiaDoanTheoNguon(tuNgay: string, denNgay: string): DoanTraCuu[] {
  if (denNgay < MOC_TDT) return [{ nguon: "tdt", tuNgay, denNgay }];
  if (tuNgay >= MOC_TDT) return [{ nguon: "dvc", tuNgay, denNgay }];
  return [
    { nguon: "tdt", tuNgay, denNgay: NGAY_CUOI_TDT },
    { nguon: "dvc", tuNgay: MOC_TDT, denNgay },
  ];
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

Run: `npx tsx --test src/__tests__/dvcNguonTheoNgay.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Kiểm chứng**

Run: `npx tsc --noEmit`
Expected: sạch.

---

### Task 4: Gộp bảng hai nguồn về một bộ cột chuẩn

**Files:**
- Modify: `be_maxv/src/services/client/dich_vu_cong/hoSoHtml.ts` (thêm vào cuối)
- Test: `be_maxv/src/__tests__/dvcGopNguon.test.ts`

**Interfaces:**
- Consumes: `BangHoSoDaBoc` (đã có), `NguonHoSo` (Task 1).
- Produces:
  - `export const COT_NGUON = "Nguồn"` — tên cột tổng hợp thêm vào bảng gộp
  - `export function gopBangHaiNguon(phan: { bang: BangHoSoDaBoc; nguon: NguonHoSo }[]): BangHoSoDaBoc`

- [ ] **Step 1: Viết test thất bại**

Tạo `be_maxv/src/__tests__/dvcGopNguon.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gopBangHaiNguon,
  COT_NGUON,
  type BangHoSoDaBoc,
} from "../services/client/dich_vu_cong/hoSoHtml";

/**
 * Test GỘP BẢNG hai nguồn về một bộ cột chuẩn.
 *
 * `dongBoHoSo` đọc ô theo TÊN cột (`oTheoTieuDe`), mà tab Thuế điện tử đặt tên khác hẳn tab Dịch
 * vụ công — không ánh xạ thì mọi ô đọc ra rỗng và hồ sơ lưu xuống trống trơn.
 *
 *   npx tsx --test src/__tests__/dvcGopNguon.test.ts
 */

const BANG_TDT: BangHoSoDaBoc = {
  headers: [
    "STT", "Mã giao dịch", "Tờ khai/Phụ lục", "Kỳ tính thuế", "Loại tờ khai",
    "Lần nộp", "Lần bổ sung", "Ngày nộp", "Nơi nộp",
    "Tiến trình giải quyết hồ sơ (Trạng thái)", "Thao tác",
  ],
  rows: [[
    "1", "11320250320068493", "Tờ khai khấu trừ TNCN (TT80)", "Q1/2025", "Chính thức",
    "1", "0", "29/04/2025 22:41:39", "Thuế cơ sở 5 Hà Nội", "Đã chấp nhận", "",
  ]],
};

const BANG_DVC: BangHoSoDaBoc = {
  headers: ["Mã hồ sơ", "Tên TTHC", "Tờ khai", "Ngày nộp", "Trạng thái"],
  rows: [["G12.18-260729-00015489", "Khai thuế", "05/KK-TNCN", "29/07/2026 06:58", "Đã tiếp nhận"]],
};

const o = (b: BangHoSoDaBoc, dong: number, cot: string) => b.rows[dong]![b.headers.indexOf(cot)];

test("đổi tên cột ETAX về tên chuẩn của DVC", () => {
  const r = gopBangHaiNguon([{ bang: BANG_TDT, nguon: "tdt" }]);
  assert.equal(o(r, 0, "Mã hồ sơ"), "11320250320068493");
  assert.equal(o(r, 0, "Tờ khai"), "Tờ khai khấu trừ TNCN (TT80)");
  assert.equal(o(r, 0, "Lần nộp bổ sung"), "0");
  assert.equal(o(r, 0, "Cơ quan thuế tiếp nhận"), "Thuế cơ sở 5 Hà Nội");
  assert.equal(o(r, 0, "Trạng thái"), "Đã chấp nhận");
});

test("cột ETAX KHÔNG có (Tên TTHC) -> ô rỗng, không phải undefined", () => {
  const r = gopBangHaiNguon([{ bang: BANG_TDT, nguon: "tdt" }]);
  assert.ok(r.headers.includes("Tên TTHC"));
  assert.equal(o(r, 0, "Tên TTHC"), "");
});

test("mỗi dòng mang theo nguồn của nó", () => {
  const r = gopBangHaiNguon([
    { bang: BANG_TDT, nguon: "tdt" },
    { bang: BANG_DVC, nguon: "dvc" },
  ]);
  assert.equal(r.rows.length, 2);
  assert.equal(o(r, 0, COT_NGUON), "tdt");
  assert.equal(o(r, 1, COT_NGUON), "dvc");
});

test("gộp hai nguồn: mọi dòng có CÙNG số ô bằng số cột", () => {
  const r = gopBangHaiNguon([
    { bang: BANG_TDT, nguon: "tdt" },
    { bang: BANG_DVC, nguon: "dvc" },
  ]);
  for (const row of r.rows) assert.equal(row.length, r.headers.length);
});

test("cột lạ của một nguồn vẫn giữ, nguồn kia để rỗng", () => {
  const r = gopBangHaiNguon([
    { bang: BANG_TDT, nguon: "tdt" },
    { bang: BANG_DVC, nguon: "dvc" },
  ]);
  assert.ok(r.headers.includes("Kỳ tính thuế"));
  assert.equal(o(r, 1, "Kỳ tính thuế"), "");
});

test("danh sách rỗng -> bảng rỗng, không ném", () => {
  assert.deepEqual(gopBangHaiNguon([]), { headers: [], rows: [] });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

Run: `npx tsx --test src/__tests__/dvcGopNguon.test.ts`
Expected: FAIL — `gopBangHaiNguon` chưa tồn tại.

- [ ] **Step 3: Cài đặt**

Thêm vào cuối `be_maxv/src/services/client/dich_vu_cong/hoSoHtml.ts`:

```ts
// ============================================================
//  GỘP BẢNG TỪ HAI NGUỒN
// ============================================================

/** Cột tổng hợp thêm vào bảng gộp — cho biết dòng này lấy từ tab nào của cổng. Cần vì lượt tải
 * file sau đó phải gọi đúng endpoint của nguồn (xem `DUONG_DAN` bên `gdt-dvc.service.ts`). */
export const COT_NGUON = "Nguồn";

/**
 * Tên cột tab Thuế điện tử -> tên chuẩn (tên tab Dịch vụ công đang dùng).
 *
 * Cần vì `dongBoHoSo` đọc ô theo TÊN cột chứ không theo vị trí — không đổi tên thì mọi ô đọc ra
 * rỗng và hồ sơ lưu xuống trống trơn. Chuẩn hoá về tên DVC (không phải một tên thứ ba) để phía FE
 * và cột `raw` đã lưu không phải đổi gì.
 */
const DOI_TEN_COT_TDT: Record<string, string> = {
  "Mã giao dịch": "Mã hồ sơ",
  "Tờ khai/Phụ lục": "Tờ khai",
  "Lần bổ sung": "Lần nộp bổ sung",
  "Nơi nộp": "Cơ quan thuế tiếp nhận",
  "Tiến trình giải quyết hồ sơ (Trạng thái)": "Trạng thái",
};

/** Cột mà `dongBoHoSo` đọc — luôn có mặt trong bảng gộp, thiếu thì để rỗng. Bảng ETAX không có
 * "Tên TTHC"; ô rỗng là kiểu thiếu nhìn ra được, khác hẳn `undefined` lọt xuống DB. */
const COT_BAT_BUOC = [
  "Mã hồ sơ",
  "Tên TTHC",
  "Tờ khai",
  "Kỳ tính thuế",
  "Loại tờ khai",
  "Lần nộp",
  "Lần nộp bổ sung",
  "Ngày nộp",
  "Cơ quan thuế tiếp nhận",
  "Trạng thái",
];

/**
 * Gộp bảng của nhiều nguồn thành MỘT bảng dùng chung bộ cột.
 *
 * Cột là HỢP của mọi nguồn (cộng `COT_BAT_BUOC` và `COT_NGUON`); ô nào nguồn đó không có thì rỗng.
 * Giữ cả cột lạ thay vì cắt về đúng `COT_BAT_BUOC`: cột `raw` lưu nguyên dòng cổng trả để FE hiện
 * được cột mới mà không cần migration — cắt bớt ở đây là phá đúng tính chất đó.
 */
export function gopBangHaiNguon(
  phan: { bang: BangHoSoDaBoc; nguon: "dvc" | "tdt" }[],
): BangHoSoDaBoc {
  if (phan.length === 0) return { headers: [], rows: [] };

  const doiTen = (nguon: string, ten: string) =>
    nguon === "tdt" ? (DOI_TEN_COT_TDT[ten] ?? ten) : ten;

  const headers: string[] = [];
  const them = (ten: string) => {
    if (!headers.includes(ten)) headers.push(ten);
  };
  for (const ten of COT_BAT_BUOC) them(ten);
  for (const { bang, nguon } of phan) {
    for (const ten of bang.headers) them(doiTen(nguon, ten));
  }
  them(COT_NGUON);

  const rows: string[][] = [];
  for (const { bang, nguon } of phan) {
    // Vị trí của từng cột chuẩn trong bảng NGUỒN — tra một lần cho cả nguồn, không tra lại mỗi dòng.
    const viTri = headers.map((ten) =>
      bang.headers.findIndex((g) => doiTen(nguon, g) === ten),
    );
    for (const row of bang.rows) {
      rows.push(
        headers.map((ten, i) => (ten === COT_NGUON ? nguon : (row[viTri[i]!] ?? ""))),
      );
    }
  }

  return { headers, rows };
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

Run: `npx tsx --test src/__tests__/dvcGopNguon.test.ts`
Expected: PASS 6/6.

- [ ] **Step 5: Kiểm chứng**

Run: `npx tsc --noEmit && npx tsx --test src/__tests__/*.test.ts`
Expected: typecheck sạch; `# fail 5` không đổi.

---

### Task 5: Tra cứu ETAX

**Files:**
- Modify: `be_maxv/src/services/client/dich_vu_cong/gdt-dvc.service.ts` (thêm cạnh `traCuuHoSoMoiTrang`, ~dòng 898)
- Test: `be_maxv/src/__tests__/dvcLoiCaptchaTdt.test.ts`

**Interfaces:**
- Consumes: `TraCuuTrangQuery`, `gopCacTrangHoSo`, `bocPhanTrang`, `parseBangHoSo`, `SIZE_MOI_TRANG`, `toDvcDate`, `laLoiCaptcha`, `DvcHttpError`.
- Produces:
  - `export function laLoiCaptchaTdt(err: unknown): boolean`
  - `export async function traCuuHoSoTdt(q: DvcTraCuuHoSoQuery): Promise<BangHoSoDaBoc>`

- [ ] **Step 1: Viết test thất bại cho phần nhận diện lỗi captcha**

Tạo `be_maxv/src/__tests__/dvcLoiCaptchaTdt.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  laLoiCaptchaTdt,
  DvcHttpError,
} from "../services/client/dich_vu_cong/gdt-dvc.service";

/**
 * Test nhận diện lỗi captcha của tab Thuế điện tử.
 *
 * Khác Dịch vụ công: DVC trả mảnh HTML chứa câu lỗi (dò bằng `laLoiCaptcha`), còn ETAX trả HTTP
 * 400 nên ném `DvcHttpError` — dùng nhầm nhánh cũ là vòng thử lại captcha không bao giờ chạy và
 * lượt đồng bộ hỏng ngay lần OCR trượt đầu tiên.
 *
 *   npx tsx --test src/__tests__/dvcLoiCaptchaTdt.test.ts
 */

test("400 kèm câu báo captcha -> đúng là lỗi captcha", () => {
  const err = new DvcHttpError(400, "", "Mã captcha không chính xác, vui lòng thử lại!");
  assert.equal(laLoiCaptchaTdt(err), true);
});

test("400 vì lý do khác -> KHÔNG phải lỗi captcha, đừng thử lại vô ích", () => {
  assert.equal(laLoiCaptchaTdt(new DvcHttpError(400, "", "Thiếu tham số")), false);
});

test("500 kèm câu captcha -> vẫn không tính (sai mã trạng thái)", () => {
  const err = new DvcHttpError(500, "", "Mã captcha không chính xác");
  assert.equal(laLoiCaptchaTdt(err), false);
});

test("lỗi không phải DvcHttpError -> false", () => {
  assert.equal(laLoiCaptchaTdt(new Error("mất mạng")), false);
  assert.equal(laLoiCaptchaTdt(null), false);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó đỏ**

Run: `npx tsx --test src/__tests__/dvcLoiCaptchaTdt.test.ts`
Expected: FAIL — `laLoiCaptchaTdt` chưa tồn tại.

- [ ] **Step 3: Cài đặt tra cứu ETAX**

Thêm vào `gdt-dvc.service.ts`, ngay sau `traCuuHoSoMoiTrang`:

```ts
/**
 * Cổng báo captcha sai ở tab Thuế điện tử bằng HTTP 400, không phải bằng mảnh HTML như tab Dịch vụ
 * công — nên `laLoiCaptcha` (dò chữ trong HTML) không bao giờ khớp ở nhánh này.
 *
 * Xét cả mã trạng thái lẫn câu chữ: 400 vì thiếu tham số mà cứ thử lại captcha là đốt ba lượt gọi
 * cổng cho một lỗi không bao giờ tự khỏi.
 */
export function laLoiCaptchaTdt(err: unknown): boolean {
  return err instanceof DvcHttpError && err.status === 400 && laLoiCaptcha(err.message);
}

/** Gửi MỘT trang tra cứu tab Thuế điện tử. */
async function guiTraCuuTdt(
  session: DvcSession,
  q: TraCuuTrangQuery,
  captcha: string,
): Promise<string> {
  const body = new URLSearchParams({
    // Cổng đòi CSRF ở CẢ thân request lẫn header cho endpoint này (tab Dịch vụ công chỉ cần header).
    _csrf: session.csrfToken,
    page: String(q.page),
    size: String(q.size),
    maToKhai_tdt: q.maToKhai ?? "",
    maGiaoDichTthc_tdt: q.maHoSo ?? "",
    tuNgay_tdt: toDvcDate(q.tuNgay),
    denNgay_tdt: toDvcDate(q.denNgay),
    scope_tdt2: q.scope ?? "SELF",
    mstUyQuyen_tdt2: q.mstUyQuyen ?? "",
    captcha,
    btnSearch_tdt: "",
  });

  const response = await dvcSend("/tchs/thuedientu", session, {
    method: "POST",
    headers: {
      Accept: "text/html-partial",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${DVC_BASE_URL}/tchs`,
      Origin: DVC_BASE_URL.replace("/tthc", ""),
      "HX-Request": "true",
      "HX-Current-URL": `${DVC_BASE_URL}/tchs`,
      "HX-Target": "bangKetQuaTraCuu_tdt",
      "HX-Trigger": "form_search_tdt",
      [session.csrfHeader]: session.csrfToken,
    },
    body: body.toString(),
  });

  return response.text();
}

/** Một trang tra cứu ETAX, tự lấy + giải captcha, thử lại `SO_LAN_THU_CAPTCHA` lần khi đọc sai mã. */
async function traCuuTdtHtml(q: TraCuuTrangQuery): Promise<string> {
  const session = requireSession(q);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= SO_LAN_THU_CAPTCHA; attempt++) {
    try {
      const cap = await getTchsCaptcha(q);
      if (!cap.answer) {
        throw new Error("Không thể tự động giải mã captcha trang Thuế điện tử.");
      }
      return await guiTraCuuTdt(session, q, cap.answer);
    } catch (err) {
      lastError = err;
      // Chỉ captcha sai mới đáng thử lại — lỗi khác thì thử tiếp cũng hỏng y hệt, xem `khongNenThuLai`.
      if (!laLoiCaptchaTdt(err) || attempt === SO_LAN_THU_CAPTCHA) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tra cứu Thuế điện tử thất bại.");
}

/**
 * Tra cứu hồ sơ tab Thuế điện tử, gộp đủ các trang.
 *
 * Dùng lại NGUYÊN `gopCacTrangHoSo` của tab Dịch vụ công — chỉ khác `layTrang`. Mọi điều kiện dừng,
 * chống trùng theo "Mã hồ sơ" và cảnh báo lệch cột đều dùng chung, đã có test.
 */
export async function traCuuHoSoTdt(q: DvcTraCuuHoSoQuery): Promise<BangHoSoDaBoc> {
  const session = requireSession(q);
  return voiTuDangNhapLai(q.key, session, () =>
    gopCacTrangHoSo(
      async (page) => {
        const html = await traCuuTdtHtml({ ...q, page, size: SIZE_MOI_TRANG });
        return { bang: parseBangHoSo(html), phanTrang: bocPhanTrang(html) };
      },
      { size: SIZE_MOI_TRANG, daBiThay: q.daBiThay },
    ),
  );
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

Run: `npx tsx --test src/__tests__/dvcLoiCaptchaTdt.test.ts`
Expected: PASS 4/4.

- [ ] **Step 5: Kiểm chứng**

Run: `npx tsc --noEmit && npx tsx --test src/__tests__/*.test.ts`
Expected: typecheck sạch; `# fail 5` không đổi.

---

### Task 6: Cột `nguon` trong `dvc_ho_so`

**Files:**
- Modify: `be_maxv/prisma/tenant/schema.prisma` (model `dvc_ho_so`, dòng ~608)

**Interfaces:**
- Consumes: không.
- Produces: cột `dvc_ho_so.nguon String @default("dvc") @db.VarChar(8)` cho Task 7 ghi vào.

- [ ] **Step 1: Thêm cột**

Trong `model dvc_ho_so`, thêm ngay dưới `ma_ho_so`:

```prisma
  /// Nguồn lấy hồ sơ trên cổng: "dvc" (tab Dịch vụ công, nộp từ 01/07/2025) hoặc "tdt" (tab Thuế
  /// điện tử, nộp trước mốc đó). Cần lưu vì lượt "Tải file" sau này phải gọi ĐÚNG endpoint của
  /// nguồn — hai nguồn dùng URL khác nhau, xem `DUONG_DAN` ở `gdt-dvc.service.ts`.
  /// Mặc định "dvc": mọi dòng đã lưu trước khi có cột này đều đến từ tab Dịch vụ công.
  nguon String @default("dvc") @db.VarChar(8)
```

- [ ] **Step 2: Sinh lại Prisma client**

Run: `npm run generate`
Expected: `✔ Generated Prisma Client` cho cả `sys` và `tenant`.

- [ ] **Step 3: Đồng bộ schema xuống mọi DB tenant**

Run: `npm run sync:tenants`
Expected: `Xong: N thành công, 0 lỗi`.

Cột có `@default` nên `db push` chỉ THÊM, không xoá dữ liệu — nhưng vẫn đọc diff nó in ra trước khi xác nhận, vì script chạy với `--accept-data-loss`.

- [ ] **Step 4: Kiểm chứng cột đã có**

Run:
```bash
npx tsx -e "import('./src/helpers/tenantClient.js')" 2>/dev/null || echo "bỏ qua"
```
Thay bằng kiểm trực tiếp: mở `psql` hoặc chạy một script tạm đọc `information_schema.columns` cho `dvc_ho_so`, xác nhận có `nguon` kiểu `character varying`. Xoá script tạm sau khi xong.

- [ ] **Step 5: Kiểm chứng không hồi quy**

Run: `npx tsc --noEmit`
Expected: sạch.

---

### Task 7: Nối hai nguồn vào `dongBoHoSo`

**Files:**
- Modify: `be_maxv/src/services/client/dich_vu_cong/dvc-dong-bo.service.ts` (`dongBoChiTietHoSo` ~117, `dongBoHoSo` ~303)

**Interfaces:**
- Consumes: `chiaDoanTheoNguon` (Task 3), `gopBangHaiNguon`/`COT_NGUON` (Task 4), `traCuuHoSoTdt` (Task 5), `NguonHoSo` (Task 1), cột `nguon` (Task 6).
- Produces: `dongBoHoSo` giữ nguyên chữ ký; nay xử lý cả hai nguồn.

- [ ] **Step 1: Cho `dongBoChiTietHoSo` biết nguồn**

Đổi chữ ký và ba lượt gọi cổng bên trong:

```ts
async function dongBoChiTietHoSo(
  db: () => PrismaClient,
  phien: DvcService.DvcPhien,
  maHoSo: string,
  nguon: DvcService.NguonHoSo,
  daBiThay: () => boolean,
): Promise<{ thongBaoLoi: number }> {
  const xml = await DvcService.taiXmlHoSo(phien, maHoSo, nguon);
  const [, danhSachThongBao] = await Promise.all([
    db().dvc_ho_so.update({ where: { ma_ho_so: maHoSo }, data: truongToKhai(xml) }),
    DvcService.layDanhSachThongBao(phien, maHoSo, nguon),
  ]);
  // ... vòng thông báo giữ nguyên, chỉ đổi lượt tải:
  //   const file = await DvcService.taiThongBao(phien, maHoSo, tb.idTbao, nguon);
```

- [ ] **Step 2: Tra cứu theo từng đoạn rồi gộp**

Trong `dongBoHoSo`, thay khối `const { headers, rows, tongSoBanGhi } = await params.voiPhucHoi(...)` bằng:

```ts
  // Cắt khoảng theo mốc 01/07/2025 rồi hỏi từng nguồn. Khoảng vắt qua mốc cho ra HAI đoạn — gọi
  // thiếu một đoạn là mất trọn nửa dữ liệu mà không có gì báo (xem `chiaDoanTheoNguon`).
  const doan = chiaDoanTheoNguon(params.tuNgay, params.denNgay);
  const phan: { bang: BangHoSoDaBoc; nguon: DvcService.NguonHoSo }[] = [];
  let tongSoBanGhi: number | null = null;

  for (const d of doan) {
    if (params.daBiThay()) break;
    const bang = await params.voiPhucHoi(() => {
      const q = {
        ...params.phien,
        tuNgay: d.tuNgay,
        denNgay: d.denNgay,
        scope: "SELF",
        daBiThay: params.daBiThay,
      };
      return d.nguon === "tdt" ? DvcService.traCuuHoSoTdt(q) : DvcService.traCuuHoSo(q);
    });
    phan.push({ bang, nguon: d.nguon });
    // Cộng dồn tổng cổng khai của TỪNG đoạn — `null` của một đoạn không được xoá số của đoạn kia.
    if (typeof bang.tongSoBanGhi === "number") {
      tongSoBanGhi = (tongSoBanGhi ?? 0) + bang.tongSoBanGhi;
    }
  }

  const { headers, rows } = gopBangHaiNguon(phan);
```

- [ ] **Step 3: Ghi `nguon` khi lưu hồ sơ và truyền xuống chi tiết**

Trong vòng `for (const row of rows)`, sau khi lấy `maHoSo`:

```ts
    // `COT_NGUON` do `gopBangHaiNguon` gắn vào mỗi dòng — đây là chỗ DUY NHẤT biết dòng này từ tab
    // nào, và lượt tải file bên dưới phải gọi đúng endpoint của nguồn đó.
    const nguon = (oTheoTieuDe(headers, row, COT_NGUON) || "dvc") as DvcService.NguonHoSo;
```

Thêm `nguon` vào khối `create` của `db().dvc_ho_so.upsert` (KHÔNG thêm vào `update`: nguồn của một hồ sơ không đổi, mà ghi đè là mở đường cho một lượt tra cứu lệch làm hỏng dòng đã đúng):

```ts
        create: {
          ma_ho_so: maHoSo,
          nguon,
          ten_tthc: oTheoTieuDe(headers, row, "Tên TTHC") || null,
          // ... phần còn lại giữ nguyên
```

Và truyền xuống:

```ts
      const { thongBaoLoi } = await dongBoChiTietHoSo(
        db, params.phien, maHoSo, nguon, params.daBiThay,
      );
```

- [ ] **Step 4: Thêm import**

Đầu file:

```ts
import { chiaDoanTheoNguon } from "./nguonTheoNgay";
import { gopBangHaiNguon, COT_NGUON, type BangHoSoDaBoc } from "./hoSoHtml";
```

(`BangHoSoDaBoc` hiện đang là `import type` cùng `ThongBaoDaBoc` — gộp lại, đừng khai hai lần.)

- [ ] **Step 5: Kiểm chứng**

Run: `npx tsc --noEmit`
Expected: sạch.

Run: `npx tsx --test src/__tests__/*.test.ts`
Expected: `# fail 5` không đổi.

---

### Task 8: Xác minh trên cổng thật

**Files:**
- Create (tạm, xoá sau): `be_maxv/src/scripts/tmp-kiem-tdt.ts`

**Interfaces:**
- Consumes: mọi thứ từ Task 1–7.
- Produces: không có code giữ lại — đây là bước kiểm chứng.

- [ ] **Step 1: Xác minh mắt xích chưa chứng minh trong spec (mục 7)**

`parseDanhSachThongBao` có bóc được `#modalThongBao` của trang chi tiết ETAX không. Viết script tạm:

```ts
import { sysPrisma } from "../config/db.sys";
import { decryptGdtPassword } from "../services/client/hddt/gdtCredential";
import * as DvcService from "../services/client/dich_vu_cong/gdt-dvc.service";

const MST = "0106200129";

async function main() {
  const c = await sysPrisma.donVi.findFirst({
    where: { maSoThue: MST },
    select: {
      id: true, dvcUsername: true,
      dvcPasswordCipher: true, dvcPasswordIv: true, dvcPasswordTag: true,
    },
  });
  const matKhau = decryptGdtPassword({
    cipher: c!.dvcPasswordCipher!, iv: c!.dvcPasswordIv!, tag: c!.dvcPasswordTag!,
  })!;

  let key = "";
  for (let i = 1; i <= 5 && !key; i++) {
    const cap = await DvcService.getCaptcha(c!.id);
    if (!cap.answer) continue;
    try {
      key = (await DvcService.login({
        key: cap.key, donViId: c!.id, tenDN: c!.dvcUsername!, matKhau, captcha: cap.answer,
      })).key;
    } catch { /* thu lai */ }
  }
  const phien = { key, donViId: c!.id };

  // Tra cứu ETAX TRƯỚC — cổng giữ state phía server, gọi thẳng trang chi tiết sẽ ăn 500.
  const bang = await DvcService.traCuuHoSoTdt({
    ...phien, tuNgay: "2025-01-01", denNgay: "2025-06-30", scope: "SELF",
  });
  const ma = bang.rows[0]![bang.headers.indexOf("Mã giao dịch")]!;
  console.log(`Tra cuu ETAX: ${bang.rows.length} dong | ma = ${ma}`);

  const ds = await DvcService.layDanhSachThongBao(phien, ma, "tdt");
  console.log(`Thong bao: ${ds.length}`, JSON.stringify(ds.slice(0, 2)));

  if (ds[0]) {
    const f = await DvcService.taiThongBao(phien, ma, ds[0].idTbao, "tdt");
    console.log(`Tai thong bao: ${f.bytes.length} byte | ${f.contentType} | ${f.fileName}`);
  }
  const x = await DvcService.taiXmlHoSo(phien, ma, "tdt");
  console.log(`Tai to khai: ${x.bytes.length} byte | ${x.contentType} | ${x.fileName}`);
}
main().catch((e) => { console.error("LOI:", e); process.exitCode = 1; })
  .finally(() => void sysPrisma.$disconnect());
```

Run: `npx tsx src/scripts/tmp-kiem-tdt.ts`
Expected: tra cứu ra 10 dòng; `Thong bao` > 0; tải tờ khai trả `application/xml` (đã bóc khỏi ZIP).

**Nếu `Thong bao: 0`:** markup modal của ETAX khác — mở HTML trang chi tiết ra so với `parseDanhSachThongBao` rồi thêm pattern. KHÔNG đổi kiến trúc.

- [ ] **Step 2: Chạy một lượt đồng bộ THẬT vắt qua mốc**

Sửa script tạm để gọi `DvcDongBo.batDauDongBoRun` + `dongBoHoSo` với `tuNgay: "2025-01-01", denNgay: "2026-12-31"` (khuôn có sẵn ở mục 9 tài liệu `dvc-thay-doi-2026-08.md`), rồi poll `docTienDoDongBo`.

Expected: `tongHoSo = 26` (10 ETAX + 16 DVC), `loi = 0`, `thieu = 0`, log `done`.

- [ ] **Step 3: Kiểm dữ liệu đã lưu**

Đọc `dvc_ho_so` của tenant `maxv_0106200129_app`: phải có 26 dòng, trong đó 10 dòng `nguon = 'tdt'` và 16 dòng `nguon = 'dvc'`; mọi dòng `tdt` có `ten_tthc` rỗng/null (bảng ETAX không có cột đó) nhưng `to_khai`, `ngay_nop`, `trang_thai` phải có giá trị.

- [ ] **Step 4: Xoá script tạm**

Run: `rm -f src/scripts/tmp-kiem-tdt.ts && ls src/scripts/`
Expected: chỉ còn `sync-tenants.ts`, `test-dvc-ocr.ts`, `test-onnx.ts`, `test-preprocess.ts`.

- [ ] **Step 5: Kiểm chứng toàn bộ**

Run: `npx tsc --noEmit && npm run lint && npx tsx --test src/__tests__/*.test.ts`
Expected: typecheck sạch; lint 0 errors; `# fail 5` không đổi.

---

### Task 9: Cập nhật tài liệu

**Files:**
- Modify: `docs/dvc-thay-doi-2026-08.md`

- [ ] **Step 1: Thêm mục mô tả nguồn thứ hai**

Thêm một mục mới (đặt sau `7quater`) ghi: luật định tuyến theo mốc 01/07/2025, bảng bốn endpoint hai nguồn, bốn điểm khác của ETAX (idTbao phải là chuỗi, captcha lỗi qua HTTP 400, pager khác markup, bộ cột khác), ràng buộc thứ tự trong phiên, và kết quả kiểm chứng thật ở Task 8.

- [ ] **Step 2: Cập nhật lưu ý deploy**

Mục "Lưu ý khi deploy": bổ sung cột `dvc_ho_so.nguon` vào danh sách cột cần `npm run sync:tenants`.

- [ ] **Step 3: Cập nhật bảng kiểm chứng**

Thêm số test mới (`dvcNguon` 3, `dvcNguonTheoNgay` 5, `dvcGopNguon` 6, `dvcLoiCaptchaTdt` 4, `dvcPhanTrang` +3 = **21 test mới**) và kết quả lượt đồng bộ thật 26 hồ sơ.

---

## Self-Review

**Spec coverage:**

| Mục spec | Task |
|---|---|
| 1 — Luật định tuyến + cắt đôi | 3, 7 |
| 2.1 — Tra cứu ETAX | 5 |
| 2.2 — Pipeline chi tiết dùng lại | 1, 7 |
| 2.3 — Ràng buộc thứ tự trong phiên | 7 (thoả tự nhiên), 8 (kiểm) |
| 3.1 — `idTbao` giữ chuỗi | 1 (Step 5, comment + code) |
| 3.2 — Captcha lỗi qua HTTP 400 | 5 |
| 3.3 — Pager khác markup | 2 |
| 3.4 — Bộ cột khác | 4 |
| 4.1 — Cột `nguon` | 6 |
| 4.2 — Bảng `DUONG_DAN` | 1 |
| 4.3 — Dùng lại `gopCacTrangHoSo` | 5 |
| 4.4 — `chiaDoanTheoNguon` | 3 |
| 5 — Xử lý lỗi từng đoạn | 7 (vòng `for (const d of doan)` không huỷ cả lượt), 8 |
| 6 — Kiểm thử | 2, 3, 4, 5, 8 |
| 7 — Mắt xích chưa chứng minh | 8 Step 1 |

Không mục nào của spec thiếu task.

**Ghi chú lệch nhỏ so với spec:** spec mô tả `DUONG_DAN.chiTiet` là hàm; kế hoạch dùng `loaiChiTiet` (chuỗi) + hàm `duongDanChiTiet` bọc ngoài. Cùng kết quả, ít lặp hơn.

**Type consistency:** `NguonHoSo` khai ở Task 1 và dùng nguyên tên ở Task 3, 4, 7. `COT_NGUON` khai ở Task 4, dùng ở Task 7. `chiaDoanTheoNguon`/`DoanTraCuu` khai ở Task 3, dùng ở Task 7. `traCuuHoSoTdt` khai ở Task 5, dùng ở Task 7. `laLoiCaptchaTdt` khai và dùng trong Task 5. Chữ ký `dongBoChiTietHoSo` đổi ở Task 7 Step 1 và mọi nơi gọi nó cũng nằm trong Task 7 Step 3.
