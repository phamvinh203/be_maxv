import { test } from "node:test";
import assert from "node:assert/strict";
import {
  khoangCuaKy,
  kyHopLe,
  kyLienTruoc,
  nhanKy,
  thangKetThuc,
  truocKy,
} from "../services/client/to_khai/kySoThue";

/** npx tsx --test src/__tests__/kySoThue.test.ts */

test("kỳ tháng ra đúng khoảng ngày", () => {
  assert.deepEqual(khoangCuaKy({ nam: 2026, kyLoai: "thang", kySo: 7 }), {
    tuNgay: "2026-07-01",
    denNgay: "2026-07-31",
  });
});

test("tháng 2 năm nhuận ra ngày 29", () => {
  assert.equal(khoangCuaKy({ nam: 2024, kyLoai: "thang", kySo: 2 }).denNgay, "2024-02-29");
});

test("tháng 2 năm thường ra ngày 28", () => {
  assert.equal(khoangCuaKy({ nam: 2026, kyLoai: "thang", kySo: 2 }).denNgay, "2026-02-28");
});

test("tháng 12 không tràn sang năm sau", () => {
  assert.deepEqual(khoangCuaKy({ nam: 2026, kyLoai: "thang", kySo: 12 }), {
    tuNgay: "2026-12-01",
    denNgay: "2026-12-31",
  });
});

test("kỳ quý ra đúng ba tháng", () => {
  assert.deepEqual(khoangCuaKy({ nam: 2026, kyLoai: "quy", kySo: 3 }), {
    tuNgay: "2026-07-01",
    denNgay: "2026-09-30",
  });
});

test("quý 1 và quý 4 đúng biên", () => {
  assert.deepEqual(khoangCuaKy({ nam: 2026, kyLoai: "quy", kySo: 1 }), {
    tuNgay: "2026-01-01",
    denNgay: "2026-03-31",
  });
  assert.deepEqual(khoangCuaKy({ nam: 2026, kyLoai: "quy", kySo: 4 }), {
    tuNgay: "2026-10-01",
    denNgay: "2026-12-31",
  });
});

test("kỳ ngoài biên bị chặn", () => {
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "thang", kySo: 13 }), false);
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "thang", kySo: 0 }), false);
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "quy", kySo: 5 }), false);
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "quy", kySo: 4 }), true);
  assert.equal(kyHopLe({ nam: 1999, kyLoai: "thang", kySo: 1 }), false);
  assert.equal(kyHopLe({ nam: 2026, kyLoai: "nam" as never, kySo: 1 }), false);
});

test("nhãn kỳ", () => {
  assert.equal(nhanKy({ nam: 2026, kyLoai: "thang", kySo: 7 }), "T7/2026");
  assert.equal(nhanKy({ nam: 2026, kyLoai: "quy", kySo: 3 }), "Q3/2026");
});

test("kỳ liền trước trong cùng năm", () => {
  assert.deepEqual(kyLienTruoc({ nam: 2026, kyLoai: "thang", kySo: 7 }), {
    nam: 2026,
    kyLoai: "thang",
    kySo: 6,
  });
  assert.deepEqual(kyLienTruoc({ nam: 2026, kyLoai: "quy", kySo: 3 }), {
    nam: 2026,
    kyLoai: "quy",
    kySo: 2,
  });
});

test("kỳ đầu năm lùi về kỳ cuối năm trước", () => {
  // Nối [22] của T1 phải lấy [43] của T12 NĂM TRƯỚC — sai chỗ này là số khấu trừ chuyển kỳ đứt đoạn.
  assert.deepEqual(kyLienTruoc({ nam: 2026, kyLoai: "thang", kySo: 1 }), {
    nam: 2025,
    kyLoai: "thang",
    kySo: 12,
  });
  assert.deepEqual(kyLienTruoc({ nam: 2026, kyLoai: "quy", kySo: 1 }), {
    nam: 2025,
    kyLoai: "quy",
    kySo: 4,
  });
});

/* ===== Mốc so kỳ tháng <-> kỳ quý (thêm 2026-09-02) ===== */

test("Q4/2025 kết thúc ngay trước T1/2026 — nối [22] được", () => {
  assert.equal(truocKy({ nam: 2025, kyLoai: "quy", kySo: 4 }, { nam: 2026, kyLoai: "thang", kySo: 1 }), true);
});

test("T12/2025 cũng nối được sang Q1/2026", () => {
  assert.equal(truocKy({ nam: 2025, kyLoai: "thang", kySo: 12 }, { nam: 2026, kyLoai: "quy", kySo: 1 }), true);
});

test("T1/2026 KHÔNG phải kỳ trước của Q1/2026 — nó nằm TRONG quý đó", () => {
  assert.equal(truocKy({ nam: 2026, kyLoai: "thang", kySo: 1 }, { nam: 2026, kyLoai: "quy", kySo: 1 }), false);
});

test("Q1/2026 không nối ngược vào T1/2026", () => {
  assert.equal(truocKy({ nam: 2026, kyLoai: "quy", kySo: 1 }, { nam: 2026, kyLoai: "thang", kySo: 1 }), false);
});

test("cùng loại vẫn đúng: Q1 trước Q2, T6 trước T7", () => {
  assert.equal(truocKy({ nam: 2026, kyLoai: "quy", kySo: 1 }, { nam: 2026, kyLoai: "quy", kySo: 2 }), true);
  assert.equal(truocKy({ nam: 2026, kyLoai: "thang", kySo: 6 }, { nam: 2026, kyLoai: "thang", kySo: 7 }), true);
  assert.equal(truocKy({ nam: 2026, kyLoai: "quy", kySo: 2 }, { nam: 2026, kyLoai: "quy", kySo: 1 }), false);
});

test("Q4/2025 và T12/2025 cùng mốc kết thúc", () => {
  assert.equal(
    thangKetThuc({ nam: 2025, kyLoai: "quy", kySo: 4 }),
    thangKetThuc({ nam: 2025, kyLoai: "thang", kySo: 12 }),
  );
});
