import type { AuthCompany, AuthUser } from './types/auth';

// Access token (15') ở localStorage. Refresh token nằm trong cookie httpOnly
// nên FE không (và không cần) đụng tới — chỉ cần withCredentials khi gọi /auth/refresh.
const TOKEN_KEY = 'maxv_client_access_token';
const USER_KEY = 'maxv_client_user';
const COMPANY_KEY = 'maxv_client_company';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Slot localStorage JSON có type, dùng chung cho mọi giá trị object (user, company, ...). */
function createStorageSlot<T>(key: string) {
  return {
    get(): T | null {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    set(value: T | null): void {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    },
  };
}

const userSlot = createStorageSlot<AuthUser>(USER_KEY);
const companySlot = createStorageSlot<AuthCompany>(COMPANY_KEY);

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

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(COMPANY_KEY);
}
