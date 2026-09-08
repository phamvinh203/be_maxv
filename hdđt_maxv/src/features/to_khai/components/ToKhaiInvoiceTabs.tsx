import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ChonKyPanel from "./ChonKyPanel";
import BangKeMotChieu from "./bang_ke/BangKeMotChieu";
import ToKhaiGtgt01Editor from "./ToKhaiGtgt01Editor";
import DanhSachKyDaLap from "./DanhSachKyDaLap";
import { useBanToKhaiQuery, useDanhSachKyQuery, useTinhToKhai } from "../api/gtgt01Queries";
import { useKeKhaiMutation } from "../api/toKhaiQueries";
import { getPhuSongKy } from "../api/toKhai";
import { baoKetQuaKeKhai } from "../thongBaoKeKhai";
import { KHO_GIAY_TO_KHAI } from "../layout";
import { cungKy, kyToQuery, kyTuQuery, nhanKy, type Ky } from "../ky";
import type { InvoiceDirection } from "../../hddt/types";
import { getErrorMessage } from "../../../lib/errors";
import { ApiError } from "../../../lib/http";
import { useAuth } from "../../auth/useAuth";
import { toast } from "react-toastify";

type TabToKhai = InvoiceDirection | "to-khai";

/** Màn Tờ khai chỉ điều phối kỳ và tab; mỗi bảng kê tự giữ state phân trang của nó. */
export default function ToKhaiInvoiceTabs(): ReactElement {
  const { currentCompanyId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const ky = useMemo(() => kyTuQuery(searchParams), [searchParams]);
  const [tab, setTab] = useState<TabToKhai>("purchase");
  const laToKhai = tab === "to-khai";

  const doiKy = (moi: Ky) => setSearchParams(new URLSearchParams(kyToQuery(moi)));
  const banToKhai = useBanToKhaiQuery(ky, laToKhai);
  const tinh = useTinhToKhai();
  const keKhai = useKeKhaiMutation();

  /**
   * Kỳ đang chọn đã chốt chưa — lấy từ danh sách kỳ đã lập (`DanhSachKyDaLap` dùng chung query này
   * nên không tốn thêm request). Không đọc `banToKhai` vì query đó chỉ bật ở tab Tờ khai, còn nút
   * "Lập tờ khai" lại nằm ở hai tab bảng kê.
   *
   * Danh sách chưa tải xong thì coi như chưa chốt — server vẫn chặn bằng mã `da_chot`.
   */
  const danhSachKy = useDanhSachKyQuery();
  const daChot = (danhSachKy.data ?? []).some(
    (r) => cungKy(r, ky) && r.trangThai === "chot",
  );

  /**
   * "Lập tờ khai" từ khối chọn kỳ: KÊ KHAI luôn kỳ đang chọn rồi tính — một nút trọn hai bước,
   * khỏi phải sang màn Hóa đơn điện tử bấm "Kê khai" trước. Kê khai lại là an toàn: upsert chỉ
   * gán/gỡ kỳ, giữ nguyên quyết định của kế toán (`ke_khai`, ghi chú, chỉ tiêu tăng giảm).
   *
   * Kỳ sau khi kê khai vẫn trống thì không tính nữa — chưa đồng bộ hóa đơn là thiếu gốc, tính
   * cũng chỉ ra lỗi "chưa có hóa đơn nào được kê khai" khó hiểu.
   */
  const bamLapToKhai = () => {
    // Kỳ đã chốt: chặn TRƯỚC lượt kê khai. Kê khai lại có quyền gỡ dòng khỏi bảng kê, mà bản tờ
    // khai đã chốt thì không tính lại — để chạy là bảng kê một đằng, số đã nộp một nẻo.
    if (daChot) {
      toast.error(
        `Tờ khai kỳ ${nhanKy(ky)} đã chốt. Mở khóa ở tab "Tờ khai 01/GTGT" rồi lập lại.`,
      );
      return;
    }

    // Độ phủ đồng bộ chỉ CẢNH BÁO, không chặn — kế toán có thể cố ý lập trên phần đang có, như
    // dialog "Kê khai" (cảnh báo nhưng nút vẫn bấm được). Đọc từ `sync_log`, không phụ thuộc lượt
    // kê khai nên chạy song song; lỗi của nó để lượt kê khai/tính tự báo lỗi của chúng.
    void getPhuSongKy(ky)
      .then((ps) => {
        if (!ps.daPhu && ps.canhBao) {
          toast.warning(`Kỳ ${nhanKy(ky)} chưa đồng bộ trọn vẹn: ${ps.canhBao}`);
        }
      })
      .catch(() => {});

    keKhai.mutate(ky, {
      onSuccess: (kq) => {
        baoKetQuaKeKhai(kq);
        if (kq.tong === 0) {
          // Kỳ rỗng vì hóa đơn còn nằm ở kỳ đã chốt thì `baoKetQuaKeKhai` đã nói đúng lý do rồi —
          // thêm câu "sang đồng bộ hóa đơn" ở đây chỉ chỉ sai đường.
          if (kq.giuKyChot === 0) {
            toast.error(
              `Kỳ ${kq.nhanKy} không có hóa đơn nào sau khi kê khai — hãy sang màn Hóa đơn điện tử ` +
                `đồng bộ hóa đơn của kỳ này rồi thử lại.`,
            );
          }
          return;
        }
        tinh.mutate(ky, {
          onSuccess: () => {
            setTab("to-khai");
            toast.success(`Đã lập tờ khai kỳ ${kq.nhanKy}.`);
          },
          onError: (err) => toast.error(getErrorMessage(err, "Không lập được tờ khai.")),
        });
      },
      onError: (err) => toast.error(getErrorMessage(err, "Không kê khai được kỳ này.")),
    });
  };
  const loi = banToKhai.isError
    ? {
        message: getErrorMessage(banToKhai.error, "Kỳ này chưa có bản tờ khai nào."),
        severity:
          banToKhai.error instanceof ApiError && banToKhai.error.code === "chua_co_ban"
            ? ("info" as const)
            : ("error" as const),
      }
    : null;

  return (
    <Box>
      {!laToKhai && (
        <ChonKyPanel
          ky={ky}
          onChange={doiKy}
          onLapToKhai={bamLapToKhai}
          dangLap={keKhai.isPending || tinh.isPending}
          daChot={daChot}
        />
      )}

      <Tabs value={tab} onChange={(_event, value: TabToKhai) => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="purchase" label="Hóa đơn mua vào" sx={{ textTransform: "none" }} />
        <Tab value="sold" label="Hóa đơn bán ra" sx={{ textTransform: "none" }} />
        <Tab value="to-khai" label="Tờ khai 01/GTGT" sx={{ textTransform: "none" }} />
      </Tabs>

      <Box sx={{ display: tab === "purchase" ? "block" : "none" }}>
        <BangKeMotChieu ky={ky} direction="purchase" active={tab === "purchase"} />
      </Box>
      <Box sx={{ display: tab === "sold" ? "block" : "none" }}>
        <BangKeMotChieu ky={ky} direction="sold" active={tab === "sold"} />
      </Box>

      {laToKhai && (
        <>
          <ToKhaiGtgt01Editor
            key={`${currentCompanyId ?? "chua-chon"}-${nhanKy(ky)}`}
            ky={ky}
            ban={banToKhai.data ?? null}
            dangTai={banToKhai.isFetching}
            loi={loi}
            onDoiKy={() => setTab("purchase")}
          />
          <Box sx={{ maxWidth: KHO_GIAY_TO_KHAI, mx: "auto" }}>
            <DanhSachKyDaLap kyDangXem={ky} onChonKy={doiKy} />
          </Box>
        </>
      )}
    </Box>
  );
}
