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
  'he-thong': heThongConfig,
  'tong-hop': tongHopConfig,
  tien: tienConfig,
  'ban-hang': banHangConfig,
  'mua-hang': muaHangConfig,
  'ton-kho': tonKhoConfig,
  'gia-thanh': giaThanhConfig,
};

/** Thứ tự hiển thị module (menu khách hàng). */
export const MODULE_ORDER: { slug: string; title: string }[] = [
  { slug: 'he-thong', title: heThongConfig.title },
  { slug: 'tong-hop', title: tongHopConfig.title },
  { slug: 'tien', title: tienConfig.title },
  { slug: 'ban-hang', title: banHangConfig.title },
  { slug: 'mua-hang', title: muaHangConfig.title },
  { slug: 'ton-kho', title: tonKhoConfig.title },
  { slug: 'gia-thanh', title: giaThanhConfig.title },
];
