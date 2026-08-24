import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { fmtNgayDai, fmtNgayGio } from "./mauInFormat";

/**
 * Các khối JSX DÙNG CHUNG của mọi form "mẫu in" tờ khai (01/GTGT, 05/KK-TNCN…).
 *
 * VÌ SAO TÁCH: khối cam đoan + ô ký và chân chữ ký số giống hệt nhau ở mọi mẫu TT80/2021. Trước đây
 * mỗi form chép một bản, nên sửa một chỗ phải nhớ sửa đủ mọi form — và hai bản ĐÃ bắt đầu lệch nhau
 * trước khi kịp gom về đây.
 *
 * KHÔNG gộp phần BẢNG chỉ tiêu vào đây: bảng mới là chỗ các mẫu khác nhau thật sự về cấu trúc
 * (01/GTGT hai cột tiền, 05/KK-TNCN năm cột có "Mã chỉ tiêu" + "Đơn vị tính"), gộp lại sẽ thành một
 * component đầy cờ điều kiện.
 *
 * Quy tắc định dạng số/ngày nằm ở `mauInFormat.ts` — tách file vì `react-refresh` không cho một
 * file vừa export component vừa export hàm.
 */

/** Số mã chỉ tiêu `[NN]` in đậm — lặp ở mọi dòng khối thông tin lẫn cột "Mã chỉ tiêu", gom một chỗ
 * để đổi cách hiển thị chỉ phải sửa ở đây. */
export function Ma({ n }: { n: string }) {
  return (
    <Box component="span" sx={{ fontWeight: 700 }}>
      [{n}]
    </Box>
  );
}

/**
 * Câu cam đoan + hai cột ký cuối mẫu in. GIỐNG HỆT nhau ở mọi mẫu tờ khai TT80/2021 nên nằm ở đây;
 * phần khác nhau giữa các mẫu là bảng chỉ tiêu, không phải khối này.
 */
export function CamDoanVaKhoiKy({ ngayKy, nguoiKy }: { ngayKy: string | null; nguoiKy: string }) {
  return (
    <>
      <Typography variant="body2" sx={{ mt: 2, fontStyle: "italic" }}>
        Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về những số liệu
        đã khai./...
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, gap: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            NHÂN VIÊN ĐẠI LÝ THUẾ
          </Typography>
          <Typography variant="body2" sx={{ mt: 4 }}>
            Họ và tên:
          </Typography>
          <Typography variant="body2">Chứng chỉ hành nghề số:</Typography>
        </Box>

        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body2" sx={{ fontStyle: "italic" }}>
            {fmtNgayDai(ngayKy)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
            NGƯỜI NỘP THUẾ hoặc
            <br />
            ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ
          </Typography>
          <Typography variant="caption" sx={{ fontStyle: "italic", display: "block" }}>
            (Ký, ghi rõ họ tên, chức vụ và đóng dấu nếu có)
          </Typography>
          <Typography variant="body2" sx={{ mt: 4, fontWeight: 600 }}>
            {nguoiKy}
          </Typography>
        </Box>
      </Box>
    </>
  );
}

/**
 * Chân trang chữ ký số — chỉ hiện khi hồ sơ đã ký.
 *
 * Mỗi dòng tự kiểm dữ liệu của mình thay vì dùng chung một điều kiện cho cả khối: có `SigningTime`
 * mà không moi được `CN=` (dạng chữ ký lạ) thì bản cũ in ra "Ký điện tử bởi:" cụt lủn không có gì
 * đằng sau.
 */
export function ChanChuKySo({
  kyDienTuBoi,
  ngayKyDienTu,
}: {
  kyDienTuBoi: string | null;
  ngayKyDienTu: string | null;
}) {
  if (!kyDienTuBoi && !ngayKyDienTu) return null;

  return (
    <>
      <Divider sx={{ mt: 3, mb: 1 }} />
      {kyDienTuBoi && (
        <Typography variant="body2" color="success.main" sx={{ fontStyle: "italic" }}>
          ✓ Ký điện tử bởi: {kyDienTuBoi}
        </Typography>
      )}
      {ngayKyDienTu && (
        <Typography variant="body2" color="text.secondary">
          Ngày ký: {fmtNgayGio(ngayKyDienTu)}.
        </Typography>
      )}
    </>
  );
}
