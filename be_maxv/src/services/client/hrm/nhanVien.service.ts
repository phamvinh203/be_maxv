import type { Prisma, PrismaClient } from '../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../helpers/crudGuards';
import { MESSAGES } from '../../../constants/messages';
import type {
  NhanVienBodyInput,
  NhanVienListQuery,
  NhanVienUpdateInput,
} from '../../../validators/hrm/nhanVien.validator';

const nhanVienSelect = {
  ma_nv: true,
  ho_ten: true,
  ngay_sinh: true,
  so_cccd: true,
  mst_ca_nhan: true,
  dien_thoai: true,
  email: true,
  dia_chi: true,
  gioi_tinh: true,
  ma_pb: true,
  chuc_vu: true,
  cap_bac: true,
  so_hop_dong: true,
  loai_hop_dong: true,
  kieu_luong: true,
  ngay_vao_lam: true,
  ngay_hieu_luc_toi: true,
  bhxh: true,
  tncn: true,
  mien_cham_cong: true,
  cong_doan: true,
  so_tai_khoan: true,
  ten_tai_khoan: true,
  ngan_hang: true,
  ghi_chu: true,
  status: true,
} satisfies Prisma.hrm_nhan_vienSelect;

/** Khớp `@db.VarChar(24)` của cột ma_nv. */
const MA_NV_MAX = 24;

/**
 * Sinh mã nhân viên kế tiếp: `NV0001`, `NV0002`…
 *
 * Chuyển từ FE (`hdđt_maxv/src/features/hrm/cay.ts#sinhMaNhanVien`) về đây cùng lý do như mã
 * phòng ban: mã phải do MỘT chỗ cấp, không thì hai máy tạo cùng lúc ra trùng mã.
 * Chỉ quét mã đúng dạng `NV####` — mã người dùng tự đặt (vd "GD-01") không được phép làm lệch
 * bộ đếm.
 *
 * CỐ Ý quét CẢ nhân viên đã xóa mềm (`da_xoa = true`): mã của người đã xóa không được cấp lại
 * cho người khác, nếu không thì bảng lương / chấm công cũ khóa theo `ma_nv` sẽ bị gán sang
 * người mới, im lặng và không cách nào phát hiện về sau.
 */
async function sinhMaNhanVien(db: PrismaClient): Promise<string> {
  const rows = await db.hrm_nhan_vien.findMany({
    where: { ma_nv: { startsWith: 'NV' } },
    select: { ma_nv: true },
  });
  const daDung = new Set(rows.map((r) => r.ma_nv));

  for (let i = 1; i <= 9999; i += 1) {
    const ma = `NV${String(i).padStart(4, '0')}`;
    if (!daDung.has(ma)) return ma;
  }
  // Vượt 9999 nhân viên — hiếm, nhưng không được đứng im: lấy đuôi timestamp làm mã.
  const ma = `NV${Date.now().toString().slice(-6)}`;
  if (ma.length > MA_NV_MAX) {
    throw new ConflictError('Không sinh được mã nhân viên, vui lòng tự nhập mã.');
  }
  return ma;
}

/**
 * Phòng ban phải có thật trước khi gán.
 * `ma_pb` là tham chiếu MỀM (không FK ở DB, xem schema.prisma) nên nếu đây không chặn thì
 * nhân viên sẽ trỏ vào phòng ban không tồn tại và không chỗ nào báo lỗi.
 */
async function assertPhongBanTonTai(
  db: PrismaClient,
  maPb: string,
): Promise<void> {
  await findOrThrow(
    () =>
      db.hrm_phong_ban.findFirst({
        where: { ma_pb: maPb, da_xoa: false },
        select: { ma_pb: true },
      }),
    new NotFoundError(MESSAGES.HRM.PHONG_BAN_NOT_FOUND),
  );
}

/**
 * Hợp đồng dịch vụ (HĐDV) không thuộc diện đóng phí công đoàn — ép `false` bất kể người dùng
 * gửi lên gì, thay vì tin form. Áp ở service để mọi đường ghi (API, import Excel sau này) đều
 * đi qua cùng một luật.
 */
function chuanHoaCongDoan<T extends { loai_hop_dong: string; cong_doan: boolean }>(
  body: T,
): T {
  return body.loai_hop_dong === 'hdvc' ? { ...body, cong_doan: false } : body;
}

/** GET danh sách + lọc, kèm `ten_pb` (thay LEFT JOIN hrm_phong_ban). */
export async function listNhanVien(db: PrismaClient, q: NhanVienListQuery) {
  const and: Prisma.hrm_nhan_vienWhereInput[] = [{ da_xoa: false }];
  if (q.ma_nv) and.push({ ma_nv: { contains: q.ma_nv, mode: 'insensitive' } });
  if (q.ho_ten)
    and.push({ ho_ten: { contains: q.ho_ten, mode: 'insensitive' } });
  if (q.ma_pb) and.push({ ma_pb: q.ma_pb });
  if (q.status) and.push({ status: q.status });

  const [rows, phongBan, demNpt] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: { AND: and },
      select: nhanVienSelect,
      orderBy: { ma_nv: 'asc' },
    }),
    db.hrm_phong_ban.findMany({
      where: { da_xoa: false },
      select: { ma_pb: true, ten_pb: true },
    }),
    db.hrm_nguoi_phu_thuoc.groupBy({ by: ['ma_nv'], _count: { _all: true } }),
  ]);

  const tenPbTheoMa = new Map(phongBan.map((pb) => [pb.ma_pb, pb.ten_pb]));
  const soNptTheoMa = new Map(demNpt.map((g) => [g.ma_nv, g._count._all]));

  return rows.map((r) => ({
    ...r,
    ten_pb: r.ma_pb ? (tenPbTheoMa.get(r.ma_pb) ?? null) : null,
    so_npt: soNptTheoMa.get(r.ma_nv) ?? 0,
  }));
}

/** GET 1 nhân viên — màn chi tiết/sửa cần đủ trường, không lấy lại từ danh sách. */
export async function getNhanVien(db: PrismaClient, maNv: string) {
  return findOrThrow(
    () =>
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
        select: nhanVienSelect,
      }),
    new NotFoundError(MESSAGES.HRM.NHAN_VIEN_NOT_FOUND),
  );
}

/** POST tạo mới. Bỏ trống `ma_nv` thì sinh tự động. */
export async function createNhanVien(
  db: PrismaClient,
  body: NhanVienBodyInput,
) {
  if (body.ma_pb) await assertPhongBanTonTai(db, body.ma_pb);

  const maNv = body.ma_nv ?? (await sinhMaNhanVien(db));

  await assertNotExists(
    () =>
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
        select: { ma_nv: true },
      }),
    new ConflictError(`Mã nhân viên "${maNv}" đã tồn tại`),
  );

  const { ma_nv: _bo, ...phanConLai } = chuanHoaCongDoan(body);
  await db.hrm_nhan_vien.create({ data: { ...phanConLai, ma_nv: maNv } });
  return { ma_nv: maNv };
}

/** PUT cập nhật (không đổi khóa — xem ghi chú ở nhanVienUpdateSchema). */
export async function updateNhanVien(
  db: PrismaClient,
  maNv: string,
  body: NhanVienUpdateInput,
) {
  await findOrThrow(
    () =>
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
        select: { ma_nv: true },
      }),
    new NotFoundError(MESSAGES.HRM.NHAN_VIEN_NOT_FOUND),
  );
  if (body.ma_pb) await assertPhongBanTonTai(db, body.ma_pb);

  await db.hrm_nhan_vien.update({
    where: { ma_nv: maNv },
    data: { ...chuanHoaCongDoan(body), datetime2: new Date() },
  });
  return { ma_nv: maNv };
}

/**
 * DELETE — XÓA MỀM (đặt `da_xoa = true`), không xóa dòng.
 * Giữ dòng lại để `ma_nv` không bao giờ được cấp lại; xem ghi chú ở `sinhMaNhanVien`.
 *
 * Người phụ thuộc KHÔNG bị xóa theo nữa (cascade chỉ chạy khi xóa cứng) — chúng bị ẩn cùng
 * nhân viên vì mọi truy vấn NPT đều lọc theo nhân viên chưa xóa. Vẫn trả số lượng để màn hình
 * nói được "ẩn kèm N người phụ thuộc" thay vì âm thầm.
 */
export async function deleteNhanVien(db: PrismaClient, maNv: string) {
  await findOrThrow(
    () =>
      db.hrm_nhan_vien.findFirst({
        where: { ma_nv: maNv, da_xoa: false },
        select: { ma_nv: true },
      }),
    new NotFoundError(MESSAGES.HRM.NHAN_VIEN_NOT_FOUND),
  );

  const soNpt = await db.hrm_nguoi_phu_thuoc.count({ where: { ma_nv: maNv } });
  await db.hrm_nhan_vien.update({
    where: { ma_nv: maNv },
    data: { da_xoa: true, datetime2: new Date() },
  });
  return { ma_nv: maNv, so_npt_an_theo: soNpt };
}
