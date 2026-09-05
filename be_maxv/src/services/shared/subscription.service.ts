import { sysPrisma } from '../../config/db.sys';
import { MODULE_KEYS } from '../../constants/modules';
import type { SubscriptionPlan } from '../../generated/sys';

/** Cộng `months` tháng vào một mốc thời gian. */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Mốc hết hạn của một thuê bao — **quy tắc DUY NHẤT**, dùng cho cả lúc đăng ký
 * (`createTrialSubscription`), lúc admin đổi gói và lúc admin gia hạn.
 *
 * `chuKyThang = 0` nghĩa là gói KHÔNG hết hạn -> `null`. `goiConHieuLuc` bỏ qua
 * phép so ngày khi `ketThuc` là `null`, nên đó là cách khai "dùng vĩnh viễn".
 *
 * ===== VÌ SAO PHẢI LÀ HÀM DÙNG CHUNG =====
 *
 * Trước đây có HAI quy tắc song song: đăng ký thì lấy `env.trialDays` (30 ngày
 * cứng trong biến môi trường), còn admin đổi gói thì lấy `chuKyThang` của gói.
 * Cùng một gói "Miễn phí" mà tài khoản tự đăng ký chết sau 30 ngày, tài khoản
 * được admin đổi tay lại sống theo chu kỳ gói — không nhìn ra được từ giao diện.
 * Tệ hơn: admin sửa `chuKyThang` trên màn Gói tưởng đã kéo dài thời gian dùng
 * thử, nhưng đường đăng ký không đọc nó nên chẳng có tác dụng gì (đo thật
 * 04/09/2026: gói TRIAL ghi 12 tháng, 7 thuê bao TRIAL vẫn hết hạn từ 27/07).
 *
 * Nên `chuKyThang` của gói là NGUỒN DUY NHẤT: sửa trên UI admin là ăn ngay cho
 * mọi người đăng ký sau đó, không phải deploy lại.
 */
export function tinhKetThuc(chuKyThang: number, tuMoc: Date): Date | null {
  return chuKyThang > 0 ? addMonths(tuMoc, chuKyThang) : null;
}

/**
 * Gia hạn thì cộng tiếp từ ĐÂU: thuê bao còn hạn cộng nối vào `ketThuc` cũ (không
 * ăn mất số ngày khách còn lại), thuê bao đã quá hạn cộng từ bây giờ (không tặng
 * không quãng thời gian họ đã không dùng được).
 */
export function mocGiaHan(ketThucHienTai: Date | null, bayGio: Date): Date {
  if (!ketThucHienTai) return bayGio;
  return ketThucHienTai.getTime() > bayGio.getTime() ? ketThucHienTai : bayGio;
}

/**
 * Hạn MỚI của một thuê bao khi gói của nó đổi `chuKyThang` — hàm THUẦN, test ở
 * `src/__tests__/hanThueBao.test.ts`.
 *
 * Mốc là `batDau` (ngày khách vào gói), không phải bây giờ: sửa gói không được biến một
 * tài khoản đăng ký từ tháng 6 thành mới tinh.
 *
 * ===== CHỈ KÉO DÀI, KHÔNG BAO GIỜ RÚT NGẮN =====
 *
 * `batDau + chuKyThang` là hạn của thuê bao CHƯA gia hạn lần nào. Khách đã gia hạn 3 lần
 * có `ketThuc` xa hơn thế, và áp thẳng công thức là XÉN mất hai tháng họ đã trả tiền —
 * lặng lẽ, không log, không ai biết cho tới lúc khách gọi lên. Nên hạn mới ngắn hơn hạn
 * đang có thì trả `null` = không đụng vào thuê bao đó.
 *
 * `chuKyThang = 0` (gói không hết hạn) luôn được áp: đó là nới rộng tuyệt đối.
 *
 * Trả `null` nghĩa là "để yên", khác hẳn giá trị `ketThuc` bằng `null` nghĩa là "vĩnh viễn"
 * — nên hàm trả về một bọc `{ ketThuc }` thay vì trả thẳng `Date | null`, để hai cái `null`
 * đó không bao giờ lẫn vào nhau.
 */
export function hanMoiKhiDoiGoi(
  sub: { batDau: Date; ketThuc: Date | null },
  chuKyThang: number,
): { ketThuc: Date | null } | null {
  // Gói bỏ hạn -> mọi thuê bao thành vĩnh viễn. Thuê bao vốn đã vĩnh viễn thì khỏi ghi lại.
  if (chuKyThang <= 0) return sub.ketThuc === null ? null : { ketThuc: null };
  // Thuê bao đang vĩnh viễn mà gói lại có chu kỳ -> đặt hạn vào là RÚT NGẮN, không đụng.
  if (sub.ketThuc === null) return null;

  const moi = addMonths(sub.batDau, chuKyThang);
  return moi.getTime() > sub.ketThuc.getTime() ? { ketThuc: moi } : null;
}

/**
 * Module mà gói dùng thử cấp sẵn khi phần mềm TỰ TẠO gói đó (xem `ensureTrialPlan`).
 *
 * Chỉ là giá trị mặc định cho lần tạo đầu tiên — admin bật/tắt lại trên màn Gói lúc
 * nào cũng được, và `ensureTrialPlan` KHÔNG bao giờ ghi đè cấu hình đó.
 */
const MODULE_MAC_DINH_TRIAL: Partial<Record<(typeof MODULE_KEYS)[number], boolean>> = {
  tokhai: true,
  dvc: true,
};

/** Chu kỳ mặc định của gói dùng thử (tháng) khi phần mềm tự tạo gói. */
const CHU_KY_MAC_DINH_TRIAL = 12;

/**
 * Đảm bảo có gói TRIAL trong DB (idempotent).
 * Không cache trong process: chỉ chạy ở path hiếm (đăng ký công ty) và đọc
 * trực tiếp DB để luôn phản ánh cấu hình gói mới nhất (giá, số người tối đa).
 */
async function ensureTrialPlan(): Promise<SubscriptionPlan> {
  return sysPrisma.subscriptionPlan.upsert({
    where: { ma: 'TRIAL' },
    // `update: {}` là CHỦ Ý — gói đã có thì không đụng vào. Admin chỉnh gói trên UI
    // rồi mà lần đăng ký kế tiếp lại ghi đè về mặc định thì cấu hình không bao giờ
    // đứng yên, và không ai lần ra vì sao.
    update: {},
    create: {
      ma: 'TRIAL',
      ten: 'Miễn phí',
      gia: 0,
      chuKyThang: CHU_KY_MAC_DINH_TRIAL,
      soMstToiDa: 3,
      soNguoiToiDa: 3,
      // Gói dùng thử CÓ kèm module — người đăng ký mới phải dùng được ngay thì mới
      // có cái để thử. Trước đây để `{}`: ai đăng ký cũng vào gói này và thấy một
      // thanh menu trống trơn, không thông báo gì, tưởng phần mềm hỏng.
      features: MODULE_MAC_DINH_TRIAL,
    },
  });
}

/**
 * Tạo thuê bao dùng thử cho 1 TÀI KHOẢN (owner) mới + ghi lịch sử.
 * Gọi ngay khi đăng ký tài khoản; thời hạn lấy theo `chuKyThang` của gói TRIAL
 * (xem `tinhKetThuc`) nên admin sửa gói là có hiệu lực ngay với người đăng ký sau đó.
 *
 * IDEMPOTENT: mỗi owner chỉ 1 thuê bao (Subscription.ownerId @unique) — nếu đã
 * có thì trả về luôn, không tạo trùng / không ghi thêm lịch sử. Nhờ vậy lời gọi
 * lưới an toàn ở bước tạo công ty (cho tài khoản cũ) là no-op an toàn.
 */
export async function createTrialSubscription(ownerId: string) {
  const existing = await sysPrisma.subscription.findUnique({
    where: { ownerId },
  });
  if (existing) return existing;

  const plan = await ensureTrialPlan();
  const ketThuc = tinhKetThuc(plan.chuKyThang, new Date());

  // Transaction: tránh để lại subscription không có lịch sử nếu insert lịch sử lỗi
  // (idempotency check ở trên sẽ không bao giờ backfill lịch sử bị thiếu).
  return sysPrisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: { ownerId, planId: plan.id, status: 'TRIALING', ketThuc },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        ownerId,
        planId: plan.id,
        hanhDong: 'CREATE_TRIAL',
        ghiChu: ketThuc
          ? `Tạo gói dùng thử ${plan.chuKyThang} tháng`
          : 'Tạo gói dùng thử không giới hạn thời gian',
      },
    });

    return sub;
  });
}
