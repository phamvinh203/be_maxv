import { TIEN_TOI_DA } from '../../../../constants/hrm/to_khai_thue/gioiHanSo';
import { ToKhaiThueError } from '../../../../helpers/hrm/toKhaiThueErrors';
import type { NhomXuLyThue } from '../../../../validators/hrm/to_khai_thue/incomeCategory.validator';

/**
 * ENGINE THUẾ CỦA MỘT BẢN GHI THU NHẬP NGOÀI LƯƠNG — BR-tkt-007 / BR-tkt-008.
 *
 * Hàm THUẦN: mọi thứ cần biết đều nằm trong tham số, kể cả phần trần đã dùng trong kỳ. Truy vấn
 * CSDL nằm ở service. Nhờ vậy 4 nhánh + các biên (đúng ngưỡng, Cam kết 08, ép khấu trừ, trần đã
 * dùng hết) kiểm được bằng ca kiểm thuần, không cần CSDL.
 *
 * `NFR-tkt-004` cấm công thức thuế nằm ở hai nơi — đây là nơi DUY NHẤT. Giao diện gọi
 * `POST /other-income/preview` để lấy số, KHÔNG được tự tính lại.
 */

export interface ThamSoDanhMuc {
  taxTreatmentGroup: NhomXuLyThue;
  exemptCapAmount: number | null;
  exemptCapPeriod: 'MONTHLY' | 'YEARLY' | null;
  withholdingRate: number | null;
  withholdingThreshold: number | null;
}

export interface DauVaoTinhThue {
  /** Số tiền kế toán GÕ VÀO, hiểu theo `paymentType`. */
  amount: number;
  paymentType: 'GROSS' | 'NET';
  isResident: boolean;
  hasCommitment08: boolean;
  forceWithholding: boolean;
  /** Phần đã được miễn của CÙNG người + CÙNG danh mục trong cửa sổ trần (tháng hoặc năm). */
  daMienTrongKy: number;
}

export interface KetQuaTinhThue {
  taxTreatmentGroup: NhomXuLyThue;
  grossAmount: number;
  netAmount: number;
  /** Phần miễn thuế — KHÔNG cộng vào `thu_nhap_ngoai` của Bảng tính thuế. */
  exemptAmount: number;
  /** Phần cộng lũy tiến vào `thu_nhap_ngoai` của Bảng tính thuế tháng. */
  taxableAmount: number;
  taxDeductionType:
    'PROGRESSIVE' | 'FLAT_10' | 'FLAT_20' | 'EXEMPT_COMMIT' | 'NO_DEDUCTION';
  taxRate: number;
  taxDeducted: number;
  /** Câu giải thích cho giao diện — vì sao ra con số này. */
  explain: string;
}

function dinhDang(n: number): string {
  return n.toLocaleString('vi-VN');
}

export function tinhThueThuNhapNgoaiLuong(
  dm: ThamSoDanhMuc,
  dv: DauVaoTinhThue,
): KetQuaTinhThue {
  const kq = tinhTheoNhom(dm, dv);
  // RVW-723: chốt chặn cuối cho mọi nhánh — quy ngược NET với tỷ lệ sát 100% hoặc số đầu vào khổng lồ cho ra số
  // vô hạn / vượt cột Decimal(18,2): tính thử trả `null`, ghi thì tràn cột thành 500 vô danh.
  if (
    ![kq.grossAmount, kq.netAmount, kq.taxDeducted].every(
      (n) => Number.isFinite(n) && Math.abs(n) <= TIEN_TOI_DA,
    )
  ) {
    throw new ToKhaiThueError(
      'E-tkt-004',
      'Số tiền sau khi quy đổi vượt giới hạn cho phép — hãy kiểm tra lại số tiền và tỷ lệ khấu trừ của loại thu nhập.',
    );
  }
  return kq;
}

function tinhTheoNhom(dm: ThamSoDanhMuc, dv: DauVaoTinhThue): KetQuaTinhThue {
  const soTien = dv.amount;

  switch (dm.taxTreatmentGroup) {
    case 'EXEMPT_FULL':
      // Miễn toàn bộ nên không có thuế để quy đổi: GROSS và NET bằng nhau ở mọi `paymentType`.
      return {
        taxTreatmentGroup: dm.taxTreatmentGroup,
        grossAmount: soTien,
        netAmount: soTien,
        exemptAmount: soTien,
        taxableAmount: 0,
        taxDeductionType: 'NO_DEDUCTION',
        taxRate: 0,
        taxDeducted: 0,
        explain: `Khoản được miễn thuế toàn bộ — không khấu trừ và không cộng vào thu nhập chịu thuế.`,
      };

    case 'EXEMPT_CAPPED': {
      const tran = dm.exemptCapAmount ?? 0;
      const chuKy = dm.exemptCapPeriod === 'YEARLY' ? 'năm' : 'tháng';
      // Trần tính LŨY KẾ theo cửa sổ (cùng người + cùng danh mục), không phải theo từng lần chi.
      const tranConLai = Math.max(0, tran - dv.daMienTrongKy);
      const phanMien = Math.min(soTien, tranConLai);
      const phanVuot = soTien - phanMien;

      const explain =
        phanVuot === 0
          ? `Miễn toàn bộ ${dinhDang(phanMien)}đ trong trần ${dinhDang(tran)}đ/${chuKy}.`
          : dv.daMienTrongKy > 0
            ? `Trần ${dinhDang(tran)}đ/${chuKy} đã dùng ${dinhDang(dv.daMienTrongKy)}đ, còn ${dinhDang(tranConLai)}đ ⇒ miễn ${dinhDang(phanMien)}đ, ${dinhDang(phanVuot)}đ còn lại cộng vào thu nhập chịu thuế.`
            : `Miễn ${dinhDang(phanMien)}đ theo trần ${chuKy}, ${dinhDang(phanVuot)}đ còn lại cộng vào thu nhập chịu thuế.`;

      return {
        taxTreatmentGroup: dm.taxTreatmentGroup,
        grossAmount: soTien,
        netAmount: soTien,
        exemptAmount: phanMien,
        taxableAmount: phanVuot,
        taxDeductionType: 'NO_DEDUCTION',
        taxRate: 0,
        taxDeducted: 0,
        explain,
      };
    }

    case 'TAXABLE_FULL':
      // GAP-QA-tkt-01 CHƯA ĐÓNG: quy đổi NET→GROSS ở nhóm này phụ thuộc VÒNG vào thuế suất biên
      // của cả tháng (thuế lũy tiến tính trên tổng thu nhập, không tính trên riêng khoản này) nên
      // không giải được ở mức từng bản ghi. CHẶN thay vì lặng lẽ gán gross = net như mã nháp cũ:
      // kế toán nhập NET 10 triệu sẽ thấy gross 10 triệu và tin là đúng, trong khi số thuế thật
      // phải cao hơn. Mở lại nhánh này khi BA chốt cách quy đổi.
      if (dv.paymentType === 'NET') {
        throw new ToKhaiThueError(
          'E-tkt-004',
          'Khoản chịu thuế toàn bộ hiện chỉ nhập được theo số GROSS. Cách quy đổi từ số thực nhận (NET) phụ thuộc thuế suất lũy tiến của cả tháng nên chưa áp dụng được cho từng khoản — hãy nhập số trước thuế.',
        );
      }
      return {
        taxTreatmentGroup: dm.taxTreatmentGroup,
        grossAmount: soTien,
        netAmount: soTien,
        exemptAmount: 0,
        taxableAmount: soTien,
        taxDeductionType: 'PROGRESSIVE',
        taxRate: 0,
        taxDeducted: 0,
        explain: `Chịu thuế toàn bộ — cộng ${dinhDang(soTien)}đ vào thu nhập chịu thuế của tháng rồi tính theo biểu lũy tiến, không khấu trừ riêng tại đây.`,
      };

    case 'WITHHOLDING_FLAT': {
      // KHÔNG tự điền mặc định ở đây (RVW-729): `incomeCategory.service.ts` LUÔN điền tỷ lệ và ngưỡng cho
      // nhóm này (AC-tkt-002), nên thiếu là dữ liệu danh mục hỏng chứ không phải ca nghiệp vụ. Giữ bản sao thứ
      // hai của tham số thuế ở engine thì hôm luật đổi ngưỡng mà sót một chỗ sẽ không có test nào đỏ (NFR-tkt-004).
      const { withholdingRate: tyLe, withholdingThreshold: nguong } = dm;
      if (tyLe === null || nguong === null) {
        throw new Error(
          `Danh mục nhóm WITHHOLDING_FLAT thiếu tỷ lệ hoặc ngưỡng khấu trừ (tỷ lệ ${tyLe}, ngưỡng ${nguong}) — dữ liệu danh mục hỏng, xem AC-tkt-002.`,
        );
      }
      const khong = (
        loai: KetQuaTinhThue['taxDeductionType'],
        explain: string,
      ): KetQuaTinhThue => ({
        taxTreatmentGroup: dm.taxTreatmentGroup,
        grossAmount: soTien,
        netAmount: soTien,
        exemptAmount: 0,
        // Khoản khấu trừ riêng KHÔNG cộng lũy tiến vào Bảng tính thuế — hai cơ chế độc lập,
        // cộng vào nữa là đánh thuế hai lần trên cùng một khoản.
        taxableAmount: 0,
        taxDeductionType: loai,
        taxRate: 0,
        taxDeducted: 0,
        explain,
      });

      if (dv.hasCommitment08) {
        return khong(
          'EXEMPT_COMMIT',
          'Có Cam kết 08/CK-TNCN ⇒ tạm không khấu trừ.',
        );
      }
      if (soTien < nguong && !dv.forceWithholding) {
        return khong(
          'NO_DEDUCTION',
          `Chi trả ${dinhDang(soTien)}đ dưới ngưỡng ${dinhDang(nguong)}đ/lần ⇒ không khấu trừ.`,
        );
      }

      const loai = dv.isResident ? 'FLAT_10' : 'FLAT_20';
      const lyDo =
        soTien >= nguong
          ? `Vượt ngưỡng ${dinhDang(nguong)}đ/lần`
          : 'Cá nhân yêu cầu khấu trừ dù dưới ngưỡng';

      if (dv.paymentType === 'GROSS') {
        const thue = Math.round((soTien * tyLe) / 100);
        return {
          taxTreatmentGroup: dm.taxTreatmentGroup,
          grossAmount: soTien,
          netAmount: soTien - thue,
          exemptAmount: 0,
          taxableAmount: 0,
          taxDeductionType: loai,
          taxRate: tyLe,
          taxDeducted: thue,
          explain: `${lyDo} ⇒ khấu trừ ${tyLe}% tại nguồn: ${dinhDang(thue)}đ.`,
        };
      }

      // NET: quy ngược ra GROSS. Ở nhóm này quy đổi được vì thuế suất CỐ ĐỊNH, không phụ thuộc
      // tổng thu nhập tháng như nhánh lũy tiến — trừ tỷ lệ từ 100%: khấu trừ hết thì thực nhận luôn
      // bằng 0, không số trước thuế nào ứng với số thực nhận dương (chia cho 0 ⇒ ∞ ⇒ 500, BUG-tkt-002).
      if (tyLe >= 100) {
        throw new ToKhaiThueError(
          'E-tkt-004',
          `Loại thu nhập này khấu trừ ${tyLe}% nên người nhận không thực nhận đồng nào — không quy đổi được từ số thực nhận (NET). Hãy nhập số trước thuế (GROSS) hoặc sửa tỷ lệ khấu trừ của loại thu nhập.`,
        );
      }
      const gross = Math.round(soTien / (1 - tyLe / 100));
      return {
        taxTreatmentGroup: dm.taxTreatmentGroup,
        grossAmount: gross,
        netAmount: soTien,
        exemptAmount: 0,
        taxableAmount: 0,
        taxDeductionType: loai,
        taxRate: tyLe,
        taxDeducted: gross - soTien,
        explain: `${lyDo}, trả theo số thực nhận ⇒ quy ngược thành ${dinhDang(gross)}đ trước thuế, khấu trừ ${tyLe}%: ${dinhDang(gross - soTien)}đ.`,
      };
    }
  }
}
