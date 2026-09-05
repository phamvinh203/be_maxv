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
import { useBanToKhaiQuery } from "../api/gtgt01Queries";
import { KHO_GIAY_TO_KHAI } from "../layout";
import { kyToQuery, kyTuQuery, nhanKy, type Ky } from "../ky";
import type { InvoiceDirection } from "../../hddt/types";
import { getErrorMessage } from "../../../lib/errors";
import { ApiError } from "../../../lib/http";
import { useAuth } from "../../auth/useAuth";

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
      {!laToKhai && <ChonKyPanel ky={ky} onChange={doiKy} />}

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
