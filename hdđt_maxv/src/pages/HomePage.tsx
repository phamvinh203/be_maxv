import { useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DialogLoginHddt from "../components/dialogLoginHddt";
import AppHeader from "../components/AppHeader";
import InvoiceListTabs from "../features/hddt/components/InvoiceListTabs";
import { useGdtSession } from "../features/hddt/gdtSession/useGdtSession";

export default function HomePage() {
  const { setGdtToken } = useGdtSession();
  const [openLogin, setOpenLogin] = useState(false);

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
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenLogin(true)}
          >
            Đăng nhập Thuế điện tử
          </Button>
        </Stack>

        <InvoiceListTabs />

        <DialogLoginHddt
          open={openLogin}
          onClose={() => setOpenLogin(false)}
          onLoginSuccess={(token, mst) => setGdtToken(mst, token)}
        />
      </Box>
    </>
  );
}
