import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import CircularProgress from "@mui/material/CircularProgress";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import { useAuth } from "../../auth/useAuth";
import { getErrorMessage } from "../../../lib/errors";
import { type CompanyDetail } from "../types";
import { useDeleteCompanyMutation } from "../api/companyQueries";

interface Props {
  /** Có giá trị = đang hỏi xóa công ty này; không có = dialog đóng. */
  company?: CompanyDetail;
  onClose: () => void;
}

/**
 * Xác nhận XÓA VĨNH VIỄN một công ty (xem `deleteCompany` ở companyApi). Vì không có thùng rác và
 * không hoàn tác được, nút xóa chỉ bật khi gõ lại đúng MST — chuẩn quen thuộc của thao tác drop
 * database. Tách khỏi `CompanyManagementTab` để tab đó không ôm thêm state của luồng xác nhận.
 */
export default function DeleteCompanyDialog({ company, onClose }: Props) {
  const { companies, currentCompanyId } = useAuth();
  const deleteMutation = useDeleteCompanyMutation();
  const busy = deleteMutation.isPending;

  const [confirmMst, setConfirmMst] = useState("");
  const [error, setError] = useState("");

  // Dọn ô nhập + lỗi mỗi lần mở cho công ty khác — cố ý reset theo prop ngoài.
  useEffect(() => {
    if (!company) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirmMst("");
    setError("");
  }, [company]);

  const isCurrent = company?.id === currentCompanyId;
  const isLastCompany = companies.length <= 1;
  // Cắt khoảng trắng MỘT lần: chuỗi so để bật nút và chuỗi gửi lên server phải là cùng một chuỗi.
  const typedMst = confirmMst.trim();
  const matched = typedMst === company?.maSoThue;

  const handleDelete = () => {
    if (!company || !matched) return;
    setError("");
    deleteMutation.mutate(
      { id: company.id, maSoThue: typedMst },
      {
        onSuccess: onClose,
        onError: (e) => setError(getErrorMessage(e, "Không xóa được công ty.")),
      },
    );
  };

  return (
    <Dialog
      open={Boolean(company)}
      // Đang xóa thì không cho đóng: lượt xóa vẫn chạy tiếp ở server, đóng dialog chỉ làm người
      // dùng tưởng đã hủy được.
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 700, color: "error.main", pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <WarningAmberRounded />
          <Box component="span">Xóa vĩnh viễn công ty/Hộ kinh doanh</Box>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Bạn sắp xóa{" "}
          <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
            {company?.tenDonVi}
          </Box>{" "}
          (MST {company?.maSoThue}).
        </DialogContentText>

        <Alert severity="error" icon={<WarningAmberRounded />} sx={{ mb: 2 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>Toàn bộ dữ liệu sẽ mất vĩnh viễn</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>Hóa đơn đầu vào và đầu ra đã đồng bộ</li>
            <li>Chi tiết từng hóa đơn đã tải về</li>
            <li>Lịch sử đồng bộ với Thuế điện tử</li>
            <li>Cơ sở dữ liệu riêng của công ty trên máy chủ</li>
          </Box>
          <Box sx={{ mt: 1, fontWeight: 700 }}>
            Thao tác này KHÔNG thể hoàn tác và không có bản sao lưu.
          </Box>
        </Alert>

        {isCurrent && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Đây là công ty bạn đang sử dụng.{" "}
            {/* Cố ý KHÔNG nêu tên công ty sẽ chuyển sang: đoán trước lựa chọn của server nghĩa là
                chép lại quy tắc chọn công ty (firstAccessibleCompanyId) sang TypeScript, và hai bên
                sẽ lệch nhau mà không gì phát hiện được. */}
            {isLastCompany
              ? "Đây cũng là công ty cuối cùng — sau khi xóa bạn sẽ cần thêm công ty mới để tiếp tục làm việc."
              : "Sau khi xóa, hệ thống sẽ tự chuyển sang một công ty khác của bạn."}
          </Alert>
        )}

        <TextField
          fullWidth
          size="small"
          label="Nhập mã số thuế để xác nhận"
          placeholder={company?.maSoThue}
          value={confirmMst}
          onChange={(e) => setConfirmMst(e.target.value)}
          disabled={busy}
          helperText={
            matched
              ? "Mã số thuế khớp — có thể xóa."
              : `Gõ đúng ${company?.maSoThue} để bật nút xóa.`
          }
          slotProps={{ formHelperText: { sx: { mx: 0 } } }}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={busy || !matched}
        >
          {busy ? <CircularProgress size={20} color="inherit" /> : "Xóa vĩnh viễn"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
