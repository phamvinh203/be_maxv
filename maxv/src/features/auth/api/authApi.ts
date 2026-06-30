import { api } from '@/lib/apiClient';
import type { LoginInput, LoginResult } from '@/features/auth/types/auth';

export function login(input: LoginInput): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/login', input);
}

export function logout(): Promise<void> {
  return api.post<void>('/auth/logout');
}
