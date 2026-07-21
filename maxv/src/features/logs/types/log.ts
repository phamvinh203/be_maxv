export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface SysLog {
  id: string;
  level: LogLevel;
  hanhDong: string;
  userId: string | null;
  donViId: string | null;
  chiTiet: unknown | null;
  ip: string | null;
  createdAt: string;
}

export interface ListLogsParams {
  level?: LogLevel;
  hanhDong?: string;
  userId?: string;
  donViId?: string;
  ip?: string;
  from?: string; // ISO datetime
  to?: string; // ISO datetime
  sort?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
