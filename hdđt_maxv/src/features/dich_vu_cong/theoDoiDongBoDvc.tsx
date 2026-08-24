import { toast, type Id as ToastId } from "react-toastify";

import ToastTienDoDongBo from "./components/ToastTienDoDongBo";
import { layTienDoDongBoDvc, type DvcDongBoTienDo } from "./api/dvc";
import { getErrorMessage } from "../../lib/errors";
import {
  batDauToastNen,
  capNhatToastNen,
  ketThucToastNen,
  nghiMs,
  POLL_NEN_MS,
  MAX_POLL_NEN_HONG,
  LOI_MAT_KET_NOI_NEN,
} from "../../lib/toastChayNen";

/**
 * Theo dõi lượt "Đồng bộ" Dịch vụ công chạy nền bằng MỘT toast góc DƯỚI PHẢI có thanh tiến độ.
 *
 * VÌ SAO GÓC DƯỚI PHẢI, đặt trên từng toast thay vì đổi `ToastContainer`: toast này sống hàng phút,
 * còn mọi toast khác của app là thông báo tức thời 3 giây. Để chung một góc thì cái đang chạy bị
 * cái tức thời đẩy lên đẩy xuống, hoặc tệ hơn là che mất. Tách góc là tách hai loại thông báo.
 *
 * Cùng khuôn `pollUpdateRunToast` bên HĐĐT (trạng thái thật nằm ở BE, FE chỉ bám theo) — khác ở nội
 * dung có thanh tiến độ và ở chỗ lượt DVC chỉ có một pha.
 */

/**
 * `startedAt` của lượt mà vòng theo dõi hiện tại đang bám; `null` = không có vòng nào chạy.
 *
 * Lưu ĐỊNH DANH LƯỢT chứ không phải một cờ boolean. Cờ boolean chỉ trả lời được "có ai đang chạy
 * không", nên lượt thứ hai chỉ có thể bị BỎ chứ không phân biệt được là trùng hay khác — và bỏ
 * lượt khác thì không ai bám nó nữa: người dùng thấy không có toast, còn nút "Đồng bộ" thì kẹt
 * disabled cho tới khi F5 (vì `khiXong` của vòng cũ chạy trên instance đã unmount).
 *
 * Có định danh thì câu hỏi trở thành đúng thứ cần hỏi: "tôi đã bám ĐÚNG lượt này chưa?".
 */
let luotDangBam: number | null = null;

/** Đã có vòng theo dõi bám ĐÚNG lượt này chưa — `DvcPage` hỏi trước khi mở vòng mới. */
export function dangBamLuot(startedAt: number): boolean {
  return luotDangBam === startedAt;
}

/** Câu chữ + mức độ của toast khi lượt kết thúc. */
function ketQua(st: DvcDongBoTienDo): { render: string; type: "success" | "warning" | "error" } {
  if (st.error) return { render: st.error, type: "error" };

  if (st.tongHoSo === 0 && st.thieuHoSo === 0) {
    return { render: "Đồng bộ xong — khoảng ngày này không có hồ sơ nào.", type: "success" };
  }

  const base =
    `Đồng bộ xong ${st.tongHoSo} hồ sơ — ${st.dongBoXong} hồ sơ mới, ` +
    `${st.daCoSan} đã có sẵn`;
  const them =
    (st.loi > 0 ? `, ${st.loi} lỗi (sẽ bù ở lượt sau)` : "") +
    // Thiếu hồ sơ là mất DỮ LIỆU, nặng hơn lỗi lẻ — phải nói ra ngay trên toast. Chỉ ghi vào
    // `dvc_dong_bo_log` là chôn nó trong dialog mà lúc này người dùng đã đóng rồi.
    (st.thieuHoSo > 0 ? `. CHƯA lấy hết: cổng khai còn ${st.thieuHoSo} hồ sơ nữa` : "");

  if (st.loi > 0 || st.thieuHoSo > 0) return { render: `${base}${them}.`, type: "warning" };
  return { render: `${base}.`, type: "success" };
}

export interface TheoDoiDongBoOpts {
  /** Đổi công ty giữa chừng -> ngừng poll và gỡ toast, tránh hiện số của tenant khác. */
  daLacHau: () => boolean;
  /**
   * Gọi ĐÚNG một lần lúc kết thúc, kèm trạng thái cuối (`null` = tự gỡ vì đã đổi công ty).
   *
   * KHÔNG có callback "có số liệu mới" giữa chừng: `dvc_dong_bo_log` chỉ được ghi MỘT dòng ở CUỐI
   * lượt, nên nạp lại lịch sử mỗi nhịp poll không lấy được gì mới — chỉ tốn request.
   */
  khiXong: (st: DvcDongBoTienDo | null) => void;
}

/**
 * Poll tiến độ tới khi BE báo xong, hiển thị bằng một toast cập nhật dần.
 *
 * Dùng cho CẢ lúc bấm nút lẫn lúc NỐI LẠI lượt đang chạy khi mở lại trang: trạng thái thật nằm ở
 * BE nên hai đường vào chỉ khác nhau ở chỗ lấy `initial` từ đâu.
 */
export async function theoDoiDongBoDvc(
  initial: DvcDongBoTienDo,
  opts: TheoDoiDongBoOpts,
): Promise<void> {
  // Đã có vòng bám đúng lượt này -> khỏi mở vòng thứ hai (hai toast chồng nhau cho một lượt).
  // Lượt KHÁC thì thay luôn: vòng cũ sẽ tự thấy `startedAt` lệch ở nhịp poll kế và tự gỡ.
  if (luotDangBam === initial.startedAt) return;
  luotDangBam = initial.startedAt;

  // `try` mở NGAY, trước cả `toast.loading`: nếu chỗ đó ném thì cờ kẹt `true` suốt đời tab, và
  // guard `dangTheoDoiDongBo()` bên `DvcPage` biến nó thành vĩnh viễn — không lượt nào còn được
  // theo dõi nữa.
  let toastId: ToastId | null = null;
  let st = initial;
  let dauVetCu = "";
  let fails = 0;

  try {
    toastId = batDauToastNen(<ToastTienDoDongBo st={initial} />);
    for (;;) {
      if (opts.daLacHau()) {
        toast.dismiss(toastId);
        opts.khiXong(null);
        return;
      }
      // Chỉ vẽ lại khi số liệu ĐỔI: pha tra cứu đứng im hàng chục giây, còn pha hồ sơ thì mỗi hồ
      // sơ ~3,2s so với nhịp poll 2s — vẽ vô điều kiện là quá nửa số lần render không đổi gì.
      const dauVet =
        `${st.daCoSan}/${st.dongBoXong}/${st.loi}/${st.tongHoSo}/${st.maHoSoDangLam}` +
        `/${st.dangBuLai}`;
      if (dauVet !== dauVetCu) {
        dauVetCu = dauVet;
        capNhatToastNen(toastId, <ToastTienDoDongBo st={st} />);
      }
      if (!st.active) break;

      await nghiMs(POLL_NEN_MS);
      try {
        const moi = await layTienDoDongBoDvc();
        // BE restart giữa chừng -> mất lượt trong RAM, `null`. Coi như kết thúc, đừng poll mãi.
        if (!moi) {
          st = { ...st, active: false, error: "Máy chủ khởi động lại — lượt đồng bộ đã dừng." };
          continue;
        }
        // Không còn là lượt mình đang bám (`startedAt` là định danh lượt): hoặc người dùng bấm
        // Đồng bộ lại nên BE thay lượt, hoặc đã đổi công ty — endpoint trả tiến độ theo công ty
        // ĐANG CHỌN nên sau khi đổi là số của công ty khác. Gỡ toast, để `khiXong(null)` báo nơi
        // gọi dò lại và bám lượt đúng.
        //
        // Phải kiểm ở ĐÂY chứ không chỉ dựa `daLacHau`: vòng poll sống cả khi đã rời `DvcPage`
        // (cố ý — toast phải theo người dùng sang trang khác), mà lúc đó ref công ty bên trang kia
        // đứng im nên `daLacHau` không bao giờ đúng nữa.
        if (moi.startedAt !== st.startedAt) {
          toast.dismiss(toastId);
          opts.khiXong(null);
          return;
        }
        st = moi;
        fails = 0;
      } catch (e) {
        fails += 1;
        if (fails >= MAX_POLL_NEN_HONG) throw e;
      }
    }

    ketThucToastNen(toastId, { ...ketQua(st), autoClose: 6000 });
    opts.khiXong(st);
  } catch (e) {
    if (toastId === null) throw e; // chưa kịp có toast -> không có gì để cập nhật
    ketThucToastNen(toastId, { render: getErrorMessage(e, LOI_MAT_KET_NOI_NEN), type: "error" });
    opts.khiXong(st);
  } finally {
    // Chỉ nhả nếu vẫn là vòng của lượt này — vòng mới đã ghi đè thì không được xóa dấu của nó.
    if (luotDangBam === initial.startedAt) luotDangBam = null;
  }
}
