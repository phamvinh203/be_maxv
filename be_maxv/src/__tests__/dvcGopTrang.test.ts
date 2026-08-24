import { test } from "node:test";
import assert from "node:assert/strict";
import { gopCacTrangHoSo, type TrangHoSo } from "../services/client/dich_vu_cong/hoSoHtml";

/**
 * Test VÒNG GỘP TRANG của tra cứu hồ sơ DVC — phần quyết định dòng nào sống sót.
 *
 * Đây là chỗ đáng khóa nhất của cả lượt vá: lỗi gốc là "mất dòng mà không ai biết", nên mọi điều
 * kiện dừng và cơ chế chống trùng phải có test. `layTrang` là hàm giả nên KHÔNG đụng cổng.
 *
 *   npx tsx --test src/__tests__/dvcGopTrang.test.ts
 */

const HEADERS = ["STT", "Mã hồ sơ", "Tờ khai"];
const SIZE = 3;

/** Trang giả: `n` dòng, mã hồ sơ đánh số từ `tu`. */
function trang(tu: number, n: number, phanTrang: TrangHoSo["phanTrang"]): TrangHoSo {
  return {
    bang: {
      headers: HEADERS,
      rows: Array.from({ length: n }, (_, i) => [String(tu + i), `HS-${tu + i}`, "01/GTGT"]),
    },
    phanTrang,
  };
}

const CO_PAGER = (tongSoBanGhi: number, tongSoTrang: number) => ({ tongSoBanGhi, tongSoTrang });
const KHONG_PAGER = { tongSoBanGhi: null, tongSoTrang: null };

const maCua = (r: { rows: string[][] }) => r.rows.map((x) => x[1]);

test("gộp đủ 2 trang theo totalPage cổng khai", async () => {
  const trangs = [trang(1, 3, CO_PAGER(5, 2)), trang(4, 2, CO_PAGER(5, 2))];
  const r = await gopCacTrangHoSo((p) => Promise.resolve(trangs[p - 1]!), { size: SIZE });

  assert.deepEqual(maCua(r), ["HS-1", "HS-2", "HS-3", "HS-4", "HS-5"]);
  assert.equal(r.tongSoBanGhi, 5);
});

test("CỔNG LỜ THAM SỐ page (trả lại y hệt trang 1) -> không nhân bản, dừng ngay", async () => {
  // Kiểu hỏng NGƯỢC với lỗi gốc và khó thấy hơn: cứ nối vào là ra 6 dòng cho 3 bản ghi.
  let goi = 0;
  const r = await gopCacTrangHoSo(
    () => {
      goi++;
      return Promise.resolve(trang(1, 3, CO_PAGER(6, 2)));
    },
    { size: SIZE },
  );

  assert.deepEqual(maCua(r), ["HS-1", "HS-2", "HS-3"], "không được có dòng trùng");
  assert.equal(goi, 2, "xin trang 2 một lần rồi thấy không có gì mới thì dừng");
});

test("KHÔNG đọc được pager + trang ĐẦY -> vẫn xin tiếp (đúng lỗi gốc phải tránh)", async () => {
  const trangs = [
    trang(1, 3, KHONG_PAGER), // đầy -> còn nữa
    trang(4, 3, KHONG_PAGER), // đầy -> còn nữa
    trang(7, 1, KHONG_PAGER), // hụt -> hết
  ];
  const r = await gopCacTrangHoSo((p) => Promise.resolve(trangs[p - 1]!), { size: SIZE });

  assert.equal(r.rows.length, 7);
  assert.equal(r.tongSoBanGhi, null, "không bịa ra tổng khi cổng không khai");
});

test("KHÔNG đọc được pager + trang HỤT -> dừng luôn, không xin thừa", async () => {
  let goi = 0;
  await gopCacTrangHoSo(
    (p) => {
      goi++;
      return Promise.resolve(trang(1, 2, KHONG_PAGER));
    },
    { size: SIZE },
  );
  assert.equal(goi, 1);
});

test("cột đổi giữa chừng -> dừng, KHÔNG gộp dữ liệu lệch cột", async () => {
  const lech: TrangHoSo = {
    bang: { headers: ["Mã hồ sơ", "STT"], rows: [["HS-9", "9"]] },
    phanTrang: CO_PAGER(6, 2),
  };
  const trangs = [trang(1, 3, CO_PAGER(6, 2)), lech];
  const r = await gopCacTrangHoSo((p) => Promise.resolve(trangs[p - 1]!), { size: SIZE });

  assert.deepEqual(maCua(r), ["HS-1", "HS-2", "HS-3"]);
});

test("daBiThay -> dừng ngay, không tiêu thêm request cổng", async () => {
  let goi = 0;
  const r = await gopCacTrangHoSo(
    (p) => {
      goi++;
      return Promise.resolve(trang(1 + (p - 1) * 3, 3, CO_PAGER(99, 33)));
    },
    { size: SIZE, daBiThay: () => goi >= 2 },
  );
  assert.equal(goi, 2, "kiểm ở ĐẦU vòng nên lượt thứ 3 không được gọi");
  assert.equal(r.rows.length, 6);
});

test("chạm trần maxTrang -> dừng, trả những gì đã gộp", async () => {
  let goi = 0;
  const r = await gopCacTrangHoSo(
    (p) => {
      goi++;
      return Promise.resolve(trang(1 + (p - 1) * 3, 3, CO_PAGER(999, 333)));
    },
    { size: SIZE, maxTrang: 4 },
  );
  assert.equal(goi, 4);
  assert.equal(r.rows.length, 12);
  assert.equal(r.tongSoBanGhi, 999, "giữ số cổng khai để nơi gọi biết là còn thiếu");
});

test("không có hồ sơ nào -> rỗng, không ném", async () => {
  const r = await gopCacTrangHoSo(
    () => Promise.resolve({ bang: { headers: [], rows: [] }, phanTrang: KHONG_PAGER }),
    { size: SIZE },
  );
  assert.deepEqual(r, { headers: [], rows: [], tongSoBanGhi: null });
});

test("dòng thiếu ô Mã hồ sơ vẫn được giữ (chỉ không chống trùng được cho nó)", async () => {
  const r = await gopCacTrangHoSo(
    () =>
      Promise.resolve({
        bang: { headers: HEADERS, rows: [["1", "", "01/GTGT"]] },
        phanTrang: KHONG_PAGER,
      }),
    { size: SIZE },
  );
  assert.equal(r.rows.length, 1);
});

test("cổng ÉP cỡ trang nhỏ hơn số xin -> vẫn lấy đủ theo cỡ thực tế", async () => {
  // Xin size=3 nhưng cổng chỉ trả 2/trang và pager nói có 3 trang. Nếu so với số ĐÃ XIN thì
  // `2 < 3` -> dừng ngay trang 1, mất 4 dòng. Phải hiệu chuẩn theo cỡ cổng thực dùng.
  const trangs = [
    trang(1, 2, CO_PAGER(6, 3)),
    trang(3, 2, CO_PAGER(6, 3)),
    trang(5, 2, CO_PAGER(6, 3)),
  ];
  const r = await gopCacTrangHoSo((p) => Promise.resolve(trangs[p - 1]!), { size: SIZE });

  assert.deepEqual(maCua(r), ["HS-1", "HS-2", "HS-3", "HS-4", "HS-5", "HS-6"]);
});

test("bảng nguồn ETAX (cột 'Mã giao dịch') vẫn chống trùng được", async () => {
  // Vòng gộp chống trùng bằng cột "Mã hồ sơ". Bảng ETAX thô gọi cột đó là "Mã giao dịch", nên nếu
  // chuẩn hoá tên cột xảy ra SAU vòng gộp thì mọi dòng có mã rỗng và chống trùng câm hoàn toàn —
  // cổng lờ `page` là nhân bản dữ liệu mà `thieuHoSo` vẫn báo 0. `traCuuHoSo` chuẩn hoá ngay trong
  // callback lấy trang chính là để tránh chuyện đó.
  const H = ["STT", "Mã hồ sơ", "Ngày nộp"];
  const rows = [["1", "HS-1", "x"], ["2", "HS-2", "x"], ["3", "HS-3", "x"]];
  const r = await gopCacTrangHoSo(
    () => Promise.resolve({ bang: { headers: H, rows }, phanTrang: CO_PAGER(9, 3) }),
    { size: 3 },
  );
  assert.equal(r.rows.length, 3, "cổng trả lại y hệt mỗi trang -> phải dừng ở 3 dòng");
});
