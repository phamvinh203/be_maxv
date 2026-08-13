import { useLocation, useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import SpaceDashboardRounded from "@mui/icons-material/SpaceDashboardRounded";
import FolderSharedRounded from "@mui/icons-material/FolderSharedRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import FactCheckRounded from "@mui/icons-material/FactCheckRounded";
import SummarizeRounded from "@mui/icons-material/SummarizeRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";

const KHU = [
  { path: "dashboard", label: "Dashboard", icon: <SpaceDashboardRounded /> },
  {
    path: "danh-muc",
    label: "Dữ liệu nhân viên",
    icon: <FolderSharedRounded />,
  },
  { path: "cau-hinh", label: "Cấu hình mặc định", icon: <TuneRounded /> },
  { path: "cai-dat-luong", label: "Cài đặt lương", icon: <PaymentsRounded /> },
  {
    path: "du-lieu-luong",
    label: "Dữ liệu tính lương",
    icon: <FactCheckRounded />,
  },
  { path: "bang-luong", label: "Bảng lương", icon: <SummarizeRounded /> },
  { path: "to-khai-thue", label: "Tờ khai thuế", icon: <AccountBalanceRounded /> },
  { path: "ho-so-luong", label: "Hồ sơ lương", icon: <FactCheckRounded /> },
];

/**
 * Thanh điều hướng cấp trên của khu HRM — dạng tab nổi.
 *
 * Mỗi tab là một route con nên gửi được link tới đúng khu và F5 không nhảy về
 * đầu. Tab con bên trong "Danh mục quản lý nhân viên" do `DanhMucNav` lo.
 */
export default function HrmNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Path lạ thì không tô tab nào, thay vì để MUI cảnh báo value không khớp.
  const hienTai =
    KHU.find((khu) => pathname.startsWith(`/hrm/${khu.path}`))?.path ?? false;

  return (
    <Paper
      elevation={3}
      sx={{
        display: "inline-flex",
        maxWidth: "100%",
        p: 0.75,
        borderRadius: 999,
      }}
    >
      <Tabs
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ minHeight: 0, "& .MuiTabs-indicator": { display: "none" } }}
      >
        {KHU.map((khu) => (
          <Tab
            key={khu.path}
            value={khu.path}
            label={khu.label}
            icon={khu.icon}
            iconPosition="start"
            sx={{
              minHeight: 44,
              px: 2.5,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 600,
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
              },
            }}
          />
        ))}
      </Tabs>
    </Paper>
  );
}
