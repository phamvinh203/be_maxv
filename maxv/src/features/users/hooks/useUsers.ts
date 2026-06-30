import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listUsers,
  activateUser,
  deactivateUser,
  changeUserRole,
  resetUserPassword,
} from '@/features/users/api/usersApi';
import type { ListUsersParams, Role } from '@/features/users/types/user';

export const userKeys = {
  all: ['users'] as const,
  list: (p: ListUsersParams) => [...userKeys.all, 'list', p] as const,
};

export function useUsers(params: ListUsersParams) {
  return useSuspenseQuery({
    queryKey: userKeys.list(params),
    queryFn: () => listUsers(params),
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: userKeys.all });
}

export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      v.active ? activateUser(v.id) : deactivateUser(v.id),
    onSuccess: invalidate,
  });
}

export function useChangeUserRole() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (v: { id: string; role: Role }) => changeUserRole(v.id, v.role),
    onSuccess: invalidate,
  });
}

// Reset mật khẩu không đổi danh sách -> không cần invalidate; trả password 1 lần.
export function useResetPassword() {
  return useMutation({ mutationFn: (id: string) => resetUserPassword(id) });
}
