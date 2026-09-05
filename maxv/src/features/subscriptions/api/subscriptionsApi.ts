import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type {
  Plan,
  Subscription,
  SubHistory,
  ListSubscriptionsParams,
  CreatePlanInput,
  UpdatePlanInput,
  PlanUpdated,
} from '@/features/subscriptions/types/subscription';

// ---- Gói dịch vụ ----
export function listPlans(): Promise<Plan[]> {
  return api.get<Plan[]>('/admin/plans');
}
export function createPlan(input: CreatePlanInput): Promise<Plan> {
  return api.post<Plan>('/admin/plans', input);
}
export function updatePlan(
  id: string,
  input: UpdatePlanInput,
): Promise<PlanUpdated> {
  return api.patch<PlanUpdated>(`/admin/plans/${id}`, input);
}
/** Chỉ xóa được gói chưa từng dùng; gói đã có thuê bao/lịch sử -> backend trả 409. */
export function deletePlan(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/admin/plans/${id}`);
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
/** Gia hạn theo chu kỳ của chính gói đang dùng — không đổi gói. */
export function renewSubscription(id: string): Promise<Subscription> {
  return api.post<Subscription>(`/admin/subscriptions/${id}/renew`);
}
export function cancelSubscription(id: string): Promise<Subscription> {
  return api.post<Subscription>(`/admin/subscriptions/${id}/cancel`);
}
export function listSubscriptionHistory(id: string): Promise<SubHistory[]> {
  return api.get<SubHistory[]>(`/admin/subscriptions/${id}/history`);
}
