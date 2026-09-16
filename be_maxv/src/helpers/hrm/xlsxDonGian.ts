import { taoZip } from '../zip';

/**
 * Ghi file `.xlsx` TỐI GIẢN — đủ cho file xuất dạng bảng của tờ khai thuế (vài chục dòng, chữ + số,
 * in đậm theo dòng, định dạng `#,##0`). Không công thức, không gộp ô, không ảnh.
 *
 * Tự viết trên `taoZip` thay vì thêm `exceljs`: dự án giữ mốc 0 lỗ hổng `npm audit` (cùng lý do với
 * `helpers/zip.ts`), còn nhu cầu ở đây chỉ là một bảng phẳng.
 * ponytail: cần gộp ô / công thức / nhiều kiểu định dạng thì chuyển sang thư viện, đừng vá thêm vào đây.
 */

export type OXlsx = string | number | null | undefined;

export interface HangXlsx {
  o: OXlsx[];
  dam?: boolean;
}

export interface TrangXlsx {
  ten: string;
  hang: HangXlsx[];
  /** Độ rộng từng cột theo đơn vị ký tự của Excel. */
  doRongCot?: number[];
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL =
  'http://schemas.openxmlformats.org/package/2006/relationships';
const DAU_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Excel coi ký tự điều khiển C0 (trừ tab, xuống dòng) và mã FFFE/FFFF là XML hỏng rồi bật hộp "sửa
 * file" — lọc bỏ trước khi ghi. So theo MÃ SỐ thay vì regex để mã nguồn không phải chứa ký tự điều khiển.
 */
function laKyTuHopLe(ma: number): boolean {
  if (ma === 0x09 || ma === 0x0a || ma === 0x0d) return true;
  return ma >= 0x20 && ma !== 0xfffe && ma !== 0xffff;
}

function xml(s: string): string {
  let sach = '';
  for (const ch of s) if (laKyTuHopLe(ch.codePointAt(0) ?? 0)) sach += ch;
  return sach
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 → A, 25 → Z, 26 → AA. */
function tenCot(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/** Chỉ số kiểu ô trong `styles.xml`: 0 chữ · 1 chữ đậm · 2 số · 3 số đậm. */
function oXml(ref: string, v: OXlsx, dam: boolean): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    return Number.isFinite(v)
      ? `<c r="${ref}" s="${dam ? 3 : 2}"><v>${v}</v></c>`
      : '';
  }
  return `<c r="${ref}" t="inlineStr" s="${dam ? 1 : 0}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
}

function trangXml(t: TrangXlsx): string {
  const cot = t.doRongCot?.length
    ? `<cols>${t.doRongCot
        .map(
          (w, i) =>
            `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
        )
        .join('')}</cols>`
    : '';
  const hang = t.hang
    .map((h, r) => {
      const o = h.o
        .map((v, c) => oXml(`${tenCot(c)}${r + 1}`, v, !!h.dam))
        .join('');
      return o ? `<row r="${r + 1}">${o}</row>` : '';
    })
    .join('');
  return `${DAU_XML}<worksheet xmlns="${NS_MAIN}">${cot}<sheetData>${hang}</sheetData></worksheet>`;
}

const STYLES = `${DAU_XML}<styleSheet xmlns="${NS_MAIN}">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

export function taoXlsx(trang: TrangXlsx[]): Buffer {
  const n = trang.length;
  const tenTrang = (t: TrangXlsx, i: number) =>
    xml(
      t.ten
        .replace(/[[\]:*?/\\]/g, ' ')
        .slice(0, 31)
        .trim() || `Sheet${i + 1}`,
    );

  const contentTypes = `${DAU_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${trang
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join('\n')}
</Types>`;

  const rels = `${DAU_XML}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `${DAU_XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${trang
    .map(
      (t, i) =>
        `<sheet name="${tenTrang(t, i)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('')}</sheets></workbook>`;

  const workbookRels = `${DAU_XML}<Relationships xmlns="${NS_PKG_REL}">${trang
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join(
      '',
    )}<Relationship Id="rId${n + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`;

  return taoZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
    { name: '_rels/.rels', data: Buffer.from(rels) },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels) },
    { name: 'xl/styles.xml', data: Buffer.from(STYLES) },
    ...trang.map((t, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(trangXml(t)),
    })),
  ]);
}
