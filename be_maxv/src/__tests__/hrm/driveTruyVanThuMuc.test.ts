import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { taoThuMucNeuChua } from '../../utils/du_lieu_ca_nhan/driveClient';

/**
 * vbsec 2026-09-10 (LOW, driveClient.ts:270): điều kiện tìm thư mục trên Drive (`name = '...'`) chỉ thoát
 * dấu `'` chứ không thoát `\`. Tên thư mục dựng từ mã NV + họ tên (người dùng nhập): tên kết thúc bằng `\`
 * làm `\'` của bước thoát thành `\\` + `'` -> đóng chuỗi sớm, phần sau thành điều kiện truy vấn. Cú pháp
 * truy vấn Drive: `\` phải thoát thành `\\` TRƯỚC, rồi mới tới `'` -> `\'`.
 *
 * `fetch` giả ghi lại tham số `q` (không gọi Google).
 */

const fetchGoc = globalThis.fetch;
const daHoi: string[] = [];
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const q = url.searchParams.get('q');
  if (q) {
    daHoi.push(q);
    return new Response(JSON.stringify({ files: [{ id: 'thu-muc-co-san' }] }));
  }
  return new Response(JSON.stringify({ id: 'moi' }));
}) as typeof fetch;

after(() => {
  globalThis.fetch = fetchGoc;
});

/** Giá trị trong cặp nháy đầu tiên sau `name = `, đọc theo đúng luật thoát của Drive. */
function giaTriNameTrongTruyVan(q: string): string {
  const batDau = q.indexOf("name = '") + "name = '".length;
  let kq = '';
  for (let i = batDau; i < q.length; i++) {
    const c = q[i];
    if (c === '\\') {
      kq += q[++i];
      continue;
    }
    if (c === "'") return kq;
    kq += c;
  }
  throw new Error('chuỗi name không đóng');
}

test("tên có dấu \\ và ' -> truy vấn giữ nguyên đúng tên, không thoát ra thành điều kiện khác", async () => {
  for (const ten of [
    'NV01 - Nguyễn Văn A\\',
    "NV02 - O'Brien",
    "NV03 - x\\' or trashed = true or name = 'y",
  ]) {
    daHoi.length = 0;
    await taoThuMucNeuChua('access-token', ten, 'thu-muc-cha');
    assert.equal(daHoi.length, 1);
    assert.equal(
      giaTriNameTrongTruyVan(daHoi[0]!),
      ten,
      `truy vấn: ${daHoi[0]}`,
    );
    // Phần sau tên vẫn đúng các điều kiện cố định, không bị chèn thêm.
    assert.match(
      daHoi[0]!,
      /' and mimeType = 'application\/vnd\.google-apps\.folder' and trashed = false and 'thu-muc-cha' in parents$/,
    );
  }
});
