import { useState, type SyntheticEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { toast } from "react-toastify";

import AppHeader from "../../components/AppHeader";
import DialogLoginDVC from "../../features/dich_vu_cong/components/DialogLoginDVC";
import BoLocHoSo, { type BoLocHoSoValues } from "../../features/dich_vu_cong/components/BoLocHoSo";
import BangHoSo from "../../features/dich_vu_cong/components/BangHoSo";
import XuatFileDvcDialog from "../../features/dich_vu_cong/components/XuatFileDvcDialog";
import TaiLieuDinhKemDialog from "../../features/dich_vu_cong/components/TaiLieuDinhKemDialog";
import { TAB_DVC } from "../../features/dich_vu_cong/config";
import { useActiveCompanyMst } from "../../features/auth/useActiveCompanyMst";
import { traCuuHoSoDvc } from "../../features/dich_vu_cong/api/dvc";
import { taiFileHoSo } from "../../features/dich_vu_cong/taiFileHoSo";
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
  /** Hành động (cột "Tải file"...) đang chạy dở — xem `onAction` truyền cho `BangHoSo`. */
  const [dangChayAction, setDangChayAction] = useState<{ key: string; maHoSo: string } | null>(
    null,
  );
  /** Mã hồ sơ đang mở dialog "Tệp đính kèm" — null = dialog đóng. */
  const [tepDinhKemMaHoSo, setTepDinhKemMaHoSo] = useState<string | null>(null);

  const activeMst = useActiveCompanyMst();
  // Tài khoản cổng Dịch vụ công là "<MST>-ql", khác cổng HĐĐT đăng nhập bằng MST trơ.
  const tenDangNhapDvc = activeMst ? `${activeMst}-ql` : undefined;

  // Bảng có đúng ba dòng cố định nên tab nào cũng tra ra — không cần nhánh dự phòng.
  const dangMo = TAB_DVC.find((muc) => muc.value === tab)!;

  const doiTab = (_e: SyntheticEvent, value: string) => setTab(value);

  /**
   * Tra cứu hồ sơ chạy ngầm: Backend tự động lấy captcha & OCR ngầm mà không cần người dùng
   * nhập mã. `useMutation` thay vì tự quản `loading`/kết quả bằng tay — khớp cách
   * `loginMutation` trong `DialogLoginDVC` và `TaiLieuDinhKemDialog` đã dùng TanStack Query.
   */
  const traCuuMutation = useMutation({
    mutationFn: (vars: { key: string; values: BoLocHoSoValues }) =>
      traCuuHoSoDvc({
        key: vars.key,
        tuNgay: vars.values.tuNgay,
        denNgay: vars.values.denNgay,
        maHoSo: vars.values.hoSo,
        maToKhai: vars.values.loaiHoSo,
      }),
    onSuccess: (res) => {
      if (res.rows.length === 0) {
        toast.info("Không tìm thấy hồ sơ nào khớp với điều kiện tìm kiếm.");
      } else {
        toast.success(`Tìm thấy ${res.rows.length} hồ sơ.`);
      }
    },
    onError: (err) => toast.error(getErrorMessage(err, "Tra cứu hồ sơ thất bại.")),
  });
  const bangData = traCuuMutation.data ?? { headers: [], rows: [] };
  const loading = traCuuMutation.isPending;

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
    traCuuMutation.mutate({ key: dvcKey, values });
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

  /**
   * Bấm icon "Tải file" của một dòng — luôn có `dvcKey` vì icon chỉ hiện sau khi tra cứu
   * ra dữ liệu, mà tra cứu đã bắt buộc đăng nhập trước đó.
   */
  const handleTaiFile = async (maHoSo: string) => {
    if (!dvcKey) return;
    setDangChayAction({ key: "taiFile", maHoSo });
    const toastId = toast.loading(`Đang tải file hồ sơ ${maHoSo}…`);
    try {
      await taiFileHoSo(dvcKey, maHoSo);
      toast.update(toastId, {
        render: `Đã tải file hồ sơ ${maHoSo}.`,
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });
    } catch (err) {
      toast.update(toastId, {
        render: getErrorMessage(err, "Tải file hồ sơ thất bại."),
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    } finally {
      setDangChayAction(null);
    }
  };

  /**
   * Bấm một icon hành động ở `BangHoSo` — phân theo `actionKey` khai trong `cotBang`
   * (`config.ts`). Thêm cột hành động mới chỉ cần thêm 1 case ở đây, khỏi sửa `BangHoSo`.
   */
  const handleAction = (actionKey: string, maHoSo: string) => {
    if (actionKey === "taiFile") {
      void handleTaiFile(maHoSo);
      return;
    }
    if (actionKey === "tepDinhKem") {
      setTepDinhKemMaHoSo(maHoSo);
      return;
    }
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
          onReset={() => traCuuMutation.reset()}
        />

        {/*
          Tiêu đề HIỂN THỊ luôn lấy từ `cotBang` (COT_TO_KHAI/COT_GIAY_NOP_TIEN
          trong config.ts), không dùng câu chữ tiêu đề cổng trả về. Vẫn phải
          truyền `bangData.headers` xuống để BangHoSo khớp đúng cột NGUỒN theo
          tên — cổng không có cột STT/nút bấm như `cotBang`, khớp theo vị trí
          sẽ đổ dữ liệu sang nhầm ô (vd "Mã giao dịch" lệch sang "Tên thủ tục").
        */}
        <BangHoSo
          cot={dangMo.cotBang}
          headers={bangData.headers}
          rows={bangData.rows}
          onAction={handleAction}
          dangChayAction={dangChayAction}
        />
      </Box>

      <XuatFileDvcDialog open={xuatOpen} onClose={() => setXuatOpen(false)} />

      <DialogLoginDVC
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        initialUsername={tenDangNhapDvc}
        onLoginSuccess={handleLoginSuccess}
      />

      <TaiLieuDinhKemDialog
        open={!!tepDinhKemMaHoSo}
        onClose={() => setTepDinhKemMaHoSo(null)}
        dvcKey={dvcKey}
        maHoSo={tepDinhKemMaHoSo}
      />
    </>
  );
}
