import { createContext } from 'react';
import type { AuthContextValue } from '@/features/auth/types/auth';

// Tách khỏi AuthProvider.tsx để file component chỉ export component (react-refresh).
export const AuthContext = createContext<AuthContextValue | null>(null);
