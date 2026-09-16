import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getErrorMessage } from "@/lib/errors";
import { useNhanVienList } from "../../../api/du_lieu_nhan_vien/nhanVienQueries";
import {
  useDanhSachDanhMuc,
  useSuaKhoan,
  useTaoKhoan,
  useTinhThuKhoan,
} from "../../../api/to_khai_thue/toKhaiThueQueries";
import type {
  CreateOtherIncomePayload,
  KieuTraTien,
  OtherIncomeCategoryDto,
  OtherIncomePreviewDto,
  OtherIncomeRecordDto,
} from "../../../types/toKhaiThue";
import { chiSo, tienVn } from "../../../_shared/format";
import { NHAN_CACH_KHAU_TRU, NHAN_NHOM_XU_LY } from "../nhan";

/** Một mục trong ô chọn loại thu nhập: danh mục đang dùng, hoặc danh mục cũ của khoản đang sửa. */
type LuaChonDanhMuc = Pick<
  OtherIncomeCategoryDto,
  "id" | "code" | "name" | "taxTreatmentGroup"
> &
  Partial<OtherIncomeCategoryDto> & { ngungDung?: boolean };

interface Props {
  open: boolean;
  onClose: () => void;
  periodId: string;
  /** Tháng/năm của kỳ — chặn ngày chi trả rơi ra ngoài tháng ngay tại ô nhập. */
  thang: number;
  nam: number;
  /** Có giá trị = sửa khoản đã ghi; `null` = thêm mới. */
  khoan: OtherIncomeRecordDto | null;
}

interface Form {
  otherIncomeCategoryId: string;
  ma_nv: string | null;
  fullName: string;
  taxCode: string;
  idCardNumber: string;
  address: string;
  phone: string;
  email: string;
  paymentDate: string;
  paymentType: KieuTraTien;
  amount: string;
  hasCommitment08: boolean;
  forceWithholding: boolean;
  eWithholdingCertNo: string;
  eWithholdingCertDate: string;
  note: string;
}

const RONG: Form = {
  otherIncomeCategoryId: "",
  ma_nv: null,
  fullName: "",
  taxCode: "",
  idCardNumber: "",
  address: "",
  phone: "",
  email: "",
  paymentDate: "",
  paymentType: "GROSS",
  amount: "",
  hasCommitment08: false,
  forceWithholding: false,
  eWithholdingCertNo: "",
  eWithholdingCertDate: "",
  note: "",
};

const haiSo = (n: number) => String(n).padStart(2, "0");

/** Ngày đầu và ngày cuối của tháng kỳ lương — `paymentDate` phải nằm trong khoảng này (BR-tkt-005). */
function bienNgay(nam: number, thang: number): { min: string; max: string } {
  const cuoi = new Date(Date.UTC(nam, thang, 0)).getUTCDate();
  return { min: `${nam}-${haiSo(thang)}-01`, max: `${nam}-${haiSo(thang)}-${haiSo(cuoi)}` };
}

/** Bỏ trường rỗng: máy chủ phân biệt "không gửi" với "gửi chuỗi rỗng" ở vài trường tùy chọn. */
function chuoiHoacBo(gt: string): string | undefined {
  const s = gt.trim();
  return s === "" ? undefined : s;
}

export default function ThuNhapNgoaiLuongDialog({
  open,
  onClose,
  periodId,
  thang,
  nam,
  khoan,
}: Props) {
  const laSua = khoan !== null;
  const { min, max } = bienNgay(nam, thang);
  const [form, setForm] = useState<Form>(RONG);
  // Gắn kết quả với CHÍNH bộ tham số đã gửi: đổi số tiền hay loại thu nhập là `thamSoTinhThu` đổi
  // danh tính, kết quả cũ tự hết hiệu lực ngay lập tức nên khối hiển thị rơi về "Đang tính…" thay vì
  // đứng ở số của lần gõ trước suốt cửa sổ chờ (RVW-760). Cách này cũng thay luôn bộ đếm lượt gọi
  // của RVW-749: phản hồi về muộn mang tham số cũ thì không khớp, tự bị bỏ qua.
  const [ketQuaTinhThu, setKetQuaTinhThu] = useState<{
    thamSo: object;
    kq: OtherIncomePreviewDto | null;
    loi: string | null;
  } | null>(null);

  const { data: danhMucs = [], isLoading: dangTaiDanhMuc } = useDanhSachDanhMuc({
    status: "ACTIVE",
  });
  const nhanViens = useNhanVienList();
  const tinhThuMut = useTinhThuKhoan();
  const taoMut = useTaoKhoan();
  const suaMut = useSuaKhoan();

  // Khoản cũ có thể trỏ tới danh mục ĐÃ NGỪNG DÙNG — danh sách chọn chỉ nạp loại đang dùng nên
  // phải ghép thêm danh mục của chính bản ghi vào (RVW-744), nếu không ô Loại thu nhập trắng trơn
  // và khoản đã ghi không sửa nổi kể cả những trường chẳng liên quan tới danh mục.
  const luaChon: LuaChonDanhMuc[] = useMemo(() => {
    if (!khoan || danhMucs.some((d) => d.id === khoan.otherIncomeCategoryId)) return danhMucs;
    // Lúc danh mục còn đang tải thì `danhMucs` rỗng, mọi khoản đều rơi vào nhánh ghép — chưa biết
    // gì mà dán nhãn "đã ngừng dùng" là nói sai về một loại đang dùng bình thường (RVW-757).
    return [...danhMucs, { ...khoan.category, ngungDung: !dangTaiDanhMuc }];
  }, [danhMucs, khoan, dangTaiDanhMuc]);

  const danhMuc = luaChon.find((d) => d.id === form.otherIncomeCategoryId) ?? null;
  /** Nhóm khác "khấu trừ tại nguồn" chỉ áp cho nhân viên nội bộ (E-tkt-021). */
  const batBuocNoiBo =
    danhMuc?.appliesToInternalOnly ??
    (danhMuc ? danhMuc.taxTreatmentGroup !== "WITHHOLDING_FLAT" : false);
  /** Cam kết 08 và ép khấu trừ chỉ có nghĩa với nhóm khấu trừ tại nguồn (BR-tkt-008). */
  const laKhauTruTaiNguon = danhMuc?.taxTreatmentGroup === "WITHHOLDING_FLAT";

/* eslint-disable react-hooks/set-state-in-effect -- nạp lại form mỗi lần MỞ dialog, cố ý reset theo prop nguồn (cùng khuôn `useFormDialog` của khu HRM) */
  useEffect(() => {
    if (!open) return;
    if (khoan) {
      setForm({
        otherIncomeCategoryId: khoan.otherIncomeCategoryId,
        ma_nv: khoan.ma_nv,
        fullName: khoan.fullName,
        taxCode: khoan.taxCode ?? "",
        idCardNumber: khoan.idCardNumber ?? "",
        address: khoan.address ?? "",
        phone: khoan.phone ?? "",
        email: khoan.email ?? "",
        paymentDate: khoan.paymentDate.slice(0, 10),
        paymentType: khoan.paymentType,
        amount: String(khoan.paymentType === "NET" ? khoan.netAmount : khoan.grossAmount),
        hasCommitment08: khoan.hasCommitment08,
        forceWithholding: khoan.forceWithholding,
        eWithholdingCertNo: khoan.eWithholdingCertNo ?? "",
        eWithholdingCertDate: khoan.eWithholdingCertDate?.slice(0, 10) ?? "",
        note: khoan.note ?? "",
      });
    } else {
      setForm({ ...RONG, paymentDate: `${nam}-${haiSo(thang)}-15` });
    }
    setKetQuaTinhThu(null);
  }, [open, khoan, nam, thang]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const soTien = chiSo(form.amount);

  /** Đủ dữ liệu để máy chủ tính thử chưa — thiếu thì khỏi bắn yêu cầu. */
  const duDeTinhThu =
    form.otherIncomeCategoryId !== "" && soTien > 0 && form.fullName.trim() !== "";

  const thamSoTinhThu = useMemo(
    () => ({
      otherIncomeCategoryId: form.otherIncomeCategoryId,
      ma_nv: form.ma_nv,
      fullName: form.fullName.trim(),
      taxCode: chuoiHoacBo(form.taxCode),
      idCardNumber: chuoiHoacBo(form.idCardNumber),
      paymentDate: form.paymentDate,
      paymentType: form.paymentType,
      amount: soTien,
      hasCommitment08: form.hasCommitment08,
      forceWithholding: form.forceWithholding,
      periodId,
    }),
    [
      form.otherIncomeCategoryId,
      form.ma_nv,
      form.fullName,
      form.taxCode,
      form.idCardNumber,
      form.paymentDate,
      form.paymentType,
      form.hasCommitment08,
      form.forceWithholding,
      soTien,
      periodId,
    ],
  );

  const conHieuLuc = ketQuaTinhThu?.thamSo === thamSoTinhThu;
  const tinhThu = conHieuLuc ? ketQuaTinhThu.kq : null;
  const loiTinhThu = conHieuLuc ? ketQuaTinhThu.loi : null;

  const goiTinhThu = tinhThuMut.mutateAsync;
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Số thuế do MÁY CHỦ tính (hợp đồng Mục 4.3): giao diện không được tự nhân tỷ lệ hay tự so ngưỡng,
  // lệch một chỗ là kế toán thấy một đằng, chứng từ khấu trừ in ra một nẻo.
  useEffect(() => {
    if (!open) return;
    if (hen.current) clearTimeout(hen.current);
    hen.current = setTimeout(() => {
      if (!duDeTinhThu) return;
      void goiTinhThu(thamSoTinhThu)
        .then((kq) => setKetQuaTinhThu({ thamSo: thamSoTinhThu, kq, loi: null }))
        .catch((err: unknown) =>
          setKetQuaTinhThu({
            thamSo: thamSoTinhThu,
            kq: null,
            loi: getErrorMessage(err, "Chưa tính thử được khoản này."),
          }),
        );
    }, 400);
    return () => {
      if (hen.current) clearTimeout(hen.current);
    };
  }, [open, duDeTinhThu, thamSoTinhThu, goiTinhThu]);

  function soatForm(): string | null {
    if (!form.otherIncomeCategoryId) return "Chọn loại thu nhập.";
    if (!form.fullName.trim()) return "Nhập họ tên người nhận.";
    if (batBuocNoiBo && !form.ma_nv) {
      return `Loại "${danhMuc?.name}" chỉ áp cho nhân viên trong công ty — hãy chọn nhân viên.`;
    }
    if (!form.paymentDate) return "Chọn ngày chi trả.";
    if (form.paymentDate < min || form.paymentDate > max) {
      return `Ngày chi trả phải nằm trong tháng ${thang}/${nam}.`;
    }
    if (soTien <= 0) return "Nhập số tiền lớn hơn 0.";
    if (form.hasCommitment08 && !laKhauTruTaiNguon) {
      return "Cam kết 08 chỉ dùng cho loại thu nhập khấu trừ tại nguồn.";
    }
    if (form.hasCommitment08 && !form.taxCode.trim()) {
      return "Cam kết 08 cần mã số thuế cá nhân của người nhận.";
    }
    return null;
  }

  async function luu() {
    const loi = soatForm();
    if (loi) {
      toast.error(loi);
      return;
    }
    const payload: CreateOtherIncomePayload = {
      periodId,
      otherIncomeCategoryId: form.otherIncomeCategoryId,
      ma_nv: form.ma_nv,
      fullName: form.fullName.trim(),
      taxCode: chuoiHoacBo(form.taxCode),
      idCardNumber: chuoiHoacBo(form.idCardNumber),
      address: chuoiHoacBo(form.address),
      phone: chuoiHoacBo(form.phone),
      email: chuoiHoacBo(form.email),
      paymentDate: form.paymentDate,
      paymentType: form.paymentType,
      amount: soTien,
      hasCommitment08: form.hasCommitment08,
      forceWithholding: form.forceWithholding,
      eWithholdingCertNo: chuoiHoacBo(form.eWithholdingCertNo),
      eWithholdingCertDate: chuoiHoacBo(form.eWithholdingCertDate),
      note: chuoiHoacBo(form.note),
    };
    try {
      if (laSua && khoan) {
        // Sửa khoản KHÔNG chuyển kỳ được: bỏ `periodId` khỏi thân yêu cầu.
        const { periodId: _bo, ...capNhat } = payload;
        void _bo;
        await suaMut.mutateAsync({ id: khoan.id, payload: capNhat });
        toast.success("Đã lưu khoản thu nhập ngoài lương.");
      } else {
        await taoMut.mutateAsync(payload);
        toast.success("Đã thêm khoản thu nhập ngoài lương.");
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa lưu được khoản thu nhập ngoài lương."));
    }
  }

  const dangLuu = taoMut.isPending || suaMut.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{laSua ? "Sửa khoản thu nhập ngoài lương" : "Thêm khoản thu nhập ngoài lương"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            select
            required
            label="Loại thu nhập"
            value={form.otherIncomeCategoryId}
            onChange={(e) => {
              // Hai cờ chỉ có nghĩa với nhóm khấu trừ tại nguồn (BR-tkt-008). Đổi sang nhóm khác thì
              // phải dọn, nếu không người dùng thấy ô trống, bị khóa, không bỏ được rồi bị chặn lúc
              // Lưu (RVW-743). Nhưng đổi giữa HAI loại cùng nhóm khấu trừ thì cờ vẫn đúng ý định —
              // dọn luôn là âm thầm bỏ cam kết 08 của người ta (RVW-756).
              const nhomMoi = luaChon.find((d) => d.id === e.target.value)?.taxTreatmentGroup;
              const giuCo = nhomMoi === "WITHHOLDING_FLAT";
              setForm({
                ...form,
                otherIncomeCategoryId: e.target.value,
                hasCommitment08: giuCo && form.hasCommitment08,
                forceWithholding: giuCo && form.forceWithholding,
              });
            }}
            helperText={
              danhMuc
                ? `${danhMuc.ngungDung ? "Loại này đã ngừng dùng — " : ""}${
                    NHAN_NHOM_XU_LY[danhMuc.taxTreatmentGroup]
                  }${
                    typeof danhMuc.exemptCapAmount === "number"
                      ? ` — trần ${tienVn(danhMuc.exemptCapAmount)}đ/${danhMuc.exemptCapPeriod === "YEARLY" ? "năm" : "tháng"}`
                      : ""
                  }${
                    typeof danhMuc.withholdingRate === "number"
                      ? ` — ${danhMuc.withholdingRate}% từ ${tienVn(danhMuc.withholdingThreshold ?? 0)}đ`
                      : ""
                  }`
                : dangTaiDanhMuc
                  ? "Đang tải danh mục…"
                  : "Danh mục do màn Loại thu nhập quản lý."
            }
          >
            {luaChon.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.code} — {d.name}
                {d.ngungDung ? " (đã ngừng dùng)" : ""}
              </MenuItem>
            ))}
          </TextField>

          <Divider textAlign="left">
            <Typography variant="caption">Người nhận</Typography>
          </Divider>

          <Autocomplete
            options={nhanViens}
            getOptionLabel={(nv) => `${nv.ma_nv} — ${nv.ho_ten}`}
            value={nhanViens.find((nv) => nv.ma_nv === form.ma_nv) ?? null}
            onChange={(_e, nv) =>
              setForm({
                ...form,
                ma_nv: nv?.ma_nv ?? null,
                fullName: nv?.ho_ten ?? form.fullName,
                taxCode: nv?.mst_ca_nhan ?? form.taxCode,
                idCardNumber: nv?.so_cccd ?? form.idCardNumber,
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Nhân viên trong công ty"
                required={batBuocNoiBo}
                helperText={
                  batBuocNoiBo
                    ? "Loại thu nhập này chỉ áp cho nhân viên nội bộ."
                    : "Bỏ trống nếu người nhận là cộng tác viên vãng lai."
                }
              />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              required
              fullWidth
              label="Họ tên người nhận"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <TextField
              fullWidth
              label="Mã số thuế cá nhân"
              value={form.taxCode}
              onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
              required={form.hasCommitment08}
            />
            <TextField
              fullWidth
              label="Số CCCD"
              value={form.idCardNumber}
              onChange={(e) => setForm({ ...form, idCardNumber: e.target.value })}
              helperText={form.ma_nv ? undefined : "Nên có: dùng để nhận diện người vãng lai."}
            />
          </Stack>

          {!form.ma_nv && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="Địa chỉ"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <TextField
                fullWidth
                label="Điện thoại"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <TextField
                fullWidth
                label="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Stack>
          )}

          <Divider textAlign="left">
            <Typography variant="caption">Khoản chi trả</Typography>
          </Divider>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              required
              fullWidth
              type="date"
              label="Ngày chi trả"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min, max } }}
              helperText={`Trong tháng ${thang}/${nam}`}
            />
            <TextField
              select
              fullWidth
              label="Số tiền là"
              value={form.paymentType}
              onChange={(e) => setForm({ ...form, paymentType: e.target.value as KieuTraTien })}
            >
              <MenuItem value="GROSS">Trước thuế (GROSS)</MenuItem>
              <MenuItem value="NET">Thực nhận (NET)</MenuItem>
            </TextField>
            <TextField
              required
              fullWidth
              label="Số tiền"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              slotProps={{ htmlInput: { inputMode: "numeric" } }}
              helperText={soTien > 0 ? `${tienVn(soTien)} đồng` : "Nhập số nguyên đồng"}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControlLabel
              disabled={!laKhauTruTaiNguon}
              control={
                <Checkbox
                  checked={form.hasCommitment08 && laKhauTruTaiNguon}
                  onChange={(e) =>
                    setForm({ ...form, hasCommitment08: e.target.checked, forceWithholding: false })
                  }
                />
              }
              label="Có cam kết 08 (không khấu trừ)"
            />
            <FormControlLabel
              disabled={!laKhauTruTaiNguon}
              control={
                <Checkbox
                  checked={form.forceWithholding && laKhauTruTaiNguon}
                  onChange={(e) =>
                    setForm({ ...form, forceWithholding: e.target.checked, hasCommitment08: false })
                  }
                />
              }
              label="Cá nhân yêu cầu khấu trừ dù dưới ngưỡng"
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="Số chứng từ khấu trừ điện tử"
              value={form.eWithholdingCertNo}
              onChange={(e) => setForm({ ...form, eWithholdingCertNo: e.target.value })}
            />
            <TextField
              fullWidth
              type="date"
              label="Ngày chứng từ"
              value={form.eWithholdingCertDate}
              onChange={(e) => setForm({ ...form, eWithholdingCertDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          <TextField
            fullWidth
            label="Ghi chú"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            multiline
            minRows={2}
          />

          <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
            <Typography variant="subtitle2" gutterBottom>
              Máy chủ tính thử
            </Typography>
            {loiTinhThu ? (
              <Alert severity="warning">{loiTinhThu}</Alert>
            ) : !duDeTinhThu ? (
              <Typography variant="body2" color="text.secondary">
                Chọn loại thu nhập, nhập họ tên và số tiền để xem trước số thuế.
              </Typography>
            ) : tinhThuMut.isPending || !tinhThu ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Đang tính…</Typography>
              </Stack>
            ) : (
              <Stack spacing={1}>
                <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap" }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Trước thuế
                    </Typography>
                    <Typography>{tienVn(tinhThu.grossAmount)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Miễn thuế
                    </Typography>
                    <Typography>{tienVn(tinhThu.exemptAmount)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Chịu thuế
                    </Typography>
                    <Typography>{tienVn(tinhThu.taxableAmount)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Thuế khấu trừ
                    </Typography>
                    <Typography>{tienVn(tinhThu.taxDeducted)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Thực nhận
                    </Typography>
                    <Typography sx={{ fontWeight: 600 }}>{tienVn(tinhThu.netAmount)}</Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {NHAN_CACH_KHAU_TRU[tinhThu.taxDeductionType]} · {tinhThu.explain}
                </Typography>
              </Stack>
            )}
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={dangLuu}>
          Hủy
        </Button>
        <Button variant="contained" onClick={() => void luu()} disabled={dangLuu}>
          {dangLuu ? "Đang lưu…" : laSua ? "Lưu thay đổi" : "Thêm khoản"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
