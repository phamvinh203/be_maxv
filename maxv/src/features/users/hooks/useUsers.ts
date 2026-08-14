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
  deleteUser,
} from '@/features/users/api/usersApi';
import { companyKeys } from '@/features/companies/hooks/useCompanies';
import { ownerKeys } from '@/features/owners/hooks/useOwners';
import { inviteKeys } from '@/features/invites/hooks/useInvites';
import { subKeys } from '@/features/subscriptions/hooks/useSubscriptions';
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

/**
 * Xóa 1 user kéo theo cascade cả nhân viên, công ty, thuê bao và lời mời của họ, nên
 * phải làm mới mọi danh sách đang hiển thị các thực thể đó — chỉ invalidate 'users'
 * thì admin chuyển sang tab khác sẽ thấy bản ghi đã chết.
 */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; email: string }) => deleteUser(v.id, v.email),
    onSuccess: () => {
      for (const key of [
        userKeys.all,
        companyKeys.all,
        ownerKeys.all,
        subKeys.all,
        inviteKeys.all,
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
