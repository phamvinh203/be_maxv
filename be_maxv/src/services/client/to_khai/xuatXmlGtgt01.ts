/**
 * Dựng file XML tờ khai 01/GTGT để nộp qua cổng thuế.
 *
 * Hàm THUẦN, không DB không HTTP — test ở `src/__tests__/xuatXmlGtgt01.test.ts`.
 *
 * ===== NGUỒN CỦA CẤU TRÚC (đừng sửa theo trí nhớ) =====
 *
 * Tên thẻ chỉ tiêu và các nhóm bọc lấy từ MỘT FILE 01/GTGT THẬT đã nộp (MST 0106200129, Q2/2026,
 * `maTKhai` 842) — chính file đang dùng làm dữ liệu test cho `dich_vu_cong/toKhaiXml.ts`. Đó là lý
 * do [23]/[24] nằm trong `GiaTriVaThueGTGTHHDVMuaVao` còn [32]/[33] trong `HHDVBRaChiuTSuat10`
 * chứ không phẳng như tên thẻ gợi ý.
 *
 * Khung ngoài (`id="ID-NODETOSIGN"`, `loaiTKhai`, `KyKKhaiThue` đủ 6 thẻ, `GiaHan`, `<PLuc />`)
 * lấy từ hai file XML do phần mềm khác xuất (mẫu 01/CNKD của MST 0111142786) — mẫu khác nhưng
 * khung ngoài là chung cho mọi tờ khai của cổng.
 *
 * ===== CÁI FILE NÀY CỐ Ý KHÔNG LÀM =====
 *
 * KHÔNG ký số. `id="ID-NODETOSIGN"` đánh dấu chỗ chữ ký sẽ chèn vào; kế toán nạp file này vào HTKK
 * hoặc iTaxViewer để ký và nộp. Cũng vì vậy `nguoiKy`/`maCQTNoiNop` để trống — hai file mẫu do
 * phần mềm khác xuất cũng để trống đúng những thẻ đó.
 *
 * KHÔNG kèm phụ lục giảm thuế NQ 204/2025: `<PLuc />` để rỗng vì chưa có mẫu XML thật của phụ lục
 * để bám. Kỳ có hàng 8% thì kế toán vẫn phải thêm phụ lục trong HTKK — màn hình nói ra điều đó
 * (nó đã biết kỳ có phụ lục hay không qua `BanToKhai.phuLuc`) thay vì để người dùng nộp thiếu.
 */

import { khoangCuaKy, type Ky } from "./kySoThue";

/** Mã và tên mẫu — theo file thật đã nộp. */
export const MA_TKHAI_GTGT01 = "842";
const TEN_TKHAI = "TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)";
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
  /** Tờ khai lần đầu = 0; khai bổ sung lần N = N. */
  soLan?: number;
  /** Ngày lập/ngày ký ghi trên tờ khai; mặc định hôm nay. */
  ngayLap?: Date;
}

/** Thoát ký tự đặc biệt của XML. Tên công ty có thể mang `&`, `<`, dấu nháy. */
function thoat(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** `2026-09-02` — định dạng ngày của các thẻ `ngayLapTKhai`/`ngayKy`. */
function isoNgay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `01/07/2026` — định dạng ngày của `kyKKhaiTuNgay`/`kyKKhaiDenNgay` (khác kiểu trên). */
function ngayVn(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
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

export function dungXmlGtgt01(dv: DauVaoXmlGtgt01): string {
  const { ky, ct, nnt } = dv;
  const ngay = dv.ngayLap ?? new Date();
  const ngayIso = isoNgay(ngay);
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const nhanKyXml = `${ky.kySo}/${ky.nam}`;
  const thangDau = ky.kyLoai === "thang" ? ky.kySo : (ky.kySo - 1) * 3 + 1;
  const thangCuoi = ky.kyLoai === "thang" ? ky.kySo : ky.kySo * 3;
  const t = (tag: string) => tien(ct, tag);

  return `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">
  <HSoKhaiThue id="ID-NODETOSIGN">
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
          <loaiTKhai>C</loaiTKhai>
          <soLan>${Math.max(0, Math.trunc(dv.soLan ?? 0))}</soLan>
          <KyKKhaiThue>
            <kieuKy>${kieuKy(ky)}</kieuKy>
            <kyKKhai>${nhanKyXml}</kyKKhai>
            <kyKKhaiTuNgay>${ngayVn(tuNgay)}</kyKKhaiTuNgay>
            <kyKKhaiDenNgay>${ngayVn(denNgay)}</kyKKhaiDenNgay>
            <kyKKhaiTuThang>${thangDau}/${ky.nam}</kyKKhaiTuThang>
            <kyKKhaiDenThang>${thangCuoi}/${ky.nam}</kyKKhaiDenThang>
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
      <ten_NganhNghe>Hoạt động sản xuất kinh doanh thông thường</ten_NganhNghe>
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
    <PLuc />
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
