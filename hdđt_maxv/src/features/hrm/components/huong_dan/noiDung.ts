/**
 * Nội dung các hộp "Hướng dẫn …" của khu HRM — MỘT chỗ sửa lời hướng dẫn cho mọi khu.
 *
 * Viết theo đúng màn hình đang có (nhãn nút, tên tab khớp giao diện). Đổi nhãn một nút ở màn nào thì
 * sửa luôn câu tương ứng ở đây, kẻo hướng dẫn chỉ tới nút không còn tồn tại. Bản đầy đủ cho người
 * dùng cuối: `docs/HDSD_hrm.md`.
 */

export interface BuocHuongDan {
  tieuDe: string;
  moTa: string;
}

export interface HuongDan {
  /** Ghép sau chữ "Hướng dẫn" ở nút và tiêu đề hộp thoại, vd "chốt kỳ lương". */
  tenKhu: string;
  gioiThieu?: string;
  buoc: BuocHuongDan[];
}

export const HUONG_DAN_CHOT_KY_LUONG: HuongDan = {
  tenKhu: "chốt kỳ lương",
  buoc: [
    {
      tieuDe: "Chọn tháng cần chốt",
      moTa: 'Dùng ô tháng ở góc phải thanh HRM. Tháng chưa có kỳ lương thì bấm "Tạo kỳ lương".',
    },
    {
      tieuDe: "Nhập đủ dữ liệu từng bảng kê",
      moTa: 'Bấm "Xem chi tiết" trên từng thẻ để mở đúng màn nhập liệu (chấm công, tăng ca, KPI, thưởng...).',
    },
    {
      tieuDe: "Chốt số từng bảng kê",
      moTa: 'Rà xong bảng kê nào thì bấm "Chốt số liệu" bảng kê đó. 8 bảng kê có dữ liệu riêng của kỳ sẽ bị khóa sửa; 4 bảng kê dữ liệu dùng chung (Thu nhập ngoài bảng lương, Giảm trừ thuế TNCN, Hồ sơ lương, Khoản hỗ trợ) chỉ ghi nhận đã rà soát.',
    },
    {
      tieuDe: "Tính lương",
      moTa: 'Bấm "Tính lương" để chạy bảng lương tạm của kỳ. Ô "Bảng lương a/b NV" cho biết đã tính cho bao nhiêu nhân viên — thêm nhân viên mới sau đó thì tính lại.',
    },
    {
      tieuDe: "Chốt số toàn kỳ",
      moTa: "Chốt nốt mọi bảng kê còn đang mở trong một lần.",
    },
    {
      tieuDe: "Trình duyệt, khóa sổ, duyệt",
      moTa: "Khóa sổ tính lại lần cuối và chụp bảng lương chính thức — từ đó mọi dữ liệu của kỳ chỉ đọc. Khóa sổ không bắt buộc đã chốt đủ 12 bảng kê, nhưng sẽ cảnh báo.",
    },
    {
      tieuDe: "Khi cần sửa lại",
      moTa: 'Chủ tài khoản bấm "Mở chốt" trên bảng kê cần sửa. Kỳ đã khóa sổ thì phải "Mở lại kỳ lương" (kèm lý do từ 20 ký tự) trước. Mọi thao tác đều hiện ở Lịch sử hoạt động.',
    },
  ],
};

export const HUONG_DAN_DU_LIEU_NHAN_VIEN: HuongDan = {
  tenKhu: "dữ liệu nhân viên",
  gioiThieu:
    "Khai tổ chức và hồ sơ nhân sự — nền cho mọi bước tính lương. Nên làm lần lượt theo thứ tự dưới đây.",
  buoc: [
    {
      tieuDe: "Khai cây phòng ban",
      moTa: 'Tab Phòng ban → "Thêm phòng ban": nhập tên, chọn phòng ban trực thuộc (để trống nếu là cấp cao nhất), mã tự sinh. Phòng ban đã giải thể thì chuyển trạng thái "Ngừng" thay vì xóa, để còn tra cứu chứng từ cũ.',
    },
    {
      tieuDe: "Thêm nhân viên",
      moTa: 'Tab Nhân viên → "Thêm nhân viên": điền thông tin cá nhân (họ tên bắt buộc), công việc (phòng ban, chức vụ, ngày vào, tham gia công đoàn) và tài khoản ngân hàng. Có thể nhập luôn hợp đồng đầu tiên ở nhóm "Thông tin hợp đồng".',
    },
    {
      tieuDe: "Hoàn thiện hồ sơ ngay sau khi lưu",
      moTa: 'Lưu lần đầu xong, hộp thoại mở thêm 3 tab "Lịch sử hợp đồng", "Hồ sơ, tài liệu", "Người phụ thuộc" — nhập tiếp tại chỗ, không phải tìm lại người vừa tạo.',
    },
    {
      tieuDe: "Ký / đổi hợp đồng",
      moTa: 'Lên chính thức, gia hạn hay đổi mức lương thì dùng nghiệp vụ đổi hợp đồng ở tab "Lịch sử hợp đồng": hệ thống tự chốt ngày kết thúc hợp đồng cũ và tạo hợp đồng mới trong một lần lưu. Nút sửa trên từng dòng chỉ dùng để sửa lỗi gõ.',
    },
    {
      tieuDe: "Đăng ký người phụ thuộc",
      moTa: 'Tab Người phụ thuộc (hoặc tab cùng tên trong hồ sơ nhân viên): nhập họ tên, quan hệ, CCCD/MST và kỳ giảm trừ "Từ tháng – Đến tháng" (để trống "Đến tháng" nếu còn hiệu lực). Mức giảm trừ tiền khai ở Cấu hình mặc định.',
    },
    {
      tieuDe: "Đính kèm giấy tờ scan",
      moTa: 'Tab "Hồ sơ, tài liệu" trong hồ sơ nhân viên: mỗi dòng là một loại giấy tờ, đính được nhiều file ảnh/PDF (tối đa 10MB/file, 20 file/giấy tờ). File lưu trên Google Drive của công ty — lần đầu hệ thống sẽ hỏi kết nối Drive.',
    },
    {
      tieuDe: "Gán nhanh phòng ban",
      moTa: 'Nhiều người chưa có phòng ban, hoặc cần chuyển hàng loạt? Tab Phòng ban → "Gán nhanh phòng ban": lọc và tick chọn nhân viên, chọn phòng ban đích rồi bấm "Gán".',
    },
    {
      tieuDe: "Lưu ý quyền xem lương",
      moTa: "Tài khoản không có quyền xem lương sẽ không thấy nhóm hợp đồng, tài khoản ngân hàng và tab lịch sử hợp đồng — liên hệ chủ tài khoản để được cấp quyền.",
    },
  ],
};

export const HUONG_DAN_CAU_HINH_MAC_DINH: HuongDan = {
  tenKhu: "cấu hình mặc định",
  gioiThieu:
    "Tham số dùng chung cho toàn công ty — gốc để tính ngày công, bảo hiểm, thuế cho mọi nhân viên. Rà soát kỹ trước kỳ lương đầu tiên.",
  buoc: [
    {
      tieuDe: "Rà các nhóm tham số",
      moTa: "Tab Thiết lập chung gồm: ngày công & giờ công (26/24 ngày cố định hay tự đếm theo tháng, chính sách thứ 7/chủ nhật), nghỉ phép, hệ số và trần giờ tăng ca, lương cơ sở / tối thiểu vùng, tỷ lệ bảo hiểm nhân viên và công ty đóng, công đoàn, giảm trừ bản thân và người phụ thuộc.",
    },
    {
      tieuDe: "Kiểm biểu thuế TNCN",
      moTa: "Biểu lũy tiến 7 bậc theo luật hiện hành. Ô ngưỡng là thu nhập tính thuế LŨY KẾ tới hết bậc, bậc cuối là bậc mở không có ngưỡng. Sửa lệch biểu chuẩn vẫn lưu được nhưng hệ thống sẽ cảnh báo.",
    },
    {
      tieuDe: "Miễn trừ & khấu trừ đặc biệt",
      moTa: "Khai trần miễn thuế phụ cấp ăn trưa (VNĐ/tháng), tỷ lệ khấu trừ tại nguồn cho hợp đồng thử việc/thời vụ (mặc định 10%) và ngưỡng thu nhập mỗi lần chi trả bắt đầu khấu trừ.",
    },
    {
      tieuDe: "Lưu một lần cho cả trang",
      moTa: '"Lưu cấu hình" ghi toàn bộ thay đổi; "Hoàn tác" bỏ các thay đổi chưa lưu; "Khôi phục mặc định" ghi đè về bộ tham số chuẩn theo luật — không hoàn tác được, hệ thống sẽ hỏi lại trước.',
    },
    {
      tieuDe: "Khai ca làm việc",
      moTa: 'Cuối trang Thiết lập chung → "Thêm ca làm việc": giờ vào, giờ ra, nghỉ giữa ca — số giờ công tự tính, giờ ra sớm hơn giờ vào là ca qua đêm. Danh sách ca lưu ngay khi bấm, không cần "Lưu cấu hình".',
    },
    {
      tieuDe: "Tạo lịch ngày lễ",
      moTa: 'Tab Lịch ngày lễ → "Tạo nhanh": chọn năm để tạo 11 ngày lễ chuẩn theo Bộ luật Lao động (ngày đã có tự bỏ qua, bấm lại không tạo trùng). Ngày nghỉ riêng của công ty, nghỉ bù thì "Thêm ngày lễ" thủ công.',
    },
    {
      tieuDe: "Vì sao lịch lễ quan trọng",
      moTa: 'Ngày lễ quyết định hệ số tăng ca 300%/390% và được trừ khỏi ngày công chuẩn khi tính theo ngày thực tế. Tick "Có lương" nếu nhân viên nghỉ ngày đó vẫn hưởng đủ công.',
    },
  ],
};

export const HUONG_DAN_CAI_DAT_LUONG: HuongDan = {
  tenKhu: "cài đặt lương",
  gioiThieu:
    "Khai các khoản lương/phụ cấp của công ty, dựng cấu trúc lương chung rồi set mức lương cho từng người.",
  buoc: [
    {
      tieuDe: "Tạo danh mục khoản lương",
      moTa: "Tab Danh mục lương & phụ cấp: cột trái liệt kê 7 loại khoản (Lương/Phụ cấp, Lương hỗ trợ, Lương nghiệm thu, Lương phần trăm, Lương KPI, Lương thưởng, Lương chuyên cần) — bấm dấu cộng ở loại cần để tạo khoản mới đúng loại đó.",
    },
    {
      tieuDe: "Đánh dấu bảo hiểm & thuế cho từng khoản",
      moTa: 'Tick "Tính vào lương đóng BHXH" nếu khoản cộng vào gốc đóng bảo hiểm; bỏ tick "Chịu thuế TNCN" để miễn thuế. Khoản loại Lương hỗ trợ có thêm ô "Phụ cấp ăn trưa" — được miễn thuế trong trần đã khai ở Cấu hình mặc định.',
    },
    {
      tieuDe: "Ngừng thay vì xóa",
      moTa: 'Khoản đã dùng cho các kỳ lương cũ thì chuyển trạng thái "Ngừng" để bảng lương cũ vẫn đọc được tên khoản.',
    },
    {
      tieuDe: "Dựng cấu trúc lương",
      moTa: 'Tab Set lương, phần trên: nhập thời gian hiệu lực, bấm "Thêm khoản có sẵn" để đưa khoản vào cấu trúc; mỗi khoản chọn phân loại thuế, có làm gốc tính tăng ca không, tiêu thức tính (cố định tháng, theo ngày công...) và mức mặc định. Xong bấm "Lưu cấu trúc lương".',
    },
    {
      tieuDe: "Set lương từng nhân viên",
      moTa: 'Phần dưới tab Set lương: lọc "Chưa set lương", bấm bút chì ở dòng nhân viên, sửa số tiền riêng cho người đó (điền sẵn mức mặc định của cấu trúc) rồi Lưu — bản set chuyển sang Chờ duyệt.',
    },
    {
      tieuDe: "Duyệt lương",
      moTa: 'Bấm "Duyệt lương" để duyệt hàng loạt các bản đang Chờ duyệt. Mọi lần sửa set lương đều phải duyệt lại — chỉ bản Đã duyệt mới được đưa vào tính lương.',
    },
  ],
};

export const HUONG_DAN_DU_LIEU_TINH_LUONG: HuongDan = {
  tenKhu: "dữ liệu tính lương",
  gioiThieu:
    "Nhập biến động lương của từng kỳ: chấm công, tăng ca, KPI, thưởng, lương sản phẩm, lương phần trăm, lương chuyên cần, các khoản ứng - bù trừ lương.",
  buoc: [
    {
      tieuDe: "Chọn kỳ lương",
      moTa: 'Chọn tháng ở góc phải thanh HRM; tháng chưa có kỳ thì bấm "Tạo kỳ lương". Mọi tab bên dưới nhập cho đúng kỳ đang chọn.',
    },
    {
      tieuDe: "Chấm công",
      moTa: 'Bảng lưới theo ngày; ô chưa sửa tự theo lịch chuẩn nên chỉ cần sửa ngày khác thường (phép, ốm, công tác...). Bấm vào ô, chọn loại công (phím tắt 1–8), nhập số giờ nếu cần rồi Enter để lưu; "Xóa ô" đưa ô về mặc định theo lịch.',
    },
    {
      tieuDe: "Soạn bảng nháp ở các tab còn lại",
      moTa: 'Các tab Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm, Lương chuyên cần và Các khoản ứng - bù trừ lương dùng chung một khuôn: "Thêm dòng" để soạn bảng nháp (loại/chỉ tiêu + số liệu). Loại/chỉ tiêu chưa có thì tạo ở nút "Quản lý …" của từng tab.',
    },
    {
      tieuDe: "Chọn phạm vi rồi Áp dụng",
      moTa: 'Chọn phạm vi Nhân viên (theo bộ lọc), Phòng ban hoặc Toàn công ty rồi bấm "Áp dụng …" — bảng nháp được ghi cho TOÀN BỘ người trong danh sách, dữ liệu cũ của họ trong kỳ bị thay thế. Kiểm kỹ phạm vi, nhất là ở tab Các khoản ứng - bù trừ lương.',
    },
    {
      tieuDe: "Tái sử dụng & Excel",
      moTa: '"Tái sử dụng" chép lại bảng của một người đã áp trong kỳ; "Tải mẫu / Nhập Excel / Xuất Excel" để làm việc theo file thay vì nhập tay.',
    },
    {
      tieuDe: "Lương chuyên cần: mỗi lần vi phạm một dòng",
      moTa: "Đi trễ 3 hôm khác nhau là 3 dòng, mỗi dòng có ngày vi phạm. Áp bảng trống cũng hợp lệ — nghĩa là kỳ này không vi phạm, nhân viên nhận đủ khoản chuyên cần.",
    },
    {
      tieuDe: "Khi tab bị khóa",
      moTa: "Kỳ đang chờ duyệt / đã khóa sổ, hoặc bảng kê đã được chốt số ở màn Chốt kỳ lương thì tab chuyển chỉ đọc kèm cảnh báo. Cần sửa thì mở chốt bảng kê (hoặc mở lại kỳ) ở màn Chốt kỳ lương.",
    },
    {
      tieuDe: "Bước tiếp theo",
      moTa: 'Nhập xong, sang Bảng lương để soát số; rồi bấm nút "Chốt kỳ lương" ở góc phải thanh HRM để chốt số từng bảng kê và khóa sổ.',
    },
  ],
};

export const HUONG_DAN_BANG_LUONG: HuongDan = {
  tenKhu: "bảng lương",
  gioiThieu:
    "Màn chỉ xem kết quả — mọi con số do máy chủ tính từ hợp đồng, set lương đã duyệt và dữ liệu tính lương của kỳ, không có ô nhập tay.",
  buoc: [
    {
      tieuDe: "Chọn kỳ",
      moTa: 'Chọn tháng ở góc phải thanh HRM. Kỳ còn mở tính trực tiếp theo dữ liệu mới nhất; kỳ đã khóa sổ đọc bản chốt cứng lúc khóa sổ (có nhãn "Đã khóa sổ").',
    },
    {
      tieuDe: "Đọc số tổng",
      moTa: "3 thẻ đầu trang: Tổng quỹ lương (gồm phần bảo hiểm, kinh phí công đoàn công ty đóng), Tổng thực lĩnh và Tổng thuế TNCN.",
    },
    {
      tieuDe: "Đọc bảng lương",
      moTa: 'Hai cột đầu dính bên trái khi cuộn ngang. Di chuột vào số "Thu nhập" để xem các khoản cấu thành; Bù trừ màu đỏ là khấu trừ, màu xanh là bù thêm; Thực lĩnh âm nghĩa là tạm ứng vượt lương.',
    },
    {
      tieuDe: "Đổi cách xem",
      moTa: 'Ô "Chế độ" đổi GROSS/NET để đối chiếu; ô "Chi tiết" chọn "Rút gọn" để chỉ xem các cột chính.',
    },
    {
      tieuDe: "Tính lại sau khi sửa dữ liệu",
      moTa: 'Vừa sửa chấm công, tăng ca... thì bấm "Tính lại lương". Kỳ đã khóa sổ nút đổi thành "Tải lại số liệu" và không tính lại — muốn sửa phải "Mở lại kỳ lương" ở màn Chốt kỳ lương.',
    },
    {
      tieuDe: "Lương hỗ trợ",
      moTa: "Tab Lương hỗ trợ bóc tách từng khoản hỗ trợ (ăn ca, xăng xe, điện thoại...), mỗi khoản một cột, đã quy theo ngày công — cộng khớp phần hỗ trợ trong cột Thu nhập. Tab này luôn tính theo dữ liệu hiện tại, kể cả khi kỳ đã khóa sổ.",
    },
    {
      tieuDe: "Xuất Excel",
      moTa: 'Bấm "Xuất Excel" ở từng tab để tải file đầy đủ cột.',
    },
  ],
};
