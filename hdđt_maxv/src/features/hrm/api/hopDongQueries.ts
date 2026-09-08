/**
 * Hook lịch sử hợp đồng chạy trên API THẬT — bản thay thế của `mock/hooks/hopDong.ts`.
 *
 * Ba chỗ quy đổi so với BE:
 *   - `luong_chinh` / `luong_bhxh` BE trả CHUỖI (cột Decimal) -> `Number()`
 *   - `kieu_luong` BE dùng `gross|net`, FE dùng `GROSS|NET`
 *   - ngày ISO <-> `YYYY-MM-DD`; `ngay_ket_thuc` null <-> "" (FE coi rỗng là vô thời hạn)
 *
 * `loai_hd` KHÔNG phải quy đổi: bảng hợp đồng bên BE giữ đủ 5 giá trị của FE (chỉ bản sao trên
 * nhân viên mới gom về 3), nên đọc ra hiển thị đúng thứ người dùng đã chọn.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HAI RÀNG BUỘC MỚI CỦA NHÓM `/hrm/hop-dong` (QĐ #8) — đọc trước khi sửa file này
 *
 *  1. `GET /hrm/hop-dong` **bắt buộc `ma_nv`**. Bản trước gọi `listHopDong()` trần rồi `filter`
 *     phía trình duyệt: lương của TOÀN BỘ nhân viên tải về máy bất kỳ ai mở màn hồ sơ
 *     (BUG-HRM-25). Máy chủ nay trả 400 cho lời gọi trần ⇒ mỗi nhân viên một truy vấn riêng.
 *  2. **Cả nhóm** trả 403 (E-hrm-058) nếu phiên không được cấp quyền xem dữ liệu lương. Giao
 *     diện không được mở tab rồi mới báo lỗi — xem `useQuyenXemLuong` và `enabled` bên dưới.
 * ────────────────────────────────────────────────────────────────────────────
 */

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmHopDongKeys, hrmNhanVienKeys } from "./hrmKeys";
import { useQuyenXemLuong } from "./quyenLuongQueries";
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

/**
 * Hai câu lỗi lương — CHÉP NGUYÊN VĂN từ `be_maxv/src/validators/hrm/hopDong.validator.ts`
 * (`soatLuong`), tức E-hrm-056 và E-hrm-057 của QĐ #5.
 *
 * Vì sao FE phải giữ bản sao: hai lỗi này BE trả dạng **400 Zod**, mà envelope 400 chỉ có
 * `errors.fieldErrors`, KHÔNG có `message` (contract Mục 1.2). `apiFetch` dựng `ApiError` từ
 * `body.message` nên người dùng chỉ nhận được câu vô nghĩa "Yêu cầu thất bại (400)". Chặn ở
 * đây để câu chữ đúng và gắn được vào đúng ô nhập.
 *
 * Đây là ngoại lệ có chủ ý với nguyên tắc "không giữ hai bộ luật song song": mọi luật khác
 * (chồng lấn, trùng số HĐ, ngày) BE trả 409 kèm `message` nên vẫn để BE nói.
 */
export const LOI_LUONG_CHINH = "Lương chính phải lớn hơn 0.";
export const LOI_LUONG_BHXH =
  "Đã bật trích BHXH nên lương đóng BHXH phải lớn hơn 0. Nếu không đóng BHXH, hãy tắt ô Trích BHXH.";

export interface LoiLuongHopDong {
  luong_chinh?: string;
  luong_bhxh?: string;
}

/** Soát hai ràng buộc lương của QĐ #5. Rỗng = hợp lệ. */
export function soatLuongHopDong(v: {
  luong_chinh: number;
  luong_bhxh: number;
  trich_bhxh: boolean;
}): LoiLuongHopDong {
  const loi: LoiLuongHopDong = {};
  if (!(v.luong_chinh > 0)) loi.luong_chinh = LOI_LUONG_CHINH;
  if (v.trich_bhxh && !(v.luong_bhxh > 0)) loi.luong_bhxh = LOI_LUONG_BHXH;
  return loi;
}

/** Ném đúng câu lỗi đầu tiên để toast/`catch` ở lối gọi không có ô nhập vẫn nói đúng chuyện. */
function nemNeuLuongSai(values: HopDongFormValues): void {
  const loi = soatLuongHopDong(values);
  const cau = loi.luong_chinh ?? loi.luong_bhxh;
  if (cau) throw new Error(cau);
}

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

export interface KetQuaHopDongList {
  items: HopDong[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** `false` = phiên chắc chắn không được xem lương; màn hình phải ẩn/khóa kèm giải thích. */
  coQuyenXemLuong: boolean;
}

/**
 * Lịch sử hợp đồng của MỘT nhân viên, mới nhất lên đầu (BE đã sắp sẵn).
 *
 * Truy vấn theo từng `ma_nv` — KHÔNG còn tải danh sách chung rồi lọc phía trình duyệt.
 * Truy vấn TẮT khi chắc chắn không có quyền: gọi để nhận 403 rồi mới ẩn là vừa thừa một lượt
 * mạng vừa đúng thứ QĐ #8 cấm (hiện tab trước, báo lỗi sau).
 */
export function useHopDongList(maNv: string | null): KetQuaHopDongList {
  const { isAuthenticated, currentCompanyId } = useAuth();
  const { coQuyen, biTuChoi } = useQuyenXemLuong();

  const goiDuoc = isAuthenticated && !!currentCompanyId && !!maNv && !biTuChoi;

  // KHÔNG dùng `placeholderData` — xem ghi chú cùng loại ở các file api khác.
  // `skipToken` thay cho `enabled` + `ma_nv!`: không cần khẳng định non-null ở chỗ mà kiểu dữ
  // liệu không tự chứng minh được, và TanStack vẫn hiểu là truy vấn đang tắt.
  const { data, isLoading, isError, error } = useQuery({
    queryKey: hrmHopDongKeys.list(currentCompanyId, maNv),
    queryFn:
      goiDuoc && maNv ? () => listHopDong({ ma_nv: maNv }) : skipToken,
  });

  /*
   * `useMemo` ở đây là BẮT BUỘC, không phải tối ưu.
   *
   * `hopDongHienHanh(items, ...)` ở `NhanVienDialog` / `NhanVienChiTietDialog` trả về một phần
   * tử của mảng này, và phần tử đó nằm trong mảng phụ thuộc của `useEffect` nạp form bên
   * `ThayDoiHopDongDialog`. Dựng mảng mới mỗi lần render là effect đó chạy mỗi lần render, nó
   * `setValues` một object mới nên React không bail-out được -> vòng lặp render vô tận.
   */
  const items = useMemo(() => (data ?? []).map(veKieuFe), [data]);

  return {
    items,
    // Truy vấn đang tắt (chưa chọn nhân viên, hoặc không có quyền) thì `isLoading` của TanStack
    // vẫn là `true` — nó nghĩa là "chưa từng chạy", không phải "đang chạy". Trả thẳng ra là màn
    // hình quay vòng vĩnh viễn thay vì nói lý do.
    isLoading: goiDuoc ? isLoading : false,
    isError,
    error,
    coQuyenXemLuong: coQuyen,
  };
}

/**
 * Làm mới sau khi ghi. Phải đụng cả NHÂN VIÊN: sáu trường "hợp đồng hiện hành" trên hồ sơ nhân
 * viên được BE **tính lúc đọc** từ `hrm_hop_dong`, nên ghi hợp đồng xong mà không nạp lại thì
 * bảng nhân viên còn hiện hợp đồng cũ.
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
      // Chỉ soát hai ràng buộc lương (BE trả 400 Zod không kèm `message`, xem đầu file). Các
      // luật còn lại — chồng lấn, trùng số HĐ, ngày — BE trả 409 kèm câu tiếng Việt nên để BE
      // nói, không giữ hai bộ luật song song.
      nemNeuLuongSai(values);
      const body = veKieuApi(values);
      if (id) await sua.mutateAsync({ id, body });
      else await them.mutateAsync({ ...body, ma_nv: maNv });
    },
    [them, sua],
  );
}

/**
 * Chốt hợp đồng đang hiệu lực rồi ký hợp đồng mới — một request, BE làm trong một transaction.
 *
 * `loaiHdCanChot` là **bắt buộc** (QĐ #1): BE gom nhãn đó về nhóm nghiệp vụ rồi chỉ tìm hợp
 * đồng đang hiệu lực TRONG nhóm ấy để chốt. Thiếu là 400. Không truyền id hợp đồng cũ: BE tự
 * tìm, tin nó hơn tin id do màn hình tính (màn có thể đang xem dữ liệu cũ).
 */
export function useDoiHopDong() {
  const lamMoi = useLamMoi();
  const doi = useMutation({ mutationFn: doiHopDong, onSuccess: lamMoi });

  return useCallback(
    async (
      maNv: string,
      ngayChot: string,
      loaiHdCanChot: LoaiHopDong,
      values: HopDongFormValues,
    ) => {
      if (!maNv) throw new Error("Chưa chọn nhân viên.");
      if (!loaiHdCanChot) throw new Error("Chưa chọn loại hợp đồng cần chốt.");
      nemNeuLuongSai(values);
      // Trả nguyên kết quả để màn hình báo theo VIỆC ĐÃ LÀM: `da_chot_hop_dong_cu` do máy chủ
      // quyết (không tìm thấy hợp đồng nào trong nhóm thì là `false`, dù client có gửi
      // `ngay_chot`). Đoán thay nó là sớm muộn cũng báo sai.
      return doi.mutateAsync({
        ...veKieuApi(values),
        ma_nv: maNv,
        ngay_chot: ngayChot.trim() || null,
        loai_hd_can_chot: loaiHdCanChot,
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
