import { randomUUID } from 'crypto';
import { Prisma, type PrismaClient } from '../../../../generated/tenant';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../helpers/errors';
import { findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import {
  HRM_CANH_BAO,
  NGUONG_GIO_CA_CANH_BAO,
} from '../../../../constants/hrm/hrmCanhBao';
import type {
  CreateWorkShiftInput,
  UpdateWorkShiftInput,
  WorkShiftListQuery,
} from '../../../../validators/hrm/cau_hinh_mac_dinh/workShifts.validator';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Nhận diện ca qua đêm:
 * Nếu endTime <= startTime (ví dụ 22:00 -> 06:00), ca kéo dài sang ngày hôm sau.
 */
export function tinhCaQuaDem(startTime: string, endTime: string): boolean {
  return endTime <= startTime;
}

/**
 * Tính số giờ công thực tế ròng (đã trừ thời gian nghỉ giữa ca):
 * - Ca ngày (startTime < endTime): ((endTime - startTime in phút) - breakMinutes) / 60
 * - Ca đêm (endTime <= startTime): ((endTime + 1440 - startTime in phút) - breakMinutes) / 60
 * Bắt buộc workingHours > 0, vi phạm ném E-hrm-072.
 */
export function tinhGioCongThucTe(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;

  if (endTotal <= startTotal) {
    endTotal += 24 * 60; // Ca qua đêm
  }

  const netMinutes = endTotal - startTotal - (breakMinutes || 0);
  if (netMinutes <= 0) {
    throw new BadRequestError(MESSAGES.HRM.NGHI_GIUA_CA_HOAC_GIO_CONG_INVALID);
  }

  // Ca dài quá `NGUONG_GIO_CA_CANH_BAO` KHÔNG bị chặn ở đây — nó vẫn hợp lệ (ca trực y tế, an
  // ninh, cứu hộ). Cảnh báo được sinh ở `ganThuocTinhSuyRa`, nơi duy nhất gắn thuộc tính suy ra.
  return Math.round((netMinutes / 60) * 100) / 100;
}

/**
 * Gắn 3 thuộc tính suy ra lúc đọc API (Computed Properties):
 * - `isOvernight`: boolean
 * - `workingHours`: number (giờ)
 * - `warning`: `"CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"` khi `workingHours > 12.0`, ngược lại VẮNG MẶT
 *
 * ĐÂY LÀ NƠI DUY NHẤT sinh ba thuộc tính đó. Vì cả bốn đường đọc — `POST`, `GET` danh sách (từng
 * phần tử `items[]`), `GET /:id`, `PATCH` — đều đi qua hàm này nên chúng xuất hiện đồng nhất,
 * không đường nào lỡ thiếu (ADR-009 Quyết định 4). Đừng tính lại `workingHours > 12` ở tầng nào
 * khác, kể cả Frontend: ngưỡng pháp luật (Điều 105 & 107 BLLĐ 2019) thuộc về Backend, nhân đôi
 * nó ra hai nơi là bảo đảm có ngày hai nơi lệch nhau.
 *
 * Ca `<= 12h` **bỏ hẳn trường** `warning` chứ không trả `null` hay chuỗi rỗng — client dùng
 * `warning?: string` và chỉ cần kiểm tra sự tồn tại.
 */
export function ganThuocTinhSuyRa<T extends { startTime: string; endTime: string; breakMinutes: number }>(
  shift: T,
): T & { isOvernight: boolean; workingHours: number; warning?: string } {
  const isOvernight = tinhCaQuaDem(shift.startTime, shift.endTime);
  const workingHours = tinhGioCongThucTe(shift.startTime, shift.endTime, shift.breakMinutes);

  if (workingHours > NGUONG_GIO_CA_CANH_BAO) {
    return {
      ...shift,
      isOvernight,
      workingHours,
      warning: HRM_CANH_BAO.GIO_LAM_VUOT_TRAN_BLLD,
    };
  }

  return {
    ...shift,
    isOvernight,
    workingHours,
  };
}

/**
 * Thuật toán Gap Scanning tìm mã CA01 đến CA99 còn trống nhỏ nhất:
 * Nếu đã dùng hết 99 ca (CA01..CA99) mà người dùng để trống mã, ném E-hrm-078.
 */
export async function sinhMaCa(db: Db): Promise<string> {
  const existing = await db.workShift.findMany({
    select: { code: true },
  });

  const existingCodes = new Set(existing.map((s) => s.code.toUpperCase()));

  for (let i = 1; i <= 99; i++) {
    const candidate = `CA${String(i).padStart(2, '0')}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  throw new BadRequestError(MESSAGES.HRM.GIOI_HAN_99_CA_TU_SINH);
}

/** Số lượt thử tối đa khi hệ thống tự cấp mã ca và bị người khác chiếm mất — ADR-001. */
const SO_LAN_THU_CAP_MA = 5;

/**
 * Tạo mới ca làm việc (POST /work-shifts)
 *
 * HAI NHÁNH TÁCH BẠCH, đúng khuôn ADR-001 (mã tự sinh và xử lý đồng thời):
 *
 *  • **Người dùng NHẬP mã** — ghi thẳng. Trùng ⇒ 409 `E-hrm-073` nói đích danh mã nào.
 *    KHÔNG thử lại: thử lại ở đây là tự ý đổi mã mà người dùng đã cố ý chọn.
 *
 *  • **Bỏ trống mã (máy chủ cấp)** — `sinhMaCa()` rồi `create()`, đụng khóa duy nhất (`P2002`)
 *    thì SINH LẠI và thử tiếp, tối đa `SO_LAN_THU_CAP_MA` lượt (lượt sau `findMany` đã thấy mã
 *    vừa bị chiếm nên tự nhảy sang số kế tiếp). Không có vòng này thì hai người cùng bấm Lưu sẽ
 *    có một người nhận 409 "mã đã tồn tại" — câu vô nghĩa với người **không hề nhập mã nào**.
 *    Hết lượt ⇒ 409 với câu nói đúng chuyện đang xảy ra.
 *
 * KHÔNG bọc `$transaction` — ADR-001 Quyết định điểm 4 nói rõ lý do, và ở đây còn hai lý do nữa:
 * (1) trong Postgres, một lệnh vỡ ràng buộc làm cả giao dịch vào trạng thái hỏng, nên thử lại
 * *bên trong* cùng một giao dịch là bất khả; (2) `db` ở đây có thể đã là `Prisma.TransactionClient`
 * do tầng gọi truyền xuống — trên kiểu đó không có `$transaction`.
 * (Báo cáo đối soát `BE-04` đề nghị "bọc `$transaction` + retry"; phần `$transaction` mâu thuẫn
 * với chính ADR-001 mà nó viện dẫn, nên chỉ phần retry được thi hành — ghi lại ở đây để lần sau
 * không ai "sửa" ngược lại.)
 */
export async function createWorkShift(db: Db, data: CreateWorkShiftInput) {
  // Thẩm định giờ công thực tế trước khi đụng tới DB (E-hrm-072).
  tinhGioCongThucTe(data.startTime, data.endTime, data.breakMinutes ?? 0);

  const ghi = async (code: string) =>
    ganThuocTinhSuyRa(
      await db.workShift.create({
        data: {
          id: randomUUID(),
          code,
          name: data.name,
          startTime: data.startTime,
          endTime: data.endTime,
          breakMinutes: data.breakMinutes ?? 0,
          status: data.status ?? 'ACTIVE',
        },
      }),
    );

  // Nhánh người dùng tự nhập mã.
  if (data.code) {
    try {
      return await ghi(data.code.toUpperCase());
    } catch (err) {
      if (laTrungKhoa(err)) {
        throw new ConflictError(MESSAGES.HRM.MA_CA_LAM_VIEC_EXISTED);
      }
      throw err;
    }
  }

  // Nhánh máy chủ tự cấp mã — thử lại khi bị chiếm mất.
  for (let lan = 0; lan < SO_LAN_THU_CAP_MA; lan++) {
    try {
      return await ghi(await sinhMaCa(db));
    } catch (err) {
      // Chỉ đụng khóa duy nhất mới thử lại. Mọi mã lỗi khác ném thẳng lên — thử lại mù là biến
      // một lỗi cấu hình thành năm lần thử vô ích.
      if (!laTrungKhoa(err)) throw err;
    }
  }

  throw new ConflictError(MESSAGES.HRM.HE_THONG_BAN_CAP_MA_CA);
}

/** Prisma `P2002` — vỡ ràng buộc duy nhất (ở đây là `hrm_work_shifts.code`). */
function laTrungKhoa(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * Danh sách ca làm việc kèm phân trang, tìm kiếm và lọc (GET /work-shifts)
 */
export async function listWorkShifts(db: Db, query: WorkShiftListQuery) {
  const where: Prisma.WorkShiftWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;

  const [items, total] = await Promise.all([
    db.workShift.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy]: query.sortOrder },
    }),
    db.workShift.count({ where }),
  ]);

  return {
    items: items.map(ganThuocTinhSuyRa),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize) || 1,
  };
}

/**
 * Chi tiết ca làm việc (GET /work-shifts/:id)
 */
export async function getWorkShiftDetail(db: Db, id: string) {
  const shift = await findOrThrow(
    () => db.workShift.findUnique({ where: { id } }),
    new NotFoundError(MESSAGES.HRM.WORK_SHIFT_NOT_FOUND),
  );

  return ganThuocTinhSuyRa(shift);
}

/**
 * Cập nhật ca làm việc (PATCH /work-shifts/:id) — CẤM sửa mã code
 */
export async function updateWorkShift(db: Db, id: string, data: UpdateWorkShiftInput) {
  const existing = await findOrThrow(
    () => db.workShift.findUnique({ where: { id } }),
    new NotFoundError(MESSAGES.HRM.WORK_SHIFT_NOT_FOUND),
  );

  const name = data.name ?? existing.name;
  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  const breakMinutes = data.breakMinutes ?? existing.breakMinutes;
  const status = data.status ?? existing.status;

  // Tính lại giờ công thực tế với dữ liệu sau khi merge
  tinhGioCongThucTe(startTime, endTime, breakMinutes);

  const updated = await db.workShift.update({
    where: { id },
    data: {
      name,
      startTime,
      endTime,
      breakMinutes,
      status,
    },
  });

  return ganThuocTinhSuyRa(updated);
}

/**
 * Xóa ca làm việc (DELETE /work-shifts/:id)
 */
export async function deleteWorkShift(db: Db, id: string) {
  await findOrThrow(
    () => db.workShift.findUnique({ where: { id } }),
    new NotFoundError(MESSAGES.HRM.WORK_SHIFT_NOT_FOUND),
  );

  try {
    await db.workShift.delete({
      where: { id },
    });

    return {
      id,
      message: 'Xóa ca làm việc thành công',
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new ConflictError(MESSAGES.HRM.WORK_SHIFT_IN_USE);
    }
    throw err;
  }
}
