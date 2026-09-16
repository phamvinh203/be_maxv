/**
 * 17 chỉ tiêu `ct16`–`ct32` của tờ khai 05/KK-TNCN (data-model Mục 3.5 + Mục 8, BR-tkt-018).
 *
 * Nguồn DUY NHẤT của danh sách chỉ tiêu ở máy chủ — giao diện đọc `ctGocSuaDuoc` qua API thay vì
 * giữ bản sao thứ hai (`O_SUA_DUOC_TNCN05` hiện đang hardcode ở FE).
 */

export const CT_TAGS = [
  'ct16',
  'ct17',
  'ct18',
  'ct19',
  'ct20',
  'ct21',
  'ct22',
  'ct23',
  'ct24',
  'ct25',
  'ct26',
  'ct27',
  'ct28',
  'ct29',
  'ct30',
  'ct31',
  'ct32',
] as const;

export type CtTag = (typeof CT_TAGS)[number];
export type ChiTieuTncn05 = Record<CtTag, number>;

/** 13 chỉ tiêu gốc được ghi đè — khớp `O_SUA_DUOC_TNCN05` của FE (BR-tkt-018). */
export const CT_GOC_SUA_DUOC = [
  'ct16',
  'ct17',
  'ct19',
  'ct20',
  'ct22',
  'ct23',
  'ct24',
  'ct25',
  'ct27',
  'ct28',
  'ct30',
  'ct31',
  'ct32',
] as const satisfies readonly CtTag[];

/** Chỉ tiêu tổng hợp — LUÔN tính lại từ chỉ tiêu con, cấm ghi đè (E-tkt-012). */
export const CT_TONG_HOP = {
  ct18: ['ct19', 'ct20'],
  ct21: ['ct22', 'ct23'],
  ct26: ['ct27', 'ct28'],
  ct29: ['ct30', 'ct31'],
} as const satisfies Partial<Record<CtTag, readonly CtTag[]>>;

/** Chỉ tiêu đếm NGƯỜI — ghi đè phải là số nguyên (api-contract Mục 5.3). */
export const CT_DEM_NGUOI = [
  'ct16',
  'ct17',
  'ct18',
  'ct19',
  'ct20',
] as const satisfies readonly CtTag[];

/** Nhãn in lên file Excel/PDF — nguyên văn bố cục nháp `tncn05Layout.ts` mà BA đã lấy làm gốc. */
export const NHAN_CHI_TIEU_TNCN05: Record<
  CtTag,
  { stt: string; nhan: string; donVi: 'Người' | 'VNĐ'; dam?: boolean }
> = {
  ct16: { stt: '1', nhan: 'Tổng số người lao động', donVi: 'Người', dam: true },
  ct17: {
    stt: '',
    nhan: 'Trong đó: Cá nhân cư trú có hợp đồng lao động từ 3 tháng trở lên',
    donVi: 'Người',
  },
  ct18: {
    stt: '2',
    nhan: 'Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20]',
    donVi: 'Người',
    dam: true,
  },
  ct19: { stt: '2.1', nhan: 'Cá nhân cư trú', donVi: 'Người' },
  ct20: { stt: '2.2', nhan: 'Cá nhân không cư trú', donVi: 'Người' },
  ct21: {
    stt: '3',
    nhan: 'Tổng thu nhập chịu thuế (TNCT) trả cho cá nhân [21]=[22]+[23]',
    donVi: 'VNĐ',
    dam: true,
  },
  ct22: { stt: '3.1', nhan: 'Cá nhân cư trú', donVi: 'VNĐ' },
  ct23: { stt: '3.2', nhan: 'Cá nhân không cư trú', donVi: 'VNĐ' },
  ct24: {
    stt: '3.3',
    nhan: 'Trong đó: Tổng thu nhập chịu thuế từ tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động',
    donVi: 'VNĐ',
  },
  ct25: {
    stt: '4',
    nhan: 'Trong đó: Tổng thu nhập chịu thuế được miễn theo quy định của Hợp đồng dầu khí',
    donVi: 'VNĐ',
    dam: true,
  },
  ct26: {
    stt: '5',
    nhan: 'Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế [26]=[27]+[28]',
    donVi: 'VNĐ',
    dam: true,
  },
  ct27: { stt: '5.1', nhan: 'Cá nhân cư trú', donVi: 'VNĐ' },
  ct28: { stt: '5.2', nhan: 'Cá nhân không cư trú', donVi: 'VNĐ' },
  ct29: {
    stt: '6',
    nhan: 'Tổng số thuế thu nhập cá nhân đã khấu trừ [29]=[30]+[31]',
    donVi: 'VNĐ',
    dam: true,
  },
  ct30: { stt: '6.1', nhan: 'Cá nhân cư trú', donVi: 'VNĐ' },
  ct31: { stt: '6.2', nhan: 'Cá nhân không cư trú', donVi: 'VNĐ' },
  ct32: {
    stt: '6.3',
    nhan: 'Trong đó: Tổng số thuế thu nhập cá nhân đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động',
    donVi: 'VNĐ',
  },
};

/** Vòng đời tờ khai quý (BR-tkt-014/015). `CHUA_SAN_SANG` không phải trạng thái lưu — là "chưa có dòng". */
export const TRANG_THAI_TO_KHAI = [
  'READY_TO_EXPORT',
  'EXPORTED',
  'SUBMITTED',
] as const;
export type TrangThaiToKhai = (typeof TRANG_THAI_TO_KHAI)[number];

/** Đã xuất trở đi: số đã lưu là bất biến, 3 tháng trong quý vĩnh viễn không mở lại được. */
export const TO_KHAI_DA_XUAT: readonly string[] = ['EXPORTED', 'SUBMITTED'];
