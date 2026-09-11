import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import OndemandVideoRounded from "@mui/icons-material/OndemandVideoRounded";
import HuongDanDialog from "./HuongDanDialog";
import type { HuongDan } from "./noiDung";

/**
 * Nút cam "Hướng dẫn …" mở hộp hướng dẫn từng bước — cùng một kiểu cho màn Chốt kỳ lương và thanh
 * tab con của các khu HRM. Màn hẹp chỉ hiện "Hướng dẫn" để nhường chỗ cho các tab.
 */
export default function NutHuongDan({ huongDan }: { huongDan: HuongDan }) {
  const [mo, setMo] = useState(false);

  return (
    <>
      <Button
        variant="contained"
        size="small"
        color="warning"
        startIcon={<OndemandVideoRounded />}
        onClick={() => setMo(true)}
        sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}
      >
        Hướng dẫn
        <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
          &nbsp;{huongDan.tenKhu}
        </Box>
      </Button>
      <HuongDanDialog open={mo} onClose={() => setMo(false)} huongDan={huongDan} />
    </>
  );
}
