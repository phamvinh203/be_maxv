import ChotKyLuongPanel from "../../../features/hrm/components/chot_ky_luong/ChotKyLuongPanel";

/**
 * Màn "Chốt kỳ lương" — mở từ nút xanh "Chốt kỳ lương T{tháng}/{năm}" ở góc phải thanh HRM.
 * Kỳ lương lấy từ `PayrollPeriodProvider` bọc ở `HrmPage`, nên không tự bọc provider riêng.
 */
export default function ChotKyLuongPage() {
  return <ChotKyLuongPanel />;
}
