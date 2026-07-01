import type { ModuleConfig } from './types';
import { heThongConfig } from './he-thong';
import { tongHopConfig } from './tong-hop';
import { tienConfig } from './tien';
import { banHangConfig } from './ban-hang';
import { muaHangConfig } from './mua-hang';
import { tonKhoConfig } from './ton-kho';
import { giaThanhConfig } from './gia-thanh';

export type {
  ModuleConfig,
  ChungTuItem,
  DanhMucRow,
  BaoCaoGroup,
} from './types';

/** Tra cứu module theo slug (khớp path /:slug ở client). */
export const MODULES: Record<string, ModuleConfig> = {
  'he_thong': heThongConfig,
  'tong_hop': tongHopConfig,
  'tien': tienConfig,
  'ban_hang': banHangConfig,
  'mua_hang': muaHangConfig,
  'ton_kho': tonKhoConfig,
  'gia_thanh': giaThanhConfig,
};

/** Thứ tự hiển thị module (menu khách hàng). */
export const MODULE_ORDER: { slug: string; title: string }[] = [
  { slug: 'he_thong', title: heThongConfig.title },
  { slug: 'tong_hop', title: tongHopConfig.title },
  { slug: 'tien', title: tienConfig.title },
  { slug: 'ban_hang', title: banHangConfig.title },
  { slug: 'mua_hang', title: muaHangConfig.title },
  { slug: 'ton_kho', title: tonKhoConfig.title },
  { slug: 'gia_thanh', title: giaThanhConfig.title },
];
