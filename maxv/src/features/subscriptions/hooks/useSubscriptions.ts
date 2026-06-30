import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listPlans,
  createPlan,
  updatePlan,
  listSubscriptions,
  changePlan,
  cancelSubscription,
  listSubscriptionHistory,
} from '@/features/subscriptions/api/subscriptionsApi';
import type {
  ListSubscriptionsParams,
  CreatePlanInput,
  UpdatePlanInput,
} from '@/features/subscriptions/types/subscription';

export const subKeys = {
  all: ['subscriptions'] as const,
  list: (p: ListSubscriptionsParams) => [...subKeys.all, 'list', p] as const,
  history: (id: string) => [...subKeys.all, 'history', id] as const,
};
export const planKeys = { all: ['plans'] as const };

// ---- queries ----
export function useSubscriptions(params: ListSubscriptionsParams) {
  return useSuspenseQuery({
    queryKey: subKeys.list(params),
    queryFn: () => listSubscriptions(params),
  });
}
export function usePlans() {
  return useSuspenseQuery({ queryKey: planKeys.all, queryFn: listPlans });
}
export function useSubscriptionHistory(id: string | null) {
  return useQuery({
    queryKey: subKeys.history(id ?? ''),
    queryFn: () => listSubscriptionHistory(id as string),
    enabled: Boolean(id),
  });
}

// ---- mutations ----
function useInvalidateSubs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: subKeys.all });
}

export function useChangePlan() {
  const invalidate = useInvalidateSubs();
  return useMutation({
    mutationFn: (v: { id: string; planId: string; ghiChu?: string }) =>
      changePlan(v.id, v.planId, v.ghiChu),
    onSuccess: invalidate,
  });
}

export function useCancelSubscription() {
  const invalidate = useInvalidateSubs();
  return useMutation({
    mutationFn: (id: string) => cancelSubscription(id),
    onSuccess: invalidate,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanInput) => createPlan(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: planKeys.all }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: UpdatePlanInput }) =>
      updatePlan(v.id, v.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.all });
      // tên/giá gói đổi -> làm mới luôn danh sách thuê bao (đang join plan)
      void qc.invalidateQueries({ queryKey: subKeys.all });
    },
  });
}
