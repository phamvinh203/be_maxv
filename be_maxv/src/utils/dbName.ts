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

export function tenantSlug(mst: string): string {
  return normalize(mst);
}

export function tenantUrl(dbName: string): string {
  return `${env.tenantBaseUrl}/${dbName}?schema=public`;
}
