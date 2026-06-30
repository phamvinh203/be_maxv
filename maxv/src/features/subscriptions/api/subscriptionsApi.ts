import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type {
  Plan,
  Subscription,
  SubHistory,
  ListSubscriptionsParams,
  CreatePlanInput,
  UpdatePlanInput,
} from '@/features/subscriptions/types/subscription';

// ---- Gói dịch vụ ----
export function listPlans(): Promise<Plan[]> {
  return api.get<Plan[]>('/admin/plans');
}
export function createPlan(input: CreatePlanInput): Promise<Plan> {
  return api.post<Plan>('/admin/plans', input);
}
export function updatePlan(id: string, input: UpdatePlanInput): Promise<Plan> {
  return api.patch<Plan>(`/admin/plans/${id}`, input);
}

// ---- Thuê bao ----
export function listSubscriptions(
  params: ListSubscriptionsParams,
): Promise<Paginated<Subscription>> {
  return api.get<Paginated<Subscription>>('/admin/subscriptions', { params });
}
export function changePlan(
  id: string,
  planId: string,
  ghiChu?: string,
): Promise<Subscription> {
  return api.post<Subscription>(`/admin/subscriptions/${id}/change-plan`, {
    planId,
    ghiChu,
  });
}
export function cancelSubscription(id: string): Promise<Subscription> {
  return api.post<Subscription>(`/admin/subscriptions/${id}/cancel`);
}
export function listSubscriptionHistory(id: string): Promise<SubHistory[]> {
  return api.get<SubHistory[]>(`/admin/subscriptions/${id}/history`);
}
