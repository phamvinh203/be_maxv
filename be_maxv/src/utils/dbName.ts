import { env } from '../config/env';
import { MESSAGES } from '../constants/messages';

export const MST_REGEX = /^[0-9]{10}(-[0-9]{3})?$/;

function normalize(mst: string): string {
  return mst.trim().replace(/-/g, '_');
}

export function tenantDbName(mst: string): string {
  const trimmed = mst.trim();
  if (!MST_REGEX.test(trimmed)) {
    throw new Error(`${MESSAGES.VALIDATION.INVALID_MST}: ${mst}`);
  }
  return `maxv2_${normalize(trimmed)}_app`;
}

export function tenantSlug(mst: string): string {
  return normalize(mst);
}

export function tenantUrl(dbName: string): string {
  return `${env.tenantBaseUrl}/${dbName}?schema=public`;
}
