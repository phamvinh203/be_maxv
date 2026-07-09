import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import AppHeader from "../components/AppHeader";
import InvoiceListTabs from "../features/hddt/components/InvoiceListTabs";
import Button from "@mui/material/Button";
import SyncRounded from "@mui/icons-material/SyncRounded";

export default function HomePage() {
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
            >
              Đồng bộ từ Thuế
            </Button>
          </Stack>
        </Stack>

        <InvoiceListTabs />
      </Box>
    </>
  );
}
