import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import ApartmentRounded from "@mui/icons-material/ApartmentRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import StorageRounded from "@mui/icons-material/StorageRounded";
import AppHeader from "../../components/AppHeader";
import CompanyManagementTab from "../../features/company/components/CompanyManagementTab";
import SystemDataTab from "./SystemDataTab";
import DisplayModeTab from "./DisplayModeTab";
import SyncScheduleTab from "./SyncScheduleTab";

type SettingsTab = "company" | "sync-schedule" | "display" | "system-data";

const NAV_ITEMS: { value: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { value: "company", label: "Quản lý công ty/Hộ kinh doanh", icon: <ApartmentRounded /> },
  { value: "sync-schedule", label: "Lịch tự động đồng bộ hoá đơn", icon: <SyncRounded /> },
  { value: "display", label: "Chế độ hiển thị", icon: <VisibilityRounded /> },
  { value: "system-data", label: "Dữ liệu hệ thống", icon: <StorageRounded /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("company");

  return (
    <>
      <AppHeader />
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          CÀI ĐẶT
        </Typography>

        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 300,
              flexShrink: 0,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <List disablePadding>
              {NAV_ITEMS.map((item) => (
                <ListItemButton
                  key={item.value}
                  selected={tab === item.value}
                  onClick={() => setTab(item.value)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                  <ChevronRightRounded fontSize="small" color="disabled" />
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              minWidth: 0,
              p: 3,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            {/* RVW-C04: chỉ mount đúng tab đang chọn — trước đây mount cả 4 tab (ẩn bằng
                display:none) nên vào /settings là bắn GET /companies + lịch sử đồng bộ + thống
                kê hệ thống cùng lúc dù chỉ xem 1 tab. staleTime 30s của mỗi query đã đủ tránh gọi
                lại khi remount lúc đổi qua đổi lại tab, nên bỏ mount-ẩn không còn lý do giữ. */}
            {tab === "company" && <CompanyManagementTab />}
            {tab === "sync-schedule" && <SyncScheduleTab />}
            {tab === "display" && <DisplayModeTab />}
            {tab === "system-data" && <SystemDataTab />}
          </Box>
        </Box>
      </Box>
    </>
  );
}
