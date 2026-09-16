import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listZipEntryNames, readZipEntry, taoZip } from '../../helpers/zip';
import { taoXlsx } from '../../helpers/hrm/xlsxDonGian';

/** Bộ ghi ZIP + XLSX tối giản dùng cho file tờ khai thuế — kiểm bằng chính bộ đọc ZIP của dự án. */

test('taoZip: đọc lại bằng bộ đọc ZIP ra đúng nội dung, kể cả tên UTF-8 và dữ liệu nén được', () => {
  const lap = '<x/>'.repeat(1000);
  const zip = taoZip([
    { name: 'a.txt', data: Buffer.from('xin chào') },
    { name: 'thư mục/b.xml', data: Buffer.from(lap) },
  ]);
  assert.deepEqual(listZipEntryNames(zip), ['a.txt', 'thư mục/b.xml']);
  assert.equal(readZipEntry(zip, 'a.txt')?.toString(), 'xin chào');
  assert.equal(readZipEntry(zip, 'b.xml')?.toString(), lap);
  assert.ok(zip.length < lap.length, 'phần dữ liệu lặp phải được nén');
});

test('taoXlsx: đủ phần bắt buộc; chữ được thoát XML, ký tự điều khiển bị lọc, số giữ kiểu số', () => {
  // Dựng ký tự điều khiển lúc chạy — không để ký tự vô hình nằm trong mã nguồn.
  const coKyTuDieuKhien = `x${String.fromCharCode(1)}${String.fromCharCode(0xffff)}y`;
  const file = taoXlsx([
    {
      ten: 'Q3/2026',
      hang: [
        { o: ['A & <B> "c"', 12_345_678, null, coKyTuDieuKhien], dam: true },
      ],
      doRongCot: [10, 20],
    },
  ]);
  assert.deepEqual(listZipEntryNames(file).sort(), [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/workbook.xml',
    'xl/worksheets/sheet1.xml',
  ]);

  const sheet = readZipEntry(file, 'sheet1.xml')?.toString() ?? '';
  assert.match(sheet, /A &amp; &lt;B&gt; &quot;c&quot;/);
  assert.match(
    sheet,
    /<c r="B1" s="3"><v>12345678<\/v><\/c>/,
    'số đậm dùng kiểu 3',
  );
  assert.ok(!sheet.includes('r="C1"'), 'ô rỗng không ghi');
  assert.match(
    sheet,
    /r="D1" t="inlineStr" s="1"><is><t xml:space="preserve">xy<\/t>/,
    'ký tự điều khiển và mã FFFF bị lọc',
  );
  assert.match(
    sheet,
    /<cols><col min="1" max="1" width="10" customWidth="1"\/>/,
  );

  const workbook = readZipEntry(file, 'workbook.xml')?.toString() ?? '';
  assert.match(workbook, /name="Q3 2026"/, 'tên trang bỏ ký tự Excel cấm');
});
