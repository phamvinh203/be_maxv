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
import DialogLoginDVC from "../../components/dich_vu_cong/dialogLoginDVC";
import BoLocHoSo, { type BoLocHoSoValues } from "../../features/dich_vu_cong/components/BoLocHoSo";
import BangHoSo from "../../features/dich_vu_cong/components/BangHoSo";
import XuatFileDvcDialog from "../../features/dich_vu_cong/components/XuatFileDvcDialog";
import { TAB_DVC } from "../../features/dich_vu_cong/config";
import { useActiveCompanyMst } from "../../features/auth/useActiveCompanyMst";
import { traCuuHoSoDvc, type DvcBangHoSo } from "../../features/dich_vu_cong/api/dvc";
import { getErrorMessage } from "../../lib/errors";

/**
 * Khu Dịch vụ công (`/dich-vu-cong`) — ba loại hồ sơ chia theo tab.
 *
 * Đổi tab bằng state chứ không phải route, giống 2 tab "Hóa đơn đầu vào/đầu ra"
 * bên khu Hóa đơn: đây là tab trong một màn hình, không phải ba màn hình riêng.
 */
export default function DvcPage() {
  const [tab, setTab] = useState(TAB_DVC[0]!.value);
  const [xuatOpen, setXuatOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [dvcKey, setDvcKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bangData, setBangData] = useState<DvcBangHoSo>({ headers: [], rows: [] });

  const activeMst = useActiveCompanyMst();
  // Tài khoản cổng Dịch vụ công là "<MST>-ql", khác cổng HĐĐT đăng nhập bằng MST trơ.
  const tenDangNhapDvc = activeMst ? `${activeMst}-ql` : undefined;

  // Bảng có đúng ba dòng cố định nên tab nào cũng tra ra — không cần nhánh dự phòng.
  const dangMo = TAB_DVC.find((muc) => muc.value === tab)!;

  const doiTab = (_e: SyntheticEvent, value: string) => setTab(value);

  /**
   * Gọi API tra cứu hồ sơ chạy ngầm: Backend tự động lấy captcha & OCR ngầm
   * mà không cần người dùng nhập mã.
   */
  const thucHienTraCuu = async (key: string, filterValues: BoLocHoSoValues) => {
    setLoading(true);
    try {
      const res = await traCuuHoSoDvc({
        key,
        tuNgay: filterValues.tuNgay,
        denNgay: filterValues.denNgay,
        maHoSo: filterValues.hoSo,
        maToKhai: filterValues.loaiHoSo,
      });
      setBangData(res);
      if (res.rows.length === 0) {
        toast.info("Không tìm thấy hồ sơ nào khớp với điều kiện tìm kiếm.");
      } else {
        toast.success(`Tìm thấy ${res.rows.length} hồ sơ.`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Tra cứu hồ sơ thất bại."));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Nhấn "Tìm kiếm":
   * - Nếu chưa đăng nhập DVC: Mở modal đăng nhập (captcha login tự động OCR điền sẵn).
   * - Nếu đã có phiên: Tự động chạy tra cứu ngầm mà không hiện captcha.
   */
  const handleSearch = (values: BoLocHoSoValues) => {
    if (!dvcKey) {
      setLoginOpen(true);
      return;
    }
    void thucHienTraCuu(dvcKey, values);
  };

  /**
   * Đăng nhập thành công -> Chỉ lưu key phiên và đóng dialog.
   * Không tự động tra cứu — người dùng phải bấm lại "Tìm kiếm".
   */
  const handleLoginSuccess = (key: string) => {
    setDvcKey(key);
    setLoginOpen(false);
    toast.success("Đăng nhập cổng Dịch vụ công thành công.");
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
          loading={loading}
          onSearch={handleSearch}
          onReset={() => setBangData({ headers: [], rows: [] })}
        />

        {/*
          Tiêu đề HIỂN THỊ luôn lấy từ `cotBang` (COT_TO_KHAI/COT_GIAY_NOP_TIEN
          trong config.ts), không dùng câu chữ tiêu đề cổng trả về. Vẫn phải
          truyền `bangData.headers` xuống để BangHoSo khớp đúng cột NGUỒN theo
          tên — cổng không có cột STT/nút bấm như `cotBang`, khớp theo vị trí
          sẽ đổ dữ liệu sang nhầm ô (vd "Mã giao dịch" lệch sang "Tên thủ tục").
        */}
        <BangHoSo cot={dangMo.cotBang} headers={bangData.headers} rows={bangData.rows} />
      </Box>

      <XuatFileDvcDialog open={xuatOpen} onClose={() => setXuatOpen(false)} />

      <DialogLoginDVC
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        initialUsername={tenDangNhapDvc}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
