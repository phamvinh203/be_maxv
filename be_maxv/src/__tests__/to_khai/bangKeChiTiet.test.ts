import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../../generated/tenant";
import type { Ky } from "../../services/client/to_khai/domain/kySoThue";

/**
 * `layBangKeChiTietTheoKy` (keKhaiKy.service.ts) — bảng kê của kỳ KÈM chi tiết từng hóa đơn, dùng
 * xuất Excel sheet "Chi tiết mua vào/bán ra" (api-contract Mục 2, ADR-001). Bất biến phải giữ
 * (api-contract Mục 2.4):
 *   #1 cùng TẬP và THỨ TỰ `datas` với `layBangKeTheoKy` — không lọc lại, không lọc thêm.
 *   #2 mọi phần tử `datas` đều có key `chiTiet` (object | null), không thiếu không thừa.
 *   #3 ghép `chiTiet` theo `id`, không theo vị trí.
 *   #4 đọc `detail` theo lô id <= 1.000 (dùng `chiaLo`).
 *
 * Mock hẳn `GDTService.getSavedInvoices` (đã có test riêng cho `layBangKeTheoKy` gọi hàm này ở
 * `keKhaiKyGocDb.test.ts`/`gomHoaDonGtgt.test.ts`) để test này chỉ còn kiểm đúng phần MỚI: gắn
 * `chiTiet` theo id.
 */

let layBangKeChiTietTheoKy: typeof import(
  "../../services/client/to_khai/application/keKhaiKy.service"
).layBangKeChiTietTheoKy;

interface DongGdt {
  id: string;
  tthai: string;
}

/** Danh sách hóa đơn mà `GDTService.getSavedInvoices` giả sẽ trả — mỗi test tự set trước khi gọi. */
const layGoiTraGdt = { current: [] as DongGdt[] };

before(async () => {
  mock.module("../../services/client/hddt/gdt.service", {
    namedExports: {
      getSavedInvoices: async () => ({
        total: layGoiTraGdt.current.length,
        datas: layGoiTraGdt.current,
        thayThe: [],
      }),
      // Đánh dấu `__normalized` để test phân biệt được "đã qua normalizeDetailDates" với "detail thô".
      normalizeDetailDates: (d: Record<string, unknown>) => ({ ...d, __normalized: true }),
    },
  });
  ({ layBangKeChiTietTheoKy } = await import(
    "../../services/client/to_khai/application/keKhaiKy.service"
  ));
});

const KY: Ky = { nam: 2026, kyLoai: "thang", kySo: 8 };

interface DongDaGan {
  hoa_don_id: string;
  ke_khai: boolean;
  chi_tieu_tang_giam: string | null;
}

interface DetailTheoView {
  /** Map detail dùng cho `vct60view` (chiều mua vào). */
  purchase?: Map<string, unknown>;
  /** Map detail dùng cho `vct50view` (chiều bán ra). */
  sold?: Map<string, unknown>;
}

/**
 * Mock DB tối thiểu: `tokhai_ky_hoa_don.findMany` (đã gán kỳ) + `vctXXview.findMany` (đọc detail).
 *
 * `vct60view` (mua vào) và `vct50view` (bán ra) đọc từ HAI MAP RIÊNG (RVW-T07) — nếu code đảo nhầm
 * nhánh (vd `chieu === "purchase"` lại đọc `vct50view`) thì `id` tra sai map, `chiTiet` trả ra khác
 * hẳn dữ liệu test đưa vào cho đúng chiều, test đỏ ngay thay vì lặng lẽ đọc trúng.
 */
function taoDbGia(daGan: DongDaGan[], detailTheoView: DetailTheoView = {}) {
  const loGoi: string[][] = [];
  const taoDocDetail =
    (detailTheoId: Map<string, unknown>) =>
    async (args: { where: { id: { in: string[] } } }) => {
      const ids = args.where.id.in;
      loGoi.push(ids);
      return ids.filter((id) => detailTheoId.has(id)).map((id) => ({ id, detail: detailTheoId.get(id) }));
    };
  const db = {
    tokhai_ky_hoa_don: { findMany: async () => daGan },
    vct60view: { findMany: taoDocDetail(detailTheoView.purchase ?? new Map()) },
    vct50view: { findMany: taoDocDetail(detailTheoView.sold ?? new Map()) },
    // khoangDocBangKe: không hóa đơn nào nới khoảng kỳ trong các test này.
    $queryRawUnsafe: async () => [{ tu: null, den: null }],
  } as unknown as PrismaClient;
  return { db, loGoi };
}

test("kỳ chưa từng Kê khai -> datas rỗng, không đọc detail", async () => {
  layGoiTraGdt.current = [];
  const { db, loGoi } = taoDbGia([]);

  const kq = await layBangKeChiTietTheoKy(db, KY, "purchase");

  assert.deepEqual(kq, { total: 0, datas: [], thayThe: [] });
  assert.equal(loGoi.length, 0);
});

test("tập id + thứ tự trùng bảng kê; chiTiet ghép đúng theo id, không theo vị trí", async () => {
  layGoiTraGdt.current = [
    { id: "hd-2", tthai: "1" },
    { id: "hd-1", tthai: "1" },
  ];
  const { db } = taoDbGia(
    [
      { hoa_don_id: "hd-1", ke_khai: true, chi_tieu_tang_giam: null },
      { hoa_don_id: "hd-2", ke_khai: false, chi_tieu_tang_giam: "38" },
    ],
    { purchase: new Map([["hd-1", { hdhhdvu: [] }]]) }, // hd-2 CHƯA tải chi tiết -> không có trong map
  );

  const kq = await layBangKeChiTietTheoKy(db, KY, "purchase");

  assert.deepEqual(kq.datas.map((d) => d.id), ["hd-2", "hd-1"]);
  assert.equal(kq.datas[0].chiTiet, null);
  assert.deepEqual(kq.datas[1].chiTiet, { hdhhdvu: [], __normalized: true });
  assert.equal(kq.total, 2);
});

// RVW-T06 — chỗ gọi `dienGiaiChiTieuTangGiam` (keKhaiKy.service.ts:542, đường ĐỌC dùng chung bởi
// `layBangKeTheoKy` VÀ `layBangKeChiTietTheoKy`) phải có test giữ nếu ai đó lỡ đổi lại
// `gan.chi_tieu_tang_giam ?? ""` (bỏ diễn giải mã cũ) — TC-024/025 áp dụng qua đường thật của service.
test("diễn giải mã cũ 'tang'/'giam' khi đọc qua layBangKeChiTietTheoKy (và layBangKeTheoKy nó gọi)", async () => {
  layGoiTraGdt.current = [
    { id: "hd-1", tthai: "1" },
    { id: "hd-2", tthai: "1" },
    { id: "hd-3", tthai: "1" },
  ];
  const { db } = taoDbGia([
    { hoa_don_id: "hd-1", ke_khai: true, chi_tieu_tang_giam: "tang" },
    { hoa_don_id: "hd-2", ke_khai: true, chi_tieu_tang_giam: "giam" },
    { hoa_don_id: "hd-3", ke_khai: true, chi_tieu_tang_giam: null },
  ]);

  const kq = await layBangKeChiTietTheoKy(db, KY, "purchase");

  assert.deepEqual(kq.datas.map((d) => d.chiTieuTangGiam), ["38", "37", ""]);
});

// RVW-T07 — mỗi view (mua vào/bán ra) đọc từ map RIÊNG: đảo nhầm nhánh purchase<->sold thì test đỏ.
test("chọn đúng view theo chiều: purchase đọc vct60view, sold đọc vct50view — không lẫn nhánh", async () => {
  layGoiTraGdt.current = [{ id: "hd-1", tthai: "1" }];
  const daGan = [{ hoa_don_id: "hd-1", ke_khai: true, chi_tieu_tang_giam: null }];
  const { db } = taoDbGia(daGan, {
    purchase: new Map([["hd-1", { nguon: "mua" }]]),
    sold: new Map([["hd-1", { nguon: "ban" }]]),
  });

  const muaVao = await layBangKeChiTietTheoKy(db, KY, "purchase");
  const banRa = await layBangKeChiTietTheoKy(db, KY, "sold");

  assert.deepEqual(muaVao.datas[0].chiTiet, { nguon: "mua", __normalized: true });
  assert.deepEqual(banRa.datas[0].chiTiet, { nguon: "ban", __normalized: true });
});

test("mọi phần tử đều có key chiTiet tường minh, kể cả khi detail null", async () => {
  layGoiTraGdt.current = [{ id: "hd-1", tthai: "1" }];
  const { db } = taoDbGia([{ hoa_don_id: "hd-1", ke_khai: true, chi_tieu_tang_giam: "" }]);

  const kq = await layBangKeChiTietTheoKy(db, KY, "sold");

  assert.equal("chiTiet" in kq.datas[0], true);
  assert.equal(kq.datas[0].chiTiet, null);
});

test("hóa đơn ĐÃ BỊ THAY THẾ (tthai=4) không lọt vào datas — kế thừa duocTinh từ layBangKeTheoKy", async () => {
  layGoiTraGdt.current = [
    { id: "hd-thaythe", tthai: "4" },
    { id: "hd-binhthuong", tthai: "1" },
  ];
  const { db } = taoDbGia([
    { hoa_don_id: "hd-thaythe", ke_khai: true, chi_tieu_tang_giam: null },
    { hoa_don_id: "hd-binhthuong", ke_khai: true, chi_tieu_tang_giam: null },
  ]);

  const kq = await layBangKeChiTietTheoKy(db, KY, "purchase");

  assert.deepEqual(kq.datas.map((d) => d.id), ["hd-binhthuong"]);
});

test("hóa đơn ĐÃ BỊ HỦY (tthai=6) không lọt vào datas", async () => {
  layGoiTraGdt.current = [{ id: "hd-huy", tthai: "6" }];
  const { db } = taoDbGia([{ hoa_don_id: "hd-huy", ke_khai: true, chi_tieu_tang_giam: null }]);

  const kq = await layBangKeChiTietTheoKy(db, KY, "sold");

  assert.deepEqual(kq.datas, []);
});

test("hóa đơn 'Không kê khai' (keKhai=false) vẫn có mặt ở datas kèm chiTiet", async () => {
  layGoiTraGdt.current = [{ id: "hd-1", tthai: "1" }];
  const { db } = taoDbGia(
    [{ hoa_don_id: "hd-1", ke_khai: false, chi_tieu_tang_giam: "" }],
    { purchase: new Map([["hd-1", { hdhhdvu: [] }]]) },
  );

  const kq = await layBangKeChiTietTheoKy(db, KY, "purchase");

  assert.equal(kq.datas.length, 1);
  assert.equal(kq.datas[0].keKhai, false);
  assert.deepEqual(kq.datas[0].chiTiet, { hdhhdvu: [], __normalized: true });
});

test("đọc detail theo lô <= 1.000 id: 1001 hóa đơn -> 2 lượt gọi findMany (1000 + 1)", async () => {
  const ids = Array.from({ length: 1001 }, (_, i) => `hd-${i}`);
  layGoiTraGdt.current = ids.map((id) => ({ id, tthai: "1" }));
  const { db, loGoi } = taoDbGia(ids.map((id) => ({ hoa_don_id: id, ke_khai: true, chi_tieu_tang_giam: null })));

  const kq = await layBangKeChiTietTheoKy(db, KY, "purchase");

  assert.equal(kq.datas.length, 1001);
  assert.equal(loGoi.length, 2);
  assert.equal(loGoi[0].length, 1000);
  assert.equal(loGoi[1].length, 1);
});
