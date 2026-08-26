import type { CtTagQtt05, DvcQtt05XuatRow } from "./api/dvc";
import { formatDateVN } from "../hddt/dateUtils";
import { buildDvcChiTieuWorkbookBuffer, type CotChiTieu, type CotDau } from "./xuatChiTieuExcel";

const COT_CHI_TIEU: CotChiTieu<CtTagQtt05>[] = [
  { tag: "ct16", header: "Chỉ tiêu 16 (Tổng số người lao động)" },
  { tag: "ct17", header: "Chỉ tiêu 17 (Cá nhân cư trú có hợp đồng lao động )" },
  { tag: "ct18", header: "Chỉ tiêu 18 (Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20])" },
  { tag: "ct19", header: "Chỉ tiêu 19 (Cá nhân cư trú)" },
  { tag: "ct20", header: "Chỉ tiêu 20 (Cá nhân không cư trú)" },
  {
    tag: "ct21",
    header:
      "Chỉ tiêu 21 (Tổng số cá nhân thuộc diện được miễn, giảm thuế theo Hiệp định tránh đánh thuế hai lần)",
  },
  { tag: "ct22", header: "Chỉ tiêu 22 (Tổng số cá nhân giảm trừ gia cảnh)" },
  { tag: "ct23", header: "Chỉ tiêu 23 (Tổng thu nhập chịu thuế trả cho cá nhân [23]=[24]+[25])" },
  { tag: "ct24", header: "Chỉ tiêu 24 (Cá nhân cư trú)" },
  { tag: "ct25", header: "Chỉ tiêu 25 (Cá nhân không cư trú)" },
  {
    tag: "ct26",
    header:
      "Chỉ tiêu 26 (Trong đó: Tổng thu nhập chịu thuế từ tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động)",
  },
  {
    tag: "ct27",
    header: "Chỉ tiêu 27 (Trong đó tổng thu nhập chịu thuế được miễn theo quy định của Hợp đồng dầu khí)",
  },
  {
    tag: "ct28",
    header:
      "Chỉ tiêu 28 (Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế [28]=[29]+[30])",
  },
  { tag: "ct29", header: "Chỉ tiêu 29 (Cá nhân cư trú)" },
  { tag: "ct30", header: "Chỉ tiêu 30 (Cá nhân không cư trú)" },
  { tag: "ct31", header: "Chỉ tiêu 31 (Tổng số thuế thu nhập cá nhân đã khấu trừ [31]=[32]+[33])" },
  { tag: "ct32", header: "Chỉ tiêu 32 (Cá nhân cư trú)" },
  { tag: "ct33", header: "Chỉ tiêu 33 (Cá nhân không cư trú)" },
  {
    tag: "ct34",
    header:
      "Chỉ tiêu 34 (Trong đó: Tổng số thuế thu nhập cá nhân đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động)",
  },
  {
    tag: "ct35",
    header: "Chỉ tiêu 35 (Tổng số cá nhân uỷ quyền cho tổ chức, cá nhân trả thu nhập quyết toán thay)",
  },
  { tag: "ct36", header: "Chỉ tiêu 36 (Tổng số thuế thu nhập cá nhân đã khấu trừ)" },
  {
    tag: "ct37",
    header:
      "Chỉ tiêu 37 (Trong đó: Số thuế thu nhập cá nhân đã khấu trừ tại tổ chức trước khi điều chuyển (trường hợp có đánh dấu vào chỉ tiêu [04]))",
  },
  { tag: "ct38", header: "Chỉ tiêu 38 (Tổng số thuế thu nhập cá nhân phải nộp)" },
  {
    tag: "ct39",
    header:
      "Chỉ tiêu 39 (Tổng số thuế thu nhập cá nhân được miễn do cá nhân có số thuế còn phải nộp sau ủy quyền quyết toán từ 50.000 đồng trở xuống)",
  },
  { tag: "ct40", header: "Chỉ tiêu 40 (Tổng số thuế thu nhập cá nhân còn phải nộp)" },
  { tag: "ct41", header: "Chỉ tiêu 41 (Tổng số thuế thu nhập cá nhân đã nộp thừa)" },
];

const COT_DAU: CotDau<DvcQtt05XuatRow>[] = [
  { header: "Tên tờ khai", width: 30, value: (r) => r.tenTKhai || null },
  { header: "Kỳ kê khai", width: 14, value: (r) => r.kyKeKhai || null },
  { header: "Lần nộp", width: 10, align: "right", value: (r) => r.lanNop || null },
  { header: "Ngày lập", width: 12, value: (r) => (r.ngayLap ? formatDateVN(r.ngayLap) : null) },
  { header: "Ngày ký", width: 12, value: (r) => (r.ngayKy ? formatDateVN(r.ngayKy) : null) },
  { header: "Loại tờ khai", width: 16, value: (r) => r.loaiToKhai || null },
];

export function buildQtt05WorkbookBuffer(rows: DvcQtt05XuatRow[]): Promise<ArrayBuffer> {
  return buildDvcChiTieuWorkbookBuffer({
    sheetName: "05-QTT-TNCN",
    cotDau: COT_DAU,
    cotChiTieu: COT_CHI_TIEU,
    layCt: (r) => r.ct,
    rows,
  });
}

export function qtt05WorkbookFilename(mst: string): string {
  return `${mst}_ToKhai05QTTTNCN.xlsx`;
}
