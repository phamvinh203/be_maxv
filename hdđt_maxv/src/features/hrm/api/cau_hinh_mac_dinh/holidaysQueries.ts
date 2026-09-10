/**
 * Hook lịch ngày lễ HRM chạy trên API THẬT — bản thay thế `mock/hooks/ngayLe.ts`.
 *
 * Giữ NGUYÊN chữ ký hook bản mock (`useNgayLeRows(loc)` trả mảng đã lọc,
 * `useLuuNgayLe` trả hàm `async (values, id?)`, `useTaoNhanhNgayLe` trả
 * hàm `async (nam) => number`) nên component chỉ đổi dòng import.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmHolidayKeys } from "../hrmKeys";
import type { LocNgayLe, LoaiNgayLe, NgayLe, NgayLeFormValues } from "../../types";
import type { QuickGenerateApiResponse } from "./holidaysApi";
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  quickGenerateHolidays,
  laNamTaoNhanhHopLe,
  type HolidayApiItem,
  type HolidayTypeApi,
} from "./holidaysApi";
import { PAGE_SIZE_TOI_DA, taiHetTrang } from "./taiHetTrang";

// ─────────────────────── Bảng ánh xạ enum ───────────────────────

const MAP_LOAI: Record<HolidayTypeApi, LoaiNgayLe> = {
  NATIONAL: "le_duong_lich",
  LUNAR: "le_am_lich",
  COMPANY: "le_cong_ty",
  COMPENSATORY: "nghi_bu",
};

const MAP_LOAI_NGUOC: Record<LoaiNgayLe, HolidayTypeApi> = {
  le_duong_lich: "NATIONAL",
  le_am_lich: "LUNAR",
  le_cong_ty: "COMPANY",
  nghi_bu: "COMPENSATORY",
};

// ─────────────────────── Adapter BE → FE ───────────────────────

function veKieuFe(r: HolidayApiItem): NgayLe {
  return {
    id: r.id,
    // BE trả ISO datetime "2025-01-01T00:00:00.000Z" → FE cần "2025-01-01"
    ngay: typeof r.date === "string" ? r.date.slice(0, 10) : "",
    ten: r.name,
    loai: MAP_LOAI[r.type] ?? "le_duong_lich",
    lap_lai_hang_nam: r.isAnnual,
    co_luong: r.isPaid,
    ghi_chu: r.note ?? "",
  };
}

// ─────────────────────── Adapter FE → BE ───────────────────────

function veKieuBe(fe: NgayLeFormValues) {
  return {
    date: fe.ngay,
    name: fe.ten.trim(),
    type: MAP_LOAI_NGUOC[fe.loai],
    isAnnual: fe.lap_lai_hang_nam,
    isPaid: fe.co_luong,
    note: fe.ghi_chu.trim() || null,
  };
}

// ─────────────────────── Internal query ───────────────────────

/**
 * Kéo **toàn bộ** lịch một lượt rồi lọc phía trình duyệt.
 *
 * 🔴 **Đừng xin `pageSize` lớn hơn `PAGE_SIZE_TOI_DA` (100).** Máy chủ khai
 * `pageSize: z.coerce.number().int().min(1).max(100)` (`holidays.validator.ts:114`,
 * `api-contract.md` Mục 7F.2) và `buildQuery` chỉ loại `undefined`/`null`/chuỗi rỗng — nên số
 * quá trần đi thật lên query string và Zod trả **400**. Bản trước xin `pageSize: 500`, hệ quả
 * là `useNgayLeList` / `useNgayLeRows` / `useTrangThaiNgayLe` cùng hỏng và màn Lịch ngày lễ chỉ
 * còn hiện Alert "Không tải được lịch ngày lễ" **mọi lần mở** (`B1` của biên bản review
 * 2026-09-08).
 *
 * Cách đúng là kéo theo trang cho tới đủ `total` — xem `taiHetTrang.ts`. Chọn kéo hết thay vì
 * cắt ở 100 dòng vì cắt sẽ mất dòng **im lặng**: bảng vẫn hiện bình thường mà thiếu ngày lễ,
 * và ngày lễ quyết định hệ số tăng ca 300%/390%.
 *
 * ⚠️ Bắt buộc gửi `filter: "ALL"` tường minh: mặc định của máy chủ là `THIS_YEAR`, bỏ trống
 * là danh sách đã bị lọc sẵn mà không dấu hiệu nào — bộ lọc "Ngày lễ" (tất cả) trên giao diện
 * sẽ thiếu dòng của năm khác. Và **không** gửi `year`: máy chủ cho `year` thắng `filter`, gửi
 * kèm là quay về đúng hành vi `THIS_YEAR`.
 *
 * Ba bộ lọc của bảng dùng chung một cache vì tập dữ liệu nhỏ (một công ty vài chục dòng);
 * lọc phía máy chủ theo từng nút sẽ thành ba cache rời, đổi một dòng phải nạp lại cả ba.
 */
function useDanhSachNgayLe() {
  const { isAuthenticated, currentCompanyId } = useAuth();

  return useQuery({
    queryKey: hrmHolidayKeys.list(currentCompanyId),
    queryFn: () =>
      taiHetTrang(
        "lịch ngày lễ",
        (trang) =>
          listHolidays({
            page: trang,
            pageSize: PAGE_SIZE_TOI_DA,
            sortBy: "date",
            sortOrder: "asc",
            filter: "ALL",
          }),
        (nl) => nl.id,
      ),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmHolidayKeys.all });
  };
}

// ─────────────────────── Exported hooks ───────────────────────

/** Danh sách nguyên bản, chưa lọc. */
export function useNgayLeList(): NgayLe[] {
  const { data } = useDanhSachNgayLe();
  return useMemo(() => (data?.items ?? []).map(veKieuFe), [data]);
}

/**
 * Trạng thái tải/lỗi — bảng cần phân biệt "đang tải" với "không có ngày lễ nào khớp bộ lọc".
 *
 * `thieuDong` là trường hợp hiếm nhưng **không được nuốt**: lịch vượt trần 20 trang (2.000 dòng)
 * thì `taiHetTrang` dừng lại, bảng đang hiện một danh sách **thiếu**. Thà nói ra còn hơn để kế
 * toán tưởng công ty không có ngày lễ nào trong khoảng bị cắt.
 */
export function useTrangThaiNgayLe(): {
  dangTai: boolean;
  loi: boolean;
  thieuDong: boolean;
} {
  const { isLoading, isError, data } = useDanhSachNgayLe();
  return {
    dangTai: isLoading,
    loi: isError,
    thieuDong: data ? !data.daDayDu : false,
  };
}

/**
 * Danh sách đã lọc, sắp theo ngày tăng dần — giữ đúng chữ ký mock.
 *
 * Lọc phía client từ danh sách đầy đủ để dùng chung cache (mock cũng lọc
 * client-side). Nếu sau này muốn chuyển sang server-side, chỉ đổi `queryKey`
 * và `queryFn` thêm param `filter`.
 */
export function useNgayLeRows(loc: LocNgayLe): NgayLe[] {
  const all = useNgayLeList();
  return useMemo(() => {
    const namNay = String(new Date().getFullYear());
    return all
      .filter((nl) => {
        if (loc === "hang_nam") return nl.lap_lai_hang_nam;
        if (loc === "nam_nay") {
          return nl.lap_lai_hang_nam || nl.ngay.startsWith(namNay);
        }
        return true; // tat_ca
      })
      .sort((a, b) => a.ngay.localeCompare(b.ngay));
  }, [all, loc]);
}

/** Thêm mới hoặc sửa ngày lễ. Không truyền `id` là thêm. */
export function useLuuNgayLe() {
  const lamMoi = useLamMoi();

  const taoMoi = useMutation({
    mutationFn: createHoliday,
    onSuccess: lamMoi,
  });
  const capNhat = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateHoliday>[1] }) =>
      updateHoliday(id, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (values: NgayLeFormValues, id?: string) => {
      const ten = values.ten.trim();
      if (!ten) throw new Error("Tên ngày lễ không được để trống.");
      if (!values.ngay) throw new Error("Chưa chọn ngày.");

      // Lễ gốc âm lịch / nghỉ bù không bật "lặp lại mọi năm"
      if (
        (values.loai === "le_am_lich" || values.loai === "nghi_bu") &&
        values.lap_lai_hang_nam
      ) {
        throw new Error(
          "Lễ theo âm lịch / nghỉ bù không lặp lại theo dương lịch được. Hãy tạo lại cho từng năm.",
        );
      }

      if (id) {
        await capNhat.mutateAsync({ id, body: veKieuBe(values) });
      } else {
        await taoMoi.mutateAsync(veKieuBe(values));
      }
    },
    [taoMoi, capNhat],
  );
}

/** Xóa ngày lễ theo id. */
export function useXoaNgayLe() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deleteHoliday, onSuccess: lamMoi });

  return useCallback(
    async (id: string) => {
      await xoa.mutateAsync(id);
    },
    [xoa],
  );
}

/**
 * Sinh lịch nghỉ lễ chuẩn VN — trả về số dòng thực sự thêm.
 * Giữ đúng chữ ký mock: `async (nam: number) => number`.
 *
 * `onSuccess` gọi `lamMoi()` ⇒ invalidate cả tiền tố `["hrm-holidays"]`, nên **bản xem trước
 * cũng bị đánh dấu cũ** ngay sau khi ghi thật. Lần mở hộp thoại sau sẽ hỏi lại máy chủ chứ
 * không hiện lại con số dự báo của lần trước (khi đó `skippedCount` đã thành 11).
 */
export function useTaoNhanhNgayLe() {
  const lamMoi = useLamMoi();
  const taoNhanh = useMutation({
    mutationFn: (nam: number) => quickGenerateHolidays(nam),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (nam: number): Promise<number> => {
      const result = await taoNhanh.mutateAsync(nam);
      return result.addedCount;
    },
    [taoNhanh],
  );
}

// ─────────────────── Xem trước "Tạo nhanh" (đọc, không ghi) ───────────────────

/** Một dòng của bản xem trước, kèm nguyên cờ máy chủ đã chấm cho dòng đó. */
export interface DongXemTruocTaoNhanh {
  /** `YYYY-MM-DD` — `items[].date` của `quick-generate` là ngày trần, KHÔNG phải ISO đầy đủ. */
  ngay: string;
  ten: string;
  /**
   * Nguyên văn `items[].alreadyCovered` của máy chủ: `true` ⇒ **sẽ không được tạo**, vì công ty
   * đã có đúng cặp `(ngày, tên)` **hoặc** đã có một ngày lễ lặp hàng năm phủ sẵn ngày đó.
   *
   * `null` = **máy chủ không gửi cờ** (bản cũ chưa vá `BUG-HRM-51`). Ba giá trị chứ không phải
   * hai, có chủ ý: gộp "không biết" vào `false` thì giao diện sẽ khẳng định "ngày này sẽ được
   * tạo" trong khi nó không biết gì cả — đúng kiểu sai mà `BUG-HRM-51` đang phàn nàn.
   */
  daPhu: boolean | null;
}

export interface XemTruocTaoNhanh {
  dong: DongXemTruocTaoNhanh[];
  /**
   * `false` ⇒ máy chủ đang chạy **chưa** gửi `alreadyCovered` cho (ít nhất một) dòng nào đó.
   * Hộp thoại phải hạ cấp: không tô chip trạng thái từng dòng, chỉ hiện hai con số của máy chủ.
   */
  coCoTungDong: boolean;
  /** Số ngày sẽ thêm nếu bấm Tạo. */
  soSeThem: number;
  /** Số ngày đã được phủ nên sẽ bị bỏ qua. */
  soBoQua: number;
  /** Tổng số ngày lễ chuẩn của năm đó theo máy chủ (hiện là 11). */
  tongChuan: number;
  dangTai: boolean;
  loi: boolean;
  loiMoTa: string | null;
}

/**
 * Đọc `alreadyCovered` ở **biên giới không tin được**: hợp đồng khai bắt buộc, nhưng phản hồi
 * thật đến từ một tiến trình `be_maxv` có thể cũ hơn repo (cùng bẫy của `dryRun`, dev-notes
 * 2.15.6 — mã trong repo có không có nghĩa là máy đang chạy có).
 *
 * Ép qua `unknown` chứ không đọc thẳng `it.alreadyCovered`: kiểu tĩnh nói "luôn là boolean" nên
 * `typeof` sẽ trông như thừa và rất dễ bị người sau "dọn cho gọn" — mà bỏ nó đi thì `undefined`
 * lọt xuống thành `false` (falsy) và giao diện lại khẳng định điều nó không biết.
 */
function docCoDaPhu(item: QuickGenerateApiResponse["items"][number]): boolean | null {
  const co: unknown = item.alreadyCovered;
  return typeof co === "boolean" ? co : null;
}

/**
 * Bản xem trước lịch nghỉ lễ chuẩn của một năm — **đọc từ máy chủ**, không tự tính.
 *
 * 🔴 **Vì sao có hook này (đọc trước khi định "tối ưu" bằng cách tính lại ở trình duyệt).**
 * Bản trước dựng xem trước bằng `features/hrm/ngayLeChuan.ts` — một bảng tra âm lịch **chép tay
 * riêng của giao diện**, trong khi máy chủ sinh bằng thuật toán. Hai nguồn sự thật cho cùng một
 * dữ liệu, và đã lệch thật: hộp thoại hiện khối Tết 2026 là **16–20/02**, máy chủ ghi vào cơ sở
 * dữ liệu là **15–19/02**. Cùng cấu trúc đó từng che luôn lỗi Mùng 1 Tết 2030 (`CONTEXT_SUMMARY`
 * Mục 16.3): hai bảng chép tay khớp nhau nên phép đối chiếu BE↔FE báo "đúng" trong khi cả hai
 * cùng sai. Vá số trong bảng chỉ mua được một năm; **bỏ nguồn thứ hai** mới là cách sửa.
 *
 * 🔴 **Trạng thái "đã có" của từng dòng cũng ĐỌC TỪ MÁY CHỦ** (`items[].alreadyCovered`), không
 * tự đối chiếu nữa. Bản trước tải cả lịch công ty rồi so cặp `(ngày, tên)` ngay tại đây —
 * `BUG-HRM-51` cho thấy phép so đó **sai ở mức nghiệp vụ**: tenant đã có
 * `2026-01-01 Tết Dương lịch` với `isAnnual = true` (phủ mọi năm), mở Tạo nhanh cho 2027 vẫn báo
 * "11/11 ngày sẽ thêm; 0 ngày đã có", bấm Tạo là sinh dòng thứ hai cùng nghĩa. Trình duyệt
 * **không thể** tự biết luật phủ hàng năm nếu không cài lại logic máy chủ — mà cài lại chính là
 * dựng lại nguồn sự thật thứ hai vừa gỡ ở `ADR-010`, chỉ khác là lần này lệch kín đáo hơn.
 *
 * `useQuery` chứ **không** `useMutation`: với `dryRun: true` máy chủ không ghi gì, đây là phép
 * đọc thuần — cần cache theo năm, cần `isLoading`/`isError`, và cần bị invalidate cùng nhóm
 * `["hrm-holidays"]` sau mỗi lần ghi. `useMutation` không cho cái nào trong bốn cái đó.
 *
 * ⚠️ **Phụ thuộc phiên bản máy chủ ĐANG CHẠY, không phải mã trong repo.** `z.object` của Zod
 * **lược** khóa lạ chứ không từ chối, và hai chế độ trả về hình dạng phản hồi **giống hệt nhau**
 * — nên với một `be_maxv` cũ chưa có `dryRun`, mở hộp thoại là **ghi thật**, và trình duyệt
 * không có cách nào biết. Dữ liệu vẫn đúng (thao tác idempotent, đúng 11 ngày chuẩn) nhưng
 * **được tạo sớm hơn ý người dùng**. ⇒ Không triển khai giao diện này lên môi trường nào mà
 * `be_maxv` chưa có `dryRun`.
 * (Xác nhận 2026-09-08: mã trong repo **đã có** — `holidays.validator.ts` khai
 * `dryRun: z.boolean().optional()`, `holidays.service.ts` rẽ nhánh chỉ-đọc.)
 *
 * `staleTime: 0` (đè mặc định 30 giây của `queryClient`): đây là **dự báo tại thời điểm xem**,
 * mỗi lần mở hộp thoại phải hỏi lại. Giữ 30 giây thì mở lại ngay sau khi người khác vừa thêm
 * ngày lễ sẽ hiện con số cũ mà không dấu hiệu gì.
 */
export function useXemTruocTaoNhanh(
  nam: number,
  dangMo: boolean,
): XemTruocTaoNhanh {
  const { isAuthenticated, currentCompanyId } = useAuth();

  const { data, isLoading, isError, error } = useQuery<QuickGenerateApiResponse>({
    queryKey: hrmHolidayKeys.quickPreview(currentCompanyId, nam),
    queryFn: () => quickGenerateHolidays(nam, true),
    // Chỉ gọi khi hộp thoại đang mở và năm nằm trong dải máy chủ nhận — vừa khỏi gọi nền vô ích,
    // vừa khỏi tự chuốc một lần 400 `E-hrm-079` chỉ để hiện lỗi.
    enabled:
      dangMo && isAuthenticated && !!currentCompanyId && laNamTaoNhanhHopLe(nam),
    staleTime: 0,
  });

  return useMemo(() => {
    const dong: DongXemTruocTaoNhanh[] = (data?.items ?? []).map((it) => ({
      ngay: it.date,
      ten: it.name,
      daPhu: docCoDaPhu(it),
    }));

    /*
     * Đòi **mọi** dòng đều có cờ mới coi là dùng được. Máy chủ gửi thiếu một dòng nghĩa là ta
     * đang nói chuyện với một phiên bản không như hợp đồng — lúc đó tin phần còn lại là đoán mò.
     * (`every` trên mảng rỗng trả `true`, nên phải chặn `length > 0` trước.)
     */
    const coCoTungDong = dong.length > 0 && dong.every((d) => d.daPhu !== null);

    /*
     * Hai con số ĐẾM TỪ CHÍNH CÁC CỜ vừa dùng để tô chip, không lấy `addedCount`/`skippedCount`
     * rời ra nữa.
     *
     * Theo hợp đồng hai cách đếm bằng nhau (`api-contract.md` Mục 7F.6 (b2), `ADR-011`:
     * `count(alreadyCovered === false) === addedCount` và
     * `count(alreadyCovered === true) === skippedCount`, kiểm **trong cùng một phản hồi** —
     * đúng bằng những gì `useMemo` này có trong tay). Nhưng nếu chúng có lệch — máy chủ vá nửa
     * vời, hoặc `skippedCount` còn đếm theo luật cũ — thì hộp thoại phải **tự nhất quán** trước
     * đã: đúng cảnh `BUG-HRM-51` là dòng tổng kết nói một đằng ("0 ngày đã có") mà thực tế
     * nghiệp vụ một nẻo. Một hộp thoại tự mâu thuẫn thì người dùng không dựa vào được câu nào.
     *
     * Không còn `useNgayLeList()` ở đây: bản trước tải cả lịch công ty chỉ để tự đối chiếu cặp
     * `(ngày, tên)`. Phép đối chiếu đó **không thể** biết luật "một dòng lặp hàng năm phủ mọi
     * năm" nếu không cài lại logic máy chủ ở trình duyệt — tức dựng lại nguồn sự thật thứ hai mà
     * `ADR-010` vừa gỡ. Cờ của máy chủ là bên sắp thực thi; tin nó.
     */
    const soSeThem = coCoTungDong
      ? dong.filter((d) => d.daPhu === false).length
      : (data?.addedCount ?? 0);
    const soBoQua = coCoTungDong
      ? dong.length - soSeThem
      : (data?.skippedCount ?? 0);

    return {
      dong,
      coCoTungDong,
      soSeThem,
      soBoQua,
      // Lùi về số dòng thực nhận nếu máy chủ không nói tổng: thà "8/11" hơn là "8/0".
      tongChuan: data?.totalStandard ?? dong.length,
      dangTai: isLoading,
      loi: isError,
      loiMoTa: error instanceof Error ? error.message : null,
    };
  }, [data, isLoading, isError, error]);
}
