import type { DvcKhacXuatRow } from "../api/dvc";
import { buildDvcChiTieuWorkbookBuffer, type CotDau } from "./xuatChiTieuExcel";

const COT_DAU: CotDau<DvcKhacXuatRow>[] = [
  { header: "STT", width: 6, align: "center", value: (r) => r.stt },
  { header: "Mã giao dịch", width: 22, value: (r) => r.maHoSo || null },
  { header: "Tờ khai", width: 34, value: (r) => r.toKhai || null },
  { header: "Kỳ tính thuế", width: 14, value: (r) => r.kyTinhThue || null },
  { header: "Loại tờ khai", width: 16, value: (r) => r.loaiToKhai || null },
  { header: "Lần nộp", width: 10, align: "right", value: (r) => r.lanNop || null },
  { header: "Lần bổ sung", width: 12, align: "right", value: (r) => r.lanBoSung || null },
  { header: "Ngày nộp", width: 12, value: (r) => r.ngayNop || null },
  { header: "Nơi nộp", width: 26, value: (r) => r.noiNop || null },
];

export function buildKhacWorkbookBuffer(rows: DvcKhacXuatRow[]): Promise<ArrayBuffer> {
  return buildDvcChiTieuWorkbookBuffer<DvcKhacXuatRow, never>({
    sheetName: "Khac",
    cotDau: COT_DAU,
    cotChiTieu: [],
    layCt: () => ({}),
    rows,
  });
}

export function khacWorkbookFilename(mst: string): string {
  return `${mst}_ToKhaiKhac.xlsx`;
}
