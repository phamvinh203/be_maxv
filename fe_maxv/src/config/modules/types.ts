import type { ReactNode } from 'react';

export interface ChungTuItem {
  label: string;
  path: string;
  icon: ReactNode;
}

export interface DanhMucRow {
  left: { label: string; path: string };
  right?: { label: string; path: string };
}

export interface BaoCaoGroup {
  items: string[];
}

export interface ModuleConfig {
  title: string; // tên module, ví dụ "Tồn kho"
  chungTu: ChungTuItem[];
  danhMuc: DanhMucRow[];
  baoCao: BaoCaoGroup[];
}
