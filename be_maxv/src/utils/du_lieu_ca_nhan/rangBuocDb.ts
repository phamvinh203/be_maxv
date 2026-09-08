import { ConflictError } from '../../helpers/errors';

/**
 * Ánh xạ lỗi RÀNG BUỘC LOẠI TRỪ của Postgres (`EXCLUDE USING gist`) sang lỗi nghiệp vụ.
 *
 * VÌ SAO KHÔNG DÙNG `error.code`: vi phạm `EXCLUDE` trả SQLSTATE **`23P01`
 * (`exclusion_violation`)**, và Prisma **không** map mã này thành `P2002`/`P2003` — nó về dưới
 * dạng lỗi generic với SQLSTATE nằm sâu trong `meta`. Bắt theo `err.code === 'P2002'` sẽ trượt,
 * lỗi rơi xuống nhánh 500 "Lỗi máy chủ nội bộ" và người dùng không biết mình vừa tạo hai hợp
 * đồng chồng lấn. Cách duy nhất chạy được là đối chiếu **TÊN RÀNG BUỘC** trong thông điệp lỗi.
 * Xem `docs/hrm/architecture/data-model.md` M-01 và `ADR-002`.
 *
 * Hai lớp phòng thủ, KHÔNG phải trùng lặp vô nghĩa: pre-check ở service lo 99% ca (người dùng
 * nhập sai) và nói rõ đang đụng hợp đồng nào; ràng buộc ở cơ sở dữ liệu là chốt cuối khi hai
 * yêu cầu vào cùng lúc — lúc đó chỉ còn thông điệp chung, nhưng dữ liệu vẫn đúng.
 */

/** Tên các ràng buộc tạo bằng SQL tay (không có trong `schema.prisma`) — xem `hrmTenantConstraints.ts`. */
export const RANG_BUOC = {
  HOP_DONG_CHONG_LAN: 'hrm_hop_dong_khong_chong_lan',
  HOP_DONG_SO_HD: 'hrm_hop_dong_so_hd_key',
  NPT_MST_TRUNG_KY: 'hrm_npt_mst_khong_trung_ky',
} as const;

/**
 * Gom `message` + `meta` thành một chuỗi để dò tên ràng buộc.
 * `meta` phải xét tới: với một số lỗi Prisma chỉ đính tên ràng buộc trong `meta`, không nhắc lại
 * trong `message`.
 */
function dauVetLoi(err: unknown): string {
  if (!(err instanceof Error)) return '';
  const meta = (err as { meta?: unknown }).meta;
  let phanMeta = '';
  try {
    phanMeta = meta === undefined ? '' : JSON.stringify(meta);
  } catch {
    phanMeta = '';
  }
  return `${err.message} ${phanMeta}`;
}

export function viPhamRangBuoc(err: unknown, ten: string): boolean {
  return dauVetLoi(err).includes(ten);
}

/**
 * Đổi lỗi ràng buộc DB sang `ConflictError` có câu tiếng Việt; lỗi khác trả nguyên trạng.
 * Dùng dạng `throw doiLoiRangBuocHrm(err)` để TypeScript vẫn thấy nhánh này kết thúc luồng.
 */
export function doiLoiRangBuocHrm(err: unknown): unknown {
  if (viPhamRangBuoc(err, RANG_BUOC.HOP_DONG_CHONG_LAN)) {
    return new ConflictError(
      'Khoảng thời gian hợp đồng bị chồng lấn với một hợp đồng cùng loại của nhân viên này. ' +
        'Vui lòng tải lại danh sách hợp đồng rồi nhập lại khoảng ngày.',
    );
  }
  if (viPhamRangBuoc(err, RANG_BUOC.HOP_DONG_SO_HD)) {
    return new ConflictError(
      'Số hợp đồng đã được dùng cho một hợp đồng khác trong công ty. Số hợp đồng phải là duy nhất trong công ty.',
    );
  }
  if (viPhamRangBuoc(err, RANG_BUOC.NPT_MST_TRUNG_KY)) {
    return new ConflictError(
      'Mã số thuế người phụ thuộc này đã được đăng ký với kỳ giảm trừ giao nhau. ' +
        'Mỗi người phụ thuộc chỉ được tính giảm trừ gia cảnh cho một người nộp thuế tại một thời điểm.',
    );
  }
  return err;
}

/** Bọc một lượt ghi: mọi lỗi ràng buộc SQL tay được đổi sang lỗi nghiệp vụ trước khi bay lên. */
export async function ghiCoRangBuoc<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw doiLoiRangBuocHrm(err);
  }
}
