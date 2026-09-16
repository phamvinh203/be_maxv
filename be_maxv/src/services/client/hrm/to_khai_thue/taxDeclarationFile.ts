import {
  CT_TAGS,
  NHAN_CHI_TIEU_TNCN05,
} from '../../../../constants/hrm/to_khai_thue/chiTieuTncn05';
import { renderPdfFromHtml } from '../../../../helpers/pdfRenderer';
import { taoXlsx, type HangXlsx } from '../../../../helpers/hrm/xlsxDonGian';
import type { ToKhaiTncn05Dto } from './taxDeclaration.service';
import {
  COT_TIEN_BANG_THUE,
  type DongChiTietNhanVien,
} from './taxDeclarationCalc';

/**
 * Dựng FILE cho tờ khai 05/KK-TNCN (Excel + PDF, FR-tkt-014) và bảng chi tiết nhân viên (FR-tkt-015).
 *
 * Chỉ đọc DTO đã có — không truy vấn, không tính số. Gọi SAU khi giao dịch xuất đã commit.
 *
 * ⚠️ Phần thông tin người nộp thuế in theo TÊN trường, không đánh số [01]–[15]: chưa đối chiếu được bản
 * gốc mẫu của Thông tư 89/2026/TT-BTC, đánh số sai trên tờ khai còn tệ hơn không đánh số.
 */

export type DinhDangToKhai = 'excel' | 'pdf';

export interface FileXuat {
  ten: string;
  loai: string;
  noiDung: Buffer;
}

const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_PDF = 'application/pdf';

const NHAN_LOAI_LAO_DONG: Record<string, string> = {
  HOP_DONG_3_THANG_TRO_LEN: 'HĐLĐ từ 3 tháng',
  THOI_VU_THU_VIEC: 'Thời vụ / thử việc',
  VANG_LAI: 'Vãng lai',
};

const TIEU_DE = 'TỜ KHAI KHẤU TRỪ THUẾ THU NHẬP CÁ NHÂN';
const PHU_DE =
  'Mẫu số 05/KK-TNCN — dành cho tổ chức, cá nhân trả thu nhập từ tiền lương, tiền công';

function boChiTieu(dto: ToKhaiTncn05Dto) {
  // Tờ khai tới được bước dựng file luôn đã có bộ số (đã xuất); null là lỗi lập trình, không phải của người dùng.
  if (!dto.ct)
    throw new Error(
      `Tờ khai quý ${dto.quy}/${dto.nam} chưa có bộ chỉ tiêu để dựng file.`,
    );
  return dto.ct;
}

function dongNguoiNopThue(dto: ToKhaiTncn05Dto): string[] {
  const nnt = dto.thongTinNguoiNopThue;
  return [
    `Kỳ tính thuế: Quý ${dto.quy} năm ${dto.nam}`,
    'Lần đầu: [X]    Bổ sung lần thứ: [ ]',
    `Tên người nộp thuế: ${nnt.ten}`,
    `Mã số thuế: ${nnt.maSoThue}`,
    `Địa chỉ: ${nnt.diaChi}`,
    `Cơ quan thuế quản lý: ${nnt.coQuanThueQuanLy}`,
  ];
}

function excelToKhai(dto: ToKhaiTncn05Dto): Buffer {
  const ct = boChiTieu(dto);
  const hang: HangXlsx[] = [
    { o: ['', TIEU_DE], dam: true },
    { o: ['', PHU_DE] },
    { o: [] },
    ...dongNguoiNopThue(dto).map((s) => ({ o: ['', s] })),
    { o: [] },
    {
      o: [
        'STT',
        'Chỉ tiêu',
        'Mã chỉ tiêu',
        'Đơn vị tính',
        'Số người / Số tiền',
      ],
      dam: true,
    },
    ...CT_TAGS.map((tag) => {
      const n = NHAN_CHI_TIEU_TNCN05[tag];
      return {
        o: [n.stt, n.nhan, `[${tag.slice(2)}]`, n.donVi, ct[tag]],
        dam: n.dam,
      };
    }),
    { o: [] },
    { o: ['', `Người ký: ${dto.nguoiKy ?? ''}`] },
    { o: ['', `Ngày ký: ${dto.ngayKy ?? ''}`] },
  ];
  return taoXlsx([
    { ten: `Q${dto.quy}-${dto.nam}`, hang, doRongCot: [8, 95, 13, 12, 22] },
  ]);
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlToKhai(dto: ToKhaiTncn05Dto): string {
  const ct = boChiTieu(dto);
  const so = new Intl.NumberFormat('vi-VN');
  const hang = CT_TAGS.map((tag) => {
    const n = NHAN_CHI_TIEU_TNCN05[tag];
    return `<tr${n.dam ? ' class="dam"' : ''}><td class="giua">${esc(n.stt)}</td><td>${esc(n.nhan)}</td><td class="giua">[${tag.slice(2)}]</td><td class="giua">${n.donVi}</td><td class="so">${so.format(ct[tag])}</td></tr>`;
  }).join('');
  const [y, m, d] = (dto.ngayKy ?? '').split('-');
  const ngayKy = dto.ngayKy
    ? `Ngày ${d} tháng ${m} năm ${y}`
    : 'Ngày ..... tháng ..... năm .....';

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
body{font-family:"Times New Roman",serif;font-size:12pt;color:#000}
h1{font-size:14pt;text-align:center;margin:0 0 4pt}
.phu{text-align:center;font-style:italic;margin:0 0 12pt}
.nnt{margin:0 0 10pt;padding:0;list-style:none}
table{width:100%;border-collapse:collapse}
td,th{border:1px solid #000;padding:3pt 5pt;vertical-align:top}
th{background:#eee}
.giua{text-align:center}.so{text-align:right;white-space:nowrap}.dam td{font-weight:bold}
.ky{margin-top:18pt;width:50%;margin-left:auto;text-align:center;break-inside:avoid;page-break-inside:avoid}
</style></head><body>
<h1>${TIEU_DE}</h1>
<p class="phu">${esc(PHU_DE)}</p>
<ul class="nnt">${dongNguoiNopThue(dto)
    .map((s) => `<li>${esc(s)}</li>`)
    .join('')}</ul>
<table><thead><tr><th>STT</th><th>Chỉ tiêu</th><th>Mã chỉ tiêu</th><th>Đơn vị tính</th><th>Số người / Số tiền</th></tr></thead><tbody>${hang}</tbody></table>
<div class="ky">${ngayKy}<br><b>NGƯỜI NỘP THUẾ hoặc ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ</b><br><br><br>${esc(dto.nguoiKy ?? '')}</div>
</body></html>`;
}

/** File tờ khai theo định dạng yêu cầu. `nguoiGoi` = userId — hàng đợi render PDF giới hạn theo người. */
export async function dungFileToKhai(
  dto: ToKhaiTncn05Dto,
  dinhDang: DinhDangToKhai,
  nguoiGoi: string,
): Promise<FileXuat> {
  const coSo = `05-KK-TNCN_Quy${dto.quy}_${dto.nam}`;
  if (dinhDang === 'excel') {
    return { ten: `${coSo}.xlsx`, loai: MIME_XLSX, noiDung: excelToKhai(dto) };
  }
  return {
    ten: `${coSo}.pdf`,
    loai: MIME_PDF,
    noiDung: await renderPdfFromHtml(htmlToKhai(dto), nguoiGoi),
  };
}

const TIEU_DE_CHI_TIET = [
  'Mã NV',
  'Họ tên',
  'MST',
  'CCCD',
  'Loại lao động',
  'Cư trú',
  'Các tháng',
  'Thu nhập lương',
  'Thu nhập ngoài lương',
  'Trong đó khấu trừ riêng',
  'Tổng thu nhập',
  'Thu nhập miễn thuế',
  'Thu nhập chịu thuế',
  'Giảm trừ bản thân',
  'Giảm trừ phụ thuộc',
  'Giảm trừ bảo hiểm',
  'Tổng giảm trừ',
  'Thu nhập tính thuế',
  'Thuế lũy tiến',
  'Thuế toàn phần',
  'Tổng thuế TNCN',
];

/** Bảng chi tiết theo nhân viên nội bộ — tài liệu đối chiếu, KHÔNG phải mẫu tờ khai chính thức. */
export function dungFileChiTiet(
  nam: number,
  quy: number,
  dong: DongChiTietNhanVien[],
): FileXuat {
  const hang: HangXlsx[] = [
    {
      o: [`BẢNG CHI TIẾT THUẾ TNCN THEO NHÂN VIÊN — QUÝ ${quy}/${nam}`],
      dam: true,
    },
    { o: ['Tài liệu đối chiếu nội bộ, không phải mẫu tờ khai chính thức.'] },
    { o: [] },
    { o: TIEU_DE_CHI_TIET, dam: true },
    ...dong.map((d) => ({
      o: [
        d.ma_nv,
        d.ho_ten,
        d.mst_ca_nhan,
        d.so_cccd,
        NHAN_LOAI_LAO_DONG[d.loai_lao_dong] ?? d.loai_lao_dong,
        d.cu_tru ? 'Có' : 'Không',
        d.cacThang.join(', '),
        ...COT_TIEN_BANG_THUE.map((c) => d[c]),
      ],
    })),
    {
      o: [
        'Tổng',
        '',
        '',
        '',
        '',
        '',
        '',
        ...COT_TIEN_BANG_THUE.map((c) => dong.reduce((s, d) => s + d[c], 0)),
      ],
      dam: true,
    },
  ];
  return {
    ten: `Chi-tiet-TNCN_Quy${quy}_${nam}.xlsx`,
    loai: MIME_XLSX,
    noiDung: taoXlsx([
      {
        ten: `Chi tiet Q${quy}-${nam}`,
        hang,
        doRongCot: [
          10,
          28,
          14,
          14,
          18,
          8,
          10,
          ...COT_TIEN_BANG_THUE.map(() => 16),
        ],
      },
    ]),
  };
}
