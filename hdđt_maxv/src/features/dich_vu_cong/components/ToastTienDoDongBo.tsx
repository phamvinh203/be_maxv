import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

import type { DvcDongBoTienDo } from "../api/dvc";

/**
 * Ruột của toast tiến độ đồng bộ Dịch vụ công — xem `theoDoiDongBoDvc`.
 *
 * Ở file RIÊNG (không nằm chung với hàm theo dõi) vì quy tắc `react-refresh/only-export-components`
 * không cho một file vừa định nghĩa component vừa export hàm thường — cùng lý do đã tách
 * `mauInChung.tsx` khỏi `mauInFormat.ts`.
 */

export default function ToastTienDoDongBo({ st }: { st: DvcDongBoTienDo }) {
  // Số hồ sơ đã xử lý = tổng ba kết cục. BE không gửi sẵn một trường tổng: nó suy ra được, mà giữ
  // thêm trường thì mỗi nhánh `continue` bên đó quên cộng là thanh tiến độ đứng im.
  const daXong = st.daCoSan + st.dongBoXong + st.loi;
  // `tongHoSo === 0` = BE còn đang tra cứu, CHƯA biết mẫu số. Vẽ 0% ở đây là nói dối người dùng
  // rằng đã bắt đầu mà chưa xong hồ sơ nào — thanh vô định mới đúng nghĩa "chưa đếm được".
  const coMauSo = st.tongHoSo > 0;
  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {coMauSo
          ? `Đang đồng bộ hồ sơ ${daXong}/${st.tongHoSo}…`
          : "Đang tra cứu hồ sơ trên cổng Dịch vụ công…"}
      </Typography>
      <LinearProgress
        variant={coMauSo ? "determinate" : "indeterminate"}
        value={coMauSo ? (daXong / st.tongHoSo) * 100 : undefined}
        // `color="inherit"` để thanh ăn theo màu chữ của toast: `ToastContainer` chạy
        // `theme="colored"` nên nền toast đổi màu theo loại, màu primary cố định sẽ chìm.
        color="inherit"
        sx={{ mt: 0.75, height: 6, borderRadius: 3, opacity: 0.85 }}
      />
      {st.maHoSoDangLam && (
        <Typography variant="caption" sx={{ display: "block", mt: 0.5, opacity: 0.85 }}>
          {st.maHoSoDangLam}
        </Typography>
      )}
    </Box>
  );
}
