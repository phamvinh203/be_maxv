import { useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import DialogLoginHddt from "../components/dialogLoginHddt";
import AppHeader from "../components/AppHeader";
import LoginForm from "../features/auth/components/LoginForm";
import { useAuth } from "../features/auth/useAuth";

export default function HomePage() {
  const { user, setGdtToken } = useAuth();
  const [openLogin, setOpenLogin] = useState(false);

  if (!user) return <LoginForm />;

  return (
    <>
      <AppHeader />
      <Box sx={{ p: 3 }}>
        Home Page
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenLogin(true)}
        >
          login hóa đơn điện tử
        </Button>
        <DialogLoginHddt
          open={openLogin}
          onClose={() => setOpenLogin(false)}
          onLoginSuccess={(token, mst) => setGdtToken(mst, token)}
        />
      </Box>
    </>
  );
}
