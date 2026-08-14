import type { TaiKhoan } from '@/features/accounting/tong_hop/danh_muc/tai_khoan/types';

/** TK bậc 1 (cấp cao nhất) — bôi đậm + nền nổi bật, dùng chung cho các bảng TK. */
export const isTopLevelAccount = (r: TaiKhoan): boolean => r.bac_tk === 1;

/** sx áp cho dòng TK bậc 1. */
export const topLevelRowSx = {
  bgcolor: 'action.selected',
  '& > .MuiTableCell-root': { fontWeight: 700 },
};
