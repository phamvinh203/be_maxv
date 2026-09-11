import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

/**
 * vbsec 2026-09-10 (LOW, gdtCredential.ts:85): refresh token Google Drive của công ty mã hóa AES-GCM không
 * gắn ngữ cảnh -> blob của công ty A chép sang dòng `don_vi` của công ty B vẫn giải mã được, B mở được
 * Drive của A. Sửa: mã hóa với AAD theo `donViId` (`nguCanhTokenDrive`).
 *
 * Service THẬT; DB control plane + client HTTP Drive thay bằng bản giả (không gọi mạng).
 */

process.env.GDT_CRED_ENC_KEY = randomBytes(32).toString('base64');

const donVi = new Map<string, Record<string, unknown>>();
const refreshDaDung: string[] = [];

let luuKetNoiDrive: typeof import('../../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service').luuKetNoiDrive;
let xoaMoiFileTrenDrive: typeof import('../../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service').xoaMoiFileTrenDrive;
let cred: typeof import('../../services/client/hddt/gdtCredential');

before(async () => {
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        donVi: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            donVi.get(where.id) ?? null,
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            donVi.set(where.id, { ...(donVi.get(where.id) ?? {}), ...data });
            return donVi.get(where.id);
          },
        },
      },
    },
  });
  class DriveChuaCauHinhError extends Error {}
  mock.module('../../utils/du_lieu_ca_nhan/driveClient', {
    namedExports: {
      DriveChuaCauHinhError,
      driveDaCauHinh: () => true,
      doiMaLayToken: async () => ({
        refreshToken: 'refresh-token-cua-dv-a',
        email: 'a@congty.vn',
      }),
      layAccessToken: async (rt: string) => {
        refreshDaDung.push(rt);
        return 'access-token';
      },
      layNoiDungFile: async () => Buffer.alloc(0),
      taiFileLen: async () => ({}),
      taoThuMucNeuChua: async () => 'folder',
      xoaFile: async () => undefined,
    },
  });
  mock.module('../../helpers/tenantClient', {
    namedExports: {
      getTenantDb: () => ({
        hrm_nhan_vien: { updateMany: async () => ({ count: 0 }) },
      }),
    },
  });
  ({ luuKetNoiDrive, xoaMoiFileTrenDrive } =
    await import('../../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service'));
  cred = await import('../../services/client/hddt/gdtCredential');
});

beforeEach(() => {
  donVi.clear();
  refreshDaDung.length = 0;
});

const dbCoMotFile = {
  hrm_tai_lieu_file: { findMany: async () => [{ drive_file_id: 'file-1' }] },
} as never;

test('luuKetNoiDrive: refresh token lưu GẮN với công ty — giải mã theo công ty khác -> null', async () => {
  donVi.set('dv-a', { maSoThue: '0100000001', tenDonVi: 'A' });
  await luuKetNoiDrive('dv-a', 'ma-oauth');

  const dong = donVi.get('dv-a')!;
  const blob = {
    cipher: String(dong.driveRefreshTokenCipher),
    iv: String(dong.driveRefreshTokenIv),
    tag: String(dong.driveRefreshTokenTag),
  };
  assert.equal(
    cred.decryptGdtPassword(blob, cred.nguCanhTokenDrive('dv-a')),
    'refresh-token-cua-dv-a',
  );
  assert.equal(
    cred.decryptGdtPassword(blob, cred.nguCanhTokenDrive('dv-b')),
    null,
  );
});

test('token của công ty A chép sang dòng công ty B: B KHÔNG dùng được để gọi Drive', async () => {
  donVi.set('dv-a', { maSoThue: '0100000001', tenDonVi: 'A' });
  await luuKetNoiDrive('dv-a', 'ma-oauth');
  const a = donVi.get('dv-a')!;
  donVi.set('dv-b', {
    maSoThue: '0100000002',
    tenDonVi: 'B',
    driveRootFolderId: null,
    driveRefreshTokenCipher: a.driveRefreshTokenCipher,
    driveRefreshTokenIv: a.driveRefreshTokenIv,
    driveRefreshTokenTag: a.driveRefreshTokenTag,
  });

  const loi: unknown[] = [];
  const sach = await xoaMoiFileTrenDrive(dbCoMotFile, 'dv-b', 'tl-1', (e) =>
    loi.push(e),
  );
  assert.equal(sach, false);
  assert.deepEqual(refreshDaDung, []);

  // Chính công ty A vẫn dùng bình thường.
  assert.equal(await xoaMoiFileTrenDrive(dbCoMotFile, 'dv-a', 'tl-1'), true);
  assert.deepEqual(refreshDaDung, ['refresh-token-cua-dv-a']);
});

test('token lưu TRƯỚC khi có ngữ cảnh (blob cũ) vẫn dùng được — không bắt công ty nối lại Drive', async () => {
  const cu = cred.encryptGdtPassword('refresh-token-cu')!;
  donVi.set('dv-a', {
    maSoThue: '0100000001',
    tenDonVi: 'A',
    driveRootFolderId: null,
    driveRefreshTokenCipher: cu.cipher,
    driveRefreshTokenIv: cu.iv,
    driveRefreshTokenTag: cu.tag,
  });
  assert.equal(await xoaMoiFileTrenDrive(dbCoMotFile, 'dv-a', 'tl-1'), true);
  assert.deepEqual(refreshDaDung, ['refresh-token-cu']);
});
