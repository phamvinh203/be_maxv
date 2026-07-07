import type { AuthCompany, AuthUser } from './types/auth';

// Access token (15') ở localStorage. Refresh token nằm trong cookie httpOnly
// nên FE không (và không cần) đụng tới — chỉ cần withCredentials khi gọi /auth/refresh.
const TOKEN_KEY = 'maxv_client_access_token';
const USER_KEY = 'maxv_client_user';
const COMPANY_KEY = 'maxv_client_company';
const COMPANIES_KEY = 'maxv_client_companies';

/** Bắn khi danh sách MST đổi — để Select đổi MST ở header cập nhật ngay, không cần reload. */
export const COMPANIES_CHANGED_EVENT = 'maxv:companies-changed';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isNullableString = (v: unknown): v is string | null =>
  v === null || typeof v === 'string';

/**
 * localStorage attacker-writable (bất kỳ script nào chạy được trên origin đều sửa được).
 * Validate shape trước khi tin — dữ liệu sai hình dạng bị coi như không có, không throw
 * làm vỡ app. Đây chỉ là "hint" hiển thị (role/tenant hiện), MỌI quyền hạn thật vẫn phải
 * do backend tự xác thực lại qua JWT — validate ở đây chỉ chống app tự sập vì dữ liệu rác.
 */
function isAuthUser(v: unknown): v is AuthUser {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    isString(o.id) &&
    isString(o.hoTen) &&
    isString(o.email) &&
    isString(o.role) &&
    isNullableString(o.donViId)
  );
}

function isAuthCompany(v: unknown): v is AuthCompany {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    isString(o.id) &&
    isString(o.maSoThue) &&
    isString(o.slug) &&
    isString(o.tenDonVi) &&
    isString(o.status)
  );
}

/**
 * Slot localStorage JSON có type + validate shape trước khi trả về. Dữ liệu hỏng/không
 * đúng hình dạng -> coi như rỗng và tự dọn key hỏng, tránh lặp lại lỗi mỗi lần đọc.
 */
function createStorageSlot<T>(key: string, isValid: (v: unknown) => v is T) {
  return {
    get(): T | null {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      } catch {
        // JSON hỏng -> rơi xuống dọn key bên dưới.
      }
      localStorage.removeItem(key);
      return null;
    },
    set(value: T | null): void {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    },
  };
}

const isAuthCompanyArray = (v: unknown): v is AuthCompany[] =>
  Array.isArray(v) && v.every(isAuthCompany);

const userSlot = createStorageSlot<AuthUser>(USER_KEY, isAuthUser);
const companySlot = createStorageSlot<AuthCompany>(COMPANY_KEY, isAuthCompany);
const companiesSlot = createStorageSlot<AuthCompany[]>(COMPANIES_KEY, isAuthCompanyArray);

export function getUser(): AuthUser | null {
  return userSlot.get();
}

export function setUser(user: AuthUser): void {
  userSlot.set(user);
}

export function getCompany(): AuthCompany | null {
  return companySlot.get();
}

export function setCompany(company: AuthCompany | null): void {
  companySlot.set(company);
}

/** Danh sách MST/công ty tài khoản được phép — nguồn cho Select đổi MST ở header. */
export function getCompanies(): AuthCompany[] {
  return companiesSlot.get() ?? [];
}

export function setCompanies(companies: AuthCompany[]): void {
  companiesSlot.set(companies);
  window.dispatchEvent(new Event(COMPANIES_CHANGED_EVENT));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(COMPANY_KEY);
  localStorage.removeItem(COMPANIES_KEY);
}
