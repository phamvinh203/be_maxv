import { useState, type SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { toast } from "react-toastify";

import AppHeader from "../../components/AppHeader";
import BoLocHoSo from "../../features/dich_vu_cong/components/BoLocHoSo";
import BangHoSo from "../../features/dich_vu_cong/components/BangHoSo";
import XuatFileDvcDialog from "../../features/dich_vu_cong/components/XuatFileDvcDialog";
import { TAB_DVC } from "../../features/dich_vu_cong/config";

/**
 * Khu Dịch vụ công (`/dich-vu-cong`) — ba loại hồ sơ chia theo tab.
 *
 * Đổi tab bằng state chứ không phải route, giống 2 tab "Hóa đơn đầu vào/đầu ra"
 * bên khu Hóa đơn: đây là tab trong một màn hình, không phải ba màn hình riêng.
 */
export default function DvcPage() {
  const [tab, setTab] = useState(TAB_DVC[0]!.value);
  const [xuatOpen, setXuatOpen] = useState(false);

  // Bảng có đúng ba dòng cố định nên tab nào cũng tra ra — không cần nhánh dự phòng.
  const dangMo = TAB_DVC.find((muc) => muc.value === tab)!;

  const doiTab = (_e: SyntheticEvent, value: string) => setTab(value);

  /**
   * Chưa gọi được API: `be_maxv/src/services/client/dich_vu_cong/gdt-dvc.service.ts`
   * còn rỗng. Báo một câu thay vì để nút bấm không ra gì — nút im lặng thì
   * người dùng tưởng phần mềm hỏng chứ không đoán được là chưa làm xong.
   */
  const timKiem = () => {
    toast.info(`${dangMo.label}: chức năng tra cứu đang được phát triển.`);
  };

  return (
    <>
      <AppHeader />
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Dịch vụ công
        </Typography>

        {/* Nút xuất nằm ở hàng tab nên dùng chung cho cả ba tab, không riêng tab nào. */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{
            justifyContent: "space-between",
            alignItems: { sm: "center" },
            borderBottom: 1,
            borderColor: "divider",
            mb: 3,
          }}
        >
          <Tabs
            value={tab}
            onChange={doiTab}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 0 }}
          >
            {TAB_DVC.map((muc) => (
              <Tab key={muc.value} value={muc.value} label={muc.label} />
            ))}
          </Tabs>

          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadRounded fontSize="small" />}
            sx={{
              textTransform: "none",
              textAlign: "left",
              lineHeight: 1.3,
              pb: { xs: 1, sm: 0 },
            }}
            onClick={() => setXuatOpen(true)}
          >
            Xuất file đối soát và tải tờ khai, giấy nộp tiền (dịch vụ công)
          </Button>
        </Stack>

        {/*
          Một bộ lọc dùng chung cho cả ba tab, cố tình không đặt `key={tab}`:
          đổi tab mà mất luôn điều kiện vừa gõ thì phải nhập lại từ đầu.
        */}
        <BoLocHoSo
          tieuDe={dangMo.tieuDeBoLoc}
          nhan={dangMo.nhanBoLoc}
          onSearch={timKiem}
        />

        <BangHoSo cot={dangMo.cotBang} />
      </Box>

      <XuatFileDvcDialog open={xuatOpen} onClose={() => setXuatOpen(false)} />
    </>
  );
}
