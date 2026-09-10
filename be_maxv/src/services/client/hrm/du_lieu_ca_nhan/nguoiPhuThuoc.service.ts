import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import { ghiCoRangBuoc } from '../../../../utils/du_lieu_ca_nhan/rangBuocDb';
import type {
  NguoiPhuThuocBodyInput,
  NguoiPhuThuocListQuery,
  NguoiPhuThuocUpdateInput,
} from '../../../../validators/hrm/du_lieu_ca_nhan/nguoiPhuThuoc.validator';

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
/** Nhận cả client thường lẫn client giao dịch — cùng quy ước với `hopDong.service.ts:31`. */
type Db = PrismaClient | Prisma.TransactionClient;

async function assertNhanVienTonTai(
  db: Db,
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

/** Kỳ đăng ký giảm trừ, dạng 4 cột rời trong DB. `null` = chưa khai. */
export interface KyGiamTru {
  dk_tu_thang: number | null;
  dk_tu_nam: number | null;
  dk_den_thang: number | null;
  dk_den_nam: number | null;
}

/**
 * Quy kỳ đăng ký (tháng/năm) về một khoảng SỐ THÁNG để so giao nhau: `nam * 12 + thang`.
 *
 * Quy ước phải KHỚP TỪNG CHỮ với hàm `hrm_ky_npt(...)` ở tầng cơ sở dữ liệu
 * (`services/shared/hrmTenantConstraints.ts`), nếu không hai tầng nói khác nhau:
 *   - thiếu **năm** bắt đầu -> `-vô cực`;  thiếu **năm** kết thúc -> `+vô cực`;
 *   - có năm mà thiếu tháng -> tháng 1 (đầu kỳ) / tháng 12 (cuối kỳ).
 */
export function kyGiamTruTheoThang(k: KyGiamTru): { tu: number; den: number } {
  const tu =
    k.dk_tu_nam === null
      ? Number.NEGATIVE_INFINITY
      : k.dk_tu_nam * 12 + (k.dk_tu_thang ?? 1);
  const den =
    k.dk_den_nam === null
      ? Number.POSITIVE_INFINITY
      : k.dk_den_nam * 12 + (k.dk_den_thang ?? 12);
  return { tu, den };
}

/**
 * Hai kỳ giảm trừ có GIAO NHAU không — khoảng tính theo THÁNG, ĐÓNG Ở CẢ HAI ĐẦU.
 *
 * Chạm nhau đúng một tháng vẫn là giao nhau: trong tháng đó cả hai người nộp thuế đều được
 * giảm trừ cho cùng một người phụ thuộc. Nối tiếp (A tới hết 06/2026, B từ 07/2026) thì KHÔNG
 * giao — đó chính là ca chuyển người kê khai giữa năm mà QĐ #19 mở ra.
 */
export function kyGiamTruGiaoNhau(a: KyGiamTru, b: KyGiamTru): boolean {
  const x = kyGiamTruTheoThang(a);
  const y = kyGiamTruTheoThang(b);
  return x.tu <= y.den && y.tu <= x.den;
}

/**
 * Mã số thuế người phụ thuộc duy nhất TRONG PHẠM VI MỘT CÔNG TY, **có xét kỳ giảm trừ** —
 * BR-hrm-030 (QĐ #7 + QĐ #19), E-hrm-026.
 *
 * KHÔNG phải khóa duy nhất phẳng theo `mst`: luật thuế TNCN nói mỗi người phụ thuộc chỉ được
 * giảm trừ cho một người nộp thuế **tại một thời điểm**. Bỏ vế "tại một thời điểm" là chặn oan
 * ca có thật và hợp pháp — vợ chồng cùng công ty đổi người kê khai giữa năm, hoặc người kê
 * khai cũ nghỉ việc và người mới nhận kê khai từ tháng sau.
 *
 * Phạm vi mở rộng từ "trong cùng một nhân viên" lên "toàn công ty" (BUG-HRM-05, 🔴 Critical:
 * cùng một mã số thuế đăng ký được cho hai nhân viên -> giảm trừ tính hai lần -> sai thuế).
 *
 * BỎ QUA dòng thuộc nhân viên **đã xóa mềm**: một lần nhập nhầm không được khóa vĩnh viễn mã
 * số thuế đó khỏi cả công ty (BR-hrm-030, theo tinh thần BR-hrm-010).
 *
 * ⚠️ Ràng buộc ở tầng cơ sở dữ liệu **chặt hơn** luật này một chút — nó không tham chiếu được
 * bảng nhân viên nên không bỏ qua được hồ sơ đã xóa mềm. Nợ kỹ thuật đã chấp nhận
 * (`data-model.md` M-09): ca hiếm đó bị chặn kèm thông báo chung chung thay vì câu nghiệp vụ.
 */
async function assertKhongTrungMst(
  db: Db,
  mst: string | null,
  ky: KyGiamTru,
  boQuaId?: string,
): Promise<void> {
  if (!mst) return; // chưa biết MST thì chưa có cơ sở nói là trùng

  const cungMst = await db.hrm_nguoi_phu_thuoc.findMany({
    where: {
      mst,
      nhan_vien: { da_xoa: false },
      ...(boQuaId ? { id: { not: boQuaId } } : {}),
    },
    select: {
      ma_nv: true,
      dk_tu_thang: true,
      dk_tu_nam: true,
      dk_den_thang: true,
      dk_den_nam: true,
      nhan_vien: { select: { ho_ten: true } },
    },
    orderBy: [{ dk_tu_nam: 'asc' }, { dk_tu_thang: 'asc' }],
  });

  // Lọc giao kỳ ở tầng ứng dụng: khoảng kỳ là kết quả của một HÀM trên bốn cột rời, Prisma
  // không diễn tả được trong `where`. Số dòng cùng một mã số thuế luôn rất nhỏ.
  const trung = cungMst.find((r) => kyGiamTruGiaoNhau(ky, r));
  if (!trung) return;

  throw new ConflictError(
    `Người phụ thuộc mang MST ${mst} đã được đăng ký cho nhân viên ${trung.ma_nv} — ${trung.nhan_vien.ho_ten}. ` +
      `Mỗi người phụ thuộc chỉ được tính giảm trừ gia cảnh cho một người nộp thuế.`,
  );
}

/** POST tạo mới. */
export async function createNguoiPhuThuoc(
  db: PrismaClient,
  body: NguoiPhuThuocBodyInput,
) {
  // BUG-HRM-34: kiểm và ghi PHẢI nằm trong CÙNG một giao dịch, theo đúng mẫu của
  // `createHopDong`. Trước đây hai bước tách rời, mà đợt này lại vừa gỡ khóa duy nhất cũ
  // khỏi schema — nên trong khoảng giữa `db push` và `apply-hrm-constraints`, bảng này
  // KHÔNG còn lớp phòng thủ nào ở tầng dữ liệu. Đúng kịch bản sai thuế TNCN của BUG-HRM-05.
  const id = randomUUID();
  await ghiCoRangBuoc(() =>
    db.$transaction(async (tx) => {
      await assertNhanVienTonTai(tx, body.ma_nv);
      await assertKhongTrungMst(tx, body.mst, body);
      await tx.hrm_nguoi_phu_thuoc.create({ data: { ...body, id } });
    }),
  );
  return { id };
}

/** PUT cập nhật (không đổi `ma_nv` — xem ghi chú ở nguoiPhuThuocUpdateSchema). */
export async function updateNguoiPhuThuoc(
  db: PrismaClient,
  id: string,
  body: NguoiPhuThuocUpdateInput,
) {
  // BUG-HRM-34: cùng lý do với createNguoiPhuThuoc — kiểm và ghi phải cùng giao dịch.
  await ghiCoRangBuoc(() =>
    db.$transaction(async (tx) => {
      await findOrThrow(
        () =>
          tx.hrm_nguoi_phu_thuoc.findFirst({
            where: { id, nhan_vien: { da_xoa: false } },
            select: { id: true, ma_nv: true },
          }),
        new NotFoundError(MESSAGES.HRM.NGUOI_PHU_THUOC_NOT_FOUND),
      );
      // Bỏ qua chính dòng đang sửa, không thì sửa tên mà giữ MST cũ cũng bị coi là trùng.
      await assertKhongTrungMst(tx, body.mst, body, id);
      await tx.hrm_nguoi_phu_thuoc.update({
        where: { id },
        data: { ...body, datetime2: new Date() },
      });
    }),
  );
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
