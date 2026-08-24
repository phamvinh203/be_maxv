/**
 * KHO LƯỢT CHẠY NỀN theo khóa — vòng đời dùng chung cho mọi luồng "bấm nút rồi bỏ đó, FE poll tiến
 * độ": cập nhật hóa đơn từ Thuế điện tử (`startUpdateRunWith`) và đồng bộ Dịch vụ công
 * (`batDauDongBoRun`).
 *
 * VÌ SAO TÁCH RA: phần này nhỏ nhưng là chỗ sai nhiều nhất của luồng nền — lượt mới thay lượt cũ,
 * lượt cũ kết thúc muộn đè mất trạng thái lượt mới, `work` ném lỗi làm `active` treo vĩnh viễn
 * (toast quay mãi, FE poll mãi). Viết một lần, test một lần (`luotChayNen.test.ts`), hai module
 * dùng chung — thay vì mỗi module chép lại và chỉ một bên được sửa khi phát hiện lỗi.
 *
 * Trạng thái nằm in-memory theo tiến trình BE: BE restart là mất lượt, đúng như bản chất "lượt
 * đang chạy" (tiến trình chết thì cũng chẳng còn gì chạy).
 */

/** Phần trạng thái mà KHO tự quản. Module gọi thêm field riêng của mình vào bên cạnh. */
export interface LuotChayNen {
  /** Đang chạy hay đã kết thúc. KHO tự bật lúc `batDau`, tự tắt lúc `work` xong/lỗi. */
  active: boolean;
  startedAt: number;
  finishedAt?: number;
  /** Câu lỗi khi `work` ném — FE đọc để hiện toast đỏ. */
  error?: string;
}

/** Giữ lượt đã xong bao lâu trước khi dọn — đủ dài để FE (poll 2s) chắc chắn đọc được kết quả,
 * kể cả khi người dùng vừa đóng máy rồi mở lại tab. */
const GIU_LUOT_XONG_MS = 15 * 60 * 1000;

export interface KhoLuotChayNen<T extends LuotChayNen> {
  /** Lượt hiện tại của khóa — `null` nếu khóa này chưa từng chạy lượt nào. */
  doc(key: string): T | null;
  /**
   * Bắt đầu một lượt, chạy `work` ở nền, trả trạng thái NGAY (không đợi `work`).
   *
   * Bấm lại khi đang chạy -> lượt mới THAY lượt cũ: người dùng thường đổi bộ lọc rồi bấm lại, phải
   * chạy theo bộ lọc mới. `work` của lượt cũ nhận `daBiThay() === true` để tự thoát sớm thay vì
   * chạy nốt và dội cổng thuế thêm một lượt vô ích.
   */
  batDau(
    key: string,
    /** Phần trạng thái RIÊNG của module. `active`/`startedAt` do KHO đặt — `Omit` ở đây để kiểu
     * chặn luôn, thay vì mỗi caller tự khai rồi bị `batDau` ghi đè (ba bản khởi tạo chết). */
    khoiTao: () => Omit<T, keyof LuotChayNen>,
    work: (st: T, daBiThay: () => boolean) => Promise<void>,
  ): T;
}

export function taoKhoLuotChayNen<T extends LuotChayNen>(opts: {
  /** Dùng khi `work` ném thứ không phải `Error` (không moi được `.message`). */
  loiMacDinh: string;
  /** Dọn thêm lúc đóng lượt — vd đặt lại `phase` về rỗng. Chỉ chạy khi lượt CHƯA bị thay. */
  khiDong?: (st: T) => void;
  /**
   * Xử lý lỗi của `work` NGAY TRONG kho: ghi log riêng của module, gắn thêm field (vd mã lỗi máy
   * đọc được), và trả câu tiếng Việt để kho gán vào `error`. Trả `void` -> kho tự suy như thường.
   *
   * Có hook này thì caller khỏi phải bọc `work` trong `try/catch` của riêng mình chỉ để chạm vào
   * lỗi trên đường đi — mà bọc như vậy là phải chép lại `loiMacDinh` lần thứ hai, rồi hai bản lệch
   * nhau lúc nào không biết.
   */
  khiLoi?: (err: unknown, st: T) => string | void;
}): KhoLuotChayNen<T> {
  const luot = new Map<string, T>();
  /** "Thế hệ" hiện tại của mỗi khóa — lượt mới bump lên để lượt cũ biết mình đã bị thay. */
  const the = new Map<string, number>();

  /**
   * Dọn lượt ĐÃ XONG sau một lúc. Khóa là `donViId`/`tenantKey` nên Map không tự co lại — để nguyên
   * thì nó phình dần theo số công ty từng chạy, suốt đời tiến trình (cùng lý do `phucHoiHongLuc`
   * bên `gdt-dvc.service.ts` được dọn kèm).
   *
   * Phải HOÃN chứ không xóa ngay: FE đọc chính lượt đã kết thúc để hiện kết quả cuối
   * (`theoDoiDongBoDvc` thoát vòng khi `!active` RỒI mới render), xóa liền là toast mất kết quả.
   */
  const hoanDon = (key: string, gen: number) => {
    const t = setTimeout(() => {
      if (the.get(key) === gen) {
        luot.delete(key);
        the.delete(key);
      }
    }, GIU_LUOT_XONG_MS);
    t.unref();
  };

  return {
    doc(key) {
      return luot.get(key) ?? null;
    },

    batDau(key, khoiTao, work) {
      const gen = (the.get(key) ?? 0) + 1;
      the.set(key, gen);

      const st = { ...khoiTao(), active: true, startedAt: Date.now() } as T;
      luot.set(key, st);

      /** Lượt này đã bị một lượt MỚI thay thế -> không được đụng vào trạng thái chung nữa. */
      const daBiThay = () => the.get(key) !== gen;

      void (async () => {
        try {
          await work(st, daBiThay);
        } catch (err) {
          st.error =
            opts.khiLoi?.(err, st) ||
            (err instanceof Error ? err.message : opts.loiMacDinh);
        } finally {
          // Chỉ đóng nếu vẫn là lượt hiện tại — lượt cũ kết thúc muộn không được đóng lượt mới.
          if (!daBiThay()) {
            st.active = false;
            st.finishedAt = Date.now();
            opts.khiDong?.(st);
            hoanDon(key, gen);
          }
        }
      })();

      return st;
    },
  };
}
