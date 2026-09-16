import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { getErrorMessage } from "@/lib/errors";
import { useSuaDanhMuc, useTaoDanhMuc } from "../../../api/to_khai_thue/toKhaiThueQueries";
import type {
  ChuKyTranMien,
  CreateIncomeCategoryPayload,
  NhomXuLyThue,
  OtherIncomeCategoryDto,
  TrangThaiDanhMuc,
} from "../../../types/toKhaiThue";
import { chiSo, tienVn } from "../../../_shared/format";
import { NHAN_NHOM_XU_LY } from "../nhan";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa danh mục đang có; `null` = thêm mới. */
  danhMuc: OtherIncomeCategoryDto | null;
}

interface Form {
  code: string;
  name: string;
  taxTreatmentGroup: NhomXuLyThue;
  exemptCapAmount: string;
  exemptCapPeriod: ChuKyTranMien;
  withholdingRate: string;
  withholdingThreshold: string;
  legalBasisNote: string;
  status: TrangThaiDanhMuc;
}

const RONG: Form = {
  code: "",
  name: "",
  taxTreatmentGroup: "WITHHOLDING_FLAT",
  exemptCapAmount: "",
  exemptCapPeriod: "MONTHLY",
  withholdingRate: "10",
  withholdingThreshold: "5000000",
  legalBasisNote: "",
  status: "ACTIVE",
};

const NHOM: NhomXuLyThue[] = [
  "EXEMPT_FULL",
  "EXEMPT_CAPPED",
  "TAXABLE_FULL",
  "WITHHOLDING_FLAT",
];

const GIAI_THICH: Record<NhomXuLyThue, string> = {
  EXEMPT_FULL: "Không tính thuế đồng nào, ví dụ tiền ăn ca do công ty tự nấu.",
  EXEMPT_CAPPED: "Miễn tới một mức trần, phần vượt mới chịu thuế — cần khai trần.",
  TAXABLE_FULL: "Cộng toàn bộ vào thu nhập chịu thuế của tháng rồi tính lũy tiến cùng lương.",
  WITHHOLDING_FLAT: "Khấu trừ ngay theo tỷ lệ cố định khi chi trả, thường cho người vãng lai.",
};

export default function DanhMucThuNhapDialog({ open, onClose, danhMuc }: Props) {
  const laSua = danhMuc !== null;
  const [form, setForm] = useState<Form>(RONG);
  const taoMut = useTaoDanhMuc();
  const suaMut = useSuaDanhMuc();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp lại form mỗi lần MỞ, cố ý reset theo prop nguồn (cùng khuôn `useFormDialog`)
    setForm(
      danhMuc
        ? {
            code: danhMuc.code,
            name: danhMuc.name,
            taxTreatmentGroup: danhMuc.taxTreatmentGroup,
            exemptCapAmount: danhMuc.exemptCapAmount !== null ? String(danhMuc.exemptCapAmount) : "",
            exemptCapPeriod: danhMuc.exemptCapPeriod ?? "MONTHLY",
            withholdingRate: danhMuc.withholdingRate !== null ? String(danhMuc.withholdingRate) : "10",
            withholdingThreshold:
              danhMuc.withholdingThreshold !== null ? String(danhMuc.withholdingThreshold) : "5000000",
            legalBasisNote: danhMuc.legalBasisNote ?? "",
            status: danhMuc.status,
          }
        : RONG,
    );
  }, [open, danhMuc]);

  const laTran = form.taxTreatmentGroup === "EXEMPT_CAPPED";
  const laKhauTru = form.taxTreatmentGroup === "WITHHOLDING_FLAT";
  // Phân biệt "để trống" với "gõ số 0" (RVW-741): `Number("")` là 0, nên gộp hai thứ này lại là
  // xóa trắng ô thành ra lưu danh mục khấu trừ 0% — mọi khoản theo loại đó khấu trừ 0đ mà không ai
  // biết. Để trống thì KHÔNG gửi trường, để máy chủ điền mặc định 10% / 5.000.000đ (AC-tkt-002).
  const tyLeNhap = form.withholdingRate.trim();
  const nguongNhap = form.withholdingThreshold.trim();
  const tyLe = tyLeNhap === "" ? null : Number(tyLeNhap);

  async function luu() {
    if (!form.name.trim()) {
      toast.error("Nhập tên loại thu nhập.");
      return;
    }
    if (laTran && chiSo(form.exemptCapAmount) <= 0) {
      toast.error("Nhóm miễn theo trần phải có mức trần lớn hơn 0.");
      return;
    }
    if (laKhauTru && tyLe !== null && (!Number.isFinite(tyLe) || tyLe <= 0 || tyLe > 100)) {
      toast.error("Tỷ lệ khấu trừ phải lớn hơn 0 và không quá 100. Bỏ trống thì máy chủ điền 10%.");
      return;
    }
    // `chiSo` bỏ mọi ký tự không phải chữ số nên "abc" ra 0 — ngưỡng 0 là khấu trừ từ đồng đầu
    // tiên, khác hẳn ý định của người gõ (RVW-758). Bỏ trống mới là "để máy chủ điền mặc định".
    if (laKhauTru && nguongNhap !== "" && chiSo(nguongNhap) <= 0) {
      toast.error("Ngưỡng khấu trừ phải là số lớn hơn 0. Bỏ trống thì máy chủ điền 5.000.000đ.");
      return;
    }

    // Máy chủ TỪ CHỐI tham số không thuộc nhóm (E-tkt-003) — chỉ gửi đúng trường của nhóm đang chọn.
    const chung = {
      name: form.name.trim(),
      taxTreatmentGroup: form.taxTreatmentGroup,
      legalBasisNote: form.legalBasisNote.trim() || undefined,
      status: form.status,
      ...(laTran
        ? { exemptCapAmount: chiSo(form.exemptCapAmount), exemptCapPeriod: form.exemptCapPeriod }
        : {}),
      ...(laKhauTru
        ? {
            ...(tyLe !== null ? { withholdingRate: tyLe } : {}),
            ...(nguongNhap !== "" ? { withholdingThreshold: chiSo(nguongNhap) } : {}),
          }
        : {}),
    };

    try {
      if (laSua && danhMuc) {
        const kq = await suaMut.mutateAsync({ id: danhMuc.id, payload: chung });
        toast.success("Đã lưu loại thu nhập.");
        if (kq.affectedRecordsCount > 0) {
          toast.info(
            `${kq.affectedRecordsCount} khoản đã ghi trước đó GIỮ NGUYÊN số thuế cũ — sửa danh mục không tính lại về trước.`,
          );
        }
      } else {
        const payload: CreateIncomeCategoryPayload = {
          ...chung,
          code: form.code.trim() || undefined,
        };
        await taoMut.mutateAsync(payload);
        toast.success("Đã thêm loại thu nhập.");
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa lưu được loại thu nhập."));
    }
  }

  const dangLuu = taoMut.isPending || suaMut.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{laSua ? "Sửa loại thu nhập" : "Thêm loại thu nhập"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Mã"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              disabled={laSua}
              helperText={laSua ? "Mã đã cấp thì không đổi." : "Bỏ trống để máy tự cấp mã TNxx."}
              sx={{ minWidth: 140 }}
            />
            <TextField
              required
              fullWidth
              label="Tên loại thu nhập"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Stack>

          <TextField
            select
            label="Cách tính thuế"
            value={form.taxTreatmentGroup}
            onChange={(e) =>
              setForm({ ...form, taxTreatmentGroup: e.target.value as NhomXuLyThue })
            }
            helperText={GIAI_THICH[form.taxTreatmentGroup]}
          >
            {NHOM.map((n) => (
              <MenuItem key={n} value={n}>
                {NHAN_NHOM_XU_LY[n]}
              </MenuItem>
            ))}
          </TextField>

          {laTran && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                required
                fullWidth
                label="Mức trần miễn thuế"
                value={form.exemptCapAmount}
                onChange={(e) => setForm({ ...form, exemptCapAmount: e.target.value })}
                slotProps={{ htmlInput: { inputMode: "numeric" } }}
                helperText={
                  chiSo(form.exemptCapAmount) > 0
                    ? `${tienVn(chiSo(form.exemptCapAmount))} đồng`
                    : "Nhập số nguyên đồng"
                }
              />
              <TextField
                select
                fullWidth
                label="Trần tính theo"
                value={form.exemptCapPeriod}
                onChange={(e) =>
                  setForm({ ...form, exemptCapPeriod: e.target.value as ChuKyTranMien })
                }
                helperText="Trần năm tính lũy kế cả năm dương lịch cho từng người."
              >
                <MenuItem value="MONTHLY">Tháng</MenuItem>
                <MenuItem value="YEARLY">Năm</MenuItem>
              </TextField>
            </Stack>
          )}

          {laKhauTru && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="Tỷ lệ khấu trừ (%)"
                value={form.withholdingRate}
                onChange={(e) => setForm({ ...form, withholdingRate: e.target.value })}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                helperText={
                  tyLeNhap === "" ? "Bỏ trống thì máy chủ điền mặc định 10%." : "Thường là 10% với cá nhân cư trú."
                }
              />
              <TextField
                fullWidth
                label="Ngưỡng bắt đầu khấu trừ"
                value={form.withholdingThreshold}
                onChange={(e) => setForm({ ...form, withholdingThreshold: e.target.value })}
                slotProps={{ htmlInput: { inputMode: "numeric" } }}
                helperText={
                  nguongNhap === ""
                    ? "Bỏ trống thì máy chủ điền mặc định 5.000.000đ."
                    : `${tienVn(chiSo(nguongNhap))} đồng cho mỗi lần chi trả.`
                }
              />
            </Stack>
          )}

          <TextField
            label="Căn cứ pháp lý"
            value={form.legalBasisNote}
            onChange={(e) => setForm({ ...form, legalBasisNote: e.target.value })}
            multiline
            minRows={2}
            helperText="Ghi điều khoản hoặc công văn để người sau biết vì sao đặt mức này."
          />

          <TextField
            select
            label="Trạng thái"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as TrangThaiDanhMuc })}
            helperText="Ngừng dùng thì loại này không chọn được khi ghi khoản mới, khoản cũ giữ nguyên."
          >
            <MenuItem value="ACTIVE">Đang dùng</MenuItem>
            <MenuItem value="INACTIVE">Ngừng dùng</MenuItem>
          </TextField>

          {laSua && danhMuc && danhMuc.usageCount > 0 && (
            <Alert severity="info">
              Đang có {danhMuc.usageCount} khoản dùng loại này. Sửa tham số ở đây KHÔNG tính lại các
              khoản đã ghi — chỉ khoản ghi từ sau mới theo mức mới.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={dangLuu}>
          Hủy
        </Button>
        <Button variant="contained" onClick={() => void luu()} disabled={dangLuu}>
          {dangLuu ? "Đang lưu…" : laSua ? "Lưu thay đổi" : "Thêm loại"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
