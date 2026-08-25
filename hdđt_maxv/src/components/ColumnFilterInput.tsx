import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { LIVE_APPLY_MS } from "./ColumnFilterButton";

interface Props {
  /** Giá trị ĐÃ ÁP DỤNG hiện tại — đồng bộ lại ô gõ khi giá trị đổi từ nơi KHÁC (vd nút "Bỏ tìm
   * kiếm", hoặc field dùng chung với panel "Bộ lọc" bị đổi từ phía panel). */
  value: string;
  onApply: (v: string) => void;
  placeholder?: string;
  /** Ghi chú nhỏ (tooltip khi hover) — vd cảnh báo giới hạn dữ liệu của lọc phía client. */
  hint?: string;
}

/**
 * Ô lọc luôn hiển thị dưới mỗi tiêu đề cột (thay cho popover cũ) — gõ tới đâu, sau `LIVE_APPLY_MS`
 * không gõ tiếp thì tự áp (không cần bấm nút). Enter/mất focus CHỐT NGAY, bỏ qua độ trễ, để giá trị
 * vừa gõ không bị rớt nếu người dùng chuyển ô/đổi trang ngay sau đó.
 * Dùng: bảng Tổng quát/Chi tiết (`features/hddt`), bảng Dịch vụ công (`features/dich_vu_cong`) —
 * component dùng chung nhiều module nên đặt ở `src/components`. Cách gõ cú pháp khoảng số
 * ("100-500", ">=100"...) hay khớp NHÃN thay vì mã thô là do NƠI GỌI tự diễn giải `onApply`, ô này
 * chỉ là input text thuần — xem `parseRangeInput` ở `src/utils/columnFilterText.ts`.
 */
export default function ColumnFilterInput({ value, onApply, placeholder, hint }: Props) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đồng bộ khi giá trị áp dụng đổi từ nơi khác — mẫu "lưu giá trị trước" của React (điều chỉnh
  // NGAY trong render bằng `useState`, KHÔNG dùng `useRef` — refs không được đọc/ghi lúc render,
  // xem react.dev) nên không kích render dây chuyền. No-op trong trường hợp thường (chính ô này vừa
  // commit xong thì `value` khớp sẵn `draft` rồi).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    // Dọn hẹn giờ khi unmount (đổi trang/đóng bảng giữa lúc đang gõ) — tránh gọi setState mồ côi.
    // CHỈ dọn dẹp (không setState trong THÂN effect) nên không phạm quy tắc react-hooks/set-state-
    // in-effect (khác nhánh đồng bộ `value` ở trên, đã chuyển sang điều chỉnh ngay trong render).
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cancelPending = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const flush = (v: string) => {
    cancelPending();
    if (v !== value) onApply(v);
  };

  const handleChange = (v: string) => {
    setDraft(v);
    cancelPending();
    timerRef.current = setTimeout(() => flush(v), LIVE_APPLY_MS);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") flush(draft);
  };

  return (
    <Tooltip title={hint ?? ""} disableInteractive>
      <TextField
        size="small"
        variant="standard"
        fullWidth
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => flush(draft)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ fontSize: 14 }} color="action" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ minWidth: 90 }}
      />
    </Tooltip>
  );
}
