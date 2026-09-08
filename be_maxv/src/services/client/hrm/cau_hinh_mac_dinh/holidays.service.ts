import { randomUUID } from 'crypto';
import { Prisma, type PrismaClient } from '../../../../generated/tenant';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../helpers/errors';
import { findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import {
  layDanhSach11NgayLeChuan,
  type StandardHolidayTemplate,
} from '../../../../utils/cau_hinh_mac_dinh/vietnamHolidays.util';
import { homNayVN } from '../du_lieu_ca_nhan/hopDong.service';
import type {
  CreateHolidayInput,
  HolidayListQuery,
  UpdateHolidayInput,
} from '../../../../validators/hrm/cau_hinh_mac_dinh/holidays.validator';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * NĂM HIỆN TẠI THEO GIỜ VIỆT NAM (`BE-07`).
 *
 * KHÔNG dùng `new Date().getFullYear()`: cái đó lấy năm theo múi giờ của TIẾN TRÌNH máy chủ. Máy
 * chủ chạy UTC thì trong khoảng 00:00–06:59 giờ VN ngày 01/01, lịch UTC vẫn ở NĂM CŨ — người dùng
 * bấm "Tạo nhanh" đầu năm sẽ sinh nhầm lịch của năm trước, và bộ lọc `filter=THIS_YEAR` cũng lọc
 * theo năm cũ. Trên máy chủ đặt múi giờ VN thì hai cách trùng nhau, nhưng đó là phụ thuộc cấu hình
 * môi trường chứ không phải bảo đảm của mã. Dùng chung `homNayVN()` với `hopDong.service.ts` để cả
 * module nói cùng một mốc.
 *
 * Dùng ở HAI chỗ: `listHolidays` (khi không gửi `year`) và `quickGenerateHolidays` (mặc định năm).
 */
export function namHienTaiVN(): number {
  return homNayVN().getUTCFullYear();
}

/**
 * Khóa "ngày trọn vẹn" `YYYY-MM-DD` của một cột `@db.Date`.
 *
 * Cột `Holiday.date` là `@db.Date`; Prisma trả về `Date` đặt tại **nửa đêm UTC**, và mọi đường
 * ghi trong hệ (validator `ngayLeDate`, `quickGenerateHolidays`) đều dựng bằng
 * `new Date(\`${YYYY-MM-DD}T00:00:00.000Z\`)`. Vì vậy đọc bằng `getUTC*` là đọc đúng ngày người
 * dùng nhập, KHÔNG phụ thuộc múi giờ tiến trình. Dùng `getMonth()/getDate()` (giờ địa phương) sẽ
 * lệch một ngày trên mọi máy chủ đặt múi giờ âm so với UTC.
 */
function khoaNgay(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Khóa "ngày/tháng, BỎ NĂM" (`MM-DD`) — dùng cho quy tắc phủ của dòng lặp hàng năm.
 * Cùng lý do dùng `getUTC*` như `khoaNgay` ở trên.
 */
function khoaNgayThang(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Tạo ngày lễ đơn lẻ (POST /holidays)
 */
export async function createHoliday(db: Db, data: CreateHolidayInput) {
  if (data.type === 'LUNAR' && data.isAnnual === true) {
    throw new BadRequestError(MESSAGES.HRM.LE_AM_LICH_KHONG_THE_LAP_LAI);
  }

  try {
    return await db.holiday.create({
      data: {
        id: randomUUID(),
        date: data.date,
        name: data.name.trim(),
        type: data.type ?? 'NATIONAL',
        isAnnual: data.isAnnual ?? true,
        isPaid: data.isPaid ?? true,
        note: data.note ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(MESSAGES.HRM.NGAY_LE_TRUNG_LAP);
    }
    throw err;
  }
}

/**
 * Danh sách ngày lễ kèm bộ lọc (GET /holidays)
 */
export async function listHolidays(db: Db, query: HolidayListQuery) {
  const where: Prisma.HolidayWhereInput = {};

  if (query.type) {
    where.type = query.type;
  }

  if (query.isPaid !== undefined) {
    where.isPaid = query.isPaid;
  }

  if (query.filter === 'ANNUAL') {
    where.isAnnual = true;
  } else if (query.filter === 'THIS_YEAR' || query.year !== undefined) {
    const targetYear = query.year ?? namHienTaiVN();
    const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999Z`);

    where.OR = [
      { date: { gte: startOfYear, lte: endOfYear } },
      { isAnnual: true },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;

  const [items, total] = await Promise.all([
    db.holiday.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy]: query.sortOrder },
    }),
    db.holiday.count({ where }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize) || 1,
  };
}

/**
 * Chi tiết một ngày lễ (GET /holidays/:id)
 */
export async function getHolidayDetail(db: Db, id: string) {
  return findOrThrow(
    () => db.holiday.findUnique({ where: { id } }),
    new NotFoundError(MESSAGES.HRM.HOLIDAY_NOT_FOUND),
  );
}

/**
 * Cập nhật thông tin ngày lễ (PATCH /holidays/:id)
 */
export async function updateHoliday(db: Db, id: string, data: UpdateHolidayInput) {
  const existing = await findOrThrow(
    () => db.holiday.findUnique({ where: { id } }),
    new NotFoundError(MESSAGES.HRM.HOLIDAY_NOT_FOUND),
  );

  const date = data.date ?? existing.date;
  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const type = data.type ?? existing.type;
  const isAnnual = data.isAnnual !== undefined ? data.isAnnual : existing.isAnnual;
  const isPaid = data.isPaid !== undefined ? data.isPaid : existing.isPaid;
  const note = data.note !== undefined ? data.note : existing.note;

  if ((type === 'LUNAR' || type === 'COMPENSATORY') && isAnnual === true) {
    throw new BadRequestError(MESSAGES.HRM.LE_AM_LICH_KHONG_THE_LAP_LAI);
  }

  try {
    return await db.holiday.update({
      where: { id },
      data: {
        date,
        name,
        type,
        isAnnual,
        isPaid,
        note,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(MESSAGES.HRM.NGAY_LE_TRUNG_LAP);
    }
    throw err;
  }
}

/**
 * Xóa một ngày lễ (DELETE /holidays/:id)
 */
export async function deleteHoliday(db: Db, id: string) {
  await findOrThrow(
    () => db.holiday.findUnique({ where: { id } }),
    new NotFoundError(MESSAGES.HRM.HOLIDAY_NOT_FOUND),
  );

  await db.holiday.delete({
    where: { id },
  });

  return {
    id,
    message: 'Xóa ngày lễ thành công',
  };
}

/**
 * Tạo nhanh 11 ngày nghỉ lễ chuẩn Việt Nam cho năm chỉ định (Idempotent - skipDuplicates)
 * POST /holidays/quick-generate
 *
 * `dryRun = true` → CHẠY THỬ: không ghi dòng nào, `addedCount`/`skippedCount` là DỰ BÁO.
 * `dryRun` vắng mặt hoặc `false` → ghi thật, hành vi y hệt trước khi có tham số này.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ CHẾ ĐỘ CHẠY THỬ (đừng gỡ đi cho "gọn")
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * Hộp thoại "Tạo nhanh lịch nghỉ lễ" ở giao diện từng TỰ TÍNH bản xem trước bằng một bảng tra
 * âm lịch chép tay riêng. Hai nguồn, hai kết quả: xem trước hiện cụm Tết 2026 là 16–20/02 trong
 * khi máy chủ ghi 15–19/02 — người dùng thấy một đằng, hệ thống lưu một nẻo. Cùng cấu tạo hai
 * nguồn đó còn đẻ ra lỗi Tết 2030, và vì CẢ HAI bảng cùng sai nên đối chiếu chéo BE↔FE không
 * bắt được.
 *
 * Chế độ này để giao diện HỎI THẲNG máy chủ thay vì tự tính. Bản xem trước khi đó bằng đúng thứ
 * sẽ được lưu **theo cấu tạo** (cùng một mảng `templates`, cùng một phép ánh xạ `items`), không
 * còn dựa vào việc hai bên "tình cờ cùng đúng". Xem thêm cảnh báo ở đầu `vietnamHolidays.util.ts`:
 * tuyệt đối không khôi phục bảng tra tay ở bất kỳ tầng nào, kể cả phía giao diện để xem trước.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * HAI QUY TẮC BỎ QUA — CỘNG DỒN, KHÔNG THAY THẾ NHAU (`BUG-HRM-51`)
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * (1) **Trùng cặp `(date, name)`** — đúng khóa `@@unique([date, name])` của bảng. Quy tắc cũ,
 *     giữ nguyên.
 * (2) **Đã được một dòng lặp-hàng-năm phủ** — tenant đã có dòng thỏa CẢ BA: cùng `name`, cùng
 *     **ngày/tháng** (bất kể năm), và dòng đó mang `isAnnual = true`.
 *
 * Vì sao phải có (2): tenant "Tạo nhanh" năm 2026 rồi năm 2027 thì `01/01 Tết Dương lịch` được
 * ghi **hai lần** — `2026-01-01` và `2027-01-01`, cả hai đều `isAnnual = true`. Khóa duy nhất
 * không chặn (khác `date`), nên `skippedCount` báo "0 đã có": **đúng ở mức dòng, sai ở mức nghiệp
 * vụ** — một ngày lễ đã bật cờ lặp hàng năm thì tự nó phủ mọi năm. Chạy tiếp 2028–2030 để lại tới
 * 20 dòng thừa cho 5 ngày lễ dương lịch, và bộ tính lương đếm theo dòng sẽ tính một ngày lễ nhiều
 * lần.
 *
 * ⚠️ Quy tắc (2) CHỈ áp cho mục chuẩn có `isAnnual === true` (5 ngày dương lịch cố định). Sáu
 * ngày **âm lịch** mang `isAnnual = false` vì ngày dương của chúng đổi mỗi năm — mỗi năm bắt
 * buộc phải có dòng riêng. Bỏ điều kiện này đi thì một dòng bị gán nhầm `isAnnual = true` (chỉ
 * ghi thẳng DB mới tạo được, `E-hrm-075` chặn mọi đường API) sẽ **nuốt mất** ngày Tết của năm sau
 * mà không ai thấy. Đây là chỗ dễ sửa hỏng nhất của cả hàm.
 *
 * Dòng cũ mang `isAnnual = false` KHÔNG phủ năm nào khác ngoài chính năm của nó.
 */
export async function quickGenerateHolidays(db: Db, year?: number, dryRun?: boolean) {
  const targetYear = year ?? namHienTaiVN();

  /*
   * LỚP CHẶN THỨ HAI của dải năm 2024–2030 (lớp thứ nhất là Zod ở `holidays.validator.ts`). Lớp
   * này canh mọi đường gọi KHÔNG đi qua validator — script, job nền, và mọi hàm nội bộ gọi thẳng
   * service. Nó còn bắt trường hợp KHÔNG gửi `year`: Zod cho `undefined` đi qua, năm thật mới
   * được suy ra ở dòng trên, nên chỉ ở đây mới kiểm được nó.
   *
   * Áp cho CẢ HAI chế độ: chạy thử một năm ngoài dải cũng là câu hỏi vô nghĩa, và nếu chỉ chặn ở
   * đường ghi thì giao diện sẽ vẽ ra một bản xem trước không bao giờ lưu được.
   */
  if (targetYear < 2024 || targetYear > 2030) {
    throw new BadRequestError(MESSAGES.HRM.NAM_KHOI_TAO_LE_INVALID);
  }

  const templates: StandardHolidayTemplate[] = layDanhSach11NgayLeChuan(targetYear);

  /*
   * Dựng SẴN đúng mảng sẽ ghi, TRƯỚC khi rẽ nhánh. Nhờ vậy chế độ chạy thử đối chiếu trùng lặp
   * bằng chính cặp `(date, name)` mà đường ghi sẽ dùng — không có cơ hội cho hai nhánh tính lệch
   * nhau. Đây là lý do tồn tại của cả thay đổi này, đừng tách thành hai phép dựng riêng.
   */
  const duLieuGhi = templates.map((t) => ({
    id: randomUUID(),
    date: new Date(`${t.date}T00:00:00.000Z`),
    name: t.name,
    type: t.type,
    isAnnual: t.isAnnual,
    isPaid: t.isPaid,
    note: t.note ?? null,
  }));

  /*
   * MỘT TRUY VẤN ĐỌC DUY NHẤT, DÙNG CHUNG CHO CẢ HAI CHẾ ĐỘ.
   *
   * Lọc theo `name IN (11 tên chuẩn)` chứ không nạp cả bảng: cả hai quy tắc bỏ qua đều đòi trùng
   * `name`, nên dòng mang tên khác không thể ảnh hưởng kết quả. Bảng ngày lễ mỗi tenant chỉ vài
   * chục dòng, và kết quả ở đây nhiều nhất là 11 tên × số năm đã tạo.
   *
   * Cả hai chế độ đi CHUNG phép đọc và CHUNG phép quyết định — đó là tính chất `ADR-010` sinh ra
   * để có. Tách thành hai nhánh tính riêng là dựng lại đúng cấu trúc hai-nguồn đã đẻ ra lỗi xem
   * trước Tết 2026.
   */
  const tenChuan = [...new Set(duLieuGhi.map((r) => r.name))];
  const dongCungTen = await db.holiday.findMany({
    where: { name: { in: tenChuan } },
    select: { date: true, name: true, isAnnual: true },
  });

  const capDaCo = new Set<string>(); // "YYYY-MM-DD|tên" — quy tắc (1)
  const capLapHangNam = new Set<string>(); // "MM-DD|tên" — quy tắc (2), chỉ dòng isAnnual = true
  for (const d of dongCungTen) {
    capDaCo.add(`${khoaNgay(d.date)}|${d.name}`);
    if (d.isAnnual === true) {
      capLapHangNam.add(`${khoaNgayThang(d.date)}|${d.name}`);
    }
  }

  /** `daPhu[i]` — mục chuẩn thứ `i` SẼ KHÔNG được tạo. Cùng thứ tự với `templates`/`duLieuGhi`. */
  const daPhu = duLieuGhi.map((r) => {
    // (1) Trùng trọn cặp (date, name) — đúng thứ `ON CONFLICT DO NOTHING` sẽ bỏ qua.
    if (capDaCo.has(`${khoaNgay(r.date)}|${r.name}`)) {
      return true;
    }
    // (2) Chỉ mục chuẩn LẶP HÀNG NĂM mới có thể được dòng lặp-hàng-năm cũ phủ. Lễ âm lịch
    //     (`isAnnual = false`) luôn cần dòng riêng cho từng năm — xem cảnh báo ở khối chú thích
    //     đầu hàm, đây là dòng canh giữ nó.
    if (r.isAnnual !== true) {
      return false;
    }
    return capLapHangNam.has(`${khoaNgayThang(r.date)}|${r.name}`);
  });

  const duLieuCanGhi = duLieuGhi.filter((_, i) => !daPhu[i]);

  if (dryRun !== true) {
    /*
     * ĐƯỜNG GHI — MỘT câu lệnh ghi, KHÔNG bọc `$transaction` (giữ nguyên bản vá `N2`).
     *
     * Bản trước `N2` đếm → chèn → đếm rồi lấy hiệu, bọc `$transaction` kèm chú thích nói giao dịch
     * chống được đua đếm. Chú thích đó SAI: PostgreSQL mặc định READ COMMITTED, mỗi câu lệnh trong
     * giao dịch lấy một ảnh chụp MỚI, nên bản ghi người khác commit xen giữa hai lần đếm vẫn lọt
     * vào lần đếm sau. Muốn hiệu số đó đúng phải REPEATABLE READ trở lên — cái giá không đáng.
     *
     * `skipDuplicates: true` (`INSERT ... ON CONFLICT DO NOTHING`) vẫn giữ, và vẫn cần: nó là tấm
     * chắn duy nhất chống lỗi trùng khóa khi hai người bấm "Tạo nhanh" cùng lúc — nếu không, người
     * thua cuộc đua nhận **500** thay vì một báo cáo.
     */
    await db.holiday.createMany({
      data: duLieuCanGhi,
      skipDuplicates: true,
    });
  }

  /*
   * ═══════════════════════════════════════════════════════════════════════════════════════════
   * CON SỐ NÀO LẤY TỪ ĐÂU — ĐỌC KỸ TRƯỚC KHI SỬA
   * ═══════════════════════════════════════════════════════════════════════════════════════════
   * `addedCount` = **số mục chuẩn được lên kế hoạch tạo** = `duLieuCanGhi.length`
   *              = số phần tử `items[]` có `alreadyCovered === false`.
   * `skippedCount` = phần bù = số phần tử có `alreadyCovered === true`.
   *
   * Bất biến `count(alreadyCovered === false) === addedCount` giữ đúng ở CẢ hai chế độ **theo cấu
   * tạo** (cùng một mảng `daPhu` sinh ra cả hai). Giao diện vẽ danh sách 11 dòng kèm nhãn "đã có"
   * và một câu tóm tắt "sẽ thêm N"; hai thứ đó lệch nhau là lỗi người dùng NHÌN THẤY.
   *
   * ❗ `addedCount` KHÔNG còn lấy từ `createMany().count` như bản `N2`. Lý do: nay chỉ phần **chưa
   * được phủ** mới được gửi đi, nên `count` trả về bằng đúng `duLieuCanGhi.length` trong mọi
   * trường hợp thường; nó CHỈ nhỏ hơn khi có người chèn đúng cặp `(date, name)` đó xen vào giữa
   * lúc đọc và lúc ghi. Trong tình huống đua hiếm hoi ấy, dòng vẫn tồn tại sau thao tác (người kia
   * chèn), chỉ là "không phải do request này chèn" — chênh lệch vô hình với người dùng. Đổi lại,
   * nếu lấy `count` làm `addedCount` thì đúng lúc đó bất biến trên vỡ và giao diện hiện số lệch
   * danh sách. Chọn giữ bất biến; đây là quyết định có chủ đích, không phải sơ suất.
   *
   * `dryRun` vẫn là **DỰ BÁO**: người khác chèn/xóa xen giữa lúc xem trước và lúc bấm tạo thì kết
   * quả thật sẽ lệch. Bản chất của mọi phép xem trước, không sửa được bằng giao dịch vì hai lời
   * gọi HTTP nằm ở hai giao dịch khác nhau.
   */
  const addedCount = duLieuCanGhi.length;
  const skippedCount = templates.length - addedCount;

  return {
    year: targetYear,
    totalStandard: templates.length,
    addedCount,
    skippedCount,
    items: templates.map((t, i) => ({
      date: t.date,
      name: t.name,
      type: t.type,
      isAnnual: t.isAnnual,
      isPaid: t.isPaid,
      /** `true` = sẽ KHÔNG được tạo (trúng quy tắc (1) hoặc (2)); `false` = sẽ được tạo. */
      alreadyCovered: daPhu[i],
    })),
  };
}
