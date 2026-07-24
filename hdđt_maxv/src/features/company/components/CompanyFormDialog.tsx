import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { getErrorMessage } from "../../../lib/errors";
import { type CompanyDetail } from "../types";
import { MST_REGEX } from "../mst";
import { useCreateCompanyMutation, useUpdateCompanyMutation } from "../api/companyQueries";
import { useTaxPayerQuery } from "../api/taxPayerQueries";

/** Chờ người dùng gõ xong MST rồi mới tra cứu, tránh bắn request mỗi lần gõ một số. */
const MST_LOOKUP_DEBOUNCE_MS = 500;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa công ty này; không có = tạo mới. */
  company?: CompanyDetail;
  /**
   * Chế độ mời tạo công ty đầu tiên (user vừa đăng ký, chưa có công ty nào):
   * thêm câu chào và đổi nhãn nút "Hủy" thành "Để sau". Chỉ khác về wording,
   * logic tạo/sửa giữ nguyên.
   */
  onboarding?: boolean;
}

export default function CompanyFormDialog({
  open,
  onClose,
  company,
  onboarding = false,
}: Props) {
  const isEdit = Boolean(company);

  const createMutation = useCreateCompanyMutation();
  const updateMutation = useUpdateCompanyMutation();
  const submitting = createMutation.isPending || updateMutation.isPending;

  const [tenCongTy, setTenCongTy] = useState("");
  const [maSoThue, setMaSoThue] = useState("");
  const [diaChi, setDiaChi] = useState("");
  const [sdt, setSdt] = useState("");
  const [loaiHinhKinhDoanh, setLoaiHinhKinhDoanh] = useState("");
  const [error, setError] = useState("");
  /** Giá trị ô MST sau debounce — tách khỏi `maSoThue` để mỗi phím gõ không đổi queryKey. */
  const [debouncedMst, setDebouncedMst] = useState("");

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
    // Xóa luôn MST của lần mở trước, nếu không query cũ còn cache sẽ điền đè lên form vừa reset.
    setDebouncedMst("");
  }, [open, company]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMst(maSoThue.trim()), MST_LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [maSoThue]);

  // Chỉ tra khi đang tạo mới: lúc sửa thì ô MST khóa, không có gì để tra.
  const lookup = useTaxPayerQuery(debouncedMst, open && !isEdit);
  const taxPayer = lookup.data;
  const lookupError = lookup.isError
    ? getErrorMessage(lookup.error, "Không tra cứu được mã số thuế.")
    : "";

  useEffect(() => {
    if (!taxPayer) return;
    // Ghi đè cả khi người dùng đã gõ tay — dữ liệu cơ quan thuế là nguồn chuẩn.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTenCongTy(taxPayer.name);
    setDiaChi(taxPayer.address);
  }, [taxPayer]);

  const handleSubmit = () => {
    setError("");

    if (!tenCongTy.trim() || !diaChi.trim()) {
      setError("Vui lòng nhập Tên công ty và Địa chỉ.");
      return;
    }
    if (!isEdit && !MST_REGEX.test(maSoThue.trim())) {
      setError("Mã số thuế không hợp lệ.");
      return;
    }

    const basePayload = {
      tenCongTy: tenCongTy.trim(),
      diaChi: diaChi.trim(),
      sdt: sdt.trim() || undefined,
      loaiHinhKinhDoanh: loaiHinhKinhDoanh.trim() || undefined,
    };

    const handlers = {
      onSuccess: () => onClose(),
      onError: (e: unknown) => setError(getErrorMessage(e, "Không lưu được công ty.")),
    };

    if (isEdit && company) {
      updateMutation.mutate({ id: company.id, payload: basePayload }, handlers);
    } else {
      createMutation.mutate({ ...basePayload, maSoThue: maSoThue.trim() }, handlers);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? "Sửa công ty/Hộ kinh doanh" : "Thêm công ty/Hộ kinh doanh"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {onboarding && (
            <Typography variant="body2" color="text.secondary">
              Chào mừng! Hãy thêm công ty/hộ kinh doanh để bắt đầu sử dụng.
            </Typography>
          )}
          
          <TextField
            label="Mã số thuế"
            value={maSoThue}
            onChange={(e) => setMaSoThue(e.target.value)}
            fullWidth
            required
            autoFocus
            disabled={isEdit}
            error={Boolean(lookupError)}
            helperText={
              isEdit
                ? "Mã số thuế không thể thay đổi sau khi tạo."
                : lookupError || "Nhập mã số thuế 10 số để tự động điền tên và địa chỉ."
            }
            slotProps={{
              input: {
                endAdornment: lookup.isFetching ? (
                  <InputAdornment position="end">
                    <CircularProgress size={18} />
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
          
          <TextField
            label="Tên công ty"
            value={tenCongTy}
            onChange={(e) => setTenCongTy(e.target.value)}
            fullWidth
            required
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

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          {onboarding ? "Để sau" : "Hủy"}
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : "Lưu"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
