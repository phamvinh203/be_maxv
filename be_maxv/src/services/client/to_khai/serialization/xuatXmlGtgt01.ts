/**
 * Dựng file XML tờ khai 01/GTGT để nộp qua cổng thuế.
 *
 * Hàm THUẦN, không DB không HTTP — test ở `src/__tests__/xuatXmlGtgt01.test.ts`.
 *
 * ===== NGUỒN CỦA CẤU TRÚC (đừng sửa theo trí nhớ) =====
 *
 * Bám MỘT FILE 01/GTGT do HTKK 5.7.6 xuất ra để nộp (MST 0111142786, Q2/2026, `maTKhai` 842,
 * `pbanTKhaiXML` 2.8.3) — người dùng cung cấp. Đây là bản đầy đủ NHẤT hiện có: khác với file tải
 * VỀ từ cổng (thiếu vài khối), và khác với mẫu 01/CNKD hộ kinh doanh (mẫu khác hẳn).
 *
 * Vài chỗ chỉ nhìn file mới biết, đừng suy từ tên thẻ:
 *   - [23]/[24] nằm trong `GiaTriVaThueGTGTHHDVMuaVao`, [32]/[33] trong `HHDVBRaChiuTSuat10`;
 *   - `CTieuTKhaiChinh` mở đầu bằng `ma_NganhNghe` + `ten_NganhNghe` + `tieuMucHachToan` + `Header`;
 *   - mẫu này KHÔNG có khối `DLyThue` (khối đó thuộc mẫu 01/CNKD);
 *   - `kyKKhaiTuThang`/`kyKKhaiDenThang` để RỖNG với kỳ quý, chỉ điền với kỳ tháng;
 *   - thẻ phụ lục giảm thuế tên `PL_NQ142_GTGT` — giữ số nghị quyết CŨ (142) dù nội dung là
 *     204/2025. HTKK không đổi tên thẻ qua các đợt nghị quyết; đổi theo là cổng không đọc được.
 *
 * ===== CÁI FILE NÀY CỐ Ý KHÔNG LÀM =====
 *
 * KHÔNG ký số, và KHÔNG điền người ký / cơ quan thuế nơi nộp / tỉnh: `nguoiKy`, `maCQTNoiNop`,
 * `tenCQTNoiNop`, `maTinhNNT`, `tenTinhNNT` để RỖNG (giữ thẻ, chỉ bỏ nội dung — cổng đối chiếu
 * cấu trúc). Phần mềm không giữ những dữ liệu đó; kế toán nạp file vào HTKK, HTKK tự điền nơi nộp
 * theo MST rồi ký và nộp.
 */
import { khoangCuaKy, type Ky } from "../domain/kySoThue";
import { catMoTa, type PhuLuc204 } from "../domain/phuLuc204";
import { ngayVn, vnDayString } from "../../../../utils/ngayVn";

/** Mã và tên mẫu — theo file thật đã nộp. */
export const MA_TKHAI_GTGT01 = "842";
const TEN_TKHAI = "TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)";
/** Phiên bản định dạng XML của mẫu 842, theo file HTKK 5.7.6 xuất. */
const PBAN_TKHAI_XML = "2.8.3";

/**
 * Ngành nghề và tiểu mục hạch toán — mã `00` là "hoạt động sản xuất kinh doanh thông thường",
 * tiểu mục `1701` là thuế GTGT hàng sản xuất kinh doanh trong nước. Đúng cho gần như mọi doanh
 * nghiệp khai 01/GTGT; hoạt động đặc thù (thủy điện, xổ số, chuyển nhượng bất động sản...) có mã
 * khác và cần khai riêng — chưa hỗ trợ.
 */
const MA_NGANH_NGHE = "00";
const TEN_NGANH_NGHE = "Hoạt động sản xuất kinh doanh thông thường";
const TIEU_MUC_HACH_TOAN = "1701";

const MO_TA_BMAU =
  "(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính)";

export interface ThongTinNnt {
  mst: string;
  tenNnt: string;
  diaChi?: string | null;
  dienThoai?: string | null;
}

export interface DauVaoXmlGtgt01 {
  ky: Ky;
  /** Bộ chỉ tiêu CUỐI của bản tờ khai (`BanToKhai.ct`). */
  ct: Record<string, number>;
  nnt: ThongTinNnt;
  /** Phụ lục giảm thuế của kỳ; `null` = kỳ không có hàng 8% nên `<PLuc />` để rỗng. */
  phuLuc?: PhuLuc204 | null;
  /** Tờ khai lần đầu = 0; khai bổ sung lần N = N. */
  soLan?: number;
  /** Ngày lập/ngày ký ghi trên tờ khai; mặc định hôm nay. */
  ngayLap?: Date;
}

/**
 * Ký tự C0 (trừ tab/LF/CR) và DEL — XML 1.0 KHÔNG cho phép những ký tự này ở bất kỳ mức escape
 * nào (không phải cứ `&`-escape là hợp lệ). Dữ liệu dán từ Word/Excel vào tên công ty/địa chỉ đôi
 * khi mang theo — không lọc thì file XML không well-formed, cổng/HTKK từ chối nạp mà báo lỗi không
 * trỏ đúng chỗ.
 */
// eslint-disable-next-line no-control-regex -- CỐ Ý khớp ký tự điều khiển để lọc chúng khỏi XML.
const KY_TU_KHONG_HOP_LE_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Thoát ký tự đặc biệt của XML. Tên công ty có thể mang `&`, `<`, dấu nháy. */
function thoat(s: string): string {
  return s
    .replace(KY_TU_KHONG_HOP_LE_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


/**
 * Số tiền trên tờ khai là số NGUYÊN, không dấu phân cách, không phần thập phân.
 *
 * Ô thiếu ghi `0` chứ không bỏ thẻ: mẫu thật ghi đủ cả những ô bằng 0, và cổng đối chiếu công thức
 * giữa các ô nên thiếu thẻ là hỏng phép kiểm.
 */
function tien(ct: Record<string, number>, tag: string): string {
  const v = Number(ct[tag] ?? 0);
  return String(Number.isFinite(v) ? Math.round(v) : 0);
}

/** `M` cho kỳ tháng, `Q` cho kỳ quý — theo `kieuKy` của cổng. */
function kieuKy(ky: Ky): string {
  return ky.kyLoai === "thang" ? "M" : "Q";
}

/**
 * Khối `<PLuc>` — phụ lục giảm thuế GTGT theo nghị quyết.
 *
 * Thẻ tên `PL_NQ142_GTGT` giữ số nghị quyết CŨ (142/2024) dù nội dung khai theo 204/2025: HTKK
 * không đổi tên thẻ qua các đợt nghị quyết, đổi theo là cổng không đọc được phụ lục.
 *
 * Kỳ không có hàng được giảm thì trả `<PLuc />` rỗng — đúng như tờ khai không kèm phụ lục.
 *
 * Mô tả hàng hóa cắt lại qua `catMoTa` dù `dungPhuLuc204` đã cắt: bản phụ lục LƯU TRONG DB từ
 * trước có thể còn mô tả dài (lượt tính lại cố ý giữ mô tả cũ để không xóa chữ kế toán đã sửa),
 * mà file nộp thuế thì không được dài.
 */
function khoiPhuLuc(pl: PhuLuc204 | null | undefined): string {
  if (!pl || pl.rong) return "    <PLuc />";
  const n = (v: number) => String(Math.round(v));
  return `    <PLuc>
      <PL_NQ142_GTGT>
        <HH_DV_MuaVaoTrongKy>
          <BangKeTenHHDV ID="ID_1">
            <tenHHDVMuaVao>${thoat(catMoTa(pl.muaVao.tenHang))}</tenHHDVMuaVao>
            <giaTriHHDVMuaVao>${n(pl.muaVao.giaTri)}</giaTriHHDVMuaVao>
            <thueGTGTHHDV>${n(pl.muaVao.thue)}</thueGTGTHHDV>
          </BangKeTenHHDV>
          <tongCongGiaTriHHDVMuaVao>${n(pl.muaVao.giaTri)}</tongCongGiaTriHHDVMuaVao>
          <tongCongThueGTGTHHDV>${n(pl.muaVao.thue)}</tongCongThueGTGTHHDV>
        </HH_DV_MuaVaoTrongKy>
        <HH_DV_BanRaTrongKy>
          <BangKeTenHHDV ID="ID_1">
            <tenHHDV>${thoat(catMoTa(pl.banRa.tenHang))}</tenHHDV>
            <giaTriHHDV>${n(pl.banRa.giaTri)}</giaTriHHDV>
            <thueSuatTheoQuyDinh>${pl.banRa.thueSuatQuyDinh}</thueSuatTheoQuyDinh>
            <thueSuatSauGiam>${pl.banRa.thueSuatSauGiam}</thueSuatSauGiam>
            <thueGTGTDuocGiam>${n(pl.banRa.thueDuocGiam)}</thueGTGTDuocGiam>
          </BangKeTenHHDV>
          <tongCongGiaTriHHDV>${n(pl.banRa.giaTri)}</tongCongGiaTriHHDV>
          <tongCongThueGTGTDuocGiam>${n(pl.banRa.thueDuocGiam)}</tongCongThueGTGTDuocGiam>
        </HH_DV_BanRaTrongKy>
        <ChenhLech>
          <ct9>${n(pl.chenhLech)}</ct9>
        </ChenhLech>
      </PL_NQ142_GTGT>
    </PLuc>`;
}

export function dungXmlGtgt01(dv: DauVaoXmlGtgt01): string {
  const { ky, ct, nnt } = dv;
  const ngay = dv.ngayLap ?? new Date();
  // Ngày GIỜ VN, không phải giờ máy chủ: `new Date().getFullYear()/getMonth()/getDate()` đọc theo
  // TZ tiến trình đang chạy — máy chủ đặt UTC thì 00:xx giờ VN bị lùi về NGÀY HÔM TRƯỚC. `ngay`
  // luôn là instant hợp lệ (tham số hoặc `new Date()`) nên `vnDayString` không bao giờ `undefined`.
  const ngayIso = vnDayString(ngay)!;
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const nhanKyXml = `${ky.kySo}/${ky.nam}`;
  // `kyKKhaiTuThang`/`kyKKhaiDenThang` CHỈ điền cho kỳ THÁNG. Ba file mẫu do phần mềm khác xuất
  // đều thống nhất: kỳ tháng ghi `7/2026` ở cả hai thẻ, kỳ QUÝ để RỖNG (khoảng thời gian của quý
  // đã nằm ở `kyKKhaiTuNgay`/`kyKKhaiDenNgay`). Điền tháng đầu/cuối quý vào đây là sai form.
  const oThang =
    ky.kyLoai === "thang"
      ? `<kyKKhaiTuThang>${ky.kySo}/${ky.nam}</kyKKhaiTuThang>
            <kyKKhaiDenThang>${ky.kySo}/${ky.nam}</kyKKhaiDenThang>`
      : `<kyKKhaiTuThang />
            <kyKKhaiDenThang />`;
  const t = (tag: string) => tien(ct, tag);

  return `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">
  <HSoKhaiThue id="ID_1">
    <TTinChung>
      <TTinDVu>
        <maDVu>MAXV</maDVu>
        <tenDVu>Maxv</tenDVu>
        <pbanDVu />
        <ttinNhaCCapDVu />
      </TTinDVu>
      <TTinTKhaiThue>
        <TKhaiThue>
          <maTKhai>${MA_TKHAI_GTGT01}</maTKhai>
          <tenTKhai>${TEN_TKHAI}</tenTKhai>
          <moTaBMau>${MO_TA_BMAU}</moTaBMau>
          <pbanTKhaiXML>${PBAN_TKHAI_XML}</pbanTKhaiXML>
          <loaiTKhai>C</loaiTKhai>
          <soLan>${Math.max(0, Math.trunc(dv.soLan ?? 0))}</soLan>
          <KyKKhaiThue>
            <kieuKy>${kieuKy(ky)}</kieuKy>
            <kyKKhai>${nhanKyXml}</kyKKhai>
            <kyKKhaiTuNgay>${ngayVn(tuNgay)}</kyKKhaiTuNgay>
            <kyKKhaiDenNgay>${ngayVn(denNgay)}</kyKKhaiDenNgay>
            ${oThang}
          </KyKKhaiThue>
          <maCQTNoiNop />
          <tenCQTNoiNop />
          <ngayLapTKhai>${ngayIso}</ngayLapTKhai>
          <GiaHan>
            <maLyDoGiaHan />
            <lyDoGiaHan />
          </GiaHan>
          <nguoiKy></nguoiKy>
          <ngayKy>${ngayIso}</ngayKy>
          <nganhNgheKD />
        </TKhaiThue>
        <NNT>
          <mst>${thoat(nnt.mst)}</mst>
          <tenNNT>${thoat(nnt.tenNnt)}</tenNNT>
          <dchiNNT>${thoat(nnt.diaChi ?? "")}</dchiNNT>
          <phuongXa />
          <maHuyenNNT />
          <tenHuyenNNT />
          <maTinhNNT />
          <tenTinhNNT />
          <dthoaiNNT>${thoat(nnt.dienThoai ?? "")}</dthoaiNNT>
          <faxNNT />
          <emailNNT />
        </NNT>
      </TTinTKhaiThue>
    </TTinChung>
    <CTieuTKhaiChinh>
      <ma_NganhNghe>${MA_NGANH_NGHE}</ma_NganhNghe>
      <ten_NganhNghe>${TEN_NGANH_NGHE}</ten_NganhNghe>
      <tieuMucHachToan>${TIEU_MUC_HACH_TOAN}</tieuMucHachToan>
      <Header>
        <ct09 />
        <ct10 />
        <DiaChiHDSXKDKhacTinhNDTSC>
          <ct11a_phuongXa_ma />
          <ct11a_phuongXa_ten />
          <ct11b_quanHuyen_ma />
          <ct11b_quanHuyen_ten />
          <ct11c_tinhTP_ma />
          <ct11c_tinhTP_ten />
        </DiaChiHDSXKDKhacTinhNDTSC>
      </Header>
      <ct21>0</ct21>
      <ct22>${t("ct22")}</ct22>
      <GiaTriVaThueGTGTHHDVMuaVao>
        <ct23>${t("ct23")}</ct23>
        <ct24>${t("ct24")}</ct24>
      </GiaTriVaThueGTGTHHDVMuaVao>
      <HangHoaDichVuNhapKhau>
        <ct23a>${t("ct23a")}</ct23a>
        <ct24a>${t("ct24a")}</ct24a>
      </HangHoaDichVuNhapKhau>
      <ct25>${t("ct25")}</ct25>
      <ct26>${t("ct26")}</ct26>
      <HHDVBRaChiuThueGTGT>
        <ct27>${t("ct27")}</ct27>
        <ct28>${t("ct28")}</ct28>
      </HHDVBRaChiuThueGTGT>
      <ct29>${t("ct29")}</ct29>
      <HHDVBRaChiuTSuat5>
        <ct30>${t("ct30")}</ct30>
        <ct31>${t("ct31")}</ct31>
      </HHDVBRaChiuTSuat5>
      <HHDVBRaChiuTSuat10>
        <ct32>${t("ct32")}</ct32>
        <ct33>${t("ct33")}</ct33>
      </HHDVBRaChiuTSuat10>
      <ct32a>${t("ct32a")}</ct32a>
      <TongDThuVaThueGTGTHHDVBRa>
        <ct34>${t("ct34")}</ct34>
        <ct35>${t("ct35")}</ct35>
      </TongDThuVaThueGTGTHHDVBRa>
      <ct36>${t("ct36")}</ct36>
      <ct37>${t("ct37")}</ct37>
      <ct38>${t("ct38")}</ct38>
      <ct39a>${t("ct39a")}</ct39a>
      <ct40a>${t("ct40a")}</ct40a>
      <ct40b>${t("ct40b")}</ct40b>
      <ct40>${t("ct40")}</ct40>
      <ct41>${t("ct41")}</ct41>
      <ct42>${t("ct42")}</ct42>
      <ct43>${t("ct43")}</ct43>
    </CTieuTKhaiChinh>
${khoiPhuLuc(dv.phuLuc)}
  </HSoKhaiThue>
</HSoThueDTu>
`;
}

/** `01_GTGT_TT80_2026_0106861880_01-04-2026_30-06-2026.xml` — theo lối đặt tên của cổng. */
export function tenFileXml(ky: Ky, mst: string): string {
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const g = (iso: string) => iso.split("-").reverse().join("-");
  return `01_GTGT_TT80_${ky.nam}_${mst}_${g(tuNgay)}_${g(denNgay)}.xml`;
}
