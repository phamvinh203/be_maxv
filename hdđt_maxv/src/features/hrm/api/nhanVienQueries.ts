/**
 * Hook nhân viên chạy trên API THẬT — bản thay thế của `mock/hooks/nhanVien.ts`.
 * Giữ nguyên chữ ký hook bản mock nên component gần như chỉ đổi dòng import.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HỢP ĐỒNG NẰM Ở BẢNG RIÊNG — đọc trước khi sửa file này
 *
 * `hrm_hop_dong` là nguồn sự thật DUY NHẤT (1 NV nhiều HĐ, có lịch sử). Hồ sơ nhân viên KHÔNG
 * lưu bản sao hợp đồng hiện hành nữa; BE tính lúc đọc và trả kèm trong `NhanVienApiRow` — mấy
 * trường đó CHỈ ĐỌC, `null` khi nhân viên chưa có hợp đồng nào.
 *
 * Vì vậy ở đây KHÔNG còn:
 *   - đoạn bịa `TAM-<mã NV>` khi người dùng để trống nhóm hợp đồng lúc thêm nhân viên;
 *   - đoạn đọc lại bản ghi để "giữ nguyên phần hợp đồng" lúc sửa (PUT không đụng tới nữa).
 *
 * Muốn đổi thông tin hợp đồng thì ghi vào `hrm_hop_dong` (tab Lịch sử hợp đồng), đừng thêm
 * lại trường hợp đồng vào thân request nhân viên.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { getErrorMessage } from "@/lib/errors";
import {
  hrmHopDongKeys,
  hrmNhanVienKeys,
  hrmNptKeys,
  hrmPhongBanKeys,
  hrmTaiLieuKeys,
} from "./hrmKeys";
import { sinhMaNhanVien } from "../cay";
import { CHUC_VU, PB_CHUA_GAN } from "../constants";
import { homNay, nhan } from "../format";
import type {
  HopDong,
  NhanVien,
  NhanVienFilters,
  NhanVienRow,
  ThemNhanVienPayload,
} from "../types";
import { createHopDong } from "./hopDongApi";
import {
  createNhanVien,
  deleteNhanVien,
  getNhanVien,
  listNhanVien,
  updateNhanVien,
  type LoaiHopDongApi,
  type NhanVienApiBody,
  type NhanVienApiRow,
} from "./nhanVienApi";

/** ISO của BE (`2026-03-01T00:00:00.000Z`) -> `YYYY-MM-DD` cho `<input type="date">`. */
function veNgayInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** `YYYY-MM-DD` của form -> chuỗi BE nhận; rỗng -> null. */
function veNgayApi(s: string): string | null {
  return s.trim() ? s.trim() : null;
}

/** Mã chức vụ FE (`CV05`) -> nhãn lưu ở BE (`Kế toán trưởng`) cho dễ đọc trong DB. */
function chucVuVeApi(maCv: string): string | null {
  const s = maCv.trim();
  return s ? nhan(CHUC_VU, s) : null;
}

/**
 * Nhãn ở BE -> mã chức vụ FE. Không khớp danh mục thì trả nguyên chuỗi: ô Select hiện đúng
 * chữ đó (`nhan()` tự fallback về chính giá trị), không nuốt mất dữ liệu người dùng nhập.
 */
function chucVuVeFe(chucVu: string | null): string {
  if (!chucVu) return "";
  return CHUC_VU.find((cv) => cv.label === chucVu)?.value ?? chucVu;
}

/**
 * BE 3 giá trị -> FE 5 giá trị: KHÔNG khôi phục được nguyên bản ("Không xác định thời hạn" và
 * "Thời vụ" đều đã gom về `hdld` lúc ghi, đọc về chỉ ra được một trong hai).
 *
 * CHỈ được dùng cho phần hiển thị của `hopDongTuApi` — hiện tại bảng nhân viên chỉ đọc `so_hd`
 * và `kieu_luong` từ đó nên chưa lộ. ĐỪNG đổ giá trị này vào ô Select "Loại hợp đồng" hay
 * `ThayDoiHopDongDialog`: người dùng sẽ thấy loại hợp đồng khác thứ họ đã chọn.
 */
function loaiHopDongVeFe(loai: LoaiHopDongApi): HopDong["loai_hd"] {
  if (loai === "thu_viec") return "thu_viec";
  if (loai === "hdvc") return "khoan";
  return "xac_dinh";
}

function veKieuFe(r: NhanVienApiRow): NhanVien {
  return {
    ma_nv: r.ma_nv,
    ho_ten: r.ho_ten,
    so_cccd: r.so_cccd ?? "",
    mst_ca_nhan: r.mst_ca_nhan ?? "",
    ngay_sinh: veNgayInput(r.ngay_sinh),
    gioi_tinh: r.gioi_tinh ?? "nam",
    dien_thoai: r.dien_thoai ?? "",
    email: r.email ?? "",
    dia_chi: r.dia_chi ?? "",
    ghi_chu: r.ghi_chu ?? "",
    ma_pb: r.ma_pb,
    ma_cv: chucVuVeFe(r.chuc_vu),
    cap_bac: r.cap_bac ?? "",
    cong_doan: r.cong_doan,
    ngay_vao: veNgayInput(r.ngay_vao_lam),
    ngan_hang: r.ngan_hang ?? "",
    so_tk: r.so_tai_khoan ?? "",
    chu_tk: r.ten_tai_khoan ?? "",
    status: r.status,
  };
}

/**
 * Dựng đối tượng hợp đồng từ phần BE TÍNH SẴN trên hồ sơ nhân viên, để bảng hiện cột Số HĐ /
 * Kiểu lương mà không phải gọi thêm API lịch sử hợp đồng cho từng dòng.
 *
 * `null` khi nhân viên chưa có hợp đồng nào — bảng đã hiện "—" cho trường hợp đó.
 */
function hopDongTuApi(r: NhanVienApiRow): HopDong | null {
  if (!r.so_hop_dong || !r.loai_hop_dong) return null;
  return {
    id: `nv-${r.ma_nv}`,
    ma_nv: r.ma_nv,
    so_hd: r.so_hop_dong,
    loai_hd: loaiHopDongVeFe(r.loai_hop_dong),
    kieu_luong: r.kieu_luong === "net" ? "NET" : "GROSS",
    // BE chưa có cột tiền lương (spec nhân viên chỉ có Gross/Net) — bảng lương vẫn chạy mock.
    luong_chinh: 0,
    luong_bhxh: 0,
    ngay_bat_dau: veNgayInput(r.ngay_vao_lam),
    ngay_ket_thuc: veNgayInput(r.ngay_hieu_luc_toi),
    trich_bhxh: r.bhxh ?? true,
    tinh_tncn: r.tncn ?? true,
    ghi_chu: "",
  };
}

/** Phần thông tin cá nhân — dùng chung cho cả thêm và sửa. */
function thongTinVeApi(
  nv: NhanVien,
): Omit<NhanVienApiBody, "ngay_vao_lam" | "mien_cham_cong"> {
  return {
    ho_ten: nv.ho_ten.trim(),
    ngay_sinh: veNgayApi(nv.ngay_sinh),
    so_cccd: nv.so_cccd.trim() || null,
    mst_ca_nhan: nv.mst_ca_nhan.trim() || null,
    dien_thoai: nv.dien_thoai.trim() || null,
    email: nv.email.trim() || null,
    dia_chi: nv.dia_chi.trim() || null,
    gioi_tinh: nv.gioi_tinh,
    ma_pb: nv.ma_pb,
    chuc_vu: chucVuVeApi(nv.ma_cv),
    cap_bac: nv.cap_bac.trim() || null,
    cong_doan: nv.cong_doan,
    so_tai_khoan: nv.so_tk.trim() || null,
    ten_tai_khoan: nv.chu_tk.trim() || null,
    ngan_hang: nv.ngan_hang.trim() || null,
    ghi_chu: nv.ghi_chu.trim() || null,
    status: nv.status,
  };
}

function useDanhSachNhanVien() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  // KHÔNG dùng `placeholderData: (prev) => prev`: nó giữ dữ liệu cũ xuyên qua việc ĐỔI query
  // key, mà key ở đây gắn `currentCompanyId` — đổi công ty sẽ hiện nguyên danh sách nhân viên của
  // công ty trước dưới tên công ty mới, `isLoading` lại là false nên không có dấu hiệu nào.
  // Ba truy vấn này không phân trang nên cũng chẳng được lợi gì từ nó.
  return useQuery({
    queryKey: hrmNhanVienKeys.list(currentCompanyId),
    queryFn: () => listNhanVien(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Danh sách thô — dùng cho ô chọn nhân viên. */
export function useNhanVienList(): NhanVien[] {
  const { data } = useDanhSachNhanVien();
  return useMemo(() => (data ?? []).map(veKieuFe), [data]);
}

/** Mã gợi ý cho form thêm mới. BE vẫn tự sinh nếu để trống, đây chỉ là gợi ý hiện sẵn trên ô. */
export function useMaNhanVienMoi(): string {
  const danhSach = useNhanVienList();
  return useMemo(() => sinhMaNhanVien(danhSach), [danhSach]);
}

/**
 * Danh sách đã lọc, kèm tên phòng ban / chức vụ / hợp đồng / số NPT.
 * Lọc ở client y như bản mock (danh mục nhỏ, và BE chưa có tham số tìm chung `q` lẫn
 * "chưa gán phòng ban") để hành vi bộ lọc không đổi.
 */
export function useNhanVienRows(filters: NhanVienFilters): {
  rows: NhanVienRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachNhanVien();

  const rows = useMemo<NhanVienRow[]>(() => {
    const tuKhoa = filters.q.trim().toLowerCase();

    return (data ?? [])
      .filter((r) => {
        if (filters.status && r.status !== filters.status) return false;
        if (filters.ma_pb === PB_CHUA_GAN && r.ma_pb) return false;
        if (
          filters.ma_pb &&
          filters.ma_pb !== PB_CHUA_GAN &&
          r.ma_pb !== filters.ma_pb
        ) {
          return false;
        }
        if (!tuKhoa) return true;
        return [r.ma_nv, r.ho_ten, r.so_cccd ?? "", r.dien_thoai ?? ""].some(
          (truong) => truong.toLowerCase().includes(tuKhoa),
        );
      })
      .map((r) => ({
        ...veKieuFe(r),
        ten_pb: r.ten_pb ?? r.ma_pb ?? "",
        ten_cv: r.chuc_vu ?? "",
        hop_dong: hopDongTuApi(r),
        so_npt: r.so_npt ?? 0,
      }));
  }, [data, filters]);

  return { rows, isLoading, isError, error };
}

/** Chi tiết một nhân viên — dialog sửa nạp từ đây. */
export function useNhanVienDetail(maNv: string | null): NhanVien | null {
  const danhSach = useNhanVienList();
  return useMemo(
    () => (maNv ? (danhSach.find((nv) => nv.ma_nv === maNv) ?? null) : null),
    [danhSach, maNv],
  );
}

/**
 * Làm mới sau khi ghi. Đụng cả ba nhóm vì số liệu móc vào nhau:
 *   - phòng ban: cột `so_nv` do BE đếm, thêm/xóa nhân viên là sai ngay
 *   - người phụ thuộc và hồ sơ tài liệu: đều bị ẩn theo nhân viên xóa mềm, không nạp lại thì
 *     hai màn đó vẫn liệt kê dữ liệu của hồ sơ đã xóa và bấm Sửa sẽ ra 404
 */
function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmNhanVienKeys.all });
    void qc.invalidateQueries({ queryKey: hrmPhongBanKeys.all });
    void qc.invalidateQueries({ queryKey: hrmNptKeys.all });
    void qc.invalidateQueries({ queryKey: hrmTaiLieuKeys.all });
    void qc.invalidateQueries({ queryKey: hrmHopDongKeys.all });
  };
}

/** Tạo nhân viên. Nhóm hợp đồng trên form là tùy chọn — bỏ trống thì điền tạm (xem đầu file). */
export function useThemNhanVien() {
  const lamMoi = useLamMoi();

  /**
   * CẢ HAI lần ghi nằm trong CÙNG một `mutationFn`, cố ý.
   *
   * TanStack chạy `onSuccess` TRƯỚC khi `mutateAsync` trả về. Nếu chỉ bọc `createNhanVien` thì
   * lệnh nạp lại danh sách hợp đồng bắn đi trong lúc hợp đồng còn CHƯA được ghi — mà truy vấn
   * hợp đồng luôn hoạt động (dialog chi tiết nhân viên vẫn gắn trên trang danh sách), nên nó
   * gọi mạng ngay và gần như luôn về đích trước, ghi vào cache một danh sách thiếu dòng vừa tạo
   * rồi đánh dấu là mới tinh. Kết quả người dùng thấy: tab "Thông tin" có số hợp đồng, tab
   * "Lịch sử hợp đồng" trống trơn — đúng thứ đoạn code này sinh ra để tránh.
   *
   * Dùng `onSettled` chứ không `onSuccess`: ghi nhân viên xong mà hợp đồng hỏng thì nhân viên
   * VẪN đã nằm trong DB, danh sách bắt buộc phải nạp lại, không thì màn hình thiếu người.
   */
  const them = useMutation({
    mutationFn: async (payload: ThemNhanVienPayload) => {
      const nv = payload.nhan_vien;
      // Hồ sơ nhân viên KHÔNG còn mang thông tin hợp đồng: số HĐ / loại HĐ / kiểu lương /
      // hiệu lực tới / BHXH / TNCN đều thuộc `hrm_hop_dong` và được BE tính lúc đọc. Nhờ vậy
      // bỏ được đoạn bịa `TAM-<mã NV>` khi người dùng để trống nhóm hợp đồng — giờ để trống
      // nghĩa là chưa có hợp đồng, và màn hình hiện đúng như vậy.
      const ketQua = await createNhanVien({
        ma_nv: nv.ma_nv.trim() || null,
        ...thongTinVeApi(nv),
        ngay_vao_lam: nv.ngay_vao || payload.hop_dong?.ngay_bat_dau || homNay(),
        mien_cham_cong: false,
      });

      // Nhóm hợp đồng có nhập ĐỦ (số HĐ + ngày bắt đầu) thì ghi luôn một dòng vào lịch sử hợp
      // đồng. Không làm bước này thì tab Lịch sử trống trơn trong khi hồ sơ nhân viên lại hiện
      // số hợp đồng — người dùng tưởng dữ liệu bị mất. BE tự đồng bộ lại bản sao sau đó.
      const hd = payload.hop_dong;
      if (hd?.so_hd.trim() && hd.ngay_bat_dau) {
        try {
          await createHopDong({
            ma_nv: ketQua.ma_nv,
            so_hd: hd.so_hd.trim(),
            loai_hd: hd.loai_hd,
            kieu_luong: hd.kieu_luong === "NET" ? "net" : "gross",
            luong_chinh: hd.luong_chinh,
            luong_bhxh: hd.luong_bhxh,
            ngay_bat_dau: hd.ngay_bat_dau,
            ngay_ket_thuc: hd.ngay_ket_thuc.trim() || null,
            trich_bhxh: hd.trich_bhxh,
            tinh_tncn: hd.tinh_tncn,
            ghi_chu: hd.ghi_chu.trim() || null,
          });
        } catch (err) {
          // Nhân viên ĐÃ tạo xong. Báo "Không lưu được nhân viên." là sai sự thật và khiến người
          // dùng bấm lưu lại -> tạo nhân viên thứ hai.
          throw new Error(
            `Đã tạo nhân viên ${ketQua.ma_nv} nhưng chưa ghi được lịch sử hợp đồng: ${getErrorMessage(
              err,
              "lỗi không xác định",
            )} Mở hồ sơ nhân viên, vào tab Lịch sử hợp đồng để thêm lại.`,
            { cause: err },
          );
        }
      }
    },
    onSettled: lamMoi,
  });

  return useCallback(
    async (payload: ThemNhanVienPayload) => {
      if (!payload.nhan_vien.ho_ten.trim())
        throw new Error("Họ và tên không được để trống.");
      await them.mutateAsync(payload);
    },
    [them],
  );
}

/**
 * Sửa nhân viên. PUT của BE thay TOÀN BỘ bản ghi, mà form sửa không có ô hợp đồng — nên đọc
 * lại bản ghi hiện tại rồi giữ nguyên phần hợp đồng, tránh ghi đè mất số HĐ đã nhập.
 */
export function useSuaNhanVien() {
  const lamMoi = useLamMoi();
  const sua = useMutation({
    mutationFn: ({ maNv, body }: { maNv: string; body: NhanVienApiBody }) =>
      updateNhanVien(maNv, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (nv: NhanVien) => {
      if (!nv.ho_ten.trim()) throw new Error("Họ và tên không được để trống.");

      // Không còn phải đọc lại bản ghi để "giữ nguyên phần hợp đồng": PUT nhân viên không đụng
      // tới hợp đồng nữa, nên cũng không thể vô tình đè mất. Bỏ luôn cảnh báo "ngày vào phải
      // trước ngày hết hạn hợp đồng" — ràng buộc đó thuộc về `hrm_hop_dong`, form nhân viên
      // không còn liên quan.
      const hienTai = await getNhanVien(nv.ma_nv);
      await sua.mutateAsync({
        maNv: nv.ma_nv,
        body: {
          ...thongTinVeApi(nv),
          ngay_vao_lam: nv.ngay_vao || hienTai.ngay_vao_lam.slice(0, 10),
          mien_cham_cong: hienTai.mien_cham_cong,
        },
      });
    },
    [sua],
  );
}

/** Bản ghi BE đọc về -> thân request PUT, để sửa được một trường mà không mất các trường khác. */
function apiRowVeBody(r: NhanVienApiRow): NhanVienApiBody {
  return {
    ho_ten: r.ho_ten,
    ngay_sinh: r.ngay_sinh ? r.ngay_sinh.slice(0, 10) : null,
    so_cccd: r.so_cccd,
    mst_ca_nhan: r.mst_ca_nhan,
    dien_thoai: r.dien_thoai,
    email: r.email,
    dia_chi: r.dia_chi,
    gioi_tinh: r.gioi_tinh,
    ma_pb: r.ma_pb,
    chuc_vu: r.chuc_vu,
    cap_bac: r.cap_bac,
    ngay_vao_lam: r.ngay_vao_lam.slice(0, 10),
    mien_cham_cong: r.mien_cham_cong,
    cong_doan: r.cong_doan,
    so_tai_khoan: r.so_tai_khoan,
    ten_tai_khoan: r.ten_tai_khoan,
    ngan_hang: r.ngan_hang,
    ghi_chu: r.ghi_chu,
    status: r.status,
  };
}

/**
 * Gán hàng loạt nhân viên vào một phòng ban — chạy THẬT trên API.
 *
 * Trước đây hook này lấy từ kho mock trong khi danh sách phòng ban đã là thật: thao tác không
 * gửi gì lên server nhưng vẫn báo "Đã gán N nhân viên", còn cột `so_nv` phía sau vẫn đứng 0.
 *
 * BE không có endpoint gán hàng loạt và `PUT` thay TOÀN BỘ bản ghi, nên phải đọc từng người
 * rồi ghi lại kèm phòng ban mới. Làm tuần tự để lỗi ở giữa còn nói được đã gán tới đâu —
 * báo "thành công" khi mới xong một nửa còn tệ hơn là báo lỗi.
 */
export function useGanNhanhPhongBan() {
  const lamMoi = useLamMoi();
  const gan = useMutation({
    mutationFn: async ({
      maPb,
      maNvList,
    }: {
      maPb: string;
      maNvList: string[];
    }) => {
      let xong = 0;
      for (const maNv of maNvList) {
        try {
          const hienTai = await getNhanVien(maNv);
          await updateNhanVien(maNv, { ...apiRowVeBody(hienTai), ma_pb: maPb });
          xong += 1;
        } catch (err) {
          const lyDo = err instanceof Error ? err.message : "lỗi không rõ";
          throw new Error(
            `Đã gán ${xong}/${maNvList.length} nhân viên rồi dừng ở ${maNv}: ${lyDo}`,
            { cause: err },
          );
        }
      }
    },
    // onSettled chứ không onSuccess: hỏng giữa chừng thì phần đã gán vẫn phải hiện ra bảng.
    onSettled: lamMoi,
  });

  return useCallback(
    async (maPb: string, maNvList: string[]) => {
      if (!maPb) throw new Error("Chưa chọn phòng ban đích.");
      if (maNvList.length === 0) throw new Error("Chưa chọn nhân viên nào.");
      await gan.mutateAsync({ maPb, maNvList });
    },
    [gan],
  );
}

/** Xóa — người phụ thuộc THẬT của nhân viên bị xóa theo (BE cascade). */
export function useXoaNhanVien() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deleteNhanVien, onSuccess: lamMoi });

  return useCallback(
    async (maNv: string) => {
      await xoa.mutateAsync(maNv);
    },
    [xoa],
  );
}
