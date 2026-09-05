import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../helpers/crudGuards';
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
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
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
  // Ẩn người phụ thuộc của nhân viên đã xóa mềm: dòng NPT vẫn nằm trong DB (cascade chỉ chạy
  // khi xóa cứng) nên nếu không lọc ở đây thì màn danh sách vẫn liệt kê người của hồ sơ đã xóa.
  const and: Prisma.hrm_nguoi_phu_thuocWhereInput[] = [
    { nhan_vien: { da_xoa: false } },
  ];
  if (q.ma_nv) and.push({ ma_nv: q.ma_nv });
  if (q.ho_ten)
    and.push({ ho_ten: { contains: q.ho_ten, mode: 'insensitive' } });

  const rows = await db.hrm_nguoi_phu_thuoc.findMany({
    where: { AND: and },
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

/**
 * Cùng một nhân viên không được đăng ký hai lần cho cùng một MST người phụ thuộc.
 *
 * DB đã có `@@unique([ma_nv, mst])` chặn cứng, nhưng để Postgres ném ra thì client chỉ nhận
 * được câu chung chung "dữ liệu bị trùng"; kiểm ở đây để nói rõ trùng ai. Ràng buộc DB vẫn
 * cần vì nó là chốt cuối khi hai request vào cùng lúc.
 */
async function assertKhongTrungMst(
  db: PrismaClient,
  maNv: string,
  mst: string | null,
  boQuaId?: string,
): Promise<void> {
  if (!mst) return; // chưa biết MST thì chưa có cơ sở nói là trùng
  await assertNotExists(
    () =>
      db.hrm_nguoi_phu_thuoc.findFirst({
        where: {
          ma_nv: maNv,
          mst,
          ...(boQuaId ? { id: { not: boQuaId } } : {}),
        },
        select: { ho_ten: true },
      }),
    new ConflictError(
      `Nhân viên ${maNv} đã có người phụ thuộc mang MST ${mst} — đăng ký trùng sẽ tính giảm trừ gia cảnh hai lần.`,
    ),
  );
}

/** POST tạo mới. */
export async function createNguoiPhuThuoc(
  db: PrismaClient,
  body: NguoiPhuThuocBodyInput,
) {
  await assertNhanVienTonTai(db, body.ma_nv);
  await assertKhongTrungMst(db, body.ma_nv, body.mst);

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
  const hienTai = await findOrThrow(
    () =>
      db.hrm_nguoi_phu_thuoc.findFirst({
        where: { id, nhan_vien: { da_xoa: false } },
        select: { id: true, ma_nv: true },
      }),
    new NotFoundError(MESSAGES.HRM.NGUOI_PHU_THUOC_NOT_FOUND),
  );
  // Bỏ qua chính dòng đang sửa, không thì sửa tên mà giữ MST cũ cũng bị coi là trùng.
  await assertKhongTrungMst(db, hienTai.ma_nv, body.mst, id);

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
      db.hrm_nguoi_phu_thuoc.findFirst({
        where: { id, nhan_vien: { da_xoa: false } },
        select: { id: true },
      }),
    new NotFoundError(MESSAGES.HRM.NGUOI_PHU_THUOC_NOT_FOUND),
  );

  // NPT xóa CỨNG: khóa chính là uuid, không có chuyện cấp lại mã nên không cần giữ dòng.
  await db.hrm_nguoi_phu_thuoc.delete({ where: { id } });
  return { id };
}
