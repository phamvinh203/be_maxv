import type { CtTagGtgt01, DvcGtgt01XuatRow } from "../api/dvc";
import {
  buildDvcChiTieuWorkbookBuffer,
  tachKyKeKhai,
  type CotChiTieu,
  type CotDau,
} from "./xuatChiTieuExcel";

const COT_CHI_TIEU: CotChiTieu<CtTagGtgt01>[] = [
  { tag: "ct22", header: "Chỉ tiêu 22 (Thuế giá trị gia tăng còn được khấu trừ kỳ trước chuyển sang)" },
  { tag: "ct23", header: "Chỉ tiêu 23 (Giá trị hàng hóa, dịch vụ mua vào)" },
  { tag: "ct24", header: "Chỉ tiêu 24 (Thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào)" },
  { tag: "ct23a", header: "Chỉ tiêu 23a (Giá trị hàng hóa, dịch vụ nhập khẩu)" },
  { tag: "ct24a", header: "Chỉ tiêu 24a (Thuế giá trị gia tăng của hàng hóa, dịch vụ nhập khẩu)" },
  {
    tag: "ct25",
    header: "Chỉ tiêu 25 (Thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào được khấu trừ kỳ này)",
  },
  { tag: "ct26", header: "Chỉ tiêu 26 (Hàng hóa, dịch vụ bán ra không chịu thuế giá trị gia tăng)" },
  { tag: "ct27", header: "Chỉ tiêu 27 (Giá trị hàng hóa, dịch vụ bán ra chịu thuế giá trị gia tăng)" },
  { tag: "ct28", header: "Chỉ tiêu 28 (Thuế giá trị gia tăng của hàng hóa, dịch vụ bán ra)" },
  { tag: "ct29", header: "Chỉ tiêu 29 (Giá trị hàng hóa, dịch vụ bán ra chịu thuế suất 0%)" },
  { tag: "ct30", header: "Chỉ tiêu 30 (Giá trị hàng hóa, dịch vụ bán ra chịu thuế suất 5%)" },
  {
    tag: "ct31",
    header: "Chỉ tiêu 31 (Thuế giá trị gia tăng của hàng hóa, dịch vụ bán ra chịu thuế suất 5% )",
  },
  { tag: "ct32", header: "Chỉ tiêu 32 (Giá trị hàng hóa, dịch vụ bán ra chịu thuế suất 10%)" },
  {
    tag: "ct33",
    header: "Chỉ tiêu 33 (Thuế giá trị gia tăng của hàng hóa, dịch vụ bán ra chịu thuế suất 10%)",
  },
  { tag: "ct32a", header: "Chỉ tiêu 32a (Giá trị hàng hóa, dịch vụ bán ra không tính thuế)" },
  { tag: "ct34", header: "Chỉ tiêu 34 (Tổng doanh thu hàng hóa, dịch vụ bán ra)" },
  { tag: "ct35", header: "Chỉ tiêu 35 (Tổng thuế giá trị gia tăng của hàng hóa, dịch vụ bán ra)" },
  { tag: "ct36", header: "Chỉ tiêu 36 (Thuế giá trị gia tăng phát sinh trong kỳ)" },
  {
    tag: "ct37",
    header: "Chỉ tiêu 37 (Điều chỉnh giảm thuế giá trị gia tăng còn được khấu trừ của các kỳ trước)",
  },
  {
    tag: "ct38",
    header: "Chỉ tiêu 38 (Điều chỉnh tăng thuế giá trị gia tăng còn được khấu trừ của các kỳ trước)",
  },
  { tag: "ct39a", header: "Chỉ tiêu 39a (Thuế giá trị gia tăng nhận bàn giao được khấu trừ trong kỳ)" },
  {
    tag: "ct40a",
    header: "Chỉ tiêu 40a (Thuế giá trị gia tăng phải nộp của hoạt động sản xuất kinh doanh trong kỳ )",
  },
  {
    tag: "ct40b",
    header:
      "Chỉ tiêu 40b (Thuế giá trị gia tăng mua vào của dự án đầu tư được bù trừ với thuế GTGT còn phải nộp của hoạt động sản xuất kinh doanh cùng kỳ tính thuế)",
  },
  { tag: "ct40", header: "Chỉ tiêu 40 (Thuế giá trị gia tăng còn phải nộp trong kỳ )" },
  { tag: "ct41", header: "Chỉ tiêu 41 (Thuế giá trị gia tăng chưa khấu trừ hết kỳ này )" },
  { tag: "ct42", header: "Chỉ tiêu 42 (Thuế giá trị gia tăng đề nghị hoàn)" },
  { tag: "ct43", header: "Chỉ tiêu 43 (Thuế giá trị gia tăng còn được khấu trừ chuyển kỳ sau)" },
];

const COT_DAU: CotDau<DvcGtgt01XuatRow>[] = [
  { header: "Tên tờ khai", width: 30, value: (r) => r.tenTKhai || null },
  { header: "Kỳ kê khai", width: 14, value: (r) => r.kyKeKhai || null },
  { header: "Quý", width: 8, value: (r) => tachKyKeKhai(r.kyKeKhai).quy },
  { header: "Năm", width: 8, value: (r) => tachKyKeKhai(r.kyKeKhai).nam },
  { header: "Lần nộp", width: 10, align: "right", value: (r) => r.lanNop || null },
  { header: "Tiểu mục\nhoạch toán", width: 12, align: "right", value: (r) => r.tieuMucHachToan || null },
];

export function buildGtgt01WorkbookBuffer(rows: DvcGtgt01XuatRow[]): Promise<ArrayBuffer> {
  return buildDvcChiTieuWorkbookBuffer({
    sheetName: "01-GTGT",
    cotDau: COT_DAU,
    cotChiTieu: COT_CHI_TIEU,
    layCt: (r) => r.ct,
    rows,
  });
}

export function gtgt01WorkbookFilename(mst: string): string {
  return `${mst}_ToKhai01GTGT.xlsx`;
}
