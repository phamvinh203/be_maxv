import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import CloseRounded from "@mui/icons-material/CloseRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import { hopDongHienHanh } from "../../../cay";
import { homNay } from "../../../format";
import { useHopDongList } from "../../../mock/hooks/hopDong";
import { useNhanVienDetail } from "../../../mock/hooks/nhanVien";
import HoSoTab from "../tabs/HoSoTab";
import NguoiPhuThuocTab from "../tabs/NguoiPhuThuocTab";
import ThayDoiHopDongDialog from "../ThayDoiHopDongDialog";
import ThongTinNhanVienTab from "./ThongTinNhanVienTab";

interface Props {
  open: boolean;
  onClose: () => void;
  maNv: string | null;
  /** Mở hồ sơ chỉnh sửa của chính nhân viên này. */
  onSua: (maNv: string) => void;
}

const NHAN_TAB = ["Thông tin nhân viên", "Hồ sơ tài liệu", "Người phụ thuộc"];

/**
 * Xem chi tiết một nhân viên — ba mục chính, phần thông tin để **chỉ đọc**.
 *
 * Tách hẳn khỏi dialog chỉnh sửa: mở hồ sơ để tra cứu là việc thường xuyên hơn
 * nhiều so với sửa, và một màn hình toàn ô nhập thì vừa khó đọc vừa dễ gõ nhầm
 * vào dữ liệu đang xem. Hai tab con vẫn dùng lại đúng component của hồ sơ chỉnh
 * sửa vì tài liệu và người phụ thuộc thì thêm/sửa ngay tại chỗ là hợp lý.
 */
export default function NhanVienChiTietDialog({ open, onClose, maNv, onSua }: Props) {
  const nhanVien = useNhanVienDetail(maNv);
  const lichSuHopDong = useHopDongList(maNv);

  const [tab, setTab] = useState(0);
  const [doiHopDongOpen, setDoiHopDongOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(0);
  }, [open, maNv]);

  const hdHienTai = useMemo(
    () => hopDongHienHanh(lichSuHopDong, homNay()),
    [lichSuHopDong],
  );

  // Nhân viên vừa bị xóa ở tab khác thì đóng lại thay vì render hồ sơ rỗng.
  if (!nhanVien) return null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" onClick={onClose}>
            <CloseRounded />
          </IconButton>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {nhanVien.ho_ten}
            </Typography>
            <Chip size="small" variant="outlined" label={nhanVien.ma_nv} sx={{ height: 22 }} />
            {nhanVien.status === "0" && (
              <Chip size="small" label="Đã nghỉ" sx={{ height: 22 }} />
            )}
          </Stack>
          <Button
            variant="outlined"
            startIcon={<EditRounded />}
            onClick={() => onSua(nhanVien.ma_nv)}
            sx={{ textTransform: "none" }}
          >
            Chỉnh sửa hồ sơ
          </Button>
        </Toolbar>

        <Tabs
          value={tab}
          onChange={(_, giaTri: number) => setTab(giaTri)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          {NHAN_TAB.map((nhan) => (
            <Tab key={nhan} label={nhan} sx={{ textTransform: "none", fontWeight: 600 }} />
          ))}
        </Tabs>
      </AppBar>

      <Box sx={{ p: 3, bgcolor: "background.default", minHeight: "100%" }}>
        {tab === 0 && (
          <ThongTinNhanVienTab
            nhanVien={nhanVien}
            hopDongHienTai={hdHienTai}
            onThayDoiHopDong={() => setDoiHopDongOpen(true)}
          />
        )}
        {tab === 1 && <HoSoTab maNv={nhanVien.ma_nv} />}
        {tab === 2 && <NguoiPhuThuocTab maNv={nhanVien.ma_nv} />}
      </Box>

      <ThayDoiHopDongDialog
        open={doiHopDongOpen}
        nhanVien={nhanVien}
        hopDongHienTai={hdHienTai}
        onClose={() => setDoiHopDongOpen(false)}
      />
    </Dialog>
  );
}
