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
import BoLocHoSo, {
  type BoLocHoSoValues,
} from "../../features/dich_vu_cong/components/BoLocHoSo";
import BangHoSo from "../../features/dich_vu_cong/components/BangHoSo";
import XuatFileDvcDialog from "../../features/dich_vu_cong/components/XuatFileDvcDialog";
import TaiLieuDinhKemDialog from "../../features/dich_vu_cong/components/TaiLieuDinhKemDialog";
import ThongBaoDialog from "../../features/dich_vu_cong/components/ThongBaoDialog";
import DialogDongBo from "../../features/dich_vu_cong/components/DialogDongBo";
import { TAB_DVC } from "../../features/dich_vu_cong/config";
import { useActiveCompanyMst } from "../../features/auth/useActiveCompanyMst";
import { traCuuHoSoDvc } from "../../features/dich_vu_cong/api/dvc";
import { taiFileHoSo } from "../../features/dich_vu_cong/taiFileHoSo";
import { getErrorMessage } from "../../lib/errors";
import { LoginRounded, SyncRounded } from "@mui/icons-material";

export default function DvcPage() {
  const [tab, setTab] = useState(TAB_DVC[0]!.value);
  const [xuatOpen, setXuatOpen] = useState(false);
  const [dongBoOpen, setDongBoOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  /**
   * Khóa phiên cổng Dịch vụ công, LƯU THEO MST — không phải một biến phẳng dùng chung.
   *
   * Đổi công ty không remount trang này (`switchCompany` chỉ đổi state ở `AuthContext`), nên
   * một biến phẳng sẽ giữ nguyên phiên của công ty trước: tra cứu ra hồ sơ công ty A trong khi
   * màn hình đang hiện công ty B. Cùng loại lỗi rò rỉ giữa tenant mà `useActiveGdtToken` bên
   * HĐĐT dựng riêng một hook để chặn.
   */
  const [dvcKeyTheoMst, setDvcKeyTheoMst] = useState<Record<string, string>>({});
  /** MST của lượt tra cứu đang hiển thị — lệch công ty đang chọn thì bảng phải trống. */
  const [mstKetQua, setMstKetQua] = useState<string | undefined>(undefined);

  const [dangChayAction, setDangChayAction] = useState<{
    key: string;
    maHoSo: string;
  } | null>(null);

  const [tepDinhKemMaHoSo, setTepDinhKemMaHoSo] = useState<string | null>(null);

  const [thongBaoMaHoSo, setThongBaoMaHoSo] = useState<string | null>(null);

  const activeMst = useActiveCompanyMst();

  const tenDangNhapDvc = activeMst ? `${activeMst}-ql` : undefined;

  /** Phiên cổng của ĐÚNG công ty đang chọn — điểm đọc khóa phiên duy nhất của trang. */
  const dvcKey = activeMst ? (dvcKeyTheoMst[activeMst] ?? null) : null;

  const dangMo = TAB_DVC.find((muc) => muc.value === tab)!;

  const doiTab = (_e: SyntheticEvent, value: string) => setTab(value);

  const traCuuMutation = useMutation({
    // `mst` không gửi lên API — chỉ đi kèm để `onSuccess` biết kết quả này của công ty nào.
    mutationFn: (vars: { key: string; mst: string; values: BoLocHoSoValues }) =>
      traCuuHoSoDvc({
        key: vars.key,
        tuNgay: vars.values.tuNgay,
        denNgay: vars.values.denNgay,
        maHoSo: vars.values.hoSo,
        maToKhai: vars.values.loaiHoSo,
      }),
    onSuccess: (res, vars) => {
      setMstKetQua(vars.mst);
      if (res.rows.length === 0) {
        toast.info("Không tìm thấy hồ sơ nào khớp với điều kiện tìm kiếm.");
      } else {
        toast.success(`Tìm thấy ${res.rows.length} hồ sơ.`);
      }
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, "Tra cứu hồ sơ thất bại.")),
  });
  /**
   * Kết quả chỉ hiện khi thuộc về công ty đang chọn. Đổi công ty giữa chừng thì bảng trống
   * NGAY ở lượt render kế — không giữ lại hồ sơ của công ty trước dưới tên công ty mới.
   */
  const bangData =
    (mstKetQua === activeMst ? traCuuMutation.data : undefined) ?? {
      headers: [],
      rows: [],
    };
  const loading = traCuuMutation.isPending;

  /**
   * Nhấn "Tìm kiếm" — chỉ tra cứu, KHÔNG tự mở form đăng nhập nữa: đăng nhập cổng đã có nút
   * riêng ở đầu trang, bấm tìm kiếm mà bị đè một dialog lên là cắt ngang điều kiện đang gõ dở.
   */
  const handleSearch = (values: BoLocHoSoValues) => {
    if (!activeMst || !dvcKey) {
      toast.info(
        'Chưa có phiên cổng Dịch vụ công — bấm "Đăng nhập cổng Dịch vụ công" trước khi tìm kiếm.',
      );
      return;
    }
    traCuuMutation.mutate({ key: dvcKey, mst: activeMst, values });
  };

  /** Lưu phiên vừa đăng nhập vào ĐÚNG MST đang chọn — xem chú thích ở `dvcKeyTheoMst`. */
  const handleLoginSuccess = (key: string) => {
    if (!activeMst) {
      toast.error("Chưa chọn công ty có mã số thuế nên không giữ được phiên đăng nhập.");
      return;
    }
    setDvcKeyTheoMst((prev) => ({ ...prev, [activeMst]: key }));
    setLoginOpen(false);
    toast.success("Đăng nhập cổng Dịch vụ công thành công.");
  };

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

  const handleAction = (actionKey: string, maHoSo: string) => {
    if (actionKey === "taiFile") {
      void handleTaiFile(maHoSo);
      return;
    }
    if (actionKey === "tepDinhKem") {
      setTepDinhKemMaHoSo(maHoSo);
      return;
    }
    if (actionKey === "thongBao") {
      setThongBaoMaHoSo(maHoSo);
      return;
    }
  };

  return (
    <>
      <AppHeader />
      <Box sx={{ p: 3 }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          {/* Bên trái */}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Dịch vụ công
          </Typography>

          {/* Bên phải */}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<SyncRounded fontSize="small" />}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
              onClick={() => setDongBoOpen(true)}
            >
              Đồng bộ dữ liệu thuế điện tử
            </Button>

            <Button
              variant="contained"
              startIcon={<LoginRounded fontSize="small" />}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
              onClick={() => setLoginOpen(true)}
            >
              Đăng nhập cổng Dịch vụ công
            </Button>
          </Stack>
        </Stack>

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

      <DialogDongBo open={dongBoOpen} onClose={() => setDongBoOpen(false)} />

      <DialogLoginDVC
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        activeMst={activeMst}
        initialUsername={tenDangNhapDvc}
        onLoginSuccess={handleLoginSuccess}
      />

      <TaiLieuDinhKemDialog
        open={!!tepDinhKemMaHoSo}
        onClose={() => setTepDinhKemMaHoSo(null)}
        dvcKey={dvcKey}
        maHoSo={tepDinhKemMaHoSo}
      />

      <ThongBaoDialog
        open={!!thongBaoMaHoSo}
        onClose={() => setThongBaoMaHoSo(null)}
        dvcKey={dvcKey}
        maHoSo={thongBaoMaHoSo}
      />
    </>
  );
}
