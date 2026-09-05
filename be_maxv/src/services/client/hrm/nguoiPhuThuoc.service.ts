import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '../../../generated/tenant';
import { NotFoundError } from '../../../helpers/errors';
import { findOrThrow } from '../../../helpers/crudGuards';
import { MESSAGES } from '../../../constants/messages';
import type {
  NguoiPhuThuocBodyInput,
  NguoiPhuThuocListQuery,
  NguoiPhuThuocUpdateInput,
} from '../../../validators/hrm/nguoiPhuThuoc.validator';

const nptSelect = {
  id: true,
  ma_nv: true,
  ho_ten: true,
  quan_he: true,
  ngay_sinh: true,
  so_cccd: true,
  mst: true,
  dien_thoai: true,
  dia_chi: true,
  dk_tu_thang: true,
  dk_tu_nam: true,
  dk_den_thang: true,
  dk_den_nam: true,
} satisfies Prisma.hrm_nguoi_phu_thuocSelect;

/**
 * Nhân viên phải có thật.
 * DB có FK cứng nên ghi bừa cũng không lọt, nhưng để Prisma ném P2003 thì client nhận 500 kèm
 * thông điệp kỹ thuật — chặn ở đây để trả 404 nói đúng chuyện gì đang sai.
 */
async function assertNhanVienTonTai(
  db: PrismaClient,
  maNv: string,
): Promise<void> {
  await findOrThrow(
    () =>
      db.hrm_nhan_vien.findUnique({
        where: { ma_nv: maNv },
        select: { ma_nv: true },
      }),
    new NotFoundError(MESSAGES.HRM.NHAN_VIEN_NOT_FOUND),
  );
}

/**
 * GET danh sách + lọc, kèm `ten_nv`.
 *
 * Tên nhân viên KHÔNG lưu trong bảng này (xem schema.prisma) mà tra lúc đọc — nhân viên đổi
 * tên thì danh sách người phụ thuộc hiện đúng tên mới, không cần đi sửa hai chỗ.
 */
export async function listNguoiPhuThuoc(
  db: PrismaClient,
  q: NguoiPhuThuocListQuery,
) {
  const and: Prisma.hrm_nguoi_phu_thuocWhereInput[] = [];
  if (q.ma_nv) and.push({ ma_nv: q.ma_nv });
  if (q.ho_ten)
    and.push({ ho_ten: { contains: q.ho_ten, mode: 'insensitive' } });

  const rows = await db.hrm_nguoi_phu_thuoc.findMany({
    where: and.length ? { AND: and } : undefined,
    select: nptSelect,
    orderBy: [{ ma_nv: 'asc' }, { ho_ten: 'asc' }],
  });

  if (rows.length === 0) return [];

  const nhanVien = await db.hrm_nhan_vien.findMany({
    where: { ma_nv: { in: [...new Set(rows.map((r) => r.ma_nv))] } },
    select: { ma_nv: true, ho_ten: true },
  });
  const tenNvTheoMa = new Map(nhanVien.map((nv) => [nv.ma_nv, nv.ho_ten]));

  return rows.map((r) => ({
    ...r,
    ten_nv: tenNvTheoMa.get(r.ma_nv) ?? null,
  }));
}

/** POST tạo mới. */
export async function createNguoiPhuThuoc(
  db: PrismaClient,
  body: NguoiPhuThuocBodyInput,
) {
  await assertNhanVienTonTai(db, body.ma_nv);

  const id = randomUUID();
  await db.hrm_nguoi_phu_thuoc.create({ data: { ...body, id } });
  return { id };
}

/** PUT cập nhật (không đổi `ma_nv` — xem ghi chú ở nguoiPhuThuocUpdateSchema). */
export async function updateNguoiPhuThuoc(
  db: PrismaClient,
  id: string,
  body: NguoiPhuThuocUpdateInput,
) {
  await findOrThrow(
    () =>
      db.hrm_nguoi_phu_thuoc.findUnique({ where: { id }, select: { id: true } }),
    new NotFoundError(MESSAGES.HRM.NGUOI_PHU_THUOC_NOT_FOUND),
  );

  await db.hrm_nguoi_phu_thuoc.update({
    where: { id },
    data: { ...body, datetime2: new Date() },
  });
  return { id };
}

/** DELETE. */
export async function deleteNguoiPhuThuoc(db: PrismaClient, id: string) {
  await findOrThrow(
    () =>
      db.hrm_nguoi_phu_thuoc.findUnique({ where: { id }, select: { id: true } }),
    new NotFoundError(MESSAGES.HRM.NGUOI_PHU_THUOC_NOT_FOUND),
  );

  await db.hrm_nguoi_phu_thuoc.delete({ where: { id } });
  return { id };
}
