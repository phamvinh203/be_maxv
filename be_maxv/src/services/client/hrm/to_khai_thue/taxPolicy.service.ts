import type {
  Prisma,
  PrismaClient,
  TaxPolicy,
} from '../../../../generated/tenant';
import { ToKhaiThueError } from '../../../../helpers/hrm/toKhaiThueErrors';
import type { TaxBracketItem } from '../../../../validators/hrm/cau_hinh_mac_dinh/generalSettings.validator';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * CHÍNH SÁCH THUẾ TNCN THEO MỐC HIỆU LỰC (ADR-012, BR-tkt-017).
 *
 * Đây là NƠI TRA CỨU DUY NHẤT. Mọi phép tính thuế phải đi qua `resolveTaxPolicy()` — chép lại
 * truy vấn này ở service khác là tạo nguồn sự thật thứ hai, đúng lỗi đã mắc với biểu thuế trước
 * đây (biểu hardcode trong `tinhThueLuyTien()` không đọc cấu hình — BUG-dltl-003).
 */

/**
 * Chính sách đang hiệu lực tại thời điểm **bắt đầu kỳ lương**.
 *
 * Mốc so sánh là `period.startDate`, KHÔNG phải `paymentDate` của từng bản ghi: cả kỳ tháng phải
 * dùng đúng một biểu thuế, nếu không hai bản ghi cùng tháng sẽ tính theo hai biểu khác nhau và
 * thu nhập tính thuế lũy tiến mất ý nghĩa.
 *
 * Không có `effectiveTo`: dòng có `effectiveFrom` lớn hơn kế tiếp tự động thay thế dòng trước,
 * nên mô hình này không thể sinh khoảng trống hay chồng lấn.
 *
 * Thiếu chính sách là lỗi HẠ TẦNG (tenant chưa chạy `npm run hrm:seed-thue`), không phải lỗi của
 * người dùng — ném `E-tkt-015` có mã thay vì để rơi vào 500 vô danh.
 */
export async function resolveTaxPolicy(
  db: Db,
  periodStartDate: Date,
): Promise<TaxPolicy> {
  const policy = await db.taxPolicy.findFirst({
    where: { effectiveFrom: { lte: periodStartDate } },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!policy) {
    throw new ToKhaiThueError(
      'E-tkt-015',
      `Chưa có chính sách thuế TNCN hiệu lực cho kỳ bắt đầu ${periodStartDate
        .toISOString()
        .slice(
          0,
          10,
        )}. Cần nạp dữ liệu khởi tạo cụm thuế (npm run hrm:seed-thue).`,
    );
  }

  return policy;
}

/** Hình dạng chính sách thuế trả ra API — tiền là `number`, không phải chuỗi Decimal. */
export interface TaxPolicyDto {
  id: string;
  effectiveFrom: string;
  personalDeduction: number;
  dependentDeduction: number;
  taxBrackets: TaxBracketItem[];
  withholdingTaxRate: number;
  withholdingTaxThreshold: number;
  voluntaryPensionMonthlyCap: number;
  lunchAllowanceTaxFreeCap: number;
  legalBasisNote: string | null;
}

export function veTaxPolicyDto(p: TaxPolicy): TaxPolicyDto {
  return {
    id: p.id,
    effectiveFrom: p.effectiveFrom.toISOString().slice(0, 10),
    personalDeduction: Number(p.personalDeduction),
    dependentDeduction: Number(p.dependentDeduction),
    taxBrackets: p.taxBrackets as unknown as TaxBracketItem[],
    withholdingTaxRate: Number(p.withholdingTaxRate),
    withholdingTaxThreshold: Number(p.withholdingTaxThreshold),
    voluntaryPensionMonthlyCap: Number(p.voluntaryPensionMonthlyCap),
    lunchAllowanceTaxFreeCap: Number(p.lunchAllowanceTaxFreeCap),
    legalBasisNote: p.legalBasisNote,
  };
}

/**
 * Danh sách chính sách thuế, mới nhất trước — phục vụ `GET /tax-policies`.
 * Bảng này chỉ vài dòng trong nhiều năm nên không phân trang.
 */
export async function getTaxPolicies(db: Db): Promise<TaxPolicyDto[]> {
  const rows = await db.taxPolicy.findMany({
    orderBy: { effectiveFrom: 'desc' },
  });
  return rows.map(veTaxPolicyDto);
}
