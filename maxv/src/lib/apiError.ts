import { AxiosError } from 'axios';

/**
 * Bóc message backend trả về trong envelope lỗi `{ success: false, message }`.
 * Rơi về message của axios (mạng chập, timeout) khi không có envelope.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi';
}

/** True khi lỗi là HTTP response đúng `status` (vd 409 = xung đột nghiệp vụ). */
export function isHttpStatus(error: unknown, status: number): boolean {
  return error instanceof AxiosError && error.response?.status === status;
}
