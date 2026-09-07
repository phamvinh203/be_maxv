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
 * Loại hợp đồng của lịch sử (5 giá trị FE) -> 3 giá trị theo spec nhân viên.
 * Dùng khi TRẢ RA cho màn nhân viên; bảng lịch sử vẫn giữ nguyên giá trị gốc.
 */
export function loaiHdVeNhanVien(loaiHd: string): string {
  if (loaiHd === 'thu_viec') return 'thu_viec';
  if (loaiHd === 'khoan') return 'hdvc';
  return 'hdld'; // khong_xac_dinh | xac_dinh | thoi_vu và mọi giá trị lạ khác
}

/**
 * Mốc "hôm nay" theo giờ VIỆT NAM, dạng nửa đêm UTC để so được với cột `@db.Date`.
 *
 * KHÔNG dùng `new Date()` + `setUTCHours(0)`: cái đó cho ra ngày theo lịch UTC, mà từ 00:00 đến
 * 06:59 giờ Việt Nam thì lịch UTC vẫn đang ở NGÀY HÔM TRƯỚC. Trong 7 tiếng đó máy chủ sẽ coi
 * hợp đồng bắt đầu hôm nay là "chưa tới hạn", còn trình duyệt (tính theo giờ máy người dùng)
 * lại coi là đã hiệu lực — hai màn hình nói khác nhau, mà mấy ngày này dùng để chốt kỳ lương.
 */
function homNayVN(): Date {
  const gioVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(gioVN.getUTCFullYear(), gioVN.getUTCMonth(), gioVN.getUTCDate()),
  );
}

export interface HopDongHienHanh {
  so_hd: string;
  loai_hd: string;
  kieu_luong: string;
  ngay_bat_dau: Date;
  ngay_ket_thuc: Date | null;
  trich_bhxh: boolean;
  tinh_tncn: boolean;
}

/**
 * Chọn hợp đồng hiện hành trong danh sách hợp đồng của MỘT nhân viên.
 *
 * Luật (chuyển nguyên từ FE `cay.ts#hopDongHienHanh`, giờ là nguồn DUY NHẤT):
 *   - đang hiệu lực = đã bắt đầu và chưa hết hạn (không có ngày kết thúc = còn hiệu lực);
 *   - nhiều cái cùng khớp thì lấy cái bắt đầu MUỘN NHẤT;
 *   - không cái nào đang hiệu lực thì lấy hợp đồng mới nhất trong lịch sử — nhân viên vừa hết
 *     hạn hợp đồng cũ mà chưa ký cái mới vẫn phải thấy thông tin gần nhất.
 *
 * TÍNH LÚC ĐỌC, không lưu bản sao xuống `hrm_nhan_vien`. Trước đây có bản sao và nó SAI theo
 * thời gian: kết quả phụ thuộc "hôm nay", mà bản sao chỉ được tính lại khi có người ghi hợp
 * đồng — nên hợp đồng ký trước cho tương lai tới ngày hiệu lực vẫn không ai cập nhật.
 *
 * `ds` phải đã sắp xếp giảm dần theo `ngay_bat_dau` (xem `sapXepHopDong`).
 */
export function chonHopDongHienHanh<T extends HopDongHienHanh>(
  ds: T[],
): T | null {
  if (ds.length === 0) return null;
  const homNay = homNayVN();
  const dangHieuLuc = ds.find(
    (hd) =>
      hd.ngay_bat_dau <= homNay &&
      (!hd.ngay_ket_thuc || hd.ngay_ket_thuc >= homNay),
  );
  return dangHieuLuc ?? ds[0];
}

/**
 * Thứ tự sắp xếp CHUẨN của lịch sử hợp đồng: mới nhất lên đầu.
 *
 * Có `datetime0` và `id` làm tiêu chí phụ vì `ngay_bat_dau` KHÔNG duy nhất — hai hợp đồng cùng
 * ngày bắt đầu là chuyện tạo được. Chỉ sắp theo mỗi `ngay_bat_dau` thì Postgres trả thứ tự tùy
 * ý, và MVCC còn đẩy dòng vừa sửa xuống cuối heap: sửa mỗi ô ghi chú của hợp đồng B cũng đủ làm
 * "hợp đồng hiện hành" nhảy từ A sang B.
 */
const sapXepHopDong = [
  { ngay_bat_dau: 'desc' },
  { datetime0: 'desc' },
  { id: 'desc' },
] satisfies Prisma.hrm_hop_dongOrderByWithRelationInput[];

/**
 * Hợp đồng hiện hành của NHIỀU nhân viên, trả về Map theo `ma_nv`.
 * Một truy vấn cho cả danh sách — màn nhân viên gọi cái này thay cho các cột đệm đã bỏ.
 */
export async function hopDongHienHanhTheoNv(
  db: Db,
  maNvs: string[],
): Promise<Map<string, HopDongHienHanh>> {
  if (maNvs.length === 0) return new Map();

  const ds = await db.hrm_hop_dong.findMany({
    where: { ma_nv: { in: maNvs } },
    select: hopDongSelect,
    orderBy: sapXepHopDong,
  });

  const theoNv = new Map<string, HopDongHienHanh[]>();
  for (const hd of ds) {
    const cu = theoNv.get(hd.ma_nv);
    if (cu) cu.push(hd);
    else theoNv.set(hd.ma_nv, [hd]);
  }

  const ketQua = new Map<string, HopDongHienHanh>();
  for (const [maNv, list] of theoNv) {
    const hienHanh = chonHopDongHienHanh(list);
    if (hienHanh) ketQua.set(maNv, hienHanh);
  }
  return ketQua;
}

/**
 * Ký hợp đồng khoán/HĐDV thì tắt cờ công đoàn của nhân viên.
 *
 * ĐÂY KHÔNG PHẢI bản sao dữ liệu: `cong_doan` là lựa chọn của người lao động, lưu trên hồ sơ
 * nhân viên và do kế toán tự tích. Chỗ này chỉ áp một luật MỘT CHIỀU lúc ký hợp đồng khoán —
 * rời khỏi khoán thì KHÔNG tự bật lại, vì bật lại là mình bịa một quyết định thay họ.
 *
 * Bám theo loại hợp đồng VỪA GHI, không theo "hợp đồng hiện hành": hiện hành phụ thuộc ngày
 * tháng nên sẽ đổi theo thời gian, mà một lần tắt cờ thì phải dứt khoát tại thời điểm ký.
 */
async function apDungLuatCongDoan(db: Db, maNv: string, loaiHd: string) {
  if (loaiHdVeNhanVien(loaiHd) !== 'hdvc') return;
  await db.hrm_nhan_vien.update({
    where: { ma_nv: maNv },
    data: { cong_doan: false, datetime2: new Date() },
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
    orderBy: [{ ma_nv: 'asc' }, ...sapXepHopDong],
  });
}

/** POST tạo mới 1 hợp đồng. */
export async function createHopDong(db: PrismaClient, body: HopDongBodyInput) {
  const id = randomUUID();
  await db.$transaction(async (tx) => {
    await assertNhanVienTonTai(tx, body.ma_nv);
    await tx.hrm_hop_dong.create({ data: { ...body, id } });
    await apDungLuatCongDoan(tx, body.ma_nv, body.loai_hd);
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
    await apDungLuatCongDoan(tx, hienTai.ma_nv, body.loai_hd);
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
  let daChot = false;

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
      // `<=` chứ không `<`: chốt ĐÚNG ngày bắt đầu sẽ tạo hợp đồng có ngày kết thúc trùng ngày
      // bắt đầu, mà `soatNgay` ở validator đòi kết thúc PHẢI SAU bắt đầu — dòng đó sinh ra xong
      // là mọi lần sửa nó về sau đều bị 400 cho tới khi người dùng tự đổi ngày.
      if (ngayChot <= cu.ngay_bat_dau) {
        throw new ConflictError(
          'Ngày chốt phải sau ngày bắt đầu của hợp đồng đang hiệu lực.',
        );
      }
      await tx.hrm_hop_dong.update({
        where: { id: cu.id },
        data: { ngay_ket_thuc: ngayChot, datetime2: new Date() },
      });
      daChot = true;
    }

    await tx.hrm_hop_dong.create({ data: { ...hopDongMoi, id } });
    await apDungLuatCongDoan(tx, body.ma_nv, body.loai_hd);
  });

  // Báo theo việc ĐÃ LÀM, không theo thứ client gửi lên: nhân viên chưa có hợp đồng nào thì
  // `cu` là null và không có gì bị chốt, dù client vẫn truyền `ngay_chot`.
  return { id, da_chot_hop_dong_cu: daChot };
}

/** DELETE — xóa cứng (khóa chính là uuid, không có chuyện cấp lại mã). */
export async function deleteHopDong(db: PrismaClient, id: string) {
  await db.$transaction(async (tx) => {
    await findOrThrow(
      () =>
        tx.hrm_hop_dong.findFirst({
          where: { id, nhan_vien: { da_xoa: false } },
          select: { id: true },
        }),
      new NotFoundError(MESSAGES.HRM.HOP_DONG_NOT_FOUND),
    );

    // Xóa xong KHÔNG phải cập nhật gì bên nhân viên: thông tin hợp đồng hiện hành được tính lúc
    // đọc, xóa dòng cuối cùng thì màn nhân viên tự hiện trống thay vì giữ lại số hợp đồng của
    // một dòng không còn tồn tại.
    await tx.hrm_hop_dong.delete({ where: { id } });
  });
  return { id };
}
