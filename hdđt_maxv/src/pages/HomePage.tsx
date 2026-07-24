import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import AppHeader from "../components/AppHeader";
import InvoiceListTabs from "../features/hddt/components/InvoiceListTabs";
import SyncInvoiceDialog from "../features/hddt/components/SyncInvoiceDialog";
import CompanyFormDialog from "../features/company/components/CompanyFormDialog";
import { useAuth } from "../features/auth/useAuth";
import Button from "@mui/material/Button";
import SyncRounded from "@mui/icons-material/SyncRounded";

export default function HomePage() {
  const [syncOpen, setSyncOpen] = useState(false);

  // User mới đăng ký chưa có công ty nào -> mời tạo ngay thay vì bắt vào Cài đặt.
  // `companies` đã được nạp xong khi HomePage render (ProtectedRoute chờ `hydrating`).
  const { companies } = useAuth();
  const [onboardDismissed, setOnboardDismissed] = useState(false);
  const needsCompany = companies.length === 0;

  return (
    <>
      <AppHeader />
      <Box sx={{ p: 3 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Hóa đơn điện tử
          </Typography>
          <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<SyncRounded />}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
              onClick={() => setSyncOpen(true)}
            >
              Đồng bộ từ Thuế
            </Button>
          </Stack>
        </Stack>

        <InvoiceListTabs />
      </Box>

      <SyncInvoiceDialog open={syncOpen} onClose={() => setSyncOpen(false)} />

      {/* Tạo xong, `refreshCompanies()` làm `needsCompany` thành false -> dialog tự đóng. */}
      <CompanyFormDialog
        open={needsCompany && !onboardDismissed}
        onboarding
        onClose={() => setOnboardDismissed(true)}
      />
    </>
  );
}
