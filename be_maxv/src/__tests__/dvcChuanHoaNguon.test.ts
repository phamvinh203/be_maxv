import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chuanHoaBangTheoNguon,
  oTheoTieuDe,
  type BangHoSoDaBoc,
} from "../services/client/dich_vu_cong/hoSoHtml";

/**
 * Test CHUẨN HOÁ TÊN CỘT theo nguồn.
 *
 * `dongBoMotDoan` đọc ô theo TÊN cột (`oTheoTieuDe`), mà tab Thuế điện tử đặt tên khác hẳn tab
 * Dịch vụ công — không ánh xạ thì mọi ô đọc ra rỗng và hồ sơ lưu xuống trống trơn.
 *
 *   npx tsx --test src/__tests__/dvcChuanHoaNguon.test.ts
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
  tongSoBanGhi: 10,
};

const o = (b: BangHoSoDaBoc, cot: string) => oTheoTieuDe(b.headers, b.rows[0]!, cot);

test("nguồn TDT: đổi cả 5 tên cột lệch về tên chuẩn của DVC", () => {
  const r = chuanHoaBangTheoNguon(BANG_TDT, "tdt");
  assert.equal(o(r, "Mã hồ sơ"), "11320250320068493");
  assert.equal(o(r, "Tờ khai"), "Tờ khai khấu trừ TNCN (TT80)");
  assert.equal(o(r, "Lần nộp bổ sung"), "0");
  assert.equal(o(r, "Cơ quan thuế tiếp nhận"), "Thuế cơ sở 5 Hà Nội");
  assert.equal(o(r, "Trạng thái"), "Đã chấp nhận");
});

test("cột nguồn TDT không có tên tương ứng thì GIỮ NGUYÊN, không bị cắt", () => {
  const r = chuanHoaBangTheoNguon(BANG_TDT, "tdt");
  // "STT"/"Thao tác" không nằm trong bảng đổi tên — phải còn, vì `raw` lưu nguyên dòng cổng trả để
  // FE hiện được cột mới mà không cần migration.
  assert.ok(r.headers.includes("STT"));
  assert.ok(r.headers.includes("Thao tác"));
  assert.equal(r.headers.length, BANG_TDT.headers.length);
});

test("cột ETAX KHÔNG có (Tên TTHC) -> đọc ra rỗng, không phải undefined", () => {
  // `oTheoTieuDe` trả "" cho cột vắng mặt, nên không cần độn cột rỗng vào bảng.
  assert.equal(o(chuanHoaBangTheoNguon(BANG_TDT, "tdt"), "Tên TTHC"), "");
});

test("giữ `tongSoBanGhi` để nơi gọi còn đối chiếu được", () => {
  assert.equal(chuanHoaBangTheoNguon(BANG_TDT, "tdt").tongSoBanGhi, 10);
});

test("nguồn DVC: trả về NGUYÊN bảng, không đụng gì", () => {
  const bang: BangHoSoDaBoc = { headers: ["Mã hồ sơ"], rows: [["G12.18-1"]] };
  assert.equal(chuanHoaBangTheoNguon(bang, "dvc"), bang);
});
