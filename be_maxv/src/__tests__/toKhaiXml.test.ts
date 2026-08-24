import { test } from "node:test";
import assert from "node:assert/strict";
import { layChiTietToKhai, layChiTieuToKhaiGtgt } from "../services/client/dich_vu_cong/toKhaiXml";

/**
 * npx tsx --test src/__tests__/toKhaiXml.test.ts
 *
 * XML mẫu 01/GTGT dưới đây là DỮ LIỆU THẬT (hồ sơ Quý 2/2026, MST 0106200129, tải qua cột "Tải
 * file" rồi người dùng gửi lại để đối chiếu — không phải xml tự bịa) — mọi chỉ tiêu ở đây khớp
 * ĐÚNG với ảnh chụp mẫu in của iTaxViewer, kể cả dấu âm ct36.
 */
const XML_GTGT01 = `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">
  <HSoKhaiThue id="ID_1">
    <TTinChung>
      <TTinDVu>
        <maDVu>HTKK</maDVu>
        <tenDVu>HỖ TRỢ KÊ KHAI THUẾ</tenDVu>
      </TTinDVu>
      <TTinTKhaiThue>
        <TKhaiThue>
          <maTKhai>842</maTKhai>
          <tenTKhai>TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)</tenTKhai>
          <moTaBMau>(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính)</moTaBMau>
          <soLan>0</soLan>
          <KyKKhaiThue>
            <kieuKy>Q</kieuKy>
            <kyKKhai>2/2026</kyKKhai>
          </KyKKhaiThue>
          <tenCQTNoiNop>Thuế cơ sở 5 Thành phố Hà Nội</tenCQTNoiNop>
          <nguoiKy>Nguyễn Văn Thanh</nguoiKy>
          <ngayKy>2026-07-29</ngayKy>
        </TKhaiThue>
        <NNT>
          <mst>0106200129</mst>
          <tenNNT>Công ty Cổ phần Phần mềm Maxv Việt Nam</tenNNT>
        </NNT>
      </TTinTKhaiThue>
    </TTinChung>
    <CTieuTKhaiChinh>
      <ten_NganhNghe>Hoạt động sản xuất kinh doanh thông thường</ten_NganhNghe>
      <ct21>0</ct21>
      <ct22>29826193</ct22>
      <GiaTriVaThueGTGTHHDVMuaVao>
        <ct23>16673369</ct23>
        <ct24>1446670</ct24>
      </GiaTriVaThueGTGTHHDVMuaVao>
      <HangHoaDichVuNhapKhau>
        <ct23a>0</ct23a>
        <ct24a>0</ct24a>
      </HangHoaDichVuNhapKhau>
      <ct25>1446670</ct25>
      <ct26>354650000</ct26>
      <HHDVBRaChiuThueGTGT>
        <ct27>0</ct27>
        <ct28>0</ct28>
      </HHDVBRaChiuThueGTGT>
      <ct29>0</ct29>
      <HHDVBRaChiuTSuat5>
        <ct30>0</ct30>
        <ct31>0</ct31>
      </HHDVBRaChiuTSuat5>
      <HHDVBRaChiuTSuat10>
        <ct32>0</ct32>
        <ct33>0</ct33>
      </HHDVBRaChiuTSuat10>
      <ct32a>0</ct32a>
      <TongDThuVaThueGTGTHHDVBRa>
        <ct34>354650000</ct34>
        <ct35>0</ct35>
      </TongDThuVaThueGTGTHHDVBRa>
      <ct36>-1446670</ct36>
      <ct37>0</ct37>
      <ct38>0</ct38>
      <ct39a>0</ct39a>
      <ct40a>0</ct40a>
      <ct40b>0</ct40b>
      <ct40>0</ct40>
      <ct41>31272863</ct41>
      <ct42>0</ct42>
      <ct43>31272863</ct43>
    </CTieuTKhaiChinh>
  </HSoKhaiThue>
<CKyDTu><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><KeyInfo><X509Data><X509SubjectName>OID.0.9.2342.19200300.100.1.1=MST:0106200129, CN=CÔNG TY CỔ PHẦN PHẦN MỀM MAXV VIỆT NAM, O=CÔNG TY CỔ PHẦN PHẦN MỀM MAXV VIỆT NAM, S=Hà Nội, C=VN</X509SubjectName></X509Data></KeyInfo><Object><SignatureProperties xmlns=""><SignatureProperty xmlns=""><SigningTime xmlns="">2026-07-29T06:56:37</SigningTime></SignatureProperty></SignatureProperties></Object></Signature></CKyDTu></HSoThueDTu>
`;

test("layChiTietToKhai: mẫu 01/GTGT -> loai=gtgt01, đủ chỉ tiêu đúng số liệu thật", () => {
  const ket = layChiTietToKhai(XML_GTGT01);
  assert.equal(ket.loai, "gtgt01");
  if (ket.loai !== "gtgt01") return; // narrow cho TypeScript

  assert.equal(ket.duLieu.tenNNT, "Công ty Cổ phần Phần mềm Maxv Việt Nam");
  assert.equal(ket.duLieu.mst, "0106200129");
  assert.equal(ket.duLieu.kyTinhThue, "Quý 2 năm 2026");
  assert.equal(ket.duLieu.laLanDau, true);
  assert.equal(ket.duLieu.nguoiKy, "Nguyễn Văn Thanh");
  assert.equal(ket.duLieu.kyDienTuBoi, "CÔNG TY CỔ PHẦN PHẦN MỀM MAXV VIỆT NAM");
  assert.equal(ket.duLieu.ngayKyDienTu, "2026-07-29T06:56:37");

  // Chỉ tiêu tiền — đối chiếu ĐÚNG với ảnh chụp mẫu in.
  assert.equal(ket.duLieu.ct.ct22, 29826193);
  assert.equal(ket.duLieu.ct.ct23, 16673369);
  assert.equal(ket.duLieu.ct.ct24, 1446670);
  assert.equal(ket.duLieu.ct.ct25, 1446670);
  assert.equal(ket.duLieu.ct.ct26, 354650000);
  assert.equal(ket.duLieu.ct.ct34, 354650000);
  assert.equal(ket.duLieu.ct.ct36, -1446670); // ÂM — lưu sẵn trong xml, không tự suy công thức
  assert.equal(ket.duLieu.ct.ct41, 31272863);
  assert.equal(ket.duLieu.ct.ct43, 31272863);
});

test("layChiTietToKhai: mẫu chưa biết layout -> loai=raw, liệt kê tên thẻ thô", () => {
  const xml = "<HSoKhaiThue><mst>0106200129</mst><tenNNT>CÔNG TY ABC</tenNNT></HSoKhaiThue>";
  const ket = layChiTietToKhai(xml);
  assert.equal(ket.loai, "raw");
  if (ket.loai !== "raw") return;
  assert.deepEqual(ket.chiTieu, [
    { nhan: "mst", giaTri: "0106200129" },
    { nhan: "tenNNT", giaTri: "CÔNG TY ABC" },
  ]);
});

test("layChiTietToKhai: thẻ cha lồng thẻ con -> bỏ qua thẻ cha, chỉ lấy thẻ lá", () => {
  const xml = "<HSoKhaiThue><CtietPLuc><ten>A</ten><tien>100</tien></CtietPLuc></HSoKhaiThue>";
  const ket = layChiTietToKhai(xml);
  assert.equal(ket.loai, "raw");
  if (ket.loai !== "raw") return;
  assert.deepEqual(ket.chiTieu, [
    { nhan: "ten", giaTri: "A" },
    { nhan: "tien", giaTri: "100" },
  ]);
});

test("layChiTietToKhai: thẻ rỗng bị bỏ qua (không liệt kê giá trị rỗng)", () => {
  const xml = "<HSoKhaiThue><a></a><b>x</b></HSoKhaiThue>";
  const ket = layChiTietToKhai(xml);
  assert.equal(ket.loai, "raw");
  if (ket.loai !== "raw") return;
  assert.deepEqual(ket.chiTieu, [{ nhan: "b", giaTri: "x" }]);
});

test("layChiTietToKhai: thẻ mở có thuộc tính vẫn khớp được", () => {
  const xml = '<HSoKhaiThue><ten dtype="string">A</ten></HSoKhaiThue>';
  const ket = layChiTietToKhai(xml);
  assert.equal(ket.loai, "raw");
  if (ket.loai !== "raw") return;
  assert.deepEqual(ket.chiTieu, [{ nhan: "ten", giaTri: "A" }]);
});

test("layChiTieuToKhaiGtgt: giữ nguyên hành vi cũ (bảng cột GTGT ở BangHoSo vẫn dùng hàm này)", () => {
  const m = layChiTieuToKhaiGtgt(XML_GTGT01);
  assert.equal(m["Khấu trừ kỳ trước"], "29826193");
  assert.equal(m["Khấu trừ kỳ này"], "1446670");
});

/**
 * XML 05/KK-TNCN dưới đây là XML TỰ DỰNG tối thiểu, KHÁC HẲN `XML_GTGT01` ở trên (dữ liệu thật) —
 * chỉ dùng để kiểm tra phần LOGIC mình tự viết được: nhận diện mẫu qua `tenTKhai`, và bộ lọc dải
 * `ct16`..`ct32`. Con số lấy theo ảnh chụp mẫu in người dùng gửi (Quý 3/2025, MST 0106200129).
 *
 * KHÔNG dùng file này để kết luận tên thẻ địa chỉ/đại lý thuế là đúng — những thẻ đó chưa đối
 * chiếu được với hồ sơ thật, xem chú thích ở `layChiTietTncn05`.
 */
const XML_TNCN05 = `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu>
  <HSoKhaiThue>
    <TTinChung><TTinTKhaiThue>
      <TKhaiThue>
        <maTKhai>999</maTKhai>
        <tenTKhai>TK KHẤU TRỪ THUẾ THU NHẬP CÁ NHÂN MẪU 05/KK-TNCN (TT80/2021)</tenTKhai>
        <soLan>0</soLan>
        <KyKKhaiThue><kieuKy>Q</kieuKy><kyKKhai>3/2025</kyKKhai></KyKKhaiThue>
        <nguoiKy>Nguyễn Văn Thanh</nguoiKy>
        <ngayKy>2025-10-29</ngayKy>
      </TKhaiThue>
      <NNT><mst>0106200129</mst><tenNNT>Công ty Cổ phần Phần mềm Maxv Việt Nam</tenNNT></NNT>
    </TTinTKhaiThue></TTinChung>
    <CTieuTKhaiChinh>
      <ct15>0</ct15>
      <ct16>4</ct16>
      <ct17>4</ct17>
      <ct18>0</ct18>
      <ct21>105000000</ct21>
      <ct22>105000000</ct22>
      <ct23>0</ct23>
      <ct32>0</ct32>
      <ct33>123</ct33>
    </CTieuTKhaiChinh>
  </HSoKhaiThue>
</HSoThueDTu>`;

test("layChiTietToKhai: nhận diện 05/KK-TNCN qua tenTKhai (không cần biết maTKhai)", () => {
  const ket = layChiTietToKhai(XML_TNCN05);
  assert.equal(ket.loai, "tncn05");
  if (ket.loai !== "tncn05") return;

  assert.equal(ket.duLieu.kyTinhThue, "Quý 3 năm 2025");
  assert.equal(ket.duLieu.laLanDau, true);
  assert.equal(ket.duLieu.mst, "0106200129");
  assert.equal(ket.duLieu.nguoiKy, "Nguyễn Văn Thanh");
  assert.equal(ket.duLieu.ngayKy, "2025-10-29");
});

test("layChiTietToKhai: 05/KK-TNCN chỉ lấy ct16..ct32, bỏ thẻ ngoài dải", () => {
  const ket = layChiTietToKhai(XML_TNCN05);
  assert.equal(ket.loai, "tncn05");
  if (ket.loai !== "tncn05") return;

  assert.equal(ket.duLieu.ct.ct16, 4);
  assert.equal(ket.duLieu.ct.ct17, 4);
  assert.equal(ket.duLieu.ct.ct21, 105000000);
  assert.equal(ket.duLieu.ct.ct22, 105000000);
  // Giữ số 0 (khác "không có chỉ tiêu") — mẫu in luôn hiện đủ ô.
  assert.equal(ket.duLieu.ct.ct18, 0);
  assert.equal(ket.duLieu.ct.ct32, 0);
  // Ngoài dải [16]..[32] -> KHÔNG được lọt vào, dù cũng là thẻ dạng ctNN.
  assert.equal("ct15" in ket.duLieu.ct, false);
  assert.equal("ct33" in ket.duLieu.ct, false);
});

test("layChiTietToKhai: 01/GTGT vẫn ưu tiên trước, không bị nhánh TNCN cướp mất", () => {
  assert.equal(layChiTietToKhai(XML_GTGT01).loai, "gtgt01");
});

/** XML KHÔNG có `tenTKhai`/`maTKhai` — nếu chỉ dò trong XML thì rơi về `raw`. Đây đúng là ca mà
 * gợi ý từ cột "Tờ khai / Phụ lục" phải cứu được. */
const XML_KHONG_TIEU_DE = `<HSoKhaiThue><mst>0106200129</mst><ct16>4</ct16><ct21>105000000</ct21></HSoKhaiThue>`;

test("layChiTietToKhai: không có gợi ý cột -> XML thiếu tiêu đề rơi về raw", () => {
  assert.equal(layChiTietToKhai(XML_KHONG_TIEU_DE).loai, "raw");
});

test("layChiTietToKhai: gợi ý từ cột 'Tờ khai' nhận ra 05/KK-TNCN dù XML thiếu tiêu đề", () => {
  const ket = layChiTietToKhai(XML_KHONG_TIEU_DE, "05/KK-TNCN");
  assert.equal(ket.loai, "tncn05");
  if (ket.loai !== "tncn05") return;
  assert.equal(ket.duLieu.ct.ct16, 4);
  assert.equal(ket.duLieu.ct.ct21, 105000000);
});

test("layChiTietToKhai: gợi ý từ cột không phân biệt hoa/thường", () => {
  assert.equal(layChiTietToKhai(XML_KHONG_TIEU_DE, "05/kk-tncn").loai, "tncn05");
  assert.equal(layChiTietToKhai(XML_KHONG_TIEU_DE, "Tờ khai 05/kk-TNCN lần 1").loai, "tncn05");
});

test("layChiTietToKhai: gợi ý từ cột cũng nhận ra 01/GTGT", () => {
  assert.equal(layChiTietToKhai(XML_KHONG_TIEU_DE, "01/GTGT").loai, "gtgt01");
});
