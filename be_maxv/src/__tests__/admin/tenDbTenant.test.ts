import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laTenDbTenant, tenantDbName } from '../../utils/dbName';
import {
  dayTenantSchema,
  dropTenant,
} from '../../services/shared/provisioning.service';
import { applyTenantConstraints } from '../../services/shared/hrmTenantConstraints';

/**
 * vbsec 2026-09-10 (LOW, sync-tenants.ts:37): tên DB tenant đọc từ `don_vi.dbName` (dữ liệu DB, L2) đi
 * thẳng vào các thao tác PHÁ DỮ LIỆU — `prisma db push --accept-data-loss`, `DROP DATABASE`, DDL ràng buộc.
 * Cột đó bị sửa thành `maxv2_sys` là đẩy schema tenant đè / DROP luôn DB điều phối. Kiểm tên đúng mẫu DB
 * tenant (`tenantDbName`) trước khi chạy.
 */

test('chỉ nhận đúng mẫu tên DB tenant sinh từ MST', () => {
  assert.equal(laTenDbTenant(tenantDbName('0101243150')), true);
  assert.equal(laTenDbTenant(tenantDbName('0101243150-001')), true);
  assert.equal(laTenDbTenant(tenantDbName('012345678901')), true);
  for (const la of ['maxv2_sys', 'postgres', 'maxv_0101243150_app; DROP', 'maxv_123_app', '']) {
    assert.equal(laTenDbTenant(la), false, la);
  }
});

test('db push / DROP DATABASE / áp ràng buộc từ chối tên không phải DB tenant — trước khi đụng tới DB', async () => {
  let daChay = false;
  await assert.rejects(
    dayTenantSchema('maxv2_sys', async () => {
      daChay = true;
      return { stdout: '', stderr: '' };
    }),
    /không phải tên DB tenant/,
  );
  assert.equal(daChay, false);
  await assert.rejects(dropTenant('maxv2_sys'), /không phải tên DB tenant/);
  await assert.rejects(applyTenantConstraints('postgres'), /không phải tên DB tenant/);
});
