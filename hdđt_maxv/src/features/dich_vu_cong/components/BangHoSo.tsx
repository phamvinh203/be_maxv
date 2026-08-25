import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import type { CotBang } from "../config";
import { fmtMoney } from "../../../utils/format";
import ColumnFilterButton, { type SortKind } from "../../../components/ColumnFilterButton";
import ColumnFilterInput from "../../../components/ColumnFilterInput";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "../../../components/InvoicePagination";
import {
  containsText,
  inNumRange,
  parseRangeInput,
  RANGE_INPUT_HINT,
} from "../../../utils/columnFilterText";
import { compareCellText, type SortState } from "../../../utils/rawCellSort";
import { clampPage } from "../../../utils/pagination";
import { columnDividerSx } from "../../../utils/tableStyles";

interface Props {
  /** Cột khai sẵn trong `config.ts` — luôn dùng bộ này làm tiêu đề bảng. */
  cot: CotBang[];
  /**
   * Tiêu đề cổng trả về — CHỈ dùng để khớp đúng ô dữ liệu vào cột của `cot` theo
   * TÊN, không dùng để hiển thị. Cổng có thể không có đủ mọi cột trong `cot`
   * (ví dụ chưa có cột STT/nút bấm), khớp theo vị trí như dữ liệu thô sẽ đổ
   * nhầm cột — ví dụ "Mã giao dịch" bị lệch sang ô "Tên thủ tục hành chính".
   */
  headers?: string[];
  /** Dòng kết quả, thứ tự cột khớp với `headers`. */
  rows?: string[][];
  /**
   * Bấm một icon ở cột hành động (`cot[i].action === true`, xem `config.ts`) —
   * nhận `key` của cột đó (vd `"taiFile"`) và `maHoSo` (giá trị cột "Mã giao
   * dịch") của đúng dòng vừa bấm. Bỏ trống thì icon hiện khóa.
   */
  onAction?: (actionKey: string, maHoSo: string) => void;
  /** Hành động đang chạy dở — hiện vòng quay đúng icon/dòng đó, khóa các icon còn lại. */
  dangChayAction?: { key: string; maHoSo: string } | null;
  /**
   * Bấm vào ô của cột khai `clickable: true` (`cot[i].clickable`, xem `config.ts` — hiện là "Tờ
   * khai / Phụ lục") — nhận `maHoSo` (giá trị cột "Mã giao dịch") của đúng dòng vừa bấm, để mở
   * dialog "Xem tờ khai". Bỏ trống, dòng không có `maHoSo`, hoặc ô rỗng thì hiện như text thường.
   */
  onXemToKhai?: (maHoSo: string) => void;
}

/** Icon cho từng cột hành động, theo `key` khai trong `config.ts`. Chưa có ở đây = icon ẩn. */
const ICON_HANH_DONG: Record<string, typeof FileDownloadRounded> = {
  taiFile: FileDownloadRounded,
  tepDinhKem: AttachFileRounded,
  thongBao: NotificationsRounded,
};

function chuanHoaTieuDe(s: string): string {
  return s.trim().toLowerCase();
}

/** Cột KHÔNG lọc/sắp xếp được — "STT" tự đánh số lại theo dòng đang hiện (không phải dữ liệu thật,
 * sắp xếp/lọc theo nó vô nghĩa), cột hành động là nút bấm, không có giá trị chữ để so sánh. */
function locSapXepDuoc(c: CotBang): boolean {
  return c.key !== "stt" && !c.action;
}

/** sortKind CHỈ quyết định CHỮ trong popover sắp xếp ("A→Z" hay "cũ→mới"...) — cách so sánh THẬT
 * luôn tự nhận dạng theo hình dạng chuỗi (`compareCellText`), nên đoán sai ở đây chỉ sai chữ, không
 * sai kết quả. Mọi cột ngày của cấu hình hiện tại (`config.ts`) đều đặt tên bắt đầu "ngay" (ngayNop,
 * ngayLapGnt, ngayGuiGnt, ngayNopThue, ngayNopDsChiTiet) nên dò theo tiền tố, khỏi phải thêm field
 * riêng vào `CotBang` chỉ để phục vụ đúng phần chữ hiển thị này. */
function sortKindOf(c: CotBang): SortKind {
  if (c.format === "money") return "number";
  if (c.key.startsWith("ngay")) return "date";
  return "text";
}

/**
 * Bảng kết quả tra cứu hồ sơ đã nộp.
 *
 * Mười mấy cột thì không cách nào vừa màn hình nên bảng tự cuộn ngang trong
 * khung của nó, tiêu đề không xuống dòng và dính lại khi cuộn dọc — cuộn tới
 * dòng thứ ba mươi mà mất tiêu đề thì không biết cột nào là cột nào.
 *
 * Tiêu đề hiển thị luôn lấy từ `cot` (COT_TO_KHAI/COT_GIAY_NOP_TIEN trong
 * config.ts), không dùng câu chữ tiêu đề của cổng — nhưng dữ liệu từng ô vẫn
 * phải tìm đúng cột nguồn qua `headers` (tên), vì `cot` có thêm cột STT và các
 * cột nút bấm mà cổng không có, nên không thể giả định cùng vị trí.
 */
/**
 * Style CẮT DÒNG, đặt lên chính phần tử chứa chữ — KHÔNG đặt lên `TableCell`.
 *
 * `-webkit-line-clamp` đếm *dòng chữ* của khối mang nó. Cột "Tờ khai / Phụ lục" bọc nội dung trong
 * `Link component="button"`, mà một nút là hộp inline nguyên khối — với ô làm khối clamp thì nó chỉ
 * là MỘT dòng, nên không cắt gì cả và `overflow: hidden` của ô xén ngang thân chữ, không có "…".
 * Đặt lên phần tử trong cùng thì đúng cho cả ô chữ thuần lẫn ô có nút.
 */
const CAT_DONG = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden",
};

/** Style của Ô: mặc định `nowrap` vì phần lớn cột là số tiền/ngày/mã — cho chúng xuống dòng chỉ làm
 * dòng so le mà chẳng hẹp thêm bao nhiêu. Cột khai `rongToiDa` thì chặn bề rộng và cho xuống dòng. */
function styleO(c?: CotBang) {
  return c?.rongToiDa
    ? { maxWidth: c.rongToiDa, whiteSpace: "normal" as const }
    : { whiteSpace: "nowrap" as const };
}

export default function BangHoSo({
  cot,
  headers = [],
  rows = [],
  onAction,
  dangChayAction,
  onXemToKhai,
}: Props) {
  const [sort, setSort] = useState<SortState>(null);
  /** Text đang gõ ở dòng lọc cố định, theo `col.key`. Cột tiền (`format: "money"`) diễn giải qua
   * `parseRangeInput` lúc lọc; các cột khác so `contains` trực tiếp. */
  const [filters, setFilters] = useState<Record<string, string>>({});
  // Phân trang phía client (đã tải hết tối đa 500 dòng về 1 lượt "Tìm kiếm", xem
  // `MAX_KET_QUA_TIM_KIEM` bên BE) — dùng chung `InvoicePagination`/`clampPage` với 2 bảng hóa đơn.
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  // Đổi tab (`cot` đổi THAM CHIẾU — mỗi tab giữ 1 mảng CỐ ĐỊNH trong `TAB_DVC`, xem `config.ts`)
  // -> bỏ hết lọc/sắp xếp/trang cũ. Không bỏ thì lọc/sort còn trỏ vào cột đã không còn tồn tại ở tab
  // mới (2 tab chỉ trùng vài key: stt/lanNop/trangThai/taiFile), hoặc tệ hơn là TRÙNG key nhưng khác
  // hẳn ý nghĩa (vd "trangThai" của tờ khai khác "trangThai" của giấy nộp tiền) — lọc từ tab cũ âm
  // thầm ăn theo tab mới thì bảng trống oan mà không rõ vì sao; còn trang thì tab mới thường ít dòng
  // hơn, đứng nguyên trang 5 dễ kẹt trang trống. Mẫu "lưu giá trị trước" của React (điều chỉnh NGAY
  // trong render bằng `useState`, không dùng effect) — xem `ColumnFilterInput`.
  const [prevCot, setPrevCot] = useState(cot);
  if (cot !== prevCot) {
    setPrevCot(cot);
    setSort(null);
    setFilters({});
    setPage(0);
  }

  const tieuDe = cot.map((c) => c.header);
  const canLe = (i: number) => cot[i]?.align;

  const viTriNguon = useMemo(
    () =>
      cot.map((c) =>
        headers.findIndex((h) => chuanHoaTieuDe(h) === chuanHoaTieuDe(c.srcHeader ?? c.header)),
      ),
    [cot, headers],
  );
  const idxMaGiaoDich = cot.findIndex((c) => c.key === "maGiaoDich");
  if (idxMaGiaoDich === -1 && cot.some((c) => c.action)) {
    // Có cột hành động nhưng không tìm thấy cột "maGiaoDich" để lấy mã hồ sơ — mọi icon sẽ bị
    // khóa (không rõ dòng nào). Cảnh báo ngay thay vì để lỗi im lặng nếu key "maGiaoDich" đổi.
    console.warn('BangHoSo: có cột action nhưng thiếu cột key "maGiaoDich" để lấy mã hồ sơ.');
  }

  /** Giá trị THÔ (chưa format) của 1 ô — dùng để LỌC/SẮP XẾP, khác `layO` bên dưới (dùng để HIỂN
   * THỊ, đã format tiền: "1234567" -> "1.234.567"). Lọc/sắp xếp trên bản format sẽ hỏng cột tiền
   * (dấu chấm ngăn cách ngàn kiểu VN phá mất phép so số). Cột `stt` không đọc từ dữ liệu cổng — tự
   * đánh số theo dòng (`dongThu`); không dùng để lọc/sắp xếp (`locSapXepDuoc`) nên `dongThu` truyền
   * vào lúc lọc/sort chỉ là giá trị giữ chỗ, không ảnh hưởng kết quả. Hàm thường (không `useCallback`)
   * — bảng tối đa 500 dòng (`MAX_KET_QUA_TIM_KIEM` bên BE) nên tính lại mỗi render không đáng kể,
   * khỏi cần giữ định danh ổn định giữa 2 lần render.
   */
  const layOTho = (row: string[], cotIdx: number, dongThu: number): string => {
    if (cot[cotIdx]?.key === "stt") return String(dongThu + 1);
    const nguon = viTriNguon[cotIdx];
    return nguon >= 0 ? (row[nguon] ?? "") : "";
  };
  const layO = (row: string[], cotIdx: number, dongThu: number): string => {
    const gia = layOTho(row, cotIdx, dongThu);
    return cot[cotIdx]?.format === "money" ? fmtMoney(gia) : gia;
  };

  /** Áp lọc rồi sắp xếp trên `rows` gốc. Cùng lý do trên: tính lại mỗi render (không `useMemo`) —
   * bảng tối đa 500 dòng × tới 23 cột nên không đáng kể, và `pagedRows` ngay dưới cũng đã là giá
   * trị thường (không memo) nên memo ở đây vốn không tiết kiệm được gì thêm. */
  const dangLoc = cot
    .map((c, idx) => {
      const text = (filters[c.key] ?? "").trim();
      // Diễn giải cú pháp khoảng 1 LẦN ở đây (không phải mỗi dòng bên trong `.every()` bên dưới).
      return { idx, c, text, range: c.format === "money" && text ? parseRangeInput(text) : null };
    })
    .filter(({ c, text }) => text && locSapXepDuoc(c));

  let filteredSortedRows = rows;
  if (dangLoc.length > 0) {
    filteredSortedRows = rows.filter((row) =>
      dangLoc.every(({ idx, c, text, range }) => {
        const raw = layOTho(row, idx, 0);
        if (c.format === "money") {
          const num = raw === "" ? NaN : Number(raw);
          return inNumRange(Number.isNaN(num) ? undefined : num, range?.tu, range?.den);
        }
        return containsText(raw, text);
      }),
    );
  }
  if (sort) {
    const sortIdx = cot.findIndex((c) => c.key === sort.key);
    if (sortIdx >= 0) {
      filteredSortedRows = [...filteredSortedRows].sort((a, b) =>
        compareCellText(layOTho(a, sortIdx, 0), layOTho(b, sortIdx, 0), sort.dir),
      );
    }
  }

  // Kẹp trang trong khoảng hợp lệ (lọc/kết quả tra cứu mới ít dòng hơn -> khỏi kẹt ở trang trống).
  const safePage = clampPage(page, filteredSortedRows.length, rowsPerPage);
  const pagedRows = filteredSortedRows.slice(
    safePage * rowsPerPage,
    safePage * rowsPerPage + rowsPerPage,
  );

  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader sx={columnDividerSx}>
          <TableHead>
            <TableRow>
              {tieuDe.map((header, i) => {
                const c = cot[i];
                return (
                  <TableCell
                    key={header || i}
                    align={canLe(i)}
                    sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    {header}
                    {c && locSapXepDuoc(c) && (
                      <ColumnFilterButton
                        label={header}
                        sortKind={sortKindOf(c)}
                        sortDir={sort?.key === c.key ? sort.dir : null}
                        onSort={(dir) => setSort(dir ? { key: c.key, dir } : null)}
                      />
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
            {/* Dòng lọc CỐ ĐỊNH dưới header — 1 ô/cột lọc được, rỗng nếu cột không lọc (STT/nút hành
                động). `position: "static"` để BỎ hiệu ứng dính-khi-cuộn-dọc (`stickyHeader` trên
                `Table` áp cho MỌI ô trong `TableHead`, không phân biệt dòng) — 2 dòng cùng dính ở
                top:0 sẽ đè chữ lên nhau, nên chỉ dòng tiêu đề dính, dòng lọc cuộn theo thân bảng. */}
            <TableRow>
              {cot.map((c, i) => (
                <TableCell key={c.key || i} align={canLe(i)} sx={{ position: "static", py: 0.25 }}>
                  {locSapXepDuoc(c) && (
                    <ColumnFilterInput
                      value={filters[c.key] ?? ""}
                      onApply={(v) => setFilters((prev) => ({ ...prev, [c.key]: v }))}
                      hint={c.format === "money" ? RANGE_INPUT_HINT : undefined}
                    />
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
  
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tieuDe.length} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Chưa có dữ liệu. Nhập điều kiện rồi nhấn “Tìm kiếm”.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredSortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tieuDe.length} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Không có dòng nào khớp bộ lọc đang gõ.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row, i) => {
                // Số thứ tự (cột "stt") tính theo vị trí TOÀN CỤC, không phải vị trí trong trang đang
                // hiện — trang 2 (20 dòng/trang) phải hiện STT 21, 22..., không phải quay lại 1, 2...
                const dongThu = safePage * rowsPerPage + i;
                const maGiaoDich = idxMaGiaoDich >= 0 ? layO(row, idxMaGiaoDich, dongThu) : "";
  
                return (
                  <TableRow key={dongThu} hover>
                    {tieuDe.map((_h, j) => {
                      const c = cot[j];
                      if (!c?.action) {
                        const gia = layO(row, j, dongThu);
                        // Cột khai `clickable: true` (hiện là "Tờ khai / Phụ lục") mở dialog "Xem tờ
                        // khai" qua `maGiaoDich` của đúng dòng — cần cả `onXemToKhai` lẫn có mã hồ sơ
                        // mới bấm được, cùng quy ước khóa icon hành động khi thiếu `maGiaoDich` ở
                        // nhánh bên dưới.
                        //
                        // Đòi thêm `gia` không rỗng: cột bấm được nay là "Tờ khai / Phụ lục", mà ô đó
                        // CÓ THỂ rỗng (`to_khai` lưu `null` khi cổng không trả) — khác "Tên TTHC" gần
                        // như luôn có chữ. Rỗng mà vẫn bọc `Link` thì ra một link vô hình: không thấy
                        // gì để bấm nhưng vẫn là vùng bấm được.
                        const bamDuoc = c?.clickable && onXemToKhai && maGiaoDich && gia;
  
                        return (
                          <TableCell
                            key={j}
                            align={canLe(j)}
                            sx={styleO(c)}
                            // Chữ bị `line-clamp` cắt vẫn xem được bằng cách rê chuột. Chỉ gắn cho ô
                            // co hẹp: gắn cho mọi ô là tooltip nhảy loạn khi rê ngang bảng.
                            title={c?.rongToiDa ? gia : undefined}
                          >
                            {bamDuoc ? (
                              <Link
                                component="button"
                                type="button"
                                underline="hover"
                                onClick={() => onXemToKhai(maGiaoDich)}
                                sx={{
                                  font: "inherit",
                                  textAlign: "left",
                                  ...(c?.rongToiDa ? CAT_DONG : null),
                                }}
                              >
                                {gia}
                              </Link>
                            ) : c?.rongToiDa ? (
                              <Box component="span" sx={CAT_DONG}>
                                {gia}
                              </Box>
                            ) : (
                              gia
                            )}
                          </TableCell>
                        );
                      }
  
                      // Cột hành động chưa đăng ký icon trong ICON_HANH_DONG -> hiện trống, giống
                      // cột dữ liệu chưa có nguồn, thay vì vẽ nút không làm gì.
                      const Icon = ICON_HANH_DONG[c.key];
                      if (!Icon) return <TableCell key={j} align={canLe(j)} />;
  
                      const dangChay =
                        !!maGiaoDich && dangChayAction?.key === c.key && dangChayAction.maHoSo === maGiaoDich;
  
                      return (
                        <TableCell key={j} align={canLe(j)} sx={{ whiteSpace: "nowrap" }}>
                          <Tooltip title={maGiaoDich ? c.header : "Không có mã hồ sơ"}>
                            <span>
                              <IconButton
                                size="small"
                                sx={{ p: 0.25 }}
                                disabled={!onAction || !maGiaoDich || dangChay}
                                onClick={() => onAction?.(c.key, maGiaoDich)}
                                aria-label={`${c.header} ${maGiaoDich}`}
                              >
                                {dangChay ? <CircularProgress size={16} /> : <Icon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <InvoicePagination
        count={filteredSortedRows.length}
        page={safePage}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setPage(0);
        }}
      />
    </>
  );
}
