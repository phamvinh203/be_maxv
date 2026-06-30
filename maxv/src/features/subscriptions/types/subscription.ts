export type SubStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED';

export interface Plan {
  id: string;
  ma: string;
  ten: string;
  gia: string; // Decimal -> chuỗi
  chuKyThang: number;
  soNguoiToiDa: number | null;
  features: unknown;
  isActive: boolean;
  createdAt: string;
}

interface CompanyRef {
  id: string;
  maSoThue: string;
  tenDonVi: string;
  status: string;
}

interface PlanRef {
  id: string;
  ma: string;
  ten: string;
  gia: string;
}

export interface Subscription {
  id: string;
  donViId: string;
  planId: string;
  status: SubStatus;
  batDau: string;
  ketThuc: string | null;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  donVi: CompanyRef;
  plan: PlanRef;
}

export interface SubHistory {
  id: string;
  subscriptionId: string | null;
  donViId: string;
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
  soNguoiToiDa?: number | null;
  isActive?: boolean;
}

export type UpdatePlanInput = Partial<Omit<CreatePlanInput, 'ma'>>;
