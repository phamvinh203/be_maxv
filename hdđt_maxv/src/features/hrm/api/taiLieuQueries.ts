/**
 * Hook hồ sơ / tài liệu chạy trên API THẬT — bản thay thế của `mock/hooks/taiLieu.ts`.
 * Giữ nguyên chữ ký hook bản mock, riêng `useTaiLieuList` trả thêm trạng thái tải (tab nằm
 * trong hồ sơ nhân viên, mảng rỗng lúc lỗi mạng đọc thành "chưa có giấy tờ nào").
 *
 * Hai chỗ quy đổi: ngày cấp ISO <-> `YYYY-MM-DD` của ô nhập, và các ô trống null <-> "".
 *
 * File scan nằm trên Google Drive CỦA CHÍNH CÔNG TY (xem `taiLieuDrive.service.ts` bên BE);
 * ở đây chỉ có luồng: chọn file -> chưa nối Drive thì mở popup đăng nhập -> tải lên.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmTaiLieuKeys } from "./hrmKeys";
import type { LoaiTaiLieu, TaiLieu, TaiLieuFormValues } from "../types";
import {
  createTaiLieu,
  deleteTaiLieu,
  listTaiLieu,
  ngatKetNoiDrive,
  taiFileLen,
  taiFileVe,
  trangThaiDrive,
  updateTaiLieu,
  urlLienKetDrive,
  xoaFileDinhKem,
  type TaiLieuApiBody,
  type TaiLieuApiRow,
} from "./taiLieuApi";

/** ISO của BE -> `YYYY-MM-DD` cho `<input type="date">`. */
function veNgayInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function veKieuFe(r: TaiLieuApiRow): TaiLieu {
  return {
    id: r.id,
    ma_nv: r.ma_nv,
    // BE để loại giấy tờ là chữ tự do (còn sổ BHXH, giấy khám sức khỏe… ngoài danh mục FE);
    // ép kiểu về union hiển thị, chỗ nào không khớp thì `nhan()` tự hiện nguyên chữ.
    loai: r.loai as LoaiTaiLieu,
    so_hieu: r.so_hieu ?? "",
    ngay_cap: veNgayInput(r.ngay_cap),
    noi_cap: r.noi_cap ?? "",
    ghi_chu: r.ghi_chu ?? "",
  };
}

/** Thông tin file scan kèm theo một dòng tài liệu (type FE gốc chưa có, thêm riêng ở đây). */
export interface FileScan {
  co_file: boolean;
  ten_file: string;
  mime_type: string;
  kich_thuoc: number;
}

export function fileScanCuaDong(r: TaiLieuApiRow): FileScan {
  return {
    co_file: Boolean(r.drive_file_id),
    ten_file: r.ten_file ?? "",
    mime_type: r.mime_type ?? "",
    kich_thuoc: r.kich_thuoc ?? 0,
  };
}

function veKieuApi(values: TaiLieuFormValues): TaiLieuApiBody {
  return {
    loai: values.loai,
    so_hieu: values.so_hieu.trim() || null,
    ngay_cap: values.ngay_cap.trim() || null,
    noi_cap: values.noi_cap.trim() || null,
    ghi_chu: values.ghi_chu.trim() || null,
  };
}

/**
 * Lấy toàn bộ tài liệu của công ty rồi lọc ở client — cùng lý do với người phụ thuộc: danh mục
 * nhỏ, và một query dùng chung thì sửa ở tab này là mọi nơi khác thấy ngay.
 */
function useDanhSachTaiLieu() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  // KHÔNG dùng `placeholderData: (prev) => prev` — xem ghi chú cùng loại ở các file api khác:
  // nó giữ dữ liệu cũ xuyên qua việc đổi công ty.
  return useQuery({
    queryKey: hrmTaiLieuKeys.list(currentCompanyId),
    queryFn: () => listTaiLieu(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Hồ sơ giấy tờ của một nhân viên, kèm trạng thái tải. */
export function useTaiLieuList(maNv: string | null): {
  items: (TaiLieu & FileScan)[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachTaiLieu();
  const items = useMemo(
    () =>
      maNv
        ? (data ?? [])
            .filter((r) => r.ma_nv === maNv)
            .map((r) => ({ ...veKieuFe(r), ...fileScanCuaDong(r) }))
        : [],
    [data, maNv],
  );
  return { items, isLoading, isError, error };
}

/**
 * `useCallback` để hàm giữ NGUYÊN tham chiếu giữa các lần render. Không bọc thì mọi
 * `useCallback` khai nó trong mảng phụ thuộc đều dựng lại mỗi lần render — memo hóa thành vô
 * nghĩa. Hiện chưa lộ vì không cái nào chạy trong `useEffect`, nhưng đó là cái bẫy cho lần sau.
 */
function useLamMoi() {
  const qc = useQueryClient();
  return useCallback(
    () => void qc.invalidateQueries({ queryKey: hrmTaiLieuKeys.all }),
    [qc],
  );
}

/**
 * Thêm mới hoặc sửa. Không truyền `id` là thêm.
 * Luật "nhân viên phải tồn tại" và định dạng ngày do BE chặn, thông điệp hiện thẳng lên toast.
 */
export function useLuuTaiLieu() {
  const lamMoi = useLamMoi();
  const them = useMutation({ mutationFn: createTaiLieu, onSuccess: lamMoi });
  const sua = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaiLieuApiBody }) =>
      updateTaiLieu(id, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maNv: string, values: TaiLieuFormValues, id?: string) => {
      if (!maNv) throw new Error("Chưa chọn nhân viên.");
      if (!values.loai) throw new Error("Chưa chọn loại tài liệu.");

      const body = veKieuApi(values);
      // Trả id về: form cần nó để tải file scan lên NGAY SAU khi tạo dòng tài liệu
      // (endpoint tải file khóa theo id, nên phải có dòng trước rồi mới đính file được).
      if (id) {
        await sua.mutateAsync({ id, body });
        return id;
      }
      const { id: idMoi } = await them.mutateAsync({ ...body, ma_nv: maNv });
      return idMoi;
    },
    [them, sua],
  );
}

export function useXoaTaiLieu() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deleteTaiLieu, onSuccess: lamMoi });

  return useCallback(
    async (id: string) => {
      await xoa.mutateAsync(id);
    },
    [xoa],
  );
}

// ── Google Drive ────────────────────────────────────────────────────────────

export const hrmDriveKeys = {
  trangThai: (companyId: string | null) =>
    ["hrm-drive", companyId, "trang-thai"] as const,
};

/** Trạng thái kết nối Drive của công ty đang chọn. */
export function useTrangThaiDrive() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hrmDriveKeys.trangThai(currentCompanyId),
    queryFn: () => trangThaiDrive(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Đợi tới khi cửa sổ popup đóng (người dùng xong hoặc tự tắt). */
function doiPopupDong(popup: Window): Promise<void> {
  return new Promise((resolve) => {
    const dong = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(dong);
        resolve();
      }
    }, 500);
  });
}

/**
 * Mở popup đăng nhập Google rồi đợi kết quả.
 *
 * DÙNG POPUP, không chuyển hướng cả trang: chuyển hướng làm trang unload và mất luôn file người
 * dùng vừa chọn (object `File` chỉ sống trong bộ nhớ trang) — quay lại phải chọn file lần nữa.
 *
 * Xác nhận bằng cách HỎI LẠI máy chủ sau khi popup đóng, không dựa vào `postMessage`: lúc chạy
 * dev, trang callback do API phục vụ (cổng 4000) còn app ở cổng 5173 nên message khác origin sẽ
 * không tới nơi. Hỏi lại trạng thái thì đúng ở cả dev lẫn production.
 */
export function useKetNoiDrive() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();

  return useCallback(async (): Promise<boolean> => {
    const { url } = await urlLienKetDrive();
    const popup = window.open(url, "maxv-drive", "width=520,height=680");
    if (!popup) {
      throw new Error(
        "Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép pop-up cho trang này rồi thử lại.",
      );
    }

    await doiPopupDong(popup);
    await qc.invalidateQueries({
      queryKey: hrmDriveKeys.trangThai(currentCompanyId),
    });
    const tt = await trangThaiDrive();
    return tt.da_ket_noi;
  }, [qc, currentCompanyId]);
}

export function useNgatKetNoiDrive() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await ngatKetNoiDrive();
    await qc.invalidateQueries({ queryKey: ["hrm-drive"] });
  }, [qc]);
}

/**
 * Tải file scan lên cho một dòng tài liệu. Chưa kết nối Drive thì tự mở popup đăng nhập trước —
 * đúng luồng "bấm thêm file -> đăng nhập Google -> ảnh được tải lên".
 */
export function useTaiFileLen() {
  const lamMoi = useLamMoi();
  const ketNoi = useKetNoiDrive();

  return useCallback(
    async (idTaiLieu: string, file: File) => {
      const tt = await trangThaiDrive();
      if (!tt.may_chu_san_sang) {
        throw new Error(
          "Máy chủ chưa cấu hình Google Drive — liên hệ quản trị hệ thống.",
        );
      }
      if (!tt.da_ket_noi) {
        const xong = await ketNoi();
        if (!xong) throw new Error("Chưa kết nối được Google Drive.");
      }

      const kq = await taiFileLen(idTaiLieu, file);
      lamMoi();
      return kq;
    },
    [ketNoi, lamMoi],
  );
}

export function useXoaFileDinhKem() {
  const lamMoi = useLamMoi();
  return useCallback(
    async (idTaiLieu: string) => {
      await xoaFileDinhKem(idTaiLieu);
      lamMoi();
    },
    [lamMoi],
  );
}

/**
 * Lấy file về dạng URL tạm để hiện ảnh/PDF trong app.
 * Người gọi PHẢI `URL.revokeObjectURL` khi đóng — không thì blob giữ trong bộ nhớ tới lúc F5.
 */
export function useXemFile() {
  return useCallback(async (idTaiLieu: string): Promise<string> => {
    const blob = await taiFileVe(idTaiLieu);
    return URL.createObjectURL(blob);
  }, []);
}
