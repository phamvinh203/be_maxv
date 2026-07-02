import { api } from '@/lib/apiClient';
import type {
  HangHoa,
  HangHoaForm,
  HangHoaListParams,
  HangHoaListResult,
  Lookup,
} from '@/features/ton_kho/danh_muc/hang_hoa/types';

const BASE = '/ton-kho';

// ---------- Hàng hóa (dmvt) ----------

export function listHangHoa(
  params: HangHoaListParams,
): Promise<HangHoaListResult> {
  return api.get<HangHoaListResult>(`${BASE}/hang-hoa`, { params });
}

export function getHangHoa(maVt: string): Promise<HangHoa> {
  return api.get<HangHoa>(`${BASE}/hang-hoa/${encodeURIComponent(maVt)}`);
}

export function createHangHoa(body: HangHoaForm): Promise<{ ma_vt: string }> {
  return api.post<{ ma_vt: string }>(`${BASE}/hang-hoa`, body);
}

export function updateHangHoa(
  maVt: string,
  body: HangHoaForm,
): Promise<{ ma_vt: string }> {
  return api.put<{ ma_vt: string }>(
    `${BASE}/hang-hoa/${encodeURIComponent(maVt)}`,
    body,
  );
}

export function deleteHangHoa(maVt: string): Promise<{ ma_vt: string }> {
  return api.del<{ ma_vt: string }>(
    `${BASE}/hang-hoa/${encodeURIComponent(maVt)}`,
  );
}

export function doiMaHangHoa(
  ma_cu: string,
  ma_moi: string,
): Promise<{ ma_moi: string }> {
  return api.put<{ ma_moi: string }>(`${BASE}/hang-hoa/doi-ma`, {
    ma_cu,
    ma_moi,
  });
}

// ---------- Lookup danh mục (đổ dropdown trong form) ----------

interface DvtRow {
  dvt: string;
  dvt2: string | null;
}
interface LoaiVtRow {
  ma_loai_vt: string;
  ten_loai_vt: string;
}
interface KhoRow {
  ma_kho: string;
  ten_kho: string;
}
interface ThueRow {
  ma_thue: string;
  ten_thue: string;
}
interface NhomRow {
  ma_nh: string;
  ten_nh: string;
}

const toLookup = <T>(
  rows: T[],
  value: (r: T) => string,
  label: (r: T) => string,
): Lookup[] => rows.map((r) => ({ value: value(r), label: label(r) }));

export async function fetchLookups() {
  const [dvt, loai, kho, thue, thuenk, nh1, nh2, nh3] = await Promise.all([
    api.get<DvtRow[]>(`${BASE}/dvt`),
    api.get<LoaiVtRow[]>(`${BASE}/loai-vt`),
    api.get<KhoRow[]>(`${BASE}/kho`),
    api.get<ThueRow[]>(`${BASE}/thue`),
    api.get<ThueRow[]>(`${BASE}/thue-nk`),
    api.get<NhomRow[]>(`${BASE}/phan-nhom`, { params: { loai_nh: 1 } }),
    api.get<NhomRow[]>(`${BASE}/phan-nhom`, { params: { loai_nh: 2 } }),
    api.get<NhomRow[]>(`${BASE}/phan-nhom`, { params: { loai_nh: 3 } }),
  ]);

  return {
    dvtList: toLookup(dvt, (r) => r.dvt, (r) => r.dvt),
    dvtRaw: dvt.map((r) => ({ dvt: r.dvt, dvt2: r.dvt2 })),
    loaiList: toLookup(loai, (r) => r.ma_loai_vt, (r) => r.ten_loai_vt),
    khoList: toLookup(kho, (r) => r.ma_kho, (r) => `${r.ma_kho} — ${r.ten_kho}`),
    thueList: toLookup(thue, (r) => r.ma_thue, (r) => r.ten_thue),
    thuenkList: toLookup(thuenk, (r) => r.ma_thue, (r) => r.ten_thue),
    nh1List: toLookup(nh1, (r) => r.ma_nh, (r) => r.ten_nh),
    nh2List: toLookup(nh2, (r) => r.ma_nh, (r) => r.ten_nh),
    nh3List: toLookup(nh3, (r) => r.ma_nh, (r) => r.ten_nh),
  };
}
