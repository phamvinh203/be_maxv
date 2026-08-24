import { test } from "node:test";
import assert from "node:assert/strict";
import { chuanHoaMime, doanContentType } from "../services/client/dich_vu_cong/gdt-dvc.service";
import { xmlToKhaiDangChuoi } from "../services/client/dich_vu_cong/dvc-dong-bo.service";

/**
 * Test đoán MIME cho DÒNG CACHE CŨ của `dvc_tai_lieu` — dòng ghi trước khi có cột `content_type`
 * nên chỉ còn tên file để lần. Dòng ghi từ nay luôn có `content_type` thật cổng khai, không đi qua
 * hàm này. Phần đụng Postgres (đọc/ghi `noi_dung_bin`) không test được ở đây, cùng giới hạn đã ghi
 * ở `companyDelete.test.ts`.
 *
 *   npx tsx --test src/__tests__/dvcTaiLieu.test.ts
 */

test("doanContentType: nhận đúng các định dạng cổng thật sự trả", () => {
  assert.equal(doanContentType("thong-bao-123.xml"), "application/xml");
  assert.equal(doanContentType("QDinh_0106861880.pdf"), "application/pdf");
  assert.equal(doanContentType("hoso.zip"), "application/zip");
});

test("doanContentType: đuôi VIẾT HOA vẫn nhận (cổng đặt tên không nhất quán)", () => {
  assert.equal(doanContentType("THONGBAO.PDF"), "application/pdf");
  assert.equal(doanContentType("ToKhai.XML"), "application/xml");
});

test("doanContentType: chỉ xét đoạn sau dấu chấm CUỐI, không phải dấu chấm đầu", () => {
  assert.equal(doanContentType("01.GTGT.Q2.2026.pdf"), "application/pdf");
});

test("doanContentType: không biết -> octet-stream (tải về, không mở sai kiểu)", () => {
  assert.equal(doanContentType("khong-co-duoi"), "application/octet-stream");
  assert.equal(doanContentType("la.abcxyz"), "application/octet-stream");
  assert.equal(doanContentType(null), "application/octet-stream");
});

// ---------------- chuanHoaMime: cổng khai `fileType` bằng ĐUÔI, không phải MIME ----------------

test("chuanHoaMime: đuôi cổng gửi -> MIME thật (lỗi phát hiện khi đồng bộ thật)", () => {
  // Gói tệp JSON của cổng trả `fileType: "xml"`. Gán thẳng vào `reply.type()` ra header
  // `Content-Type: xml` vô nghĩa; với "pdf" thì FE bóc đuôi từ content-type không khớp và
  // lưu PDF thành `.xml`.
  assert.equal(chuanHoaMime("xml"), "application/xml");
  assert.equal(chuanHoaMime("pdf"), "application/pdf");
  assert.equal(chuanHoaMime("zip"), "application/zip");
});

test("chuanHoaMime: giá trị ĐÃ là MIME thì giữ nguyên", () => {
  assert.equal(chuanHoaMime("application/pdf"), "application/pdf");
  assert.equal(chuanHoaMime("text/xml"), "text/xml");
});

test("chuanHoaMime: rỗng/không nhận ra -> octet-stream", () => {
  assert.equal(chuanHoaMime(""), "application/octet-stream");
  assert.equal(chuanHoaMime(null), "application/octet-stream");
  assert.equal(chuanHoaMime("la-gi-day"), "application/octet-stream");
});

// ---------------- xmlToKhaiDangChuoi: chan chi tieu bia tu file khong phai XML ----------------

const XML = '<?xml version="1.0"?><ct22>123</ct22>';

test("xmlToKhaiDangChuoi: dòng nhị phân XML -> giải mã ra chuỗi", () => {
  assert.equal(
    xmlToKhaiDangChuoi({
      xml_to_khai_bin: new Uint8Array(Buffer.from(XML, "utf8")),
      content_type: "application/xml",
      xml_to_khai: null,
      ten_file_xml: "to-khai.xml",
    }),
    XML,
  );
});

test("xmlToKhaiDangChuoi: file KHÔNG phải XML -> null, không bóc chỉ tiêu bịa", () => {
  // Bóc regex trên chuỗi rác vẫn chạy và vẫn có thể vớ trúng thứ gì đó -> cột chỉ tiêu trên
  // bảng tìm kiếm hiện số không có thật. Thà để trống.
  for (const ct of ["application/pdf", "application/zip", "application/octet-stream"]) {
    assert.equal(
      xmlToKhaiDangChuoi({
        xml_to_khai_bin: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        content_type: ct,
        xml_to_khai: null,
        ten_file_xml: "to-khai.pdf",
      }),
      null,
      `phải từ chối ${ct}`,
    );
  }
});

test("xmlToKhaiDangChuoi: dòng nhị phân thiếu content_type -> đoán theo đuôi tên file", () => {
  const bin = new Uint8Array(Buffer.from(XML, "utf8"));
  assert.equal(
    xmlToKhaiDangChuoi({ xml_to_khai_bin: bin, content_type: null, xml_to_khai: null, ten_file_xml: "a.xml" }),
    XML,
  );
  assert.equal(
    xmlToKhaiDangChuoi({ xml_to_khai_bin: bin, content_type: null, xml_to_khai: null, ten_file_xml: "a.pdf" }),
    null,
  );
});

test("xmlToKhaiDangChuoi: dòng cache CŨ (chỉ cột Text) vẫn đọc được", () => {
  assert.equal(
    xmlToKhaiDangChuoi({
      xml_to_khai_bin: null,
      content_type: null,
      xml_to_khai: XML,
      ten_file_xml: "cu.xml",
    }),
    XML,
  );
});

test("xmlToKhaiDangChuoi: chưa tải gì -> null", () => {
  assert.equal(
    xmlToKhaiDangChuoi({ xml_to_khai_bin: null, content_type: null, xml_to_khai: null, ten_file_xml: null }),
    null,
  );
});
