/**
 * Hook hồ sơ / tài liệu chạy trên API THẬT — bản thay thế của `mock/hooks/taiLieu.ts`.
 * Giữ nguyên chữ ký hook bản mock, riêng `useTaiLieuList` trả thêm trạng thái tải (tab nằm
 * trong hồ sơ nhân viên, mảng rỗng lúc lỗi mạng đọc thành "chưa có giấy tờ nào").
 *
 * Hai chỗ quy đổi: ngày cấp ISO <-> `YYYY-MM-DD` của ô nhập, và các ô trống null <-> "".
 *
 * File scan nằm trên Google Drive CỦA CHÍNH CÔNG TY (xem `taiLieuDrive.service.ts` bên BE);
 * ở đây chỉ có luồng: chọn file -> chưa nối Drive thì mở popup đăng nhập -> tải lên.
 *
 * `[QĐ #21]` MỘT dòng giấy tờ giữ NHIỀU file (BR-hrm-037). Mọi đường xem/gỡ đều cần cặp
 * `(idTaiLieu, fileId)`; tải lên là THÊM VÀO chứ không thay thế.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmTaiLieuKeys } from "../hrmKeys";
import type { LoaiTaiLieu, TaiLieu, TaiLieuFormValues } from "../../types";
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
  type FileScanApi,
  type KetQuaXoaTaiLieu,
  type TaiLieuApiBody,
  type TaiLieuApiRow,
} from "./taiLieuApi";

/**
 * Bốn hằng + wording E-hrm-065 nằm ở `taiLieuApi.ts` (nơi chép từ BE). Bày lại ở đây để các
 * component giữ đúng một cửa import (`../../api/taiLieuQueries`) như mọi hook khác của khu HRM.
 */
export {
  GIOI_HAN_FILE_BYTE,
  GIOI_HAN_FILE_MB,
  LOI_QUA_NHIEU_FILE,
  MIME_CHO_PHEP,
  SO_FILE_TOI_DA,
} from "./taiLieuApi";
export type { FileScanApi, KetQuaGoFile, KetQuaXoaTaiLieu } from "./taiLieuApi";

/** ISO của BE -> `YYYY-MM-DD` cho `<input type="date">`. */
function veNgayInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * Một dòng giấy tờ như giao diện dùng: thông tin giấy tờ + DANH SÁCH file scan của nó.
 *
 * `files` rỗng là trạng thái hợp lệ, KHÔNG phải lỗi: giấy tờ đã khai nhưng chưa scan. Đừng
 * hiển thị thành danh sách rỗng trơ — nói rõ "chưa đính file".
 */
export type DongTaiLieu = TaiLieu & { files: FileScanApi[] };

function veKieuFe(r: TaiLieuApiRow): DongTaiLieu {
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
    // `?? []` phòng dòng cũ còn nằm trong cache trước khi BE đổi hợp đồng — thiếu nó là
    // `files.map` ném ngay giữa lúc render bảng.
    files: r.files ?? [],
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
 * Tài liệu của MỘT nhân viên — lọc bằng `ma_nv` phía máy chủ (RVW-513), không tải toàn bộ tài
 * liệu công ty rồi lọc ở client như trước. Mỗi nhân viên một khóa cache riêng, giống
 * `hrmHopDongKeys`.
 */
function useDanhSachTaiLieu(maNv: string | null) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  // KHÔNG dùng `placeholderData: (prev) => prev` — xem ghi chú cùng loại ở các file api khác:
  // nó giữ dữ liệu cũ xuyên qua việc đổi công ty.
  return useQuery({
    queryKey: hrmTaiLieuKeys.list(currentCompanyId, maNv),
    queryFn: () => listTaiLieu({ ma_nv: maNv ?? undefined }),
    enabled: isAuthenticated && !!currentCompanyId && !!maNv,
  });
}

/** Hồ sơ giấy tờ của một nhân viên, kèm trạng thái tải. */
export function useTaiLieuList(maNv: string | null): {
  items: DongTaiLieu[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachTaiLieu(maNv);
  const items = useMemo(() => (data ?? []).map(veKieuFe), [data]);
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

/**
 * Xóa cả dòng giấy tờ. Trả nguyên phản hồi BE vì `da_xoa_file_drive = false` là ca có thật:
 * dòng đã xóa nhưng file trên Drive chưa dọn được (BR-hrm-039) — giao diện phải nói đúng.
 */
export function useXoaTaiLieu() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deleteTaiLieu, onSuccess: lamMoi });

  return useCallback(
    async (id: string): Promise<KetQuaXoaTaiLieu> => xoa.mutateAsync(id),
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
 * Bảo đảm công ty đã nối Drive trước khi tải file — chưa nối thì tự mở popup đăng nhập.
 *
 * Gọi ĐÚNG MỘT LẦN cho cả lượt tải nhiều file, không phải mỗi file một lần: người dùng đóng
 * popup giữa chừng là hỏng, mà hỏi lại trạng thái trước từng file thì vừa tốn một lượt API vừa
 * có nguy cơ mở lại popup ở giữa dãy.
 */
function useDamBaoDrive() {
  const ketNoi = useKetNoiDrive();
  return useCallback(async () => {
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
  }, [ketNoi]);
}

/**
 * Kết quả một lượt tải nhiều file lên CÙNG một dòng giấy tờ.
 *
 * `daXong` cùng chỉ số với mảng `files` truyền vào — người gọi giữ lại để lần bấm sau LÀM TIẾP
 * từ chỗ hỏng, không tải lại file đã xong.
 */
export interface KetQuaTaiNhieuFile {
  daXong: boolean[];
  /**
   * Dừng ngay tại lỗi đầu tiên; các file sau chưa chạy. `file` vắng nghĩa là hỏng ở bước kết
   * nối Drive (chưa file nào được gửi đi), không phải hỏng vì một file cụ thể.
   */
  loi?: { file?: File; err: unknown };
}

/**
 * Tải NHIỀU file scan lên **CÙNG MỘT** dòng giấy tờ, TUẦN TỰ.
 *
 * `[QĐ #21]` Đây là chỗ hiện thực "một giấy tờ, nhiều file": căn cước hai mặt là hai lần gọi
 * `POST /tai-lieu/:id/file` vào cùng một `:id`. TUYỆT ĐỐI không quay lại kiểu cũ (mỗi file một
 * dòng giấy tờ) — danh sách sẽ hiện hai dòng cùng tên "CCCD", sai bản chất nghiệp vụ.
 *
 * Ba tính chất bắt buộc giữ:
 *  1. **Tuần tự**, không `Promise.all`: lần đầu đính file sẽ mở cửa sổ đăng nhập Google, bắn
 *     song song là mở nhiều cửa sổ cùng lúc; và hỏng thì phải biết ĐÚNG file nào hỏng.
 *  2. **Làm tiếp từ chỗ hỏng**: `daXongTruoc` đánh dấu file lượt trước đã lên, lượt này bỏ qua.
 *  3. **Luôn làm mới danh sách** kể cả khi hỏng giữa chừng — các file trước đó đã lên thật.
 */
export function useTaiNhieuFileLen() {
  const lamMoi = useLamMoi();
  const damBaoDrive = useDamBaoDrive();

  return useCallback(
    async (
      idTaiLieu: string,
      files: readonly File[],
      daXongTruoc: readonly boolean[] = [],
      onTien?: (daXong: boolean[]) => void,
    ): Promise<KetQuaTaiNhieuFile> => {
      const daXong = files.map((_, i) => Boolean(daXongTruoc[i]));
      try {
        if (daXong.some((x) => !x)) await damBaoDrive();
      } catch (err) {
        return { daXong, loi: { err } };
      }

      try {
        for (let i = 0; i < files.length; i++) {
          if (daXong[i]) continue;
          try {
            await taiFileLen(idTaiLieu, files[i]);
          } catch (err) {
            return { daXong, loi: { file: files[i], err } };
          }
          daXong[i] = true;
          onTien?.([...daXong]);
        }
        return { daXong };
      } finally {
        lamMoi();
      }
    },
    [damBaoDrive, lamMoi],
  );
}

/**
 * Gỡ ĐÚNG MỘT file khỏi dòng giấy tờ (BR-hrm-038). Dòng giấy tờ và các file còn lại giữ nguyên.
 * Cần cả hai id: `fileId` được BE kiểm là thuộc đúng `idTaiLieu` (E-hrm-066).
 */
export function useXoaFileDinhKem() {
  const lamMoi = useLamMoi();
  return useCallback(
    async (idTaiLieu: string, fileId: string) => {
      const kq = await xoaFileDinhKem(idTaiLieu, fileId);
      lamMoi();
      return kq;
    },
    [lamMoi],
  );
}

/**
 * Lấy MỘT file về dạng URL tạm để hiện ảnh/PDF trong app.
 * Người gọi PHẢI `URL.revokeObjectURL` khi đóng — không thì blob giữ trong bộ nhớ tới lúc F5.
 */
export function useXemFile() {
  return useCallback(
    async (idTaiLieu: string, fileId: string): Promise<string> => {
      const blob = await taiFileVe(idTaiLieu, fileId);
      return URL.createObjectURL(blob);
    },
    [],
  );
}
