import { useState } from "react";
import Button from "@mui/material/Button";
import DialogLoginHddt from "../components/dialogLoginHddt";

export default function HomePage() {
  const [openLogin, setOpenLogin] = useState(false);

  return (
    <div>
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
        onLoginSuccess={(token) => {
          // TODO: lưu token theo tenant (tương đương SaveToken ở bản C#)
          console.log("GDT token:", token);
        }}
      />
    </div>
  );
}
