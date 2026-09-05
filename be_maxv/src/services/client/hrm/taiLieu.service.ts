import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '../../../generated/tenant';
import { NotFoundError } from '../../../helpers/errors';
import { findOrThrow } from '../../../helpers/crudGuards';
import { MESSAGES } from '../../../constants/messages';
import type {
  TaiLieuBodyInput,
  TaiLieuListQuery,
  TaiLieuUpdateInput,
} from '../../../validators/hrm/taiLieu.validator';

const taiLieuSelect = {
  id: true,
  ma_nv: true,
  loai: true,
  so_hieu: true,
  ngay_cap: true,
  noi_cap: true,
  ghi_chu: true,
  // Con trỏ file scan trên Drive — trả kèm để bảng hiện được nút xem/gỡ file mà không phải
  // gọi thêm một lượt API cho từng dòng.
  drive_file_id: true,
  ten_file: true,
  mime_type: true,
  kich_thuoc: true,
} satisfies Prisma.hrm_tai_lieuSelect;

/**
 * Nhân viên phải có thật VÀ chưa bị xóa mềm.
 * DB có FK cứng nên ghi bừa không lọt, nhưng để Prisma ném P2003 thì client nhận thông điệp
 * kỹ thuật — chặn ở đây để nói đúng chuyện gì sai.
 */
async function assertNhanVienTonTai(
  db: PrismaClient,
  maNv: string,
): Promise<void> {
  await findOrThrow(
    () =>
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
        select: { ma_nv: true },
      }),
    new NotFoundError(MESSAGES.HRM.NHAN_VIEN_NOT_FOUND),
  );
}

/**
 * GET danh sách + lọc, kèm `ten_nv`.
 * Tên nhân viên tra lúc đọc chứ không lưu kèm — nhân viên đổi tên thì danh sách hiện tên mới,
 * không phải đi sửa hai chỗ (cùng cách làm với người phụ thuộc).
 */
export async function listTaiLieu(db: PrismaClient, q: TaiLieuListQuery) {
  // Ẩn tài liệu của nhân viên đã xóa mềm: dòng vẫn nằm trong DB (cascade chỉ chạy khi xóa
  // cứng) nên không lọc ở đây thì hồ sơ đã xóa vẫn hiện trong danh sách chung.
  const and: Prisma.hrm_tai_lieuWhereInput[] = [
    { nhan_vien: { da_xoa: false } },
  ];
  if (q.ma_nv) and.push({ ma_nv: q.ma_nv });
  if (q.loai) and.push({ loai: q.loai });

  const rows = await db.hrm_tai_lieu.findMany({
    where: { AND: and },
    select: taiLieuSelect,
    orderBy: [{ ma_nv: 'asc' }, { loai: 'asc' }],
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
export async function createTaiLieu(db: PrismaClient, body: TaiLieuBodyInput) {
  await assertNhanVienTonTai(db, body.ma_nv);

  const id = randomUUID();
  await db.hrm_tai_lieu.create({ data: { ...body, id } });
  return { id };
}

/** PUT cập nhật (không đổi `ma_nv` — xem ghi chú ở taiLieuUpdateSchema). */
export async function updateTaiLieu(
  db: PrismaClient,
  id: string,
  body: TaiLieuUpdateInput,
) {
  await findOrThrow(
    () =>
      db.hrm_tai_lieu.findFirst({
        where: { id, nhan_vien: { da_xoa: false } },
        select: { id: true },
      }),
    new NotFoundError(MESSAGES.HRM.TAI_LIEU_NOT_FOUND),
  );

  await db.hrm_tai_lieu.update({
    where: { id },
    data: { ...body, datetime2: new Date() },
  });
  return { id };
}

/**
 * DELETE — xóa CỨNG: khóa chính là uuid nên không có chuyện cấp lại mã như `ma_nv`/`ma_pb`,
 * không cần giữ dòng lại (cùng lý do với người phụ thuộc).
 */
export async function deleteTaiLieu(db: PrismaClient, id: string) {
  await findOrThrow(
    () =>
      db.hrm_tai_lieu.findFirst({
        where: { id, nhan_vien: { da_xoa: false } },
        select: { id: true },
      }),
    new NotFoundError(MESSAGES.HRM.TAI_LIEU_NOT_FOUND),
  );

  await db.hrm_tai_lieu.delete({ where: { id } });
  return { id };
}
