import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestStore {
  ip?: string;
}

/**
 * Context theo từng request (AsyncLocalStorage). Cho phép code sâu trong service
 * (vd writeLog) đọc thông tin request mà KHÔNG phải truyền req xuyên mọi hàm.
 */
export const requestContext = new AsyncLocalStorage<RequestStore>();

/** IP client của request hiện tại (undefined nếu ngoài vòng đời request, vd cron). */
export function getRequestIp(): string | undefined {
  return requestContext.getStore()?.ip;
}
