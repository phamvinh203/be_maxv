import { api } from '@/lib/apiClient';
import { clearSession } from '@/features/auth/token';
import type {
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
} from '@/features/auth/types/auth';

export function login(input: LoginInput): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/login', input);
}

export function register(input: RegisterInput): Promise<RegisterResult> {
  return api.post<RegisterResult>('/auth/register', input);
}

export async function logout(): Promise<void> {
  try {
    await api.post<void>('/auth/logout');
  } finally {
    clearSession();
  }
}
