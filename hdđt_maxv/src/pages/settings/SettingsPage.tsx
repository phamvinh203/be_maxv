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
import ComingSoonTab from "./ComingSoonTab";

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
            {/* Giữ mount cả 4 tab, chỉ ẩn bằng CSS — tránh remount + gọi lại API mỗi lần đổi tab. */}
            <Box sx={{ display: tab === "company" ? "block" : "none" }}>
              <CompanyManagementTab />
            </Box>
            <Box sx={{ display: tab === "sync-schedule" ? "block" : "none" }}>
              <ComingSoonTab title="Lịch tự động đồng bộ hoá đơn" />
            </Box>
            <Box sx={{ display: tab === "display" ? "block" : "none" }}>
              <ComingSoonTab title="Chế độ hiển thị" />
            </Box>
            <Box sx={{ display: tab === "system-data" ? "block" : "none" }}>
              <ComingSoonTab title="Dữ liệu hệ thống" />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
