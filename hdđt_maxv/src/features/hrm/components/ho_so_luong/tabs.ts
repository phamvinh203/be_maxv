/**
 * Mười bốn màn hình con của khu "Hồ sơ lương".
 *
 * Để ở file riêng (không nằm trong component) vì thanh điều hướng, bảng route và
 * màn hình "đang phát triển" đều đọc bảng này — mười bốn tab mà khai ba chỗ thì
 * chắc chắn sẽ có chỗ quên sửa.
 *
 * Nhóm "Báo cáo …" cố ý mượn đúng icon của màn dữ liệu mà nó báo cáo (chấm công,
 * thưởng, KPI…) để người dùng nối được hai đầu mà không phải đọc nhãn.
 */

import type { SvgIconComponent } from "@mui/icons-material";
import HistoryEduRounded from "@mui/icons-material/HistoryEduRounded";
import MenuBookRounded from "@mui/icons-material/MenuBookRounded";
import CardGiftcardRounded from "@mui/icons-material/CardGiftcardRounded";
import TrackChangesRounded from "@mui/icons-material/TrackChangesRounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import PercentRounded from "@mui/icons-material/PercentRounded";
import FactCheckRounded from "@mui/icons-material/FactCheckRounded";
import RequestQuoteRounded from "@mui/icons-material/RequestQuoteRounded";
import HealthAndSafetyRounded from "@mui/icons-material/HealthAndSafetyRounded";
import LocalAtmRounded from "@mui/icons-material/LocalAtmRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import ReceiptRounded from "@mui/icons-material/ReceiptRounded";
import MarkEmailReadRounded from "@mui/icons-material/MarkEmailReadRounded";

export interface ManHinhHoSoLuong {
  path: string;
  label: string;
  /** Icon đứng trước nhãn tab. Giữ component, xem ghi chú ở `du_lieu_tinh_luong/tabs.ts`. */
  icon: SvgIconComponent;
  /** Một câu mô tả, hiện ở màn hình "đang phát triển" cho tới khi dựng xong. */
  moTa: string;
}

export const MAN_HINH_HO_SO_LUONG: ManHinhHoSoLuong[] = [
  {
    path: "lap-hop-dong",
    label: "Lập hợp đồng",
    icon: HistoryEduRounded,
    moTa: "Sinh hợp đồng lao động từ dữ liệu nhân viên và mức lương đã set, in ra theo mẫu của công ty.",
  },
  {
    path: "so-hkd",
    label: "Lấy số lên sổ HKD",
    icon: MenuBookRounded,
    moTa: "Kết chuyển chi phí lương của kỳ sang sổ sách hộ kinh doanh, không phải gõ lại số.",
  },
  {
    path: "bao-cao-thuong",
    label: "Báo cáo thưởng",
    icon: CardGiftcardRounded,
    moTa: "Tổng hợp các khoản thưởng đã chi trong kỳ, tách theo loại thưởng và theo phòng ban.",
  },
  {
    path: "bao-cao-kpi",
    label: "Báo cáo KPI",
    icon: TrackChangesRounded,
    moTa: "Hiệu suất KPI của từng người và từng phòng ban, kèm mức đạt của từng chỉ tiêu.",
  },
  {
    path: "bao-cao-cham-cong",
    label: "Báo cáo chấm công",
    icon: EventAvailableRounded,
    moTa: "Tổng hợp ngày công, nghỉ phép, nghỉ không lương và giờ tăng ca của cả kỳ.",
  },
  {
    path: "bao-cao-khoi-luong",
    label: "Báo cáo khối lượng",
    icon: Inventory2Rounded,
    moTa: "Sản lượng đã nghiệm thu theo từng sản phẩm và từng người, đối chiếu với tiền lương sản phẩm đã trả.",
  },
  {
    path: "bao-cao-luong-phan-tram",
    label: "Báo cáo lương phần trăm",
    icon: PercentRounded,
    moTa: "Doanh số làm gốc, tỷ lệ áp dụng và hoa hồng đã trả cho từng nhân viên trong kỳ.",
  },
  {
    path: "08ck-tncn",
    label: "08CK-TNCN",
    icon: FactCheckRounded,
    moTa: "Bản cam kết 08/CK-TNCN cho người có thu nhập chưa tới mức phải khấu trừ thuế, in theo mẫu để ký.",
  },
  {
    path: "02-tndn",
    label: "02-TNDN",
    icon: RequestQuoteRounded,
    moTa: "Phụ lục 02/TNDN về chi phí tiền lương được trừ khi xác định thu nhập chịu thuế doanh nghiệp.",
  },
  {
    path: "c12-bhxh",
    label: "C12 BHXH",
    icon: HealthAndSafetyRounded,
    moTa: "Đối chiếu mẫu C12 của cơ quan bảo hiểm với số phần mềm tính, tìm chênh lệch tiền đóng từng tháng.",
  },
  {
    path: "phieu-chi-tien-mat",
    label: "Phiếu chi tiền mặt",
    icon: LocalAtmRounded,
    moTa: "Phiếu chi cho những người nhận lương tiền mặt, một phiếu một người, in kèm chữ ký nhận.",
  },
  {
    path: "danh-sach-chuyen-khoan",
    label: "Danh sách chuyển khoản",
    icon: AccountBalanceRounded,
    moTa: "File danh sách trả lương qua ngân hàng — số tài khoản, chủ tài khoản và số tiền thực lĩnh của từng người.",
  },
  {
    path: "phieu-luong",
    label: "Phiếu lương",
    icon: ReceiptRounded,
    moTa: "Phiếu lương cá nhân của từng người: các khoản được nhận, các khoản bị trừ và số thực lĩnh.",
  },
  {
    path: "thu-xac-nhan-thu-nhap",
    label: "Thư xác nhận thu nhập",
    icon: MarkEmailReadRounded,
    moTa: "Thư xác nhận mức thu nhập theo yêu cầu của nhân viên — dùng khi vay vốn, xin visa, chứng minh tài chính.",
  },
];
