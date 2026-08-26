import { CELL_BORDER, HEADER_FILL, HEADER_HEIGHT } from "../hddt/exportXlsx";

export interface CotDau<Row> {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
  value: (r: Row) => string | number | null;
}

export interface CotChiTieu<Tag extends string> {
  tag: Tag;
  header: string;
}

const NUM_FMT_CHI_TIEU = "#,##0";
const WIDTH_COT_CHI_TIEU = 16;
const WIDTH_COT_TRANG_THAI = 26;

export interface DvcChiTieuWorkbookOptions<Row extends { trangThai: string }, Tag extends string> {
  sheetName: string;
  cotDau: CotDau<Row>[];
  cotChiTieu: CotChiTieu<Tag>[];
  layCt: (r: Row) => Partial<Record<Tag, number | null>>;
  layTrangThai?: (r: Row) => string;
  rows: Row[];
}

export async function buildDvcChiTieuWorkbookBuffer<Row extends { trangThai: string }, Tag extends string>(
  opts: DvcChiTieuWorkbookOptions<Row, Tag>,
): Promise<ArrayBuffer> {
  const { sheetName, cotDau, cotChiTieu, layCt, layTrangThai = (r) => r.trangThai, rows } = opts;

  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet(sheetName);

  const soCotDau = cotDau.length;
  const tongSoCot = soCotDau + cotChiTieu.length + 1;

  const headerRow = ws.getRow(1);
  [...cotDau.map((c) => c.header), ...cotChiTieu.map((c) => c.header), "Trạng thái"].forEach(
    (h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.border = CELL_BORDER;
    },
  );
  headerRow.height = HEADER_HEIGHT;
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  cotDau.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });
  cotChiTieu.forEach((_c, i) => {
    const col = ws.getColumn(soCotDau + 1 + i);
    col.numFmt = NUM_FMT_CHI_TIEU;
    col.width = WIDTH_COT_CHI_TIEU;
  });
  ws.getColumn(tongSoCot).width = WIDTH_COT_TRANG_THAI;

  const gioCanh: (CotDau<Row>["align"] | undefined)[] = [
    ...cotDau.map((c) => c.align),
    ...cotChiTieu.map(() => undefined),
    undefined,
  ];

  rows.forEach((row, i) => {
    const r = ws.getRow(i + 2);
    r.alignment = { vertical: "top", wrapText: true };
    const ct = layCt(row);
    const values: (string | number | null)[] = [
      ...cotDau.map((c) => c.value(row)),
      ...cotChiTieu.map((c) => ct[c.tag] ?? null),
      layTrangThai(row) || null,
    ];
    values.forEach((v, ci) => {
      const cell = r.getCell(ci + 1);
      cell.value = v;
      cell.border = CELL_BORDER;
      const canh = gioCanh[ci];
      if (canh) cell.alignment = { vertical: "top", wrapText: true, horizontal: canh };
    });
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length, 0) + 1, column: tongSoCot },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export function tachKyKeKhai(ky: string): { quy: number | null; nam: number | null } {
  const m = /^(\D*)(\d{1,2})\/(\d{4})\s*$/.exec(ky);
  if (!m) return { quy: null, nam: null };
  const [, tienTo, soThu, nam] = m;
  const quy = /^q$/i.test(tienTo.trim()) ? Number(soThu) : null;
  return { quy, nam: Number(nam) };
}
