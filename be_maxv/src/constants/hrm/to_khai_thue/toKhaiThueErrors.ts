import { HttpStatus } from '../../httpStatus';

/**
 * 21 mã lỗi chuẩn hóa của sub-cụm Tờ khai thuế TNCN (`srs-to-khai-thue.md` Mục 8).
 *
 * KHÁC `PAYROLL_ERROR_CODES` ở một điểm có chủ đích: **HTTP status gắn liền với mã lỗi**, không
 * phải tham số của chỗ ném. SRS đã quy định sẵn status cho từng mã, mà mã lỗi lại được ném ở
 * nhiều service khác nhau — để status là tham số thì sớm muộn cũng có chỗ ném đúng mã nhưng sai
 * status, và đó là loại lỗi không test nào bắt trừ khi kiểm từng endpoint một.
 *
 * Điều kiện nghiệm thu của QA (`api-contract` Mục 9 điểm 2): grep được đủ 21 mã này trong phản
 * hồi thật của máy chủ, ở trường `code`.
 */
export const TO_KHAI_THUE_ERRORS = {
  'E-tkt-001': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Mã hoặc tên loại thu nhập ngoài lương đã tồn tại.',
  },
  'E-tkt-002': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Loại thu nhập này đã có bản ghi sử dụng nên không xóa được. Hãy chuyển sang trạng thái Ngừng dùng.',
  },
  'E-tkt-003': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Thiếu ngưỡng hoặc tỷ lệ bắt buộc của nhóm xử lý thuế đã chọn.',
  },
  'E-tkt-004': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Bản ghi thu nhập ngoài lương phải có họ tên, ngày chi trả và loại thu nhập.',
  },
  'E-tkt-005': {
    status: HttpStatus.CONFLICT,
    message:
      'Đã có bản ghi trùng hoàn toàn (cùng người, cùng kỳ, cùng loại thu nhập, cùng ngày và cùng số tiền).',
  },
  'E-tkt-006': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Cam kết 08/CK-TNCN chỉ áp dụng cho khoản khấu trừ tại nguồn, với cá nhân cư trú và có mã số thuế.',
  },
  'E-tkt-007': {
    status: HttpStatus.FORBIDDEN,
    message:
      'Bảng tính thuế của tháng này đã chốt nên không sửa hay xóa bản ghi thu nhập ngoài lương được nữa.',
  },
  'E-tkt-008': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Phải khóa sổ kỳ lương của tháng này trước khi chốt Bảng tính thuế.',
  },
  'E-tkt-009': {
    status: HttpStatus.FORBIDDEN,
    message:
      'Tờ khai quý chứa tháng này đã xuất nên không mở lại Bảng tính thuế tháng được nữa.',
  },
  'E-tkt-010': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Phải chốt đủ Bảng tính thuế của cả ba tháng trong quý trước khi xuất tờ khai.',
  },
  'E-tkt-011': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Ghi đè chỉ tiêu phải nêu lý do, tối thiểu 10 ký tự.',
  },
  'E-tkt-012': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Chỉ tiêu này là chỉ tiêu tổng hợp, luôn được tính lại từ các chỉ tiêu thành phần nên không ghi đè được.',
  },
  'E-tkt-013': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Chỉ đánh dấu đã nộp được với tờ khai đã xuất.',
  },
  'E-tkt-014': {
    status: HttpStatus.FORBIDDEN,
    message:
      'Bạn không có quyền xem dữ liệu lương nên không thực hiện được thao tác này.',
  },
  'E-tkt-015': {
    // Lỗi HẠ TẦNG, không phải lỗi người dùng: thiếu dòng chính sách thuế nghĩa là tenant chưa
    // chạy `npm run hrm:seed-thue`. Có mã riêng để không rơi vào 500 vô danh — người trực vận
    // hành đọc mã là biết chạy lệnh nào, thay vì phải lần theo log.
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message:
      'Chưa có chính sách thuế TNCN hiệu lực cho kỳ này. Cần nạp dữ liệu khởi tạo cụm thuế (hrm:seed-thue) trước khi tính.',
  },
  'E-tkt-016': {
    status: HttpStatus.NOT_FOUND,
    message: 'Không tìm thấy bản ghi.',
  },
  'E-tkt-017': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Kỳ lương không tồn tại.',
  },
  'E-tkt-018': {
    status: HttpStatus.CONFLICT,
    message:
      'Trạng thái chốt của Bảng tính thuế tháng này vừa thay đổi. Hãy tải lại rồi thao tác lại.',
  },
  'E-tkt-019': {
    status: HttpStatus.FORBIDDEN,
    message: 'Tờ khai đã xuất nên không sửa hay xóa ghi đè chỉ tiêu được nữa.',
  },
  'E-tkt-020': {
    status: HttpStatus.CONFLICT,
    message: 'Tờ khai quý này đã được xuất. Hãy tải lại để xem bản đã xuất.',
  },
  'E-tkt-021': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Chỉ khoản khấu trừ tại nguồn mới ghi cho cá nhân vãng lai. Khoản thuộc nhóm khác phải chọn nhân viên.',
  },
} as const;

export type ToKhaiThueErrorCode = keyof typeof TO_KHAI_THUE_ERRORS;
