/**
 * QUYỀN XEM DỮ LIỆU LƯƠNG của phiên hiện tại, ở công ty đang chọn (QĐ #8, BR-hrm-059).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * KHOẢNG TRỐNG CỦA HỢP ĐỒNG API — đọc trước khi sửa file này
 *
 * `api-contract.md` **chưa có endpoint nào** cho giao diện hỏi "phiên này có quyền xem lương
 * không". ADR-007 nêu nhu cầu, contract chưa đặc tả, `GET /auth/me` không trả cờ nào. Mà không
 * biết trước thì màn hình chỉ còn cách mở tab hợp đồng rồi ăn 403 — đúng thứ QĐ #8 cấm.
 *
 * Nên ở đây SUY RA quyền từ hai nguồn đã có sẵn, KHÔNG thêm endpoint:
 *
 *   1. Vai trò `OWNER` -> luôn có quyền. Đây là luật của chính máy chủ, không phải phỏng đoán:
 *      `resolveTenantInfo` tính `xemLuong = role === 'OWNER' || DonViAccess.xemLuong`.
 *   2. Sự CÓ MẶT của ba khóa ngân hàng trong `GET /hrm/nhan-vien`. Máy chủ **xóa hẳn khóa**
 *      (`cheTruongLuong`) cho người không có quyền, nên "có khóa" ⇔ "có quyền", bất kể giá trị.
 *
 * Hạn chế đã biết, ghi rõ để người sau không tưởng đây là nguồn chắc chắn:
 *   - Danh sách nhân viên RỖNG thì không suy được gì -> `"chua_ro"`. Thực tế vô hại: không có
 *     nhân viên nào thì cũng không mở được hồ sơ để vào tab hợp đồng.
 *   - Quyền bị thu hồi giữa hai lần nạp danh sách thì cờ này còn cũ tới lúc `hrm-nhan-vien`
 *     được invalidate. Lớp chặn thật vẫn là 403 của máy chủ; màn hình phải hiện được thông điệp
 *     đó chứ không được coi cờ này là hàng rào.
 *   - Suy luận này gắn chặt vào một chi tiết hiện thực của BE (che bằng cách xóa khóa). BE đổi
 *     sang trả `null` là cờ sai ngay — nên contract 3.1c nói rõ "bỏ hẳn trường, không trả null".
 *
 * Việc cần backend làm để bỏ hẳn suy luận: trả cờ `xemLuong` trong `GET /auth/me` (hoặc một
 * endpoint quyền riêng của tenant đang chọn). Ghi ở `dev-notes.md` mục Frontend.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmNhanVienKeys } from "../hrmKeys";
import { coTruongNganHang, listNhanVien } from "./nhanVienApi";

/** `"chua_ro"` = chưa đủ dữ liệu để kết luận (danh sách nhân viên rỗng hoặc đang tải). */
export type TrangThaiQuyenLuong = "co" | "khong" | "chua_ro";

/** Câu giải thích dùng chung cho mọi chỗ ẩn/khóa chức năng lương — khớp E-hrm-058 của BE. */
export const LOI_KHONG_CO_QUYEN_LUONG =
  "Bạn không có quyền xem dữ liệu lương và hợp đồng của công ty này. Liên hệ chủ tài khoản để được cấp quyền.";

export interface QuyenXemLuong {
  trangThai: TrangThaiQuyenLuong;
  /** Được phép gọi nhóm `/hrm/hop-dong` không. `"chua_ro"` tính là ĐƯỢC — để máy chủ chốt. */
  coQuyen: boolean;
  /** Chắc chắn KHÔNG có quyền — chỉ khi đó mới ẩn/khóa giao diện. */
  biTuChoi: boolean;
  /**
   * Danh sách nhân viên đã tải xong (hoặc là OWNER) — tức `trangThai` là kết luận cuối, không phải
   * "chưa rõ vì đang tải". Nơi muốn đợi biết quyền rồi mới gọi nhóm `/payroll-*` (tránh một 403 vô
   * ích) dùng cờ này; `"chua_ro"` + `daXacDinh` = công ty chưa có nhân viên, để máy chủ chốt.
   */
  daXacDinh: boolean;
}

export function useQuyenXemLuong(): QuyenXemLuong {
  const { user, isAuthenticated, currentCompanyId } = useAuth();

  /*
   * CÙNG khóa và CÙNG hàm tải với `useDanhSachNhanVien` ở `nhanVienQueries.ts` — TanStack gộp
   * hai chỗ dùng về một mục cache, nên KHÔNG phát sinh thêm lượt gọi mạng nào.
   *
   * Khai lại ở đây thay vì import hook kia: `nhanVienQueries` cần chính `useQuyenXemLuong` (để
   * bỏ ba trường ngân hàng khỏi thân request), import hai chiều là vòng import. Đổi `enabled`
   * hay `queryFn` ở một bên thì phải đổi cả bên kia.
   */
  const { data, isPending } = useQuery({
    queryKey: hrmNhanVienKeys.list(currentCompanyId),
    queryFn: () => listNhanVien(),
    enabled: isAuthenticated && !!currentCompanyId,
  });

  return useMemo(() => {
    // OWNER: luật của máy chủ, không cần suy từ payload.
    if (user?.role === "OWNER") {
      return { trangThai: "co", coQuyen: true, biTuChoi: false, daXacDinh: true };
    }

    const mau = data?.[0];
    if (!mau) {
      // Chưa tải xong hoặc công ty chưa có nhân viên nào — không kết luận, và mở để máy chủ
      // là bên nói lời cuối. Chặn ở đây sẽ khóa nhầm người có quyền chỉ vì mạng chậm.
      return { trangThai: "chua_ro", coQuyen: true, biTuChoi: false, daXacDinh: !isPending };
    }

    const co = coTruongNganHang(mau);
    return {
      trangThai: co ? "co" : "khong",
      coQuyen: co,
      biTuChoi: !co,
      daXacDinh: true,
    };
  }, [user?.role, data, isPending]);
}
