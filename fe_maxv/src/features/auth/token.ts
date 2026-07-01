import type { AuthUser } from './types/auth';

// Access token (15') ở localStorage. Refresh token nằm trong cookie httpOnly
// nên FE không (và không cần) đụng tới — chỉ cần withCredentials khi gọi /auth/refresh.
const TOKEN_KEY = 'maxv_client_access_token';
const USER_KEY = 'maxv_client_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
