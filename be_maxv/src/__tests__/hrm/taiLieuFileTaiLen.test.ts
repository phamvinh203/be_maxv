import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

/**
 * vbsec 2026-09-10 (LOW) — tải file scan giấy tờ nhân sự lên Drive (`dinhKemFile`):
 *  - taiLieuDrive.service.ts:419: chỉ tin MIME trình duyệt KHAI (`image/png`...) — nội dung thật là HTML,
 *    EXE... vẫn lên Drive của khách và về lại người xem với nhãn ảnh/PDF. Sửa: đối chiếu chữ ký đầu file
 *    (magic bytes) với loại khai báo; lưu loại ĐO ĐƯỢC.
 *  - taiLieuDrive.service.ts:424: trần 20 file/giấy tờ đếm rồi mới ghi, không khóa -> 2 lượt tải song song
 *    cùng thấy 19 là cùng ghi -> 21. Sửa: đếm lại + ghi trong giao dịch có khóa theo giấy tờ; lượt thua
 *    gỡ file vừa tải khỏi Drive (không để mồ côi).
 *
 * Service THẬT; DB tenant giả (giữ đúng ngữ nghĩa khóa giao dịch), DB control plane + HTTP Drive giả.
 */

process.env.GDT_CRED_ENC_KEY = randomBytes(32).toString('base64');

const daTaiLen: Array<{ ten: string; mimeType: string; id: string }> = [];
const daXoa: string[] = [];
let choTaiLen: Promise<void> = Promise.resolve();

let svc: typeof import('../../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service');

before(async () => {
  const { encryptGdtPassword, nguCanhTokenDrive } =
    await import('../../services/client/hddt/gdtCredential');
  const blob = encryptGdtPassword('refresh-token', nguCanhTokenDrive('dv-1'))!;
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        donVi: {
          findUnique: async () => ({
            maSoThue: '0100000001',
            tenDonVi: 'A',
            driveRootFolderId: 'thu-muc-cong-ty',
            driveRefreshTokenCipher: blob.cipher,
            driveRefreshTokenIv: blob.iv,
            driveRefreshTokenTag: blob.tag,
          }),
        },
      },
    },
  });
  let dem = 0;
  mock.module('../../utils/du_lieu_ca_nhan/driveClient', {
    namedExports: {
      DriveChuaCauHinhError: class extends Error {},
      driveDaCauHinh: () => true,
      doiMaLayToken: async () => ({}),
      layAccessToken: async () => 'access-token',
      layNoiDungFile: async () => Buffer.alloc(0),
      taoThuMucNeuChua: async () => 'thu-muc',
      taiFileLen: async (
        _t: string,
        f: { ten: string; mimeType: string; noiDung: Buffer },
      ) => {
        await choTaiLen;
        const id = `drive-${++dem}`;
        daTaiLen.push({ ten: f.ten, mimeType: f.mimeType, id });
        return {
          id,
          ten: f.ten,
          mimeType: f.mimeType,
          kichThuoc: f.noiDung.length,
        };
      },
      xoaFile: async (_t: string, id: string) => {
        daXoa.push(id);
      },
    },
  });
  mock.module('../../helpers/tenantClient', {
    namedExports: { getTenantDb: () => ({}) },
  });
  svc =
    await import('../../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service');
});

beforeEach(() => {
  daTaiLen.length = 0;
  daXoa.length = 0;
  choTaiLen = Promise.resolve();
});

type DongFile = {
  id: string;
  tai_lieu_id: string;
  drive_file_id: string;
  ten_file: string;
  mime_type: string;
  thu_tu: number;
};

/** DB tenant giả: `$transaction` chạy LẦN LƯỢT (đúng tác dụng của khóa advisory theo giấy tờ). */
function taoDb(soFileSan: number) {
  const files: DongFile[] = Array.from({ length: soFileSan }, (_, i) => ({
    id: `f${i}`,
    tai_lieu_id: 'tl-1',
    drive_file_id: `cu-${i}`,
    ten_file: `${i}.png`,
    mime_type: 'image/png',
    thu_tu: i,
  }));
  let hangDoi = Promise.resolve();
  const db = {
    files,
    hrm_tai_lieu: {
      findFirst: async () => ({
        id: 'tl-1',
        ma_nv: 'NV01',
        files: files.map((f) => ({ ...f })),
      }),
      update: async () => ({}),
    },
    hrm_nhan_vien: {
      findFirst: async () => ({
        ma_nv: 'NV01',
        ho_ten: 'A',
        drive_folder_id: 'thu-muc-nv',
      }),
      update: async () => ({}),
    },
    hrm_tai_lieu_file: {
      findMany: async ({ where }: { where: { tai_lieu_id: string } }) =>
        files
          .filter((f) => f.tai_lieu_id === where.tai_lieu_id)
          .map((f) => ({ ...f })),
      count: async ({ where }: { where: { tai_lieu_id: string } }) =>
        files.filter((f) => f.tai_lieu_id === where.tai_lieu_id).length,
      create: async ({ data }: { data: DongFile }) => {
        files.push(data);
        return data;
      },
    },
    $executeRaw: async () => 1,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const truoc = hangDoi;
      let mo!: () => void;
      hangDoi = new Promise<void>((r) => (mo = r));
      await truoc;
      try {
        return await fn(db);
      } finally {
        mo();
      }
    },
  };
  return db;
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(32),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(24),
]);
const HEIC = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypheic'),
  Buffer.alloc(24),
]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n');
const HTML = Buffer.from(
  '<html><script>fetch("/api/v1/auth/me")</script></html>',
);

test('nội dung khớp loại khai báo -> tải lên, lưu đúng loại (JPG/PNG/WEBP/HEIC/PDF)', async () => {
  for (const [noiDung, mime] of [
    [PNG, 'image/png'],
    [JPEG, 'image/jpeg'],
    [WEBP, 'image/webp'],
    [HEIC, 'image/heic'],
    [PDF, 'application/pdf'],
  ] as const) {
    const db = taoDb(0);
    await svc.dinhKemFile(db as never, 'dv-1', 'tl-1', {
      ten: 'scan',
      mimeType: mime,
      noiDung,
    });
    assert.equal(db.files.length, 1, mime);
    assert.equal(db.files[0]!.mime_type, mime);
  }
});

test('nội dung KHÔNG khớp loại khai báo (HTML khai là ảnh, PNG khai là PDF) -> 409, không lên Drive', async () => {
  for (const [noiDung, mime] of [
    [HTML, 'image/png'],
    [HTML, 'application/pdf'],
    [PNG, 'application/pdf'],
    [Buffer.alloc(0), 'image/jpeg'],
  ] as const) {
    const db = taoDb(0);
    await assert.rejects(
      svc.dinhKemFile(db as never, 'dv-1', 'tl-1', {
        ten: 'scan',
        mimeType: mime,
        noiDung,
      }),
      (e: Error) =>
        e.name === 'ConflictError' || /không khớp|không phải/i.test(e.message),
    );
    assert.equal(db.files.length, 0);
  }
  assert.deepEqual(daTaiLen, []);
});

test('2 lượt tải song song khi giấy tờ đang có 19 file: chỉ 1 lượt được ghi, lượt kia 409 và gỡ file vừa tải khỏi Drive', async () => {
  const db = taoDb(19);
  let mo!: () => void;
  choTaiLen = new Promise<void>((r) => (mo = r)); // giữ cả 2 lượt ở bước tải lên -> cùng qua bước đếm trước
  const hai = [1, 2].map((i) =>
    svc
      .dinhKemFile(db as never, 'dv-1', 'tl-1', {
        ten: `scan-${i}.png`,
        mimeType: 'image/png',
        noiDung: PNG,
      })
      .then(
        () => 'ok',
        (e: Error) => e,
      ),
  );
  await new Promise((r) => setTimeout(r, 20));
  mo();
  const kq = await Promise.all(hai);

  assert.equal(db.files.length, 20);
  assert.equal(kq.filter((k) => k === 'ok').length, 1);
  const thua = kq.find((k) => k !== 'ok') as Error;
  assert.equal(thua.name, 'ConflictError');
  assert.equal(daTaiLen.length, 2);
  const idGhi = db.files[19]!.drive_file_id;
  assert.deepEqual(
    daXoa,
    daTaiLen.map((f) => f.id).filter((id) => id !== idGhi),
  );
  // thu_tu tính trong giao dịch -> không trùng.
  assert.equal(new Set(db.files.map((f) => f.thu_tu)).size, 20);
});
