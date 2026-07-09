import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { useAuth } from "../../auth/useAuth";
import { useGdtSession } from "../../hddt/gdtSession/useGdtSession";
import DialogLoginHddt from "../../../components/dialogLoginHddt";
import {
  createCompany,
  updateCompany,
  type CompanyDetail,
} from "../api/companyApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Có giá trị = sửa công ty này; không có = tạo mới. */
  company?: CompanyDetail;
}

const MST_REGEX = /^[0-9]{10}(-[0-9]{3})?$/;

export default function CompanyFormDialog({ open, onClose, onSaved, company }: Props) {
  const { accessToken } = useAuth();
  const { setGdtToken } = useGdtSession();
  const isEdit = Boolean(company);

  const [tenCongTy, setTenCongTy] = useState("");
  const [maSoThue, setMaSoThue] = useState("");
  const [diaChi, setDiaChi] = useState("");
  const [sdt, setSdt] = useState("");
  const [loaiHinhKinhDoanh, setLoaiHinhKinhDoanh] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [gdtLoginOpen, setGdtLoginOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Nạp lại form mỗi lần mở dialog (tạo mới hoặc sửa) — cố ý reset theo state ngoài.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTenCongTy(company?.tenDonVi ?? "");
    setMaSoThue(company?.maSoThue ?? "");
    setDiaChi(company?.diaChi ?? "");
    setSdt(company?.sdt ?? "");
    setLoaiHinhKinhDoanh(company?.loaiHinhKinhDoanh ?? "");
    setError("");
  }, [open, company]);

  const handleSubmit = async () => {
    setError("");

    if (!tenCongTy.trim() || !diaChi.trim()) {
      setError("Vui lòng nhập Tên công ty và Địa chỉ.");
      return;
    }
    if (!isEdit && !MST_REGEX.test(maSoThue.trim())) {
      setError("Mã số thuế không hợp lệ.");
      return;
    }
    if (!accessToken) {
      setError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
      return;
    }

    const basePayload = {
      tenCongTy: tenCongTy.trim(),
      diaChi: diaChi.trim(),
      sdt: sdt.trim() || undefined,
      loaiHinhKinhDoanh: loaiHinhKinhDoanh.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (isEdit && company) {
        await updateCompany(accessToken, company.id, basePayload);
      } else {
        await createCompany(accessToken, { ...basePayload, maSoThue: maSoThue.trim() });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được công ty.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? "Sửa công ty/Hộ kinh doanh" : "Thêm công ty/Hộ kinh doanh"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Tên công ty"
            value={tenCongTy}
            onChange={(e) => setTenCongTy(e.target.value)}
            fullWidth
            autoFocus
            required
          />
          <TextField
            label="Mã số thuế"
            value={maSoThue}
            onChange={(e) => setMaSoThue(e.target.value)}
            fullWidth
            required
            disabled={isEdit}
            helperText={isEdit ? "Mã số thuế không thể thay đổi sau khi tạo." : undefined}
          />
          <TextField
            label="Địa chỉ"
            value={diaChi}
            onChange={(e) => setDiaChi(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Số điện thoại công ty"
            value={sdt}
            onChange={(e) => setSdt(e.target.value)}
            fullWidth
          />
          <TextField
            label="Loại hình kinh doanh"
            value={loaiHinhKinhDoanh}
            onChange={(e) => setLoaiHinhKinhDoanh(e.target.value)}
            placeholder="Công ty TNHH, cổ phần, hộ kinh doanh..."
            fullWidth
          />

          <Button
            variant="outlined"
            startIcon={<ReceiptLongRounded />}
            sx={{ textTransform: "none" }}
            onClick={() => setGdtLoginOpen(true)}
          >
            Đăng nhập vào hóa đơn điện tử
          </Button>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Hủy
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : "Lưu"}
        </Button>
      </DialogActions>

      <DialogLoginHddt
        open={gdtLoginOpen}
        onClose={() => setGdtLoginOpen(false)}
        initialUsername={maSoThue.trim() || undefined}
        onLoginSuccess={(token, mst) => setGdtToken(mst, token)}
      />
    </Dialog>
  );
}
