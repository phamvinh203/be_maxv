// Envelope thống nhất từ backend: { success, data } hoặc { success:false, message/errors }.
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  message?: string;
  errors?: { message?: string }[];
}
