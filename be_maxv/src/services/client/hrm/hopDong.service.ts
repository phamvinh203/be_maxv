import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../helpers/errors';
import { findOrThrow } from '../../../helpers/crudGuards';
import { MESSAGES } from '../../../constants/messages';
import type {
  DoiHopDongBodyInput,
  HopDongBodyInput,
  HopDongListQuery,
  HopDongUpdateInput,
} from '../../../validators/hrm/hopDong.validator';

const hopDongSelect = {
  id: true,
  ma_nv: true,
  so_hd: true,
  loai_hd: true,
  kieu_luong: true,
  luong_chinh: true,
  luong_bhxh: true,
  ngay_bat_dau: true,
  ngay_ket_thuc: true,
  trich_bhxh: true,
  tinh_tncn: true,
  ghi_chu: true,
} satisfies Prisma.hrm_hop_dongSelect;

/** Prisma trong transaction — mọi hàm dưới đây nhận được cả client thường lẫn tx. */
type Db = PrismaClient | Prisma.TransactionClient;

/** Nhân viên phải có thật và chưa bị xóa mềm. */
async function assertNhanVienTonTai(db: Db, maNv: string): Promise<void> {
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
 * Loại hợp đồng của lịch sử (5 giá trị FE) -> bản sao trên nhân viên (3 giá trị theo spec).
 * Chỉ dùng cho bản sao; lịch sử vẫn giữ nguyên giá trị gốc.
 */
function loaiHdVeNhanVien(loaiHd: string): string {
  if (loaiHd === 'thu_viec') return 'thu_viec';
  if (loaiHd === 'khoan') return 'hdvc';
  return 'hdld'; // khong_xac_dinh | xac_dinh | thoi_vu và mọi giá trị lạ khác
}

/**
 * ĐỒNG BỘ bản sao "hợp đồng hiện hành" từ `hrm_hop_dong` xuống `hrm_nhan_vien`.
 *
 * BẮT BUỘC gọi ở cuối MỌI đường ghi hợp đồng (tạo / sửa / xóa / đổi), trong cùng transaction.
 * Gom vào một hàm duy nhất vì đây chính là rủi ro của mô hình hai nơi cùng lưu: sót một nhánh
 * là bảng nhân viên nói một đằng, tab lịch sử nói một nẻo, và không có gì báo lỗi.
 *
 * Luật chọn hợp đồng hiện hành (chuyển nguyên từ FE `cay.ts#hopDongHienHanh`):
 *   - đang hiệu lực = đã bắt đầu và chưa hết hạn (không có ngày kết thúc = còn hiệu lực);
 *   - nhiều cái cùng khớp thì lấy cái bắt đầu MUỘN NHẤT;
 *   - không cái nào đang hiệu lực thì lấy hợp đồng mới nhất trong lịch sử — nhân viên vừa hết
 *     hạn hợp đồng cũ mà chưa ký cái mới vẫn phải thấy thông tin gần nhất.
 *
 * KHÔNG đụng `ngay_vao_lam`: đó là ngày vào làm ĐẦU TIÊN của nhân viên (dùng tính thâm niên,
 * phép năm), không đổi khi ký hợp đồng mới.
 * Nhân viên chưa có hợp đồng nào thì GIỮ NGUYÊN bản sao đang có — mấy cột đó NOT NULL và là
 * dữ liệu người dùng đã nhập ở form nhân viên, xóa đi không giúp gì.
 */
async function dongBoHopDongHienHanh(db: Db, maNv: string): Promise<void> {
  const ds = await db.hrm_hop_dong.findMany({
    where: { ma_nv: maNv },
    select: hopDongSelect,
    orderBy: { ngay_bat_dau: 'desc' },
  });
  if (ds.length === 0) return;

  const homNay = new Date();
  homNay.setUTCHours(0, 0, 0, 0);

  const dangHieuLuc = ds.find(
    (hd) =>
      hd.ngay_bat_dau <= homNay &&
      (!hd.ngay_ket_thuc || hd.ngay_ket_thuc >= homNay),
  );
  const hienHanh = dangHieuLuc ?? ds[0];

  await db.hrm_nhan_vien.update({
    where: { ma_nv: maNv },
    data: {
      so_hop_dong: hienHanh.so_hd,
      loai_hop_dong: loaiHdVeNhanVien(hienHanh.loai_hd),
      kieu_luong: hienHanh.kieu_luong,
      ngay_hieu_luc_toi: hienHanh.ngay_ket_thuc,
      bhxh: hienHanh.trich_bhxh,
      tncn: hienHanh.tinh_tncn,
      // HĐDV/khoán không đóng phí công đoàn — cùng luật với `chuanHoaCongDoan` bên nhân viên,
      // áp lại ở đây vì đổi loại hợp đồng cũng phải kéo theo cờ này.
      //
      // MỘT CHIỀU, cố ý: chuyển sang khoán thì tắt, nhưng rời khỏi khoán KHÔNG tự bật lại.
      // Tham gia công đoàn là lựa chọn của người lao động, không suy ra được từ loại hợp đồng
      // — tự bật lại là mình bịa một quyết định thay họ. Kế toán tự tích lại ở form nhân viên.
      ...(loaiHdVeNhanVien(hienHanh.loai_hd) === 'hdvc'
        ? { cong_doan: false }
        : {}),
      datetime2: new Date(),
    },
  });
}

/** GET lịch sử hợp đồng, mới nhất lên đầu. */
export async function listHopDong(db: PrismaClient, q: HopDongListQuery) {
  // Ẩn hợp đồng của nhân viên đã xóa mềm (cascade chỉ chạy khi xóa cứng).
  const and: Prisma.hrm_hop_dongWhereInput[] = [
    { nhan_vien: { da_xoa: false } },
  ];
  if (q.ma_nv) and.push({ ma_nv: q.ma_nv });

  return db.hrm_hop_dong.findMany({
    where: { AND: and },
    select: hopDongSelect,
    orderBy: [{ ma_nv: 'asc' }, { ngay_bat_dau: 'desc' }],
  });
}

/** POST tạo mới 1 hợp đồng. */
export async function createHopDong(db: PrismaClient, body: HopDongBodyInput) {
  const id = randomUUID();
  await db.$transaction(async (tx) => {
    await assertNhanVienTonTai(tx, body.ma_nv);
    await tx.hrm_hop_dong.create({ data: { ...body, id } });
    await dongBoHopDongHienHanh(tx, body.ma_nv);
  });
  return { id };
}

/** PUT cập nhật (không đổi `ma_nv`). */
export async function updateHopDong(
  db: PrismaClient,
  id: string,
  body: HopDongUpdateInput,
) {
  await db.$transaction(async (tx) => {
    const hienTai = await findOrThrow(
      () =>
        tx.hrm_hop_dong.findFirst({
          where: { id, nhan_vien: { da_xoa: false } },
          select: { id: true, ma_nv: true },
        }),
      new NotFoundError(MESSAGES.HRM.HOP_DONG_NOT_FOUND),
    );

    await tx.hrm_hop_dong.update({
      where: { id },
      data: { ...body, datetime2: new Date() },
    });
    await dongBoHopDongHienHanh(tx, hienTai.ma_nv);
  });
  return { id };
}

/**
 * POST đổi hợp đồng: chốt hợp đồng đang hiệu lực vào `ngay_chot` rồi ký hợp đồng mới.
 * Hai việc trong một transaction — chốt xong mà tạo mới hỏng thì nhân viên mất hợp đồng.
 */
export async function doiHopDong(db: PrismaClient, body: DoiHopDongBodyInput) {
  const { ngay_chot: ngayChot, ...hopDongMoi } = body;
  const id = randomUUID();

  await db.$transaction(async (tx) => {
    await assertNhanVienTonTai(tx, body.ma_nv);

    // Hợp đồng cần chốt = cái đang hiệu lực hôm nay (chưa có ngày kết thúc, hoặc còn hạn).
    const homNay = new Date();
    homNay.setUTCHours(0, 0, 0, 0);
    const cu = await tx.hrm_hop_dong.findFirst({
      where: {
        ma_nv: body.ma_nv,
        ngay_bat_dau: { lte: homNay },
        OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: homNay } }],
      },
      orderBy: { ngay_bat_dau: 'desc' },
      select: { id: true, ngay_bat_dau: true },
    });

    if (cu) {
      if (!ngayChot) {
        throw new ConflictError(
          'Nhân viên đang có hợp đồng hiệu lực — phải chọn ngày chốt hợp đồng cũ.',
        );
      }
      if (ngayChot < cu.ngay_bat_dau) {
        throw new ConflictError(
          'Ngày chốt không được trước ngày bắt đầu của hợp đồng đang hiệu lực.',
        );
      }
      await tx.hrm_hop_dong.update({
        where: { id: cu.id },
        data: { ngay_ket_thuc: ngayChot, datetime2: new Date() },
      });
    }

    await tx.hrm_hop_dong.create({ data: { ...hopDongMoi, id } });
    await dongBoHopDongHienHanh(tx, body.ma_nv);
  });

  return { id, da_chot_hop_dong_cu: Boolean(ngayChot) };
}

/** DELETE — xóa cứng (khóa chính là uuid, không có chuyện cấp lại mã). */
export async function deleteHopDong(db: PrismaClient, id: string) {
  await db.$transaction(async (tx) => {
    const hienTai = await findOrThrow(
      () =>
        tx.hrm_hop_dong.findFirst({
          where: { id, nhan_vien: { da_xoa: false } },
          select: { id: true, ma_nv: true },
        }),
      new NotFoundError(MESSAGES.HRM.HOP_DONG_NOT_FOUND),
    );

    await tx.hrm_hop_dong.delete({ where: { id } });
    await dongBoHopDongHienHanh(tx, hienTai.ma_nv);
  });
  return { id };
}
