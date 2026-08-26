import type { CtTagTndn03, DvcTndn03XuatRow } from "./api/dvc";
import { formatDateVN } from "../hddt/dateUtils";
import { buildDvcChiTieuWorkbookBuffer, type CotChiTieu, type CotDau } from "./xuatChiTieuExcel";

const COT_CHI_TIEU: CotChiTieu<CtTagTndn03>[] = [
  { tag: "ctA1", header: "Chỉ tiêu A1 (Tổng lợi nhuận kế toán trước thuế thu nhập doanh nghiệp)" },
  { tag: "ctB1", header: "Chỉ tiêu B1 (Điều chỉnh tăng tổng lợi nhuận trước thuế thu nhập doanh nghiệp)" },
  { tag: "ctB2", header: "Chỉ tiêu B2 (Các khoản điều chỉnh tăng doanh thu)" },
  { tag: "ctB3", header: "Chỉ tiêu B3 (Chi phí của phần doanh thu điều chỉnh giảm)" },
  { tag: "ctB4", header: "Chỉ tiêu B4 (Các khoản chi không được trừ khi xác định thu nhập chịu thuế)" },
  { tag: "ctB5", header: "Chỉ tiêu B5 (Thuế thu nhập đã nộp cho phần thu nhập nhận được ở nước ngoài)" },
  {
    tag: "ctB6",
    header: "Chỉ tiêu B6 (Điều chỉnh tăng lợi nhuận do xác định giá thị trường đối với giao dịch liên kết)",
  },
  { tag: "ctB7", header: "Chỉ tiêu B7 (Các khoản điều chỉnh làm tăng lợi nhuận trước thuế khác)" },
  { tag: "ctB8", header: "Chỉ tiêu B8 (Điều chỉnh giảm tổng lợi nhuận trước thuế thu nhập doanh nghiệp)" },
  { tag: "ctB9", header: "Chỉ tiêu B9 (Giảm trừ các khoản doanh thu đã tính thuế năm trước)" },
  { tag: "ctB10", header: "Chỉ tiêu B10 (Chi phí của phần doanh thu điều chỉnh tăng )" },
  {
    tag: "ctB11",
    header:
      "Chỉ tiêu B11 (Chi phí lãi vay không được trừ kỳ trước được chuyển sang kỳ này của doanh nghiệp có giao dịch liên kết)",
  },
  { tag: "ctB12", header: "Chỉ tiêu B12 (Các khoản điều chỉnh làm giảm lợi nhuận trước thuế khác)" },
  { tag: "ctB13", header: "Chỉ tiêu B13 (Tổng thu nhập chịu thuế)" },
  { tag: "ctB14", header: "Chỉ tiêu B14 (Thu nhập chịu thuế từ hoạt động sản xuất kinh doanh)" },
  { tag: "ctB15", header: "Chỉ tiêu B15 (Thu nhập chịu thuế từ hoạt động chuyển nhượng BĐS)" },
  { tag: "ctC1", header: "Chỉ tiêu C1 (Thu nhập chịu thuế)" },
  { tag: "ctC2", header: "Chỉ tiêu C2 (Thu nhập miễn thuế)" },
  { tag: "ctC3", header: "Chỉ tiêu C3 (Chuyển lỗ và bù trừ lãi, lỗ)" },
  { tag: "ctC3a", header: "Chỉ tiêu C3a (+ Lỗ từ hoạt động SXKD được chuyển trong kỳ)" },
  {
    tag: "ctC3b",
    header: "Chỉ tiêu C3b (+ Lỗ từ chuyển nhượng BĐS được bù trừ với lãi của hoạt động SXKD)",
  },
  { tag: "ctC4", header: "Chỉ tiêu C4 (Thu nhập tính thuế (TNTT) (C4=C1-C2-C3))" },
  { tag: "ctC5", header: "Chỉ tiêu C5 (Trích lập quỹ khoa học công nghệ (nếu có))" },
  { tag: "ctC6", header: "Chỉ tiêu C6 (TNTT sau khi đã trích lập quỹ khoa học công nghệ (C6=C4-C5=C7+C8))" },
  { tag: "ctC7", header: "Chỉ tiêu C7 (+ Thu nhập tính thuế áp dụng thuế suất 20%)" },
  { tag: "ctC8", header: "Chỉ tiêu C8 (+ Thu nhập tính thuế tính theo thuế suất không ưu đãi khác)" },
  { tag: "ctC8a", header: "Chỉ tiêu C8a (+ Thuế suất không ưu đãi khác (%))" },
  {
    tag: "ctC9",
    header:
      "Chỉ tiêu C9 (Thuế TNDN từ hoạt động SXKD tính theo thuế suất không ưu đãi(C9 =(C7 x 20%) + (C8 x C8a)))",
  },
  { tag: "ctC10", header: "Chỉ tiêu C10 (Thuế TNDN được ưu đãi theo Luật thuế TNDN(C10 = C11 + C12 + C13))" },
  { tag: "ctC11", header: "Chỉ tiêu C11 (+ Thuế TNDN chênh lệch do áp dụng mức thuế suất ưu đãi)" },
  { tag: "ctC12", header: "Chỉ tiêu C12 (+ Thuế TNDN được miễn trong kỳ)" },
  { tag: "ctC13", header: "Chỉ tiêu C13 (+ Thuế TNDN được giảm trong kỳ)" },
  { tag: "ctC14", header: "Chỉ tiêu C14 (Thuế TNDN được miễn, giảm theo Hiệp định thuế)" },
  { tag: "ctC15", header: "Chỉ tiêu C15 (Thuế TNDN được miễn, giảm theo từng thời kỳ)" },
  { tag: "ctC16", header: "Chỉ tiêu C16 (Thuế thu nhập đã nộp ở nước ngoài được trừ trong kỳ tính thuế)" },
  {
    tag: "ctC17",
    header: "Chỉ tiêu C17 (Thuế TNDN phải nộp của hoạt động sản xuất kinh doanh(C17=C9-C10-C14-C15-C16))",
  },
  { tag: "ctD1", header: "Chỉ tiêu D1 (Thu nhập chịu thuế (D1 = B15))" },
  { tag: "ctD2", header: "Chỉ tiêu D2 (Lỗ từ hoạt động chuyển nhượng BĐS được chuyển trong kỳ )" },
  { tag: "ctD3", header: "Chỉ tiêu D3 (Thu nhập tính thuế (D3=D1-D2))" },
  { tag: "ctD4", header: "Chỉ tiêu D4 (Trích lập quỹ khoa học công nghệ (nếu có))" },
  { tag: "ctD5", header: "Chỉ tiêu D5 (TNTT sau khi đã trích lập quỹ khoa học công nghệ (D5=D3-D4))" },
  { tag: "ctD6", header: "Chỉ tiêu D6 (Thuế TNDN phải nộp của hoạt động chuyển nhượng BĐS trong kỳ)" },
  {
    tag: "ctD7",
    header:
      "Chỉ tiêu D7 (Thuế TNDN chênh lệch do áp dụng mức thuế suất ưu đãi đối với thu nhập từ thực hiện dự án đầu tư - kinh doanh nhà ở xã hội để bán, cho thuê, cho thuê mua)",
  },
  { tag: "ctD8", header: "Chỉ tiêu D8 (Thuế TNDN của hoạt động chuyển nhượng BĐS còn phải nộp kỳ này (D8=D6-D7))" },
  { tag: "ctE", header: "Chỉ tiêu E (Số thuế TNDN phải nộp quyết toán trong kỳ (E=E1+E2+E5))" },
  { tag: "ctE1", header: "Chỉ tiêu E1 (Thuế TNDN của hoạt động sản xuất kinh doanh )" },
  { tag: "ctE2", header: "Chỉ tiêu E2 (Thuế TNDN từ hoạt động chuyển nhượng bất động sản (E2=E3+E4))" },
  { tag: "ctE3", header: "Chỉ tiêu E3 (Thuế TNDN từ hoạt động chuyển nhượng bất động sản)" },
  {
    tag: "ctE4",
    header: "Chỉ tiêu E4 (Thuế TNDN từ hoạt động chuyển nhượng cơ sở hạ tầng, nhà có thu tiền theo tiến độ)",
  },
  { tag: "ctE5", header: "Chỉ tiêu E5 (Thuế TNDN phải nộp khác (nếu có))" },
  { tag: "ctE6", header: "Chỉ tiêu E6 (Trong đó thuế TNDN từ xử lý Quỹ phát triển khoa học công nghệ)" },
  { tag: "ctG", header: "Chỉ tiêu G (Số thuế TNDN đã tạm nộp (G=G1+G2+G3+G4+G5))" },
  { tag: "ctG1", header: "Chỉ tiêu G1 (Thuế TNDN nộp thừa kỳ trước chuyển sang kỳ này)" },
  { tag: "ctG2", header: "Chỉ tiêu G2 (Thuế TNDN đã tạm nộp trong năm)" },
  {
    tag: "ctG3",
    header: "Chỉ tiêu G3 (Thuế TNDN nộp thừa kỳ trước chuyển sang kỳ này của hoạt động chuyển nhượng BĐS)",
  },
  { tag: "ctG4", header: "Chỉ tiêu G4 (Thuế TNDN đã tạm nộp trong năm của hoạt động chuyển nhượng BĐS)" },
  {
    tag: "ctG5",
    header:
      "Chỉ tiêu G5 (Thuế TNDN đã tạm nộp các kỳ trước và trong năm quyết toán của hoạt động chuyển nhượng cơ sở hạ tầng, nhà có thu tiền theo tiến độ)",
  },
  {
    tag: "ctH1",
    header:
      "Chỉ tiêu H1 (Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp trong năm của hoạt động sản xuất kinh doanh (H1=E1+E5-G2))",
  },
  {
    tag: "ctH2",
    header:
      "Chỉ tiêu H2 (Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp trong năm của hoạt động chuyển nhượng BĐS (H2=E3-G4))",
  },
  {
    tag: "ctH3",
    header:
      "Chỉ tiêu H3 (Chênh lệch giữa số thuế phải nộp và số thuế đã tạm nộp của hoạt động chuyển nhượng cơ sở hạ tầng, nhà có thu tiền theo tiến độ (H3=E4-G5))",
  },
  {
    tag: "ctI",
    header: "Chỉ tiêu I (Số thuế TNDN còn phải nộp đến thời hạn nộp hồ sơ khai quyết toán thuế (I=E-G=I1+I2))",
  },
  { tag: "ctI1", header: "Chỉ tiêu I1 (Thuế TNDN còn phải nộp của hoạt động sản xuất kinh doanh)" },
  { tag: "ctI2", header: "Chỉ tiêu I2 (Thuế TNDN còn phải nộp của hoạt động chuyển nhượng BĐS)" },
];

const COT_DAU: CotDau<DvcTndn03XuatRow>[] = [
  { header: "Tên tờ khai", width: 30, value: (r) => r.tenTKhai || null },
  { header: "Kỳ kê khai", width: 14, value: (r) => r.kyKeKhai || null },
  { header: "Lần nộp", width: 10, align: "right", value: (r) => r.lanNop || null },
  { header: "Ngày lập", width: 12, value: (r) => (r.ngayLap ? formatDateVN(r.ngayLap) : null) },
  { header: "Loại tờ khai", width: 16, value: (r) => r.loaiToKhai || null },
];

export function buildTndn03WorkbookBuffer(rows: DvcTndn03XuatRow[]): Promise<ArrayBuffer> {
  return buildDvcChiTieuWorkbookBuffer({
    sheetName: "03-TNDN",
    cotDau: COT_DAU,
    cotChiTieu: COT_CHI_TIEU,
    layCt: (r) => r.ct,
    rows,
  });
}

export function tndn03WorkbookFilename(mst: string): string {
  return `${mst}_ToKhai03TNDN.xlsx`;
}
