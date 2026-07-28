import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/tenant';
import { tenantUrl } from '../utils/dbName';

/**
 * Factory tạo/cache PrismaClient cho từng DB công ty (db_<MST>).
 * Có IDLE EVICTION: tenant không hoạt động > IDLE_MS sẽ bị đóng pool
 * để giải phóng RAM (mỗi connection PostgreSQL là 1 process).
 * Xem KIEN-TRUC-DATABASE.md mục 2c.
 */
const IDLE_MS = 10 * 60 * 1000;
const SWEEP_MS = 60 * 1000;

interface Entry {
  client: PrismaClient;
  lastUsed: number;
}

const pool = new Map<string, Entry>();

/** Đóng pool của nhiều tenant song song, nuốt lỗi để không chặn shutdown. */
function disconnectAll(entries: Entry[]): Promise<unknown> {
  return Promise.all(
    entries.map((e) => e.client.$disconnect().catch(() => undefined)),
  );
}

export function getTenantDb(dbName: string): PrismaClient {
  let entry = pool.get(dbName);
  if (!entry) {
    const adapter = new PrismaPg(tenantUrl(dbName), { schema: 'public' });
    const client = new PrismaClient({ adapter });
    entry = { client, lastUsed: Date.now() };
    pool.set(dbName, entry);
  }
  entry.lastUsed = Date.now();
  return entry.client;
}

/**
 * Đóng + gỡ pool của ĐÚNG 1 tenant. Pool chỉ có idle-eviction (10 phút), nên DB bị xóa mà không gỡ
 * thì Map vẫn giữ PrismaClient trỏ vào chỗ trống và request sau lấy trúng client hỏng.
 * Dùng: dropTenant (provisioning.service.ts) — gọi ngay trước khi DROP DATABASE.
 */
export async function evictTenantDb(dbName: string): Promise<void> {
  const entry = pool.get(dbName);
  if (!entry) return;
  pool.delete(dbName);
  await disconnectAll([entry]);
}

const sweeper = setInterval(() => {
  if (pool.size === 0) return; // không có gì để quét -> khỏi lặp Map rỗng mỗi phút.

  const now = Date.now();
  const idle: Entry[] = [];
  for (const [name, entry] of pool) {
    if (now - entry.lastUsed > IDLE_MS) {
      pool.delete(name);
      idle.push(entry);
    }
  }
  disconnectAll(idle);
}, SWEEP_MS);
sweeper.unref();

export async function disconnectAllTenants(): Promise<void> {
  const entries = [...pool.values()];
  pool.clear();
  await disconnectAll(entries);
}
