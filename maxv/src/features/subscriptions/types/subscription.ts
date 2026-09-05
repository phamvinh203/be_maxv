export type SubStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED';

import type { UserModules } from '@/features/owners/modules';

export interface Plan {
  id: string;
  ma: string;
  ten: string;
  gia: string; // Decimal -> chuỗi
  chuKyThang: number;
  soMstToiDa: number | null;
  soNguoiToiDa: number | null;
  /** Module gói này cấp. Khóa ngoài `MODULE_KEYS` bị backend bỏ qua. */
  features: Partial<UserModules>;
  isActive: boolean;
  createdAt: string;
}

/** Chủ tài khoản (đơn vị billing) + số MST đang sở hữu. */
interface OwnerRef {
  id: string;
  hoTen: string;
  email: string;
  _count: { ownedDonVi: number };
}

interface PlanRef {
  id: string;
  ma: string;
  ten: string;
  gia: string;
}

export interface Subscription {
  id: string;
  ownerId: string;
  planId: string;
  status: SubStatus;
  batDau: string;
  ketThuc: string | null;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  owner: OwnerRef;
  plan: PlanRef;
}

export interface SubHistory {
  id: string;
  subscriptionId: string | null;
  ownerId: string;
  planId: string | null;
  hanhDong: string;
  giaTri: string | null;
  ghiChu: string | null;
  createdAt: string;
  plan: { ma: string; ten: string } | null;
}

export interface ListSubscriptionsParams {
  status?: SubStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePlanInput {
  ma: string;
  ten: string;
  gia: number;
  chuKyThang: number;
  soMstToiDa?: number | null;
  soNguoiToiDa?: number | null;
  isActive?: boolean;
  features?: Partial<UserModules>;
}

export type UpdatePlanInput = Partial<Omit<CreatePlanInput, 'ma'>>;

/**
 * Kết quả PATCH gói. Sửa `chuKyThang` sẽ dời hạn cho thuê bao đang dùng gói đó (chỉ kéo dài,
 * không rút ngắn — xem `hanMoiKhiDoiGoi` bên backend), nên server nói rõ đã chạm vào bao nhiêu
 * thuê bao. Im lặng ở đây nghĩa là admin không biết thao tác của mình ảnh hưởng tới mấy khách.
 */
export interface PlanUpdated extends Plan {
  soThueBaoDoiHan: number;
}
