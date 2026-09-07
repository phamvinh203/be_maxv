import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { getErrorMessage } from "../../../../lib/errors";
import { trangThaiHopDong } from "../../cay";
import { KIEU_LUONG, LOAI_HD } from "../../constants";
import { homNay, ngayVn, nhan, tienVn } from "../../format";
import { hopDongRong } from "../../formDefaults";
import {
  soatLuongHopDong,
  useDoiHopDong,
  useHopDongList,
} from "../../api/hopDongQueries";
import type { HopDong, HopDongFormValues, KieuLuong, LoaiHopDong, NhanVien } from "../../types";
import OThongTin from "../OThongTin";
import TienField from "../TienField";

interface Props {
  open: boolean;
  onClose: () => void;
  nhanVien: NhanVien;
  /** Hợp đồng hiện hành, `null` khi nhân viên chưa ký hợp đồng nào. */
  hopDongHienTai: HopDong | null;
}

/** Cộng `so` ngày vào một mốc `YYYY-MM-DD`. Tính trên UTC để không lệch múi giờ. */
function themNgay(iso: string, so: number): string {
  const moc = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(moc)) return iso;
  return new Date(moc + so * 86400000).toISOString().slice(0, 10);
}

/**
 * Gom nhãn `loai_hd` về NHÓM NGHIỆP VỤ — bản sao đúng từng chữ của `loaiHdVeNhanVien`
 * (`be_maxv/src/services/client/hrm/hopDong.service.ts`), theo QĐ #18.
 *
 * Chỉ dùng để KHỬ TRÙNG ô chọn "hợp đồng cần chốt": hai hợp đồng cùng nhóm thì chốt cái nào
 * máy chủ cũng tìm ra cùng một bản ghi, bày hai dòng chỉ làm người dùng phân vân. Giá trị gửi
 * lên vẫn là nhãn gốc — việc gom nhóm thật là của máy chủ, FE KHÔNG gom trước.
 */
function nhomHopDong(loaiHd: string): string {
  const chuan = loaiHd.trim().toLowerCase();
  if (chuan === "thu_viec") return "thu_viec";
  if (chuan === "khoan") return "hdvc";
  return "hdld";
}

/**
 * Chốt hợp đồng hiện tại và ký hợp đồng mới trong một lần.
 *
 * Tách khỏi `HopDongFormDialog` (sửa một dòng lịch sử) vì đây là một **thao tác
 * nghiệp vụ** chạm vào hai bản ghi: thiếu bước chốt sẽ để lại hai hợp đồng cùng
 * hiệu lực, và cột "Hợp đồng" trên bảng nhân viên hiện cái nào cũng như nhau.
 */
export default function ThayDoiHopDongDialog({
  open,
  onClose,
  nhanVien,
  hopDongHienTai,
}: Props) {
  const doiHopDong = useDoiHopDong();
  // Cùng khóa cache với tab "Lịch sử hợp đồng" nên KHÔNG tốn thêm lượt gọi. Cần cả danh sách
  // (không chỉ `hopDongHienTai`) vì từ QĐ #1 một người có thể có HĐLĐ và HĐ khoán cùng chạy —
  // ô "hợp đồng cần chốt" phải liệt kê đủ để người dùng chọn đúng cái muốn chốt.
  const { items: lichSu } = useHopDongList(nhanVien.ma_nv);

  const [ngayChot, setNgayChot] = useState("");
  const [loaiHdCanChot, setLoaiHdCanChot] = useState<LoaiHopDong>("xac_dinh");
  const [values, setValues] = useState<HopDongFormValues>(hopDongRong);
  const [dangLuu, setDangLuu] = useState(false);
  const [daBamLuu, setDaBamLuu] = useState(false);
  const loiLuong = soatLuongHopDong(values);

  /**
   * Các hợp đồng ĐANG HIỆU LỰC hôm nay, mỗi nhóm nghiệp vụ giữ một dòng đại diện.
   * Đây chính là tập máy chủ sẽ tìm trong đó để chốt (`doiHopDong` lọc theo nhóm).
   */
  const ungVienChot = useMemo(() => {
    const moc = homNay();
    const theoNhom = new Map<string, HopDong>();
    for (const hd of lichSu) {
      if (trangThaiHopDong(hd, moc) !== "Hiệu lực") continue;
      const nhom = nhomHopDong(hd.loai_hd);
      if (!theoNhom.has(nhom)) theoNhom.set(nhom, hd);
    }
    return [...theoNhom.values()];
  }, [lichSu]);

  useEffect(() => {
    if (!open) return;
    const moc = homNay();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNgayChot(moc);
    setDaBamLuu(false);
    setValues({
      ...hopDongRong(),
      // Kế thừa điều khoản của hợp đồng đang chạy — đổi hợp đồng thường chỉ
      // thay số hiệu, thời hạn và mức lương, không thay toàn bộ.
      loai_hd: hopDongHienTai?.loai_hd ?? "xac_dinh",
      kieu_luong: hopDongHienTai?.kieu_luong ?? "GROSS",
      luong_chinh: hopDongHienTai?.luong_chinh ?? 0,
      luong_bhxh: hopDongHienTai?.luong_bhxh ?? 0,
      trich_bhxh: hopDongHienTai?.trich_bhxh ?? true,
      tinh_tncn: hopDongHienTai?.tinh_tncn ?? true,
      ngay_bat_dau: hopDongHienTai ? themNgay(moc, 1) : moc,
    });
  }, [open, hopDongHienTai]);

  /*
   * Mặc định của ô "hợp đồng cần chốt": lấy theo hợp đồng hiện hành mà màn hình đang hiển thị,
   * để trường hợp thường gặp nhất (chỉ có một hợp đồng) không phải chọn thêm gì.
   *
   * Tách khỏi effect mở dialog vì `ungVienChot` tới sau — dialog mở trước khi truy vấn lịch sử
   * hợp đồng về đích thì effect kia đã chạy xong và ô sẽ đứng ở giá trị mặc định cứng.
   */
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaiHdCanChot(
      hopDongHienTai?.loai_hd ?? ungVienChot[0]?.loai_hd ?? "xac_dinh",
    );
  }, [open, hopDongHienTai, ungVienChot]);

  const dat = <K extends keyof HopDongFormValues>(khoa: K, giaTri: HopDongFormValues[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleSubmit = async () => {
    setDaBamLuu(true);
    if (loiLuong.luong_chinh || loiLuong.luong_bhxh) return;

    setDangLuu(true);
    try {
      /*
       * `loai_hd_can_chot` là trường BẮT BUỘC của `POST /hop-dong/doi` (QĐ #1) — thiếu là 400.
       *
       * Không còn hợp đồng nào đang hiệu lực thì vẫn phải gửi một giá trị hợp lệ: gửi luôn
       * loại của hợp đồng mới. Máy chủ tìm trong nhóm đó, không thấy gì để chốt và trả
       * `da_chot_hop_dong_cu = false` — đúng sự thật, không tạo tác dụng phụ nào.
       */
      const coGiCanChot = ungVienChot.length > 0;
      const ketQua = await doiHopDong(
        nhanVien.ma_nv,
        ngayChot,
        coGiCanChot ? loaiHdCanChot : values.loai_hd,
        values,
      );

      // Báo theo `da_chot_hop_dong_cu` của máy chủ, KHÔNG theo thứ màn hình đoán: từ QĐ #1 hợp
      // đồng bị chốt có thể khác cái đang hiển thị là "hiện hành" (người dùng chọn nhóm khác),
      // và máy chủ cũng có thể không tìm thấy gì để chốt.
      const daChot = ungVienChot.find((hd) => hd.loai_hd === loaiHdCanChot);
      toast.success(
        ketQua.da_chot_hop_dong_cu && daChot
          ? `Đã chốt hợp đồng ${daChot.so_hd} và ký hợp đồng mới.`
          : "Đã ký hợp đồng mới.",
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không thay đổi được hợp đồng."));
    } finally {
      setDangLuu(false);
    }
  };

  const oLuoi = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
    gap: 2,
  } as const;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Tạo mới hợp đồng — {nhanVien.ho_ten}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {hopDongHienTai ? (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Chốt hợp đồng hiện tại
              </Typography>

              <Box sx={{ ...oLuoi, mb: 2.5 }}>
                <OThongTin nhan="Số hợp đồng" giaTri={hopDongHienTai.so_hd} />
                <OThongTin
                  nhan="Loại hợp đồng"
                  giaTri={nhan(LOAI_HD, hopDongHienTai.loai_hd)}
                />
                <OThongTin
                  nhan="Kiểu lương"
                  giaTri={nhan(KIEU_LUONG, hopDongHienTai.kieu_luong).split(" — ")[0]}
                />
                <OThongTin
                  nhan="Hiệu lực từ"
                  giaTri={ngayVn(hopDongHienTai.ngay_bat_dau)}
                />
                <OThongTin
                  nhan="Lương chính"
                  giaTri={`${tienVn(hopDongHienTai.luong_chinh)} ₫`}
                />
                <OThongTin
                  nhan="Lương đóng BHXH"
                  giaTri={`${tienVn(hopDongHienTai.luong_bhxh)} ₫`}
                />
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {/*
                  Bắt buộc từ QĐ #1: một nhân viên có thể có hợp đồng lao động và hợp đồng
                  khoán chạy song song, nên phải nói rõ chốt cái nào. Chỉ hiện khi thực sự có
                  hơn một nhóm đang hiệu lực — một lựa chọn duy nhất thì hỏi là hỏi thừa.
                */}
                {ungVienChot.length > 1 && (
                  <TextField
                    select
                    label="Hợp đồng cần chốt"
                    required
                    size="small"
                    value={loaiHdCanChot}
                    onChange={(e) =>
                      setLoaiHdCanChot(e.target.value as LoaiHopDong)
                    }
                    helperText="Nhân viên đang có nhiều hợp đồng hiệu lực — chọn đúng hợp đồng muốn chốt."
                    sx={{ minWidth: 320 }}
                  >
                    {ungVienChot.map((hd) => (
                      <MenuItem key={hd.id} value={hd.loai_hd}>
                        {hd.so_hd} — {nhan(LOAI_HD, hd.loai_hd)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <TextField
                  label="Ngày chốt hợp đồng"
                  type="date"
                  required
                  size="small"
                  value={ngayChot}
                  onChange={(e) => setNgayChot(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="Ghi vào ngày kết thúc của hợp đồng hiện tại."
                  sx={{ maxWidth: 260 }}
                />
              </Stack>
            </Paper>
          ) : (
            <Alert severity="info">
              Nhân viên này chưa có hợp đồng nào — không có gì để chốt, chỉ tạo hợp đồng mới.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Hợp đồng mới
            </Typography>

            <Box sx={oLuoi}>
              <TextField
                label="Số hợp đồng"
                required
                autoFocus
                size="small"
                value={values.so_hd}
                onChange={(e) => dat("so_hd", e.target.value)}
              />
              <TextField
                select
                label="Loại hợp đồng"
                size="small"
                value={values.loai_hd}
                onChange={(e) => dat("loai_hd", e.target.value as LoaiHopDong)}
              >
                {LOAI_HD.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Kiểu lương"
                size="small"
                value={values.kieu_luong}
                onChange={(e) => dat("kieu_luong", e.target.value as KieuLuong)}
              >
                {KIEU_LUONG.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Ngày bắt đầu"
                type="date"
                required
                size="small"
                value={values.ngay_bat_dau}
                onChange={(e) => dat("ngay_bat_dau", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Ngày kết thúc"
                type="date"
                size="small"
                value={values.ngay_ket_thuc}
                onChange={(e) => dat("ngay_ket_thuc", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Để trống nếu không xác định thời hạn."
              />
              <Box />

              {/* Không nằm trong mô tả nhưng bắt buộc phải có: bỏ đi thì hợp đồng
                  mới lưu với mức lương 0 đ mà không ai thấy. Điền sẵn theo hợp
                  đồng cũ để trường hợp chỉ gia hạn thì không phải gõ lại. */}
              <TienField
                label="Lương chính"
                required
                value={values.luong_chinh}
                onChange={(v) => dat("luong_chinh", v)}
                error={daBamLuu && Boolean(loiLuong.luong_chinh)}
                helperText={daBamLuu ? loiLuong.luong_chinh : undefined}
              />
              <TienField
                label="Lương đóng BHXH"
                value={values.luong_bhxh}
                onChange={(v) => dat("luong_bhxh", v)}
                error={daBamLuu && Boolean(loiLuong.luong_bhxh)}
                helperText={daBamLuu ? loiLuong.luong_bhxh : undefined}
              />
              <Box />

              <Box sx={{ gridColumn: "1 / -1" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={values.trich_bhxh}
                        onChange={(e) => dat("trich_bhxh", e.target.checked)}
                      />
                    }
                    label="Trích đóng BHXH"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={values.tinh_tncn}
                        onChange={(e) => dat("tinh_tncn", e.target.checked)}
                      />
                    }
                    label="Tính thuế TNCN"
                  />
                </Stack>
              </Box>

              <Box sx={{ gridColumn: "1 / -1" }}>
                <TextField
                  label="Ghi chú"
                  fullWidth
                  size="small"
                  value={values.ghi_chu}
                  onChange={(e) => dat("ghi_chu", e.target.value)}
                />
              </Box>
            </Box>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={dangLuu}
          sx={{ textTransform: "none" }}
        >
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
