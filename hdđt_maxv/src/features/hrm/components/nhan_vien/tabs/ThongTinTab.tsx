import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import { sapXepCay } from "../../../cay";
import {
  CHUC_VU,
  GIOI_TINH,
  KIEU_LUONG,
  LOAI_HD,
  NGAN_HANG_VN,
  TRANG_THAI_NV,
} from "../../../constants";
import { ngayVn, nhan, tienVn } from "../../../format";
import { usePhongBanList } from "../../../mock/hooks/phongBan";
import type {
  GioiTinh,
  HopDong,
  HopDongFormValues,
  KieuLuong,
  LoaiHopDong,
  NhanVien,
  TrangThai,
} from "../../../types";
import TienField from "../../TienField";

interface Props {
  nhanVien: NhanVien;
  onChange: (nhanVien: NhanVien) => void;
  /** `false` = đang thêm mới. */
  laSua: boolean;
  hopDong: HopDongFormValues;
  onHopDongChange: (hopDong: HopDongFormValues) => void;
  /** Chế độ sửa: hợp đồng hiện hành để hiện tóm tắt chỉ đọc. */
  hopDongHienHanh: HopDong | null;
  onXemLichSu: () => void;
}

/** Một nhóm thông tin — khung `Paper` có tiêu đề, nội dung xếp lưới 2 cột. */
function Nhom({ tieuDe, children }: { tieuDe: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        {tieuDe}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
          gap: 2,
        }}
      >
        {children}
      </Box>
    </Paper>
  );
}

/** Ô chiếm trọn chiều ngang của lưới. */
function CaHang({ children }: { children: ReactNode }) {
  return <Box sx={{ gridColumn: "1 / -1" }}>{children}</Box>;
}

export default function ThongTinTab({
  nhanVien,
  onChange,
  laSua,
  hopDong,
  onHopDongChange,
  hopDongHienHanh,
  onXemLichSu,
}: Props) {
  const phongBan = usePhongBanList();
  const cayPhongBan = sapXepCay(phongBan);

  const dat = <K extends keyof NhanVien>(khoa: K, giaTri: NhanVien[K]) =>
    onChange({ ...nhanVien, [khoa]: giaTri });

  const datHd = <K extends keyof HopDongFormValues>(
    khoa: K,
    giaTri: HopDongFormValues[K],
  ) => onHopDongChange({ ...hopDong, [khoa]: giaTri });

  return (
    <Stack spacing={2.5}>
      <Nhom tieuDe="Thông tin cá nhân">
        <TextField
          label="Số CCCD"
          size="small"
          value={nhanVien.so_cccd}
          onChange={(e) => dat("so_cccd", e.target.value)}
        />
        <TextField
          label="MST cá nhân"
          size="small"
          value={nhanVien.mst_ca_nhan}
          onChange={(e) => dat("mst_ca_nhan", e.target.value)}
        />
        <TextField
          label="Mã nhân viên"
          required
          size="small"
          value={nhanVien.ma_nv}
          onChange={(e) => dat("ma_nv", e.target.value)}
          disabled={laSua}
          helperText={laSua ? "Không đổi được mã sau khi lưu." : "Sửa lại được nếu cần."}
        />
        <TextField
          label="Họ và tên"
          required
          size="small"
          value={nhanVien.ho_ten}
          onChange={(e) => dat("ho_ten", e.target.value)}
        />
        <TextField
          label="Ngày sinh"
          type="date"
          size="small"
          value={nhanVien.ngay_sinh}
          onChange={(e) => dat("ngay_sinh", e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          label="Giới tính"
          size="small"
          value={nhanVien.gioi_tinh}
          onChange={(e) => dat("gioi_tinh", e.target.value as GioiTinh)}
        >
          {GIOI_TINH.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Điện thoại"
          size="small"
          value={nhanVien.dien_thoai}
          onChange={(e) => dat("dien_thoai", e.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          size="small"
          value={nhanVien.email}
          onChange={(e) => dat("email", e.target.value)}
        />
        <Box />
        <CaHang>
          <TextField
            label="Địa chỉ"
            fullWidth
            size="small"
            value={nhanVien.dia_chi}
            onChange={(e) => dat("dia_chi", e.target.value)}
          />
        </CaHang>
        <CaHang>
          <TextField
            label="Ghi chú"
            fullWidth
            multiline
            minRows={2}
            size="small"
            value={nhanVien.ghi_chu}
            onChange={(e) => dat("ghi_chu", e.target.value)}
          />
        </CaHang>
      </Nhom>

      <Nhom tieuDe="Công việc & lương">
        <TextField
          select
          label="Phòng ban"
          size="small"
          value={nhanVien.ma_pb ?? ""}
          onChange={(e) => dat("ma_pb", e.target.value || null)}
        >
          <MenuItem value="">
            <em>— Chưa gán —</em>
          </MenuItem>
          {cayPhongBan.map((pb) => (
            <MenuItem key={pb.ma_pb} value={pb.ma_pb}>
              {" ".repeat((pb.cap - 1) * 4)}
              {pb.ten_pb}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Chức vụ"
          size="small"
          value={nhanVien.ma_cv}
          onChange={(e) => dat("ma_cv", e.target.value)}
        >
          <MenuItem value="">
            <em>— Chưa chọn —</em>
          </MenuItem>
          {CHUC_VU.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Cấp bậc"
          size="small"
          value={nhanVien.cap_bac}
          onChange={(e) => dat("cap_bac", e.target.value)}
          helperText="Nhập tự do, vd: Nhân viên chính, Quản lý cấp trung."
        />
        <TextField
          label="Ngày vào"
          type="date"
          size="small"
          value={nhanVien.ngay_vao}
          onChange={(e) => dat("ngay_vao", e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {/* Chỉ có ở chế độ sửa — nhân viên mới luôn "Đang làm". */}
        {laSua && (
          <TextField
            select
            label="Trạng thái"
            size="small"
            value={nhanVien.status}
            onChange={(e) => dat("status", e.target.value as TrangThai)}
          >
            {TRANG_THAI_NV.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        )}
        <CaHang>
          <FormControlLabel
            control={
              <Checkbox
                checked={nhanVien.cong_doan}
                onChange={(e) => dat("cong_doan", e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Tham gia công đoàn</Typography>
                <Typography variant="caption" color="text.secondary">
                  Trích 1% phí công đoàn trên lương đóng BHXH.
                </Typography>
              </Box>
            }
          />
        </CaHang>
      </Nhom>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          Thông tin hợp đồng
        </Typography>

        {laSua ? (
          /*
           * Chế độ sửa chỉ hiện tóm tắt: hợp đồng ký mới / gia hạn / sửa đều làm
           * ở tab "Lịch sử hợp đồng". Hai đường ghi vào cùng một bảng sẽ sinh ra
           * hợp đồng trùng mà không ai biết cái nào là thật.
           */
          <Stack spacing={1.5}>
            {hopDongHienHanh ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: 1.5,
                }}
              >
                <TomTat nhan_="Số hợp đồng" giaTri={hopDongHienHanh.so_hd} />
                <TomTat nhan_="Loại hợp đồng" giaTri={nhan(LOAI_HD, hopDongHienHanh.loai_hd)} />
                <TomTat
                  nhan_="Kiểu lương"
                  giaTri={nhan(KIEU_LUONG, hopDongHienHanh.kieu_luong)}
                />
                <TomTat
                  nhan_="Lương chính"
                  giaTri={`${tienVn(hopDongHienHanh.luong_chinh)} ₫`}
                />
                <TomTat
                  nhan_="Lương đóng BHXH"
                  giaTri={`${tienVn(hopDongHienHanh.luong_bhxh)} ₫`}
                />
                <TomTat
                  nhan_="Thời hạn"
                  giaTri={`${ngayVn(hopDongHienHanh.ngay_bat_dau)} → ${
                    hopDongHienHanh.ngay_ket_thuc
                      ? ngayVn(hopDongHienHanh.ngay_ket_thuc)
                      : "không xác định"
                  }`}
                />
                <TomTat
                  nhan_="Trích đóng BHXH"
                  giaTri={hopDongHienHanh.trich_bhxh ? "Có" : "Không"}
                />
                <TomTat
                  nhan_="Tính thuế TNCN"
                  giaTri={hopDongHienHanh.tinh_tncn ? "Có" : "Không"}
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Nhân viên này chưa có hợp đồng nào.
              </Typography>
            )}
            <Divider />
            <Box>
              <Button
                size="small"
                startIcon={<HistoryRounded />}
                onClick={onXemLichSu}
                sx={{ textTransform: "none" }}
              >
                Xem và ký hợp đồng ở tab Lịch sử hợp đồng
              </Button>
            </Box>
          </Stack>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label="Số hợp đồng"
              size="small"
              value={hopDong.so_hd}
              onChange={(e) => datHd("so_hd", e.target.value)}
            />
            <TextField
              select
              label="Loại hợp đồng"
              size="small"
              value={hopDong.loai_hd}
              onChange={(e) => datHd("loai_hd", e.target.value as LoaiHopDong)}
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
              value={hopDong.kieu_luong}
              onChange={(e) => datHd("kieu_luong", e.target.value as KieuLuong)}
            >
              {KIEU_LUONG.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TienField
              label="Lương chính"
              value={hopDong.luong_chinh}
              onChange={(v) => datHd("luong_chinh", v)}
            />
            <TienField
              label="Lương đóng BHXH"
              value={hopDong.luong_bhxh}
              onChange={(v) => datHd("luong_bhxh", v)}
              helperText="Gốc tính phí công đoàn 1%."
            />
            <Box />
            <TextField
              label="Ngày bắt đầu"
              type="date"
              size="small"
              value={hopDong.ngay_bat_dau}
              onChange={(e) => datHd("ngay_bat_dau", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Ngày kết thúc"
              type="date"
              size="small"
              value={hopDong.ngay_ket_thuc}
              onChange={(e) => datHd("ngay_ket_thuc", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Để trống nếu không xác định thời hạn."
            />
            <Box />
            <CaHang>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hopDong.trich_bhxh}
                      onChange={(e) => datHd("trich_bhxh", e.target.checked)}
                    />
                  }
                  label="Trích đóng BHXH"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hopDong.tinh_tncn}
                      onChange={(e) => datHd("tinh_tncn", e.target.checked)}
                    />
                  }
                  label="Tính thuế TNCN"
                />
              </Stack>
            </CaHang>
            <CaHang>
              <Typography variant="caption" color="text.secondary">
                Để trống toàn bộ nhóm này nếu chưa ký hợp đồng — ký sau ở tab "Lịch sử hợp
                đồng".
              </Typography>
            </CaHang>
          </Box>
        )}
      </Paper>

      <Nhom tieuDe="Tài khoản ngân hàng">
        <Autocomplete
          freeSolo
          options={NGAN_HANG_VN}
          value={nhanVien.ngan_hang}
          onChange={(_, giaTri) => dat("ngan_hang", giaTri ?? "")}
          onInputChange={(_, giaTri) => dat("ngan_hang", giaTri)}
          renderInput={(params) => <TextField {...params} label="Ngân hàng" size="small" />}
        />
        <TextField
          label="Số tài khoản"
          size="small"
          value={nhanVien.so_tk}
          onChange={(e) => dat("so_tk", e.target.value)}
        />
        <TextField
          label="Tên chủ tài khoản"
          size="small"
          value={nhanVien.chu_tk}
          onChange={(e) => dat("chu_tk", e.target.value.toUpperCase())}
          helperText="Viết in hoa không dấu như trên thẻ."
        />
      </Nhom>
    </Stack>
  );
}

/** Một ô tóm tắt chỉ đọc trong nhóm hợp đồng ở chế độ sửa. */
function TomTat({ nhan_, giaTri }: { nhan_: string; giaTri: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {nhan_}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {giaTri || "—"}
      </Typography>
    </Box>
  );
}
