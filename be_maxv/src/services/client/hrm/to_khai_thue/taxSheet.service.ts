import type {
  Prisma,
  PrismaClient,
  TaxPolicy,
} from '../../../../generated/tenant';
import { TO_KHAI_DA_XUAT } from '../../../../constants/hrm/to_khai_thue/chiTieuTncn05';
import { kyLuongConMo } from '../../../../helpers/hrm/payrollPeriodLockGuard';
import { ToKhaiThueError } from '../../../../helpers/hrm/toKhaiThueErrors';
import type { TaxBracketItem } from '../../../../validators/hrm/cau_hinh_mac_dinh/generalSettings.validator';
import type { TaxSheetQuery } from '../../../../validators/hrm/to_khai_thue/taxSheet.validator';
import { layHoTenNguoiDung } from '../du_lieu_tinh_luong/payrollActivity.service';
import { getPayrollSheetLines } from '../du_lieu_tinh_luong/payrollCalculation.service';
import { resolveTaxPolicy } from './taxPolicy.service';
import {
  soSanhDongBangThue,
  tinhBangTinhThueThang,
  type DongBangTinhThueTinh,
  type NhomXuLyThueNgoai,
} from './taxSheetRows';

/**
 * BẢNG TÍNH THUẾ THÁNG — 3 endpoint (api-contract Mục 4), ADR-013 tầng tháng.
 *
 * Hai nguồn, một hình dạng phản hồi:
 *   - Tháng CHƯA chốt (không có khóa `TAX_SHEET`) → tính trực tiếp bằng `tinhBangTinhThueThang`.
 *   - Tháng ĐÃ chốt → đọc thẳng `hrm_tax_calculation_lines`, KHÔNG tính lại (số pháp lý đã chốt).
 * Cả hai nhánh đều trả `number` — sub-cụm trước từng để lọt lệch kiểu giữa hai nhánh.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Phiên bản cách tính, ghim vào từng dòng chốt để một năm sau vẫn giải trình được vì sao ra số:
 *   - v1 — "tách 2 phần" thu nhập ngoài lương; vãng lai gộp theo họ tên.
 *   - v2 (2026-09-15, RVW-727/732) — vãng lai gộp theo CCCD → MST → họ tên. Quý chưa xuất mà có tháng chốt ở v1 thì
 *     mở lại rồi chốt lại tháng đó (mục rà soát `bang-thue-khoa-vang-lai-cu`), nếu không tờ khai quý đếm trùng người.
 */
const PHIEN_BAN_BANG_THUE = 'v2';

function laLoiTrungKhoa(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002';
}

async function layKy(db: Db, periodId: string) {
  const ky = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      name: true,
      year: true,
      month: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });
  if (!ky) throw new ToKhaiThueError('E-tkt-017');
  return ky;
}

type KyLuong = Awaited<ReturnType<typeof layKy>>;

function khoaThueCuaKy(db: Db, periodId: string) {
  return db.payrollModuleLock.findUnique({
    where: { periodId_module: { periodId, module: 'TAX_SHEET' } },
  });
}

async function quyDaXuatToKhai(
  db: Db,
  nam: number,
  thang: number,
): Promise<boolean> {
  const toKhai = await db.hrm_to_khai_tncn05.findMany({
    where: { nam, ky_loai: 'quy', ky_so: Math.ceil(thang / 3) },
    select: { trang_thai: true },
  });
  return toKhai.some((t) => TO_KHAI_DA_XUAT.includes(t.trang_thai));
}

function soTien(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

/** Tính trực tiếp — dùng chung cho màn tháng chưa chốt VÀ cho lúc chốt (số thấy = số đóng băng). */
async function tinhDongTrucTiep(
  db: PrismaClient,
  ky: KyLuong,
  chinhSach: TaxPolicy,
): Promise<DongBangTinhThueTinh[]> {
  const [dongLuongTho, khoanTho] = await Promise.all([
    // Kỳ đã khóa sổ ⇒ đọc snapshot lương đóng băng; kỳ còn mở ⇒ tính trực tiếp. Hai nhánh cùng
    // hình dạng trường, chỉ khác kiểu số (Decimal vs number) nên chuẩn hóa ngay dưới đây.
    getPayrollSheetLines(db, ky.id),
    db.otherIncomeRecord.findMany({
      where: { periodId: ky.id },
      select: {
        ma_nv: true,
        fullName: true,
        taxCode: true,
        idCardNumber: true,
        isResident: true,
        taxTreatmentGroup: true,
        grossAmount: true,
        taxableAmount: true,
        taxDeducted: true,
        taxDeductionType: true,
      },
    }),
  ]);

  const dongLuong = (
    dongLuongTho as unknown as Array<Record<string, unknown>>
  ).map((d) => ({
    ma_nv: String(d.ma_nv),
    fullName: String(d.fullName),
    grossIncome: soTien(d.grossIncome),
    otTaxExemptAmount: soTien(d.otTaxExemptAmount),
    lunchAllowanceExemptAmount: soTien(d.lunchAllowanceExemptAmount),
    otherAllowanceTaxExemptAmount: soTien(d.otherAllowanceTaxExemptAmount),
    employeeInsuranceDeduction: soTien(d.employeeInsuranceDeduction),
    contractType: (d.contractType as string | null | undefined) ?? null,
    personalIncomeTax: soTien(d.personalIncomeTax),
  }));

  const khoanNgoai = khoanTho.map((k) => ({
    ma_nv: k.ma_nv,
    fullName: k.fullName,
    taxCode: k.taxCode,
    idCardNumber: k.idCardNumber,
    isResident: k.isResident,
    taxTreatmentGroup: k.taxTreatmentGroup as NhomXuLyThueNgoai | null,
    grossAmount: soTien(k.grossAmount),
    taxableAmount: soTien(k.taxableAmount),
    taxDeducted: soTien(k.taxDeducted),
    taxDeductionType: k.taxDeductionType,
  }));

  const maNv = [
    ...new Set([
      ...dongLuong.map((d) => d.ma_nv),
      ...khoanNgoai.flatMap((k) => (k.ma_nv ? [k.ma_nv] : [])),
    ]),
  ];

  const nhanVienTho =
    maNv.length === 0
      ? []
      : await db.hrm_nhan_vien.findMany({
          // KHÔNG lọc `status`/`da_xoa`: người đã nghỉ việc vẫn có thể nhận khoản ngoài lương trong
          // tháng, và dòng thuế của họ vẫn phải lên bảng.
          where: { ma_nv: { in: maNv } },
          select: {
            ma_nv: true,
            ho_ten: true,
            mst_ca_nhan: true,
            so_cccd: true,
            hop_dong: {
              // Cùng cách lọc "hợp đồng hiệu lực trong kỳ" với engine lương (A-02).
              where: {
                ngay_bat_dau: { lte: ky.endDate },
                OR: [
                  { ngay_ket_thuc: null },
                  { ngay_ket_thuc: { gte: ky.startDate } },
                ],
              },
              orderBy: { ngay_bat_dau: 'desc' },
              take: 1,
              select: { loai_hd: true, tinh_tncn: true },
            },
            nguoi_phu_thuoc: {
              select: {
                dk_tu_thang: true,
                dk_tu_nam: true,
                dk_den_thang: true,
                dk_den_nam: true,
              },
            },
          },
        });

  return tinhBangTinhThueThang({
    nam: ky.year,
    thang: ky.month,
    dongLuong,
    khoanNgoai,
    nhanVien: nhanVienTho.map((n) => ({
      ma_nv: n.ma_nv,
      ho_ten: n.ho_ten,
      mst_ca_nhan: n.mst_ca_nhan,
      so_cccd: n.so_cccd,
      loaiHdHieuLuc: n.hop_dong[0]?.loai_hd ?? null,
      tinhTncn: n.hop_dong[0]?.tinh_tncn === true,
      nguoiPhuThuoc: n.nguoi_phu_thuoc,
    })),
    chinhSach: {
      personalDeduction: Number(chinhSach.personalDeduction),
      dependentDeduction: Number(chinhSach.dependentDeduction),
      taxBrackets: chinhSach.taxBrackets,
    },
  });
}

type DongDaChot = Awaited<
  ReturnType<PrismaClient['taxCalculationLine']['findMany']>
>[number];

function veDongTuSnapshot(l: DongDaChot): DongBangTinhThueTinh {
  return {
    recipientKey: l.recipientKey,
    ma_nv: l.ma_nv,
    ho_ten: l.ho_ten,
    mst_ca_nhan: l.mst_ca_nhan,
    so_cccd: l.so_cccd,
    loai_lao_dong: l.loai_lao_dong,
    cu_tru: l.cu_tru,
    so_nguoi_phu_thuoc: l.so_nguoi_phu_thuoc,
    thu_nhap_luong: soTien(l.thu_nhap_luong),
    thu_nhap_ngoai: soTien(l.thu_nhap_ngoai),
    thu_nhap_khau_tru_rieng: soTien(l.thu_nhap_khau_tru_rieng),
    tong_thu_nhap: soTien(l.tong_thu_nhap),
    thu_nhap_mien_thue: soTien(l.thu_nhap_mien_thue),
    thu_nhap_chiu_thue: soTien(l.thu_nhap_chiu_thue),
    giam_tru_ban_than: soTien(l.giam_tru_ban_than),
    giam_tru_phu_thuoc: soTien(l.giam_tru_phu_thuoc),
    giam_tru_bao_hiem: soTien(l.giam_tru_bao_hiem),
    tong_giam_tru: soTien(l.tong_giam_tru),
    thu_nhap_tinh_thue: soTien(l.thu_nhap_tinh_thue),
    phuong_phap_tinh: l.phuong_phap_tinh,
    thue_luy_tien: soTien(l.thue_luy_tien),
    thue_toan_phan: soTien(l.thue_toan_phan),
    tong_thue_tncn: soTien(l.tong_thue_tncn),
    thuc_nhan: soTien(l.thuc_nhan),
  };
}

/**
 * Dòng trả ra API. `id` = khóa người nhận: ổn định cả khi tháng chuyển Nháp → Đã chốt (id dòng
 * snapshot là uuid mới mỗi lần chốt), nên giao diện giữ được trạng thái chọn/mở rộng dòng.
 */
export type DongBangTinhThueDto = Omit<DongBangTinhThueTinh, 'recipientKey'> & {
  id: string;
};

function veDongDto(d: DongBangTinhThueTinh): DongBangTinhThueDto {
  const { recipientKey: id, ...con } = d;
  return { id, ...con };
}

export async function getTaxSheet(db: PrismaClient, query: TaxSheetQuery) {
  const ky = await layKy(db, query.periodId);
  const khoa = await khoaThueCuaKy(db, ky.id);

  let dong: DongBangTinhThueTinh[];
  let chinhSach: TaxPolicy;

  // Hai nhánh cùng MỘT thứ tự dòng (hợp đồng Mục 0.4, RVW-736).
  if (khoa) {
    const dongDaChot = await db.taxCalculationLine.findMany({
      where: { periodId: ky.id },
    });
    dong = dongDaChot.map(veDongTuSnapshot).sort(soSanhDongBangThue);
    // Biểu thuế hiển thị là biểu ĐÃ GHIM lúc chốt, không phải biểu đang hiệu lực hôm nay (ADR-012).
    chinhSach =
      dongDaChot.length > 0
        ? await db.taxPolicy.findUniqueOrThrow({
            where: { id: dongDaChot[0].taxPolicyId },
          })
        : await resolveTaxPolicy(db, ky.startDate);
  } else {
    chinhSach = await resolveTaxPolicy(db, ky.startDate);
    dong = (await tinhDongTrucTiep(db, ky, chinhSach)).sort(
      soSanhDongBangThue,
    );
  }

  const [daXuat, hoTen] = await Promise.all([
    khoa ? quyDaXuatToKhai(db, ky.year, ky.month) : Promise.resolve(false),
    layHoTenNguoiDung([khoa?.lockedByUserId]),
  ]);

  // KPI tính trên TOÀN BỘ kỳ, KHÔNG theo bộ lọc — nếu không, người dùng lọc một nhóm rồi tưởng đó
  // là tổng thuế cả công ty (hợp đồng Mục 4.1).
  const kpi = {
    tongNguoiLaoDong: dong.length,
    tongThuNhapChiuThue: dong.reduce((s, d) => s + d.thu_nhap_chiu_thue, 0),
    tongGiamTruGiaCanh: dong.reduce(
      (s, d) => s + d.giam_tru_ban_than + d.giam_tru_phu_thuoc,
      0,
    ),
    tongThueTncn: dong.reduce((s, d) => s + d.tong_thue_tncn, 0),
  };

  const tuKhoa = query.q?.toLowerCase();
  const danhSach = dong
    .filter((d) => !query.loaiLaoDong || d.loai_lao_dong === query.loaiLaoDong)
    .filter((d) => query.cuTru === undefined || d.cu_tru === query.cuTru)
    .filter(
      (d) =>
        !tuKhoa ||
        [d.ho_ten, d.mst_ca_nhan, d.so_cccd].some((v) =>
          v?.toLowerCase().includes(tuKhoa),
        ),
    )
    .map(veDongDto);

  return {
    periodId: ky.id,
    periodName: ky.name,
    month: ky.month,
    year: ky.year,
    payrollPeriodStatus: ky.status,
    trangThai: khoa ? ('DA_CHOT' as const) : ('NHAP' as const),
    chotBoi: khoa?.lockedByUserId ?? null,
    chotBoiTen: (khoa && hoTen.get(khoa.lockedByUserId)) || null,
    chotLuc: khoa?.lockedAt.toISOString() ?? null,
    coTheChot: !khoa && !kyLuongConMo(ky.status),
    coTheMoLai: !!khoa && !daXuat,
    bieuThueApDung: {
      taxPolicyId: chinhSach.id,
      effectiveFrom: chinhSach.effectiveFrom.toISOString().slice(0, 10),
      personalDeduction: Number(chinhSach.personalDeduction),
      dependentDeduction: Number(chinhSach.dependentDeduction),
      taxBrackets: chinhSach.taxBrackets as unknown as TaxBracketItem[],
    },
    kpi,
    danhSach,
  };
}

/**
 * Chốt Bảng tính thuế tháng (FR-tkt-011). Thứ tự bám hợp đồng Mục 4.2.
 *
 * Toàn bộ nằm trong MỘT giao dịch mở đầu bằng khóa ghi dòng kỳ lương (`FOR UPDATE`, RVW-721/722):
 *   - lượt ghi khoản ngoài lương đang dở giữ `FOR SHARE` trên cùng dòng ⇒ commit xong mới tới lượt chốt, số
 *     tính ra có đủ khoản đó; lượt ghi đến sau thấy khóa `TAX_SHEET` và bị chặn (E-tkt-007);
 *   - mở lại / xóa kỳ lương cũng khóa dòng này ⇒ trạng thái kỳ đọc ở đây là trạng thái thật lúc ghi khóa.
 * Kỳ lương đã khóa sổ nên phần lương chỉ đọc snapshot — tính trong giao dịch vẫn nhanh.
 */
export async function lockTaxSheet(
  db: PrismaClient,
  periodId: string,
  userId: string,
) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "hrm_payroll_periods" WHERE id = ${periodId} FOR UPDATE`;
      const ky = await layKy(tx, periodId);
      // Chốt lên số của kỳ lương còn mở là chốt lên cát: engine lương ra số khác mỗi lần gọi.
      if (kyLuongConMo(ky.status)) throw new ToKhaiThueError('E-tkt-008');
      if (await khoaThueCuaKy(tx, ky.id)) {
        throw new ToKhaiThueError('E-tkt-018');
      }

      const chinhSach = await resolveTaxPolicy(tx, ky.startDate);
      // Cùng khuôn `snapshotPayrollSheet(tx as unknown as PrismaClient, …)`: kỳ đã khóa sổ nên nhánh đọc
      // lương chỉ `findMany` snapshot, không mở giao dịch lồng.
      const dong = await tinhDongTrucTiep(
        tx as unknown as PrismaClient,
        ky,
        chinhSach,
      );
      const chotLuc = new Date();

      // Ghi khóa TRƯỚC dòng: lưới cuối nếu hai lượt chốt vẫn cùng lọt — lượt sau vỡ
      // `@@unique([periodId, module])` ngay, cả giao dịch lùi, không ai ghi đè dòng snapshot của người kia.
      await tx.payrollModuleLock.create({
        data: {
          periodId: ky.id,
          module: 'TAX_SHEET',
          lockedByUserId: userId,
          lockedAt: chotLuc,
        },
      });
      await tx.taxCalculationLine.deleteMany({ where: { periodId: ky.id } });
      if (dong.length > 0) {
        await tx.taxCalculationLine.createMany({
          data: dong.map((d) => ({
            periodId: ky.id,
            ...d,
            // Ghim biểu thuế + phiên bản cách tính: một năm sau vẫn giải trình được vì sao ra số này.
            taxPolicyId: chinhSach.id,
            engineVersion: PHIEN_BAN_BANG_THUE,
            lockedByUserId: userId,
            lockedAt: chotLuc,
          })),
        });
      }

      return {
        periodId: ky.id,
        trangThai: 'DA_CHOT' as const,
        soDong: dong.length,
        chotLuc: chotLuc.toISOString(),
        taxPolicyId: chinhSach.id,
      };
    });
  } catch (err) {
    if (laLoiTrungKhoa(err)) throw new ToKhaiThueError('E-tkt-018');
    throw err;
  }
}

/**
 * Mở lại Bảng tính thuế tháng (FR-tkt-012). XÓA snapshot đã chốt, không hoàn tác được.
 *
 * Xóa dòng khóa TRƯỚC rồi mới kiểm quý, trong cùng giao dịch: lệnh xóa giữ khóa hàng trên dòng
 * khóa `TAX_SHEET` tới lúc giao dịch kết thúc. Ca đua "mở lại đúng lúc người khác xuất tờ khai quý"
 * chỉ đóng hẳn khi bước xuất (bước 6) đọc khóa 3 tháng bằng `FOR SHARE` — ở READ COMMITTED, lệnh
 * đọc thường không thấy việc xóa chưa commit và vẫn xuất được.
 */
export async function unlockTaxSheet(db: PrismaClient, periodId: string) {
  const ky = await layKy(db, periodId);
  const quy = Math.ceil(ky.month / 3);

  await db.$transaction(async (tx) => {
    // Thứ tự lỗi bám hợp đồng Mục 4.3: chưa chốt (E-tkt-018) trước, quý đã xuất (E-tkt-009) sau.
    // Ném lỗi ở bất kỳ bước nào đều làm giao dịch lùi, kể cả dòng khóa vừa xóa.
    const { count } = await tx.payrollModuleLock.deleteMany({
      where: { periodId: ky.id, module: 'TAX_SHEET' },
    });
    if (count === 0) throw new ToKhaiThueError('E-tkt-018');

    if (await quyDaXuatToKhai(tx, ky.year, ky.month)) {
      throw new ToKhaiThueError('E-tkt-009');
    }

    await tx.taxCalculationLine.deleteMany({ where: { periodId: ky.id } });
    // BR-tkt-013 (sửa 2026-09-14): quý đang "sẵn sàng xuất" mà một tháng mở lại thì hết sẵn sàng —
    // xóa luôn tờ khai chưa xuất của quý đó, không để dữ liệu treo sai trạng thái (GAP-QA-tkt-06).
    await tx.hrm_to_khai_tncn05.deleteMany({
      where: {
        nam: ky.year,
        ky_loai: 'quy',
        ky_so: quy,
        trang_thai: { notIn: [...TO_KHAI_DA_XUAT] },
      },
    });
  });

  return { periodId: ky.id, trangThai: 'NHAP' as const };
}
