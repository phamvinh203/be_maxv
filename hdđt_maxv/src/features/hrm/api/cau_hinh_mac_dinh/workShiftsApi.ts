import { api } from "@/lib/apiClient";

const BASE = "/hrm/work-shifts";

export type ShiftStatusApi = "ACTIVE" | "INACTIVE";

export interface WorkShiftApiItem {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: ShiftStatusApi;
  /** Suy ra lúc đọc: `true` khi `endTime <= startTime`. Ca 24h (`08:00`→`08:00`) cũng là `true`. */
  isOvernight: boolean;
  /** Suy ra lúc đọc — **số thật**, không đi qua `Decimal` nên không phải chuỗi. */
  workingHours: number;
  /**
   * `"CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD"` khi `workingHours > 12.0`; ngược lại **vắng mặt hẳn**
   * (không phải `null`, không phải chuỗi rỗng). Có ở cả bốn đường đọc: `POST`, `GET` danh sách,
   * `GET /:id`, `PATCH` — do một hàm dùng chung của máy chủ gắn vào (ADR-009 QĐ 4).
   *
   * Ca > 12h **vẫn được lưu** (ngành y tế / an ninh / cứu hộ), chỉ cảnh báo, không đổi mã HTTP.
   */
  warning?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkShiftApiBody {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  code?: string;
  status?: ShiftStatusApi;
}

export interface UpdateWorkShiftApiBody {
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  status?: ShiftStatusApi;
}

export interface WorkShiftListParams {
  search?: string;
  status?: ShiftStatusApi;
  page?: number;
  pageSize?: number;
  /** Đủ 4 giá trị máy chủ nhận (`workShifts.validator.ts`) — thiếu `startTime` là không sắp được theo giờ vào ca. */
  sortBy?: "code" | "name" | "startTime" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface WorkShiftListApiResponse {
  items: WorkShiftApiItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function listWorkShifts(
  params?: WorkShiftListParams,
): Promise<WorkShiftListApiResponse> {
  return api.get<WorkShiftListApiResponse>(BASE, { params });
}

export function getWorkShiftDetail(id: string): Promise<WorkShiftApiItem> {
  return api.get<WorkShiftApiItem>(`${BASE}/${encodeURIComponent(id)}`);
}

export function createWorkShift(
  body: CreateWorkShiftApiBody,
): Promise<WorkShiftApiItem> {
  return api.post<WorkShiftApiItem>(BASE, body);
}

/**
 * ⚠️ `PATCH`, **không phải `PUT`** — route thật là `app.patch('/work-shifts/:id')`. Fastify
 * không đăng ký `PUT` cho path này nên gọi `api.put` là **404 mọi lần sửa ca** (`FE-01`).
 *
 * `code` cố ý KHÔNG có trong `UpdateWorkShiftApiBody`: máy chủ **loại bỏ im lặng** rồi trả 200,
 * nên hiện ô sửa mã ca là để người dùng tưởng đã lưu (api-contract 7E.4).
 */
export function updateWorkShift(
  id: string,
  body: UpdateWorkShiftApiBody,
): Promise<WorkShiftApiItem> {
  return api.patch<WorkShiftApiItem>(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deleteWorkShift(
  id: string,
): Promise<{ id: string; message: string }> {
  return api.del<{ id: string; message: string }>(
    `${BASE}/${encodeURIComponent(id)}`,
  );
}
