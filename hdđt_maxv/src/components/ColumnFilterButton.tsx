import { useState, type MouseEvent } from "react";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import FilterAltRounded from "@mui/icons-material/FilterAltRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";

/** Quyết định CHỮ hiển thị cho 2 mục sắp xếp — không đổi cách so sánh (mỗi bảng gọi tự lo phần so
 * sánh của mình), chỉ đổi wording cho khớp ngữ cảnh cột (tên/mã đọc khác quyển hàng, ngày đọc khác
 * tiền). */
export type SortKind = "text" | "number" | "date";

const SORT_LABELS: Record<SortKind, { asc: string; desc: string }> = {
  text: { asc: "Sắp xếp A → Z", desc: "Sắp xếp Z → A" },
  number: { asc: "Sắp xếp từ thấp đến cao", desc: "Sắp xếp từ cao đến thấp" },
  date: { asc: "Sắp xếp cũ nhất → mới nhất", desc: "Sắp xếp mới nhất → cũ nhất" },
};

/** Gõ xong bao lâu thì ô lọc dòng cố định (`ColumnFilterInput`) tự áp — đủ ngắn để thấy "gõ tới đâu
 * lọc tới đó", đủ dài để không bắn một lượt lọc (có thể kèm gọi API) cho MỖI phím gõ. Export để nơi
 * gọi (panel lọc riêng, ô input) dùng lại đúng độ trễ này thay vì mỗi nơi tự khai một hằng số 200
 * khác phải tự tay giữ đồng bộ. */
export const LIVE_APPLY_MS = 200;

interface Props {
  label: string;
  sortDir?: "asc" | "desc" | null;
  onSort: (dir: "asc" | "desc" | null) => void;
  /** Chữ 2 mục sắp xếp — mặc định "text" (A→Z). */
  sortKind?: SortKind;
}

/**
 * Icon SẮP XẾP gắn cạnh tên cột trong header bảng — bấm mở popover nhỏ chọn tăng/giảm. Icon đổi màu
 * khi cột đang được sort, để nhận ra ngay không cần mở popover. Lọc theo cột không nằm trong
 * component này — mỗi bảng tự đặt 1 dòng `ColumnFilterInput` cố định dưới header (xem ví dụ
 * `overviewColumnFilterSpec`/`detailColumnFilterSpec` ở
 * `features/hddt/components/InvoiceListTabs.tsx`); icon ở đây CHỈ còn sắp xếp.
 * Component dùng chung nhiều bảng (module `hddt` + `dich_vu_cong`) nên đặt ở `src/components`
 * thay vì trong 1 feature cụ thể.
 */
export default function ColumnFilterButton({ label, sortDir = null, onSort, sortKind = "text" }: Props) {
  const sortLabels = SORT_LABELS[sortKind];
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);
  const chooseSort = (dir: "asc" | "desc") => {
    onSort(sortDir === dir ? null : dir); // bấm lại đúng chiều đang chọn -> bỏ sắp xếp
    close();
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={open}
        aria-label={`Sắp xếp ${label}`}
        sx={{ ml: 0.25, p: 0.25, color: sortDir ? "primary.main" : "action.active" }}
      >
        <FilterAltRounded sx={{ fontSize: 16 }} />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {/* MenuItem cần context của MenuList/Menu (MUI v9) — Popover không tự cấp, phải bọc riêng. */}
        <MenuList dense disablePadding sx={{ width: 260 }}>
          <MenuItem onClick={() => chooseSort("asc")} selected={sortDir === "asc"}>
            <ArrowUpwardRounded fontSize="small" sx={{ mr: 1 }} />
            {sortLabels.asc}
            {sortDir === "asc" && <CheckRounded fontSize="small" sx={{ ml: "auto" }} />}
          </MenuItem>
          <MenuItem onClick={() => chooseSort("desc")} selected={sortDir === "desc"}>
            <ArrowDownwardRounded fontSize="small" sx={{ mr: 1 }} />
            {sortLabels.desc}
            {sortDir === "desc" && <CheckRounded fontSize="small" sx={{ ml: "auto" }} />}
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}
