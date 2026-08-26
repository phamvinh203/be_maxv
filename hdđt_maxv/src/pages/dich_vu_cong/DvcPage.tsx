import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import ToKhaiXmlDialog from "../../features/dich_vu_cong/components/ToKhaiXmlDialog";
import DialogDongBo from "../../features/dich_vu_cong/components/DialogDongBo";
import { TAB_DVC } from "../../features/dich_vu_cong/config";
import { useActiveCompanyMst } from "../../features/auth/useActiveCompanyMst";
import {
  traCuuHoSoDvc,
  layTienDoDongBoDvc,
  QUERY_KEY_LICH_SU_DVC,
  type DvcDongBoTienDo,
} from "../../features/dich_vu_cong/api/dvc";
import { traCuuGiayNopTienDvc } from "../../features/dich_vu_cong/giay_nop_tien/api";
import { taiFileGiayNopTien } from "../../features/dich_vu_cong/giay_nop_tien/taiFileGiayNopTien";
import { theoDoiDongBoDvc, dangBamLuot } from "../../features/dich_vu_cong/theoDoiDongBoDvc";
import {
  MA_LOI_DVC_PHIEN_CHET,
  loadDvcKeys,
  saveDvcKeys,
} from "../../features/dich_vu_cong/dvcKeyStore";
import { ApiError } from "../../lib/http";
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
   *
   * Khởi tạo từ `localStorage` và ghi lại mỗi khi đổi -> sống qua F5 (xem `dvcKeyStore`). Khóa cũ
   * trỏ tới phiên BE đã chết KHÔNG sao: BE tự đăng nhập lại ngầm rồi gắn phiên mới vào đúng khóa đó.
   */
  const [dvcKeyTheoMst, setDvcKeyTheoMst] = useState<Record<string, string>>(loadDvcKeys);
  // Ghi qua effect (không phải side effect ngay trong updater của setState, vốn có thể chạy 2 lần
  // dưới StrictMode/concurrent rendering) — cùng lý do đã ghi ở `GdtSessionProvider`.
  useEffect(() => {
    saveDvcKeys(dvcKeyTheoMst);
  }, [dvcKeyTheoMst]);

  /** MST của lượt tra cứu đang hiển thị — lệch công ty đang chọn thì bảng phải trống. */
  const [mstKetQua, setMstKetQua] = useState<string | undefined>(undefined);

  const [dangChayAction, setDangChayAction] = useState<{
    key: string;
    maHoSo: string;
  } | null>(null);

  const [tepDinhKemMaHoSo, setTepDinhKemMaHoSo] = useState<string | null>(null);

  const [thongBaoMaHoSo, setThongBaoMaHoSo] = useState<string | null>(null);

  const [toKhaiMaHoSo, setToKhaiMaHoSo] = useState<string | null>(null);

  const activeMst = useActiveCompanyMst();

  /** Có lượt đồng bộ nền đang chạy hay không — chỉ để khóa nút "Đồng bộ" trong dialog. Số liệu thật
   * nằm trong toast tiến độ, không cần dựng lại ở đây. */
  const [dangDongBoNen, setDangDongBoNen] = useState(false);

  /**
   * `activeMst` MỚI NHẤT, đọc được từ trong vòng poll đang chạy.
   *
   * Vòng poll sống hàng phút và bắt đầu bằng một `activeMst` chụp tại thời điểm bấm nút; muốn biết
   * người dùng đã đổi công ty giữa chừng thì phải so với giá trị HIỆN TẠI, mà closure thì giữ mãi
   * giá trị cũ. Không có ref này thì toast tiếp tục hiện tiến độ của công ty vừa rời đi.
   */
  const activeMstRef = useRef(activeMst);
  useEffect(() => {
    activeMstRef.current = activeMst;
  }, [activeMst]);


  const queryClient = useQueryClient();

  const tenDangNhapDvc = activeMst ? `${activeMst}-ql` : undefined;

  /** Phiên cổng của ĐÚNG công ty đang chọn — điểm đọc khóa phiên duy nhất của trang. */
  const dvcKey = activeMst ? (dvcKeyTheoMst[activeMst] ?? null) : null;

  const dangMo = TAB_DVC.find((muc) => muc.value === tab)!;

  const doiTab = (_e: SyntheticEvent, value: string) => setTab(value);

  const traCuuMutation = useMutation({
    // `mst` không gửi lên API — chỉ đi kèm để `onSuccess` biết kết quả này của công ty nào.
    mutationFn: (vars: { mst: string; loai: string; values: BoLocHoSoValues }) =>
      vars.loai === "giay-nop-tien"
        ? traCuuGiayNopTienDvc({
            tuNgay: vars.values.tuNgay,
            denNgay: vars.values.denNgay,
            maGiaoDich: vars.values.hoSo,
            soGnt: vars.values.loaiHoSo,
          })
        : traCuuHoSoDvc({
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
   * Nhấn "Tìm kiếm" — đọc thẳng dữ liệu ĐÃ ĐỒNG BỘ trong DB, không gọi cổng nên không cần đăng
   * nhập cổng nữa (khác trước đây) — chỉ cần đã chọn công ty. Có dữ liệu mới hay không là việc
   * của nút "Đồng bộ dữ liệu thuế điện tử".
   */
  const handleSearch = (values: BoLocHoSoValues) => {
    if (!activeMst) return;
    traCuuMutation.mutate({ mst: activeMst, loai: tab, values });
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

  /**
   * BE báo khóa phiên đã CHẾT HẲN (tự đăng nhập lại ngầm cũng không cứu được) -> bỏ khóa đó đi.
   *
   * Không bỏ thì khóa chết nằm lại `localStorage` vô thời hạn, và mỗi thao tác sau đó lại kích một
   * lượt tự đăng nhập lại vô ích lên cổng — đúng kiểu dội request khiến cổng chặn tần suất, thậm
   * chí khóa tài khoản. Bỏ rồi thì lần sau người dùng thấy ngay là cần đăng nhập cổng lại.
   */
  /**
   * Bỏ khóa phiên khi BE gửi về ĐÚNG mã `DVC_AUTO_LOGIN_FAILED`.
   *
   * Tách riêng khỏi `boKhoaNeuPhienChet` vì có HAI đường mã này về tới FE: lỗi request thường mang
   * nó trong `ApiError.code`, còn lượt đồng bộ CHẠY NỀN thì không ném lỗi nào cả — mã nằm trong ô
   * tiến độ (`DvcDongBoTienDo.code`). Chỉ nhận `ApiError` là đường thứ hai lặng lẽ mất tác dụng.
   */
  const boKhoaNeuMaPhienChet = useCallback(
    (code: string | undefined) => {
      if (!activeMst || code !== MA_LOI_DVC_PHIEN_CHET) return;

      setDvcKeyTheoMst((prev) => {
        if (!(activeMst in prev)) return prev; // giữ nguyên identity -> khỏi ghi lại localStorage
        const conLai = { ...prev };
        delete conLai[activeMst];
        return conLai;
      });
      toast.warning(
        'Phiên cổng Dịch vụ công đã hết hạn — bấm "Đăng nhập cổng Dịch vụ công" để dùng tiếp.',
      );
    },
    [activeMst],
  );

  const boKhoaNeuPhienChet = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) boKhoaNeuMaPhienChet(err.code);
    },
    // `useCallback` KHÔNG phải để tối ưu: `useBaoPhienChet` lấy hàm này làm dep của effect, hàm mới
    // mỗi render là effect chạy lại mỗi render -> một tràng toast cho cùng một lỗi.
    [boKhoaNeuMaPhienChet],
  );

  /**
   * Bám theo MỘT lượt đồng bộ nền: hiện toast tiến độ góc dưới phải cho tới khi BE báo xong.
   *
   * Dùng chung cho hai đường vào — bấm nút trong `DialogDongBo`, và nối lại lượt đang chạy lúc mở
   * trang. Chốt `activeMst` tại thời điểm bắt đầu rồi so với `activeMstRef` để biết người dùng đã
   * đổi công ty giữa chừng chưa.
   */
  const batDauTheoDoiDongBo = useCallback(
    (initial: DvcDongBoTienDo) => {
      // Đã có vòng bám ĐÚNG lượt này rồi (vd effect nối lại vừa nhặt nó lên) -> đừng đụng gì nữa.
      // Hỏi theo định danh lượt nên lượt KHÁC vẫn được nhận, không bị bỏ rơi.
      if (dangBamLuot(initial.startedAt)) return;

      const mstLucBatDau = activeMstRef.current;
      setDangDongBoNen(true);
      void theoDoiDongBoDvc(initial, {
        daLacHau: () => activeMstRef.current !== mstLucBatDau,
        khiXong: (st) => {
          setDangDongBoNen(false);
          // `st` có -> lượt chạy xong thật; `null` -> vòng tự gỡ vì đã đổi công ty / đã sang lượt
          // khác. Không cần dò lại: `theoDoiDongBoDvc` nhận lượt mới ngay ở lần bàn giao.
          if (st) {
            boKhoaNeuMaPhienChet(st.code);
            void queryClient.invalidateQueries({ queryKey: QUERY_KEY_LICH_SU_DVC });
          }
        },
      });
    },
    [boKhoaNeuMaPhienChet, queryClient],
  );

  /**
   * Mở trang (hoặc đổi công ty) mà BE còn lượt đang chạy -> nối lại, hiện tiếp toast tiến độ.
   *
   * Trạng thái thật nằm ở BE nên đóng tab giữa chừng không mất gì; thiếu bước này thì lượt vẫn chạy
   * nhưng người dùng không còn thấy nó ở đâu.
   */
  useEffect(() => {
    let daHuy = false;
    void layTienDoDongBoDvc()
      .then((st) => {
        if (!daHuy && st?.active) batDauTheoDoiDongBo(st);
      })
      // Chưa đăng nhập / chưa chọn công ty -> BE trả lỗi, không có gì để nối lại. Im lặng bỏ qua:
      // đây là lượt dò lúc mở trang, không phải thao tác người dùng yêu cầu.
      .catch(() => {});
    return () => {
      daHuy = true;
    };
  }, [batDauTheoDoiDongBo]);

  // Không còn chặn khi thiếu `dvcKey`: hồ sơ đã đồng bộ thì BE đọc thẳng cache, không cần đăng
  // nhập cổng — thiếu key chỉ hỏng khi CẦN gọi cổng thật, lúc đó BE tự trả lỗi rõ ràng.
  const handleTaiFile = async (maHoSo: string) => {
    setDangChayAction({ key: "taiFile", maHoSo });
    const toastId = toast.loading(`Đang tải file ${maHoSo}…`);
    try {
      if (tab === "giay-nop-tien") {
        await taiFileGiayNopTien(dvcKey, maHoSo);
      } else {
        await taiFileHoSo(dvcKey, maHoSo);
      }
      toast.update(toastId, {
        render: `Đã tải file hồ sơ ${maHoSo}.`,
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });
    } catch (err) {
      boKhoaNeuPhienChet(err);
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

        {/* Nút xuất nằm ở hàng tab nên dùng chung cho mọi tab, không riêng tab nào. */}
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
          Một bộ lọc dùng chung cho mọi tab, cố tình không đặt `key={tab}`:
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
          onXemToKhai={setToKhaiMaHoSo}
          khoaMaGiaoDich={dangMo.khoaMaGiaoDich}
        />
      </Box>

      <XuatFileDvcDialog open={xuatOpen} onClose={() => setXuatOpen(false)} />

      <DialogDongBo
        open={dongBoOpen}
        onClose={() => setDongBoOpen(false)}
        dvcKey={dvcKey}
        onPhienChet={boKhoaNeuPhienChet}
        onDaBatDauDongBo={batDauTheoDoiDongBo}
        dangDongBoNen={dangDongBoNen}
      />

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
        onPhienChet={boKhoaNeuPhienChet}
      />

      <ThongBaoDialog
        open={!!thongBaoMaHoSo}
        onClose={() => setThongBaoMaHoSo(null)}
        dvcKey={dvcKey}
        maHoSo={thongBaoMaHoSo}
        onPhienChet={boKhoaNeuPhienChet}
      />

      <ToKhaiXmlDialog
        open={!!toKhaiMaHoSo}
        onClose={() => setToKhaiMaHoSo(null)}
        dvcKey={dvcKey}
        maHoSo={toKhaiMaHoSo}
        onPhienChet={boKhoaNeuPhienChet}
      />
    </>
  );
}
