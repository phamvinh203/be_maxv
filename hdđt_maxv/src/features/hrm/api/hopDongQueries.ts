/**
 * Hook lịch sử hợp đồng chạy trên API THẬT — bản thay thế của `mock/hooks/hopDong.ts`.
 * Giữ nguyên chữ ký hook bản mock; riêng `useHopDongList` trả thêm trạng thái tải.
 *
 * Ba chỗ quy đổi so với BE:
 *   - `luong_chinh` / `luong_bhxh` BE trả CHUỖI (cột Decimal) -> `Number()`
 *   - `kieu_luong` BE dùng `gross|net`, FE dùng `GROSS|NET`
 *   - ngày ISO <-> `YYYY-MM-DD`; `ngay_ket_thuc` null <-> "" (FE coi rỗng là vô thời hạn)
 *
 * `loai_hd` KHÔNG phải quy đổi: bảng hợp đồng bên BE giữ đủ 5 giá trị của FE (chỉ bản sao trên
 * nhân viên mới gom về 3), nên đọc ra hiển thị đúng thứ người dùng đã chọn.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmHopDongKeys, hrmNhanVienKeys } from "./hrmKeys";
import type { HopDong, HopDongFormValues, LoaiHopDong } from "../types";
import {
  createHopDong,
  deleteHopDong,
  doiHopDong,
  listHopDong,
  updateHopDong,
  type HopDongApiBody,
  type HopDongApiRow,
} from "./hopDongApi";

function veNgayInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function veKieuFe(r: HopDongApiRow): HopDong {
  return {
    id: r.id,
    ma_nv: r.ma_nv,
    so_hd: r.so_hd,
    loai_hd: r.loai_hd as LoaiHopDong,
    kieu_luong: r.kieu_luong === "net" ? "NET" : "GROSS",
    // Bắt buộc Number(): BE trả chuỗi, để nguyên là mọi phép cộng lương thành nối chuỗi.
    luong_chinh: Number(r.luong_chinh),
    luong_bhxh: Number(r.luong_bhxh),
    ngay_bat_dau: veNgayInput(r.ngay_bat_dau),
    ngay_ket_thuc: veNgayInput(r.ngay_ket_thuc),
    trich_bhxh: r.trich_bhxh,
    tinh_tncn: r.tinh_tncn,
    ghi_chu: r.ghi_chu ?? "",
  };
}

function veKieuApi(values: HopDongFormValues): HopDongApiBody {
  return {
    so_hd: values.so_hd.trim(),
    loai_hd: values.loai_hd,
    kieu_luong: values.kieu_luong === "NET" ? "net" : "gross",
    luong_chinh: values.luong_chinh,
    luong_bhxh: values.luong_bhxh,
    ngay_bat_dau: values.ngay_bat_dau,
    // FE dùng chuỗi rỗng cho "không xác định thời hạn"; BE dùng null.
    ngay_ket_thuc: values.ngay_ket_thuc.trim() || null,
    trich_bhxh: values.trich_bhxh,
    tinh_tncn: values.tinh_tncn,
    ghi_chu: values.ghi_chu.trim() || null,
  };
}

function useDanhSachHopDong() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  // KHÔNG dùng `placeholderData` — xem ghi chú cùng loại ở các file api khác.
  return useQuery({
    queryKey: hrmHopDongKeys.list(currentCompanyId),
    queryFn: () => listHopDong(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Lịch sử hợp đồng của một nhân viên, mới nhất lên đầu (BE đã sắp sẵn). */
export function useHopDongList(maNv: string | null): {
  items: HopDong[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachHopDong();
  const items = useMemo(
    () =>
      maNv ? (data ?? []).filter((r) => r.ma_nv === maNv).map(veKieuFe) : [],
    [data, maNv],
  );
  return { items, isLoading, isError, error };
}

/**
 * Làm mới sau khi ghi. Phải đụng cả NHÂN VIÊN: BE tự đồng bộ bản sao "hợp đồng hiện hành"
 * (số HĐ, loại HĐ, kiểu lương, hạn, BHXH/TNCN) xuống bảng nhân viên sau mỗi lần ghi hợp đồng
 * — không nạp lại thì bảng nhân viên còn hiện hợp đồng cũ.
 */
function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmHopDongKeys.all });
    void qc.invalidateQueries({ queryKey: hrmNhanVienKeys.all });
  };
}

/** Thêm mới hoặc sửa. Không truyền `id` là thêm. */
export function useLuuHopDong() {
  const lamMoi = useLamMoi();
  const them = useMutation({ mutationFn: createHopDong, onSuccess: lamMoi });
  const sua = useMutation({
    mutationFn: ({ id, body }: { id: string; body: HopDongApiBody }) =>
      updateHopDong(id, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maNv: string, values: HopDongFormValues, id?: string) => {
      if (!maNv) throw new Error("Chưa chọn nhân viên.");
      // Các luật còn lại (ngày kết thúc sau ngày bắt đầu, lương không âm…) do BE chặn và trả
      // thông điệp tiếng Việt — không kiểm lại ở đây để khỏi giữ hai bộ luật song song.
      const body = veKieuApi(values);
      if (id) await sua.mutateAsync({ id, body });
      else await them.mutateAsync({ ...body, ma_nv: maNv });
    },
    [them, sua],
  );
}

/**
 * Chốt hợp đồng hiện hành rồi ký hợp đồng mới — một request, BE làm trong một transaction.
 *
 * `idCu` giữ trong chữ ký cho khớp bản mock nhưng KHÔNG gửi lên: BE tự tìm hợp đồng đang hiệu
 * lực để chốt, tin nó hơn là tin id do màn hình tính (màn có thể đang xem dữ liệu cũ).
 */
export function useDoiHopDong() {
  const lamMoi = useLamMoi();
  const doi = useMutation({ mutationFn: doiHopDong, onSuccess: lamMoi });

  return useCallback(
    async (
      maNv: string,
      _idCu: string | null,
      ngayChot: string,
      values: HopDongFormValues,
    ) => {
      if (!maNv) throw new Error("Chưa chọn nhân viên.");
      await doi.mutateAsync({
        ...veKieuApi(values),
        ma_nv: maNv,
        ngay_chot: ngayChot.trim() || null,
      });
    },
    [doi],
  );
}

export function useXoaHopDong() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deleteHopDong, onSuccess: lamMoi });

  return useCallback(
    async (id: string) => {
      await xoa.mutateAsync(id);
    },
    [xoa],
  );
}
