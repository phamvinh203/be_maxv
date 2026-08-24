import { test } from "node:test";
import assert from "node:assert/strict";
import {
  duongDanChiTiet,
  pathChiTiet,
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

test("pathChiTiet: cùng đuôi nhưng KHÔNG có host (dvcSend nhận path tương đối)", () => {
  assert.equal(pathChiTiet("11320250320068493", "tdt"), "/tchs/files/detail/11320250320068493?loai=ETAX");
  assert.equal(duongDanChiTiet("x", "dvc"), `https://dichvucong.gdt.gov.vn/tthc${pathChiTiet("x", "dvc")}`);
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
