import type { CtTagTncn05, DvcTncn05XuatRow } from "../api/dvc";
import { formatDateVN } from "../../hddt/dateUtils";
import {
  buildDvcChiTieuWorkbookBuffer,
  tachKyKeKhai,
  type CotChiTieu,
  type CotDau,
} from "./xuatChiTieuExcel";

const COT_CHI_TIEU: CotChiTieu<CtTagTncn05>[] = [
  { tag: "ct16", header: "Chỉ tiêu 16 (Tổng số người lao động)" },
  { tag: "ct17", header: "Chỉ tiêu 17 (Cá nhân cư trú có hợp đồng lao động)" },
  { tag: "ct18", header: "Chỉ tiêu 18 (Tổng số cá nhân đã khấu trừ thuế)" },
  { tag: "ct19", header: "Chỉ tiêu 19 (Cá nhân cư trú đã khấu trừ thuế)" },
  { tag: "ct20", header: "Chỉ tiêu 20 (Cá nhân không cư trú đã khấu trừ thuế)" },
  { tag: "ct21", header: "Chỉ tiêu 21 (Tổng thu nhập chịu thuế (TNCT) trả cho cá nhân)" },
  { tag: "ct22", header: "Chỉ tiêu 22 (Cá nhân cư trú chịu thuế (TNCT) trả cho cá nhân)" },
  { tag: "ct23", header: "Chỉ tiêu 23 (Cá nhân không cư trú chịu thuế (TNCT) trả cho cá nhân)" },
  {
    tag: "ct24",
    header:
      "Chỉ tiêu 24 (Tổng thu nhập chịu thuế từ tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động)",
  },
  {
    tag: "ct25",
    header: "Chỉ tiêu 25 (Trong đó tổng thu nhập chịu thuế được miễn theo quy định của Hợp đồng dầu khí)",
  },
  { tag: "ct26", header: "Chỉ tiêu 26 (Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế)" },
  {
    tag: "ct27",
    header: "Chỉ tiêu 27 (Cá nhân cư trú chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế)",
  },
  {
    tag: "ct28",
    header: "Chỉ tiêu 28 (Cá nhân không cư trú chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế)",
  },
  { tag: "ct29", header: "Chỉ tiêu 29 (Tổng số thuế thu nhập cá nhân đã khấu trừ)" },
  { tag: "ct30", header: "Chỉ tiêu 30 (Cá nhân cư trú)" },
  { tag: "ct31", header: "Chỉ tiêu 31 (Cá nhân không cư trú)" },
  {
    tag: "ct32",
    header:
      "Chỉ tiêu 32 (Tổng số thuế thu nhập cá nhân đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động)",
  },
];

const COT_DAU: CotDau<DvcTncn05XuatRow>[] = [
  { header: "Tên tờ khai", width: 30, value: (r) => r.tenTKhai || null },
  { header: "Kỳ kê khai", width: 14, value: (r) => r.kyKeKhai || null },
  { header: "Quý", width: 8, value: (r) => tachKyKeKhai(r.kyKeKhai).quy },
  { header: "Năm", width: 8, value: (r) => tachKyKeKhai(r.kyKeKhai).nam },
  { header: "Lần nộp", width: 10, align: "right", value: (r) => r.lanNop || null },
  { header: "Ngày lập", width: 12, value: (r) => (r.ngayLap ? formatDateVN(r.ngayLap) : null) },
  { header: "Ngày ký", width: 12, value: (r) => (r.ngayKy ? formatDateVN(r.ngayKy) : null) },
  { header: "Loại tờ khai", width: 16, value: (r) => r.loaiToKhai || null },
];

export function buildTncn05WorkbookBuffer(rows: DvcTncn05XuatRow[]): Promise<ArrayBuffer> {
  return buildDvcChiTieuWorkbookBuffer({
    sheetName: "05-KK-TNCN",
    cotDau: COT_DAU,
    cotChiTieu: COT_CHI_TIEU,
    layCt: (r) => r.ct,
    rows,
  });
}

export function tncn05WorkbookFilename(mst: string): string {
  return `${mst}_ToKhai05KKTNCN.xlsx`;
}
