/**
 * ===== LAYOUT MẪU IN 01/GTGT (TT80/2021/TT-BTC) =====
 *
 * Nguồn khai báo DUY NHẤT cho hai màn cùng dựng mẫu này:
 *   - `dich_vu_cong/components/ToKhaiGtgt01Form.tsx` — chỉ đọc, số bóc từ XML tờ khai ĐÃ NỘP.
 *   - `to_khai/components/ToKhaiGtgt01Editor.tsx`    — nhập được, số tính từ bảng kê của kỳ.
 *
 * Chép mảng này sang file thứ hai là cầm chắc hai bản trôi lệch nhau khi mẫu tờ khai đổi — mà lệch
 * ở đây nghĩa là hai màn hiện hai bộ chỉ tiêu khác nhau cho cùng một tờ khai.
 *
 * Kiểu của `giaTri`/`thue` để `string` (không phải union thẻ của riêng module Dịch vụ công) vì màn
 * lập tờ khai đọc bộ chỉ tiêu tự tính, không đi qua kiểu của API DVC.
 *
 * Hàng "A" (checkbox "Không phát sinh…") KHÔNG nằm trong danh sách này — nó là hàng duy nhất không
 * theo khuôn giaTri/thue nên mỗi màn tự dựng trong JSX.
 */

export interface HangChiTieu {
  stt: string;
  nhan: string;
  /** Thẻ `ctNN` đổ vào cột "Giá trị hàng hóa, dịch vụ". */
  giaTri?: string;
  /** Thẻ `ctNN` đổ vào cột "Thuế giá trị gia tăng". */
  thue?: string;
  /** Hàng tiêu đề mục lớn (C/I/II/IV/VI…) — chữ đậm, không có cột số tiền. */
  header?: boolean;
  /** Mức thụt lề (0 = gốc). */
  indent?: number;
}

export const HANG_GTGT01: HangChiTieu[] = [
  { stt: "B", nhan: "Thuế giá trị gia tăng còn được khấu trừ kỳ trước chuyển sang", thue: "ct22" },
  {
    stt: "C",
    nhan: "Kê khai thuế giá trị gia tăng phải nộp ngân sách nhà nước",
    header: true,
  },
  { stt: "I", nhan: "Hàng hoá, dịch vụ mua vào trong kỳ", header: true, indent: 1 },
  {
    stt: "1",
    nhan: "Giá trị và thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào",
    giaTri: "ct23",
    thue: "ct24",
    indent: 2,
  },
  {
    stt: "",
    nhan: "Trong đó: hàng hóa, dịch vụ nhập khẩu",
    giaTri: "ct23a",
    thue: "ct24a",
    indent: 3,
  },
  {
    stt: "2",
    nhan: "Thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào được khấu trừ kỳ này",
    thue: "ct25",
    indent: 2,
  },
  { stt: "II", nhan: "Hàng hoá, dịch vụ bán ra trong kỳ", header: true, indent: 1 },
  {
    stt: "1",
    nhan: "Hàng hóa, dịch vụ bán ra không chịu thuế giá trị gia tăng",
    giaTri: "ct26",
    indent: 2,
  },
  {
    stt: "2",
    nhan: "Hàng hóa, dịch vụ bán ra chịu thuế giá trị gia tăng ([27]=[29]+[30]+[32]+[32a]; [28]=[31]+[33])",
    giaTri: "ct27",
    thue: "ct28",
    indent: 2,
  },
  { stt: "a", nhan: "Hàng hóa, dịch vụ bán ra chịu thuế suất 0%", giaTri: "ct29", indent: 3 },
  {
    stt: "b",
    nhan: "Hàng hóa, dịch vụ bán ra chịu thuế suất 5%",
    giaTri: "ct30",
    thue: "ct31",
    indent: 3,
  },
  {
    stt: "c",
    nhan: "Hàng hóa, dịch vụ bán ra chịu thuế suất 10%",
    giaTri: "ct32",
    thue: "ct33",
    indent: 3,
  },
  { stt: "d", nhan: "Hàng hoá, dịch vụ bán ra không tính thuế", giaTri: "ct32a", indent: 3 },
  {
    stt: "3",
    nhan: "Tổng doanh thu và thuế giá trị gia tăng của hàng hóa, dịch vụ bán ra ([34]=[26]+[27]; [35]=[28])",
    giaTri: "ct34",
    thue: "ct35",
    indent: 2,
  },
  {
    stt: "III",
    nhan: "Thuế giá trị gia tăng phát sinh trong kỳ ([36]=[35]-[25])",
    thue: "ct36",
    indent: 1,
  },
  {
    stt: "IV",
    nhan: "Điều chỉnh tăng, giảm thuế giá trị gia tăng còn được khấu trừ của các kỳ trước",
    header: true,
    indent: 1,
  },
  { stt: "1", nhan: "Điều chỉnh giảm", thue: "ct37", indent: 2 },
  { stt: "2", nhan: "Điều chỉnh tăng", thue: "ct38", indent: 2 },
  {
    stt: "V",
    nhan: "Thuế giá trị gia tăng nhận bàn giao được khấu trừ trong kỳ",
    thue: "ct39a",
    indent: 1,
  },
  {
    stt: "VI",
    nhan: "Xác định nghĩa vụ thuế giá trị gia tăng phải nộp trong kỳ:",
    header: true,
    indent: 1,
  },
  {
    stt: "1",
    nhan: "Thuế giá trị gia tăng phải nộp của hoạt động sản xuất kinh doanh trong kỳ {[40a]=([36]-[22]+[37]-[38]-[39a])≥0}",
    thue: "ct40a",
    indent: 2,
  },
  {
    stt: "2",
    nhan: "Thuế giá trị gia tăng mua vào của dự án đầu tư được bù trừ với thuế GTGT còn phải nộp của hoạt động sản xuất kinh doanh cùng kỳ tính thuế ([40b]≤[40a])",
    thue: "ct40b",
    indent: 2,
  },
  {
    stt: "3",
    nhan: "Thuế giá trị gia tăng còn phải nộp trong kỳ ([40]=[40a]-[40b])",
    thue: "ct40",
    indent: 2,
  },
  {
    stt: "4",
    nhan: "Thuế giá trị gia tăng chưa khấu trừ hết kỳ này {[41]=([36]-[22]+[37]-[38]-[39a])≤0}",
    thue: "ct41",
    indent: 2,
  },
  { stt: "4.1", nhan: "Thuế giá trị gia tăng đề nghị hoàn ([42]≤[41])", thue: "ct42", indent: 2 },
  {
    stt: "4.2",
    nhan: "Thuế giá trị gia tăng còn được khấu trừ chuyển kỳ sau ([43]=[41]-[42])",
    thue: "ct43",
    indent: 2,
  },
];

/** `"ct24a"` -> `"24a"` — số trong ngoặc `[NN]` trên mẫu SUY từ tên thẻ, không khai tay, để nhãn và
 * số không bao giờ lệch nhau. Chuyển từ `dich_vu_cong/components/mauInFormat.ts` sang đây khi hai
 * màn cùng cần; file cũ re-export lại nên mọi chỗ đang import vẫn chạy. */
export function maChiTieu(tag: string): string {
  return tag.slice(2);
}

/**
 * Ô kế toán được phép sửa tay trên màn Tờ khai.
 *
 * PHẢI khớp `CT_NHAP_TAY` trong `be_maxv/src/services/client/to_khai/tinhGtgt01.ts` — backend lọc
 * theo danh sách đó, nên ô có ở đây mà thiếu bên kia sẽ bị nuốt im lặng: người dùng gõ số, thấy
 * báo "Đã lưu", rồi số nhảy về như cũ. Hai project không dùng chung package nên đây là bản sao có
 * chủ ý; sửa một bên thì sửa cả hai.
 *
 * Ô CÔNG THỨC THUẦN ([27] [28] [34] [35] [36] [40] [40a] [41] [43]) cố tình vắng mặt: chúng là
 * tổng của các ô trên, sửa tay chỉ làm tờ khai mâu thuẫn với chính nó. Muốn đổi thì sửa ô nguồn.
 */
export const O_SUA_DUOC: ReadonlySet<string> = new Set([
  // máy không suy được — mặc định 0
  "ct22",
  "ct23a",
  "ct24a",
  "ct25",
  "ct37",
  "ct38",
  "ct39a",
  "ct40b",
  "ct42",
  // máy suy từ hóa đơn — ghi đè thì thắng
  "ct23",
  "ct24",
  "ct26",
  "ct29",
  "ct30",
  "ct31",
  "ct32",
  "ct32a",
  "ct33",
]);
