import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { getErrorMessage } from "../../../../lib/errors";
import { hopDongHienHanh } from "../../_shared/cay";
import { homNay } from "../../_shared/format";
import { hopDongRong, nhanVienRong } from "../../_shared/formDefaults";
import {
  useMaNhanVienMoi,
  useNhanVienDetail,
  useSuaNhanVien,
  useThemNhanVien,
} from "../../api/du_lieu_nhan_vien/nhanVienQueries";
import { useHopDongList } from "../../api/du_lieu_nhan_vien/hopDongQueries";
import {
  LOI_KHONG_CO_QUYEN_LUONG,
  useQuyenXemLuong,
} from "../../api/du_lieu_nhan_vien/quyenLuongQueries";
import type { HopDongFormValues, NhanVien } from "../../types";
import HopDongTab from "./tabs/HopDongTab";
import HoSoTab from "./tabs/HoSoTab";
import NguoiPhuThuocTab from "./tabs/NguoiPhuThuocTab";
import ThongTinTab from "./tabs/ThongTinTab";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa nhân viên này; không có = thêm mới. */
  maNv?: string;
}

const KHOA_KHI_THEM = "Lưu nhân viên trước rồi mới nhập được mục này.";

export default function NhanVienDialog({ open, onClose, maNv }: Props) {
  /*
   * Mã nhân viên vừa TẠO XONG trong chính lần mở dialog này.
   *
   * Ba tab phụ đều thao tác theo `ma_nv`, mà lúc đang thêm mới thì nhân viên chưa nằm trong
   * CSDL — backend chặn thật bằng `assertNhanVienTonTai` và khóa ngoại, nên mở tab ra cũng chỉ
   * nhận 404. Trước đây lưu xong là đóng luôn dialog, người dùng phải tìm lại người vừa nhập
   * trong danh sách rồi mở ra mới đính được hồ sơ và người phụ thuộc.
   *
   * Giữ mã ở đây để lưu xong thì dialog CHUYỂN SANG chế độ sửa ngay tại chỗ: ba tab mở ra,
   * người dùng đi một mạch. Không đụng backend, không có nguy cơ dữ liệu nửa vời — nhân viên
   * đã thật sự tồn tại trước khi tab nào mở.
   */
  const [maNvVuaTao, setMaNvVuaTao] = useState<string | null>(null);
  /** Mã đang thao tác: của prop khi sửa, của lần tạo vừa xong khi thêm mới. */
  const maNvHienTai = maNv ?? maNvVuaTao;
  const laSua = Boolean(maNvHienTai);

  const chiTiet = useNhanVienDetail(maNvHienTai);
  const maMoi = useMaNhanVienMoi();
  const themNhanVien = useThemNhanVien();
  const suaNhanVien = useSuaNhanVien();
  const {
    items: lichSuHopDong,
    isError: loiTaiHopDong,
    error: chiTietLoiHopDong,
  } = useHopDongList(maNvHienTai);
  const { biTuChoi: khongXemDuocLuong } = useQuyenXemLuong();

  const [tab, setTab] = useState(0);
  const [nhanVien, setNhanVien] = useState<NhanVien>(() => nhanVienRong(""));
  const [hopDongDau, setHopDongDau] = useState<HopDongFormValues>(hopDongRong);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Nạp lại toàn bộ form mỗi lần mở — cố ý reset theo state ngoài.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(0);
    // Xóa mã của lần tạo TRƯỚC, nếu không thì mở dialog "Thêm nhân viên" lần hai sẽ tưởng
    // đang sửa người vừa tạo lần một.
    setMaNvVuaTao(null);
    setNhanVien(chiTiet ? { ...chiTiet } : nhanVienRong(maMoi));
    setHopDongDau(hopDongRong());
    // `chiTiet` và `maMoi` đổi theo kho dữ liệu; chỉ nạp lại khi mở dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, maNv]);

  const hdHienHanh = useMemo(
    () => hopDongHienHanh(lichSuHopDong, homNay()),
    [lichSuHopDong],
  );

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      if (laSua) {
        await suaNhanVien(nhanVien);
        toast.success("Đã cập nhật nhân viên.");
      } else {
        // Nhóm hợp đồng ở tab 1 là tùy chọn: bỏ trống cả số HĐ lẫn ngày bắt đầu
        // thì tạo nhân viên không kèm hợp đồng, ký sau ở tab Lịch sử hợp đồng.
        const coNhapHopDong = Boolean(hopDongDau.so_hd.trim() || hopDongDau.ngay_bat_dau);
        const maVuaTao = await themNhanVien({
          nhan_vien: nhanVien,
          hop_dong: coNhapHopDong ? hopDongDau : null,
        });

        /*
         * KHÔNG đóng dialog. Ghi mã vừa tạo vào state để dialog chuyển sang chế độ sửa: ba tab
         * phụ mở ra ngay, người dùng nhập tiếp hồ sơ và người phụ thuộc mà không phải tìm lại
         * người vừa nhập trong danh sách.
         *
         * Phải đồng bộ luôn `ma_nv` trong form: các tab con nhận `nhanVien.ma_nv`, mà lúc thêm
         * mới trường này có thể đang rỗng (để backend tự sinh) hoặc khác mã backend cấp thật.
         */
        setMaNvVuaTao(maVuaTao);
        setNhanVien((truoc) => ({ ...truoc, ma_nv: maVuaTao }));
        toast.success(
          `Đã thêm nhân viên ${maVuaTao}. Nhập tiếp hồ sơ và người phụ thuộc ở các tab bên trên.`,
        );
        return;
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được nhân viên."));
    } finally {
      setDangLuu(false);
    }
  };

  /*
   * `khoa` = lý do tab bị vô hiệu hóa, `undefined` là mở bình thường.
   *
   * Tab hợp đồng khóa theo QUYỀN XEM LƯƠNG (QĐ #8): cả nhóm `/hrm/hop-dong` trả 403, mở tab ra
   * rồi mới báo lỗi là đúng thứ quyết định đó cấm. Hai tab kia chỉ khóa khi đang thêm mới.
   */
  const tabPhu = [
    {
      label: "Lịch sử hợp đồng",
      khoa: khongXemDuocLuong ? LOI_KHONG_CO_QUYEN_LUONG : undefined,
      noiDung: () => <HopDongTab maNv={nhanVien.ma_nv} />,
    },
    {
      label: "Hồ sơ, tài liệu",
      khoa: undefined,
      noiDung: () => <HoSoTab maNv={nhanVien.ma_nv} />,
    },
    {
      label: "Người phụ thuộc",
      khoa: undefined,
      noiDung: () => <NguoiPhuThuocTab maNv={nhanVien.ma_nv} />,
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" onClick={onClose}>
            <CloseRounded />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {laSua ? `Hồ sơ nhân viên ${nhanVien.ma_nv} — ${nhanVien.ho_ten}` : "Thêm nhân viên"}
          </Typography>
          <Button onClick={onClose} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={dangLuu}
            sx={{ textTransform: "none" }}
          >
            {laSua ? "Lưu thay đổi" : "Lưu nhân viên"}
          </Button>
        </Toolbar>

        <Tabs
          value={tab}
          onChange={(_, giaTri: number) => setTab(giaTri)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          <Tab label="Thông tin nhân viên" sx={{ textTransform: "none", fontWeight: 600 }} />
          {tabPhu.map((item) => {
            const lyDoKhoa = !laSua ? KHOA_KHI_THEM : item.khoa;
            return (
              <Tab
                key={item.label}
                label={
                  lyDoKhoa ? (
                    /* Tooltip cần một phần tử nhận được sự kiện chuột — Tab đã
                       disabled thì không phát hover, nên bọc thêm span. */
                    <Tooltip title={lyDoKhoa}>
                      <span>{item.label}</span>
                    </Tooltip>
                  ) : (
                    item.label
                  )
                }
                disabled={Boolean(lyDoKhoa)}
                sx={{ textTransform: "none", fontWeight: 600 }}
              />
            );
          })}
        </Tabs>
      </AppBar>

      <Box sx={{ p: 3, bgcolor: "background.default", minHeight: "100%" }}>
        {tab === 0 && (
          <ThongTinTab
            nhanVien={nhanVien}
            onChange={setNhanVien}
            laSua={laSua}
            hopDong={hopDongDau}
            onHopDongChange={setHopDongDau}
            hopDongHienHanh={hdHienHanh}
            /* Tải hỏng (thường là 403 khi quyền xem lương bị thu hồi giữa phiên) phải hiện ra
               đúng câu của máy chủ, không được rơi vào nhánh "chưa có hợp đồng nào". */
            loiHopDong={
              loiTaiHopDong
                ? getErrorMessage(
                    chiTietLoiHopDong,
                    "Không tải được thông tin hợp đồng.",
                  )
                : undefined
            }
            onXemLichSu={() => setTab(1)}
          />
        )}
        {tab > 0 && laSua && tabPhu[tab - 1]?.noiDung()}
      </Box>
    </Dialog>
  );
}
