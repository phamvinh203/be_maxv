import { env } from '../config/env';
import { MESSAGES } from '../constants/messages';

/** 10 số (doanh nghiệp) kèm đuôi chi nhánh `-XXX` tùy chọn, hoặc 12 số (hộ kinh doanh cá thể). */
export const MST_REGEX = /^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/;

function normalize(mst: string): string {
  return mst.trim().replace(/-/g, '_');
}

export function tenantDbName(mst: string): string {
  const trimmed = mst.trim();
  if (!MST_REGEX.test(trimmed)) {
    throw new Error(`${MESSAGES.VALIDATION.INVALID_MST}: ${mst}`);
  }
  return `maxv_${normalize(trimmed)}_app`;
}

/** Đúng mẫu tên DB tenant do `tenantDbName` sinh ra (MST, đuôi chi nhánh đổi `-` thành `_`). */
const TEN_DB_TENANT_REGEX = /^maxv_([0-9]{10}(_[0-9]{3})?|[0-9]{12})_app$/;

export function laTenDbTenant(dbName: string): boolean {
  return TEN_DB_TENANT_REGEX.test(dbName);
}

/**
 * Chặn trước mọi thao tác PHÁ DỮ LIỆU trên DB tenant (`db push --accept-data-loss`, `DROP DATABASE`, DDL
 * ràng buộc) — vbsec 2026-09-10. Tên DB có khi đọc từ `don_vi.dbName` (dữ liệu, không phải hằng số): cột
 * đó bị sửa thành `maxv2_sys` là đẩy schema tenant đè / DROP luôn DB điều phối.
 */
export function assertTenDbTenant(dbName: string): void {
  if (!laTenDbTenant(dbName)) {
    throw new Error(`"${dbName}" không phải tên DB tenant hợp lệ — dừng, không chạy thao tác trên DB này.`);
  }
}

export function tenantSlug(mst: string): string {
  return normalize(mst);
}

export function tenantUrl(dbName: string): string {
  return `${env.tenantBaseUrl}/${dbName}?schema=public`;
}
