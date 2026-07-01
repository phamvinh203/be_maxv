import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listInvites,
  approveInvite,
  rejectInvite,
} from '@/features/invites/api/invitesApi';
import type { ListInvitesParams } from '@/features/invites/types/invite';

export const inviteKeys = {
  all: ['invites'] as const,
  list: (p: ListInvitesParams) => [...inviteKeys.all, 'list', p] as const,
};

export function useInvites(params: ListInvitesParams) {
  return useSuspenseQuery({
    queryKey: inviteKeys.list(params),
    queryFn: () => listInvites(params),
  });
}

function useInvalidateInvites() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: inviteKeys.all });
}

export function useApproveInvite() {
  const invalidate = useInvalidateInvites();
  return useMutation({
    mutationFn: (id: string) => approveInvite(id),
    onSuccess: invalidate,
  });
}

export function useRejectInvite() {
  const invalidate = useInvalidateInvites();
  return useMutation({
    mutationFn: (v: { id: string; lyDoTuChoi?: string }) =>
      rejectInvite(v.id, v.lyDoTuChoi),
    onSuccess: invalidate,
  });
}
