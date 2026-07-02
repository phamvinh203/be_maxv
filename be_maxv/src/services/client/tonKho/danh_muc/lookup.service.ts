import type { PrismaClient } from '../../../../generated/tenant';

// Đơn vị tính (dmdvt) do dvt.service.ts sở hữu (GET /ton-kho/dvt).

/** Loại vật tư (dmloaivt) — chỉ bản ghi đang dùng. */
export function listLoaiVt(db: PrismaClient) {
  return db.dmloaivt.findMany({
    where: { status: '1' },
    select: { ma_loai_vt: true, ten_loai_vt: true },
    orderBy: { ma_loai_vt: 'asc' },
  });
}

// Kho (dmkho) do kho.service.ts sở hữu (GET /ton-kho/kho).

/** Thuế GTGT (dmthue) — chỉ bản ghi đang dùng. */
export function listThue(db: PrismaClient) {
  return db.dmthue.findMany({
    where: { status: '1' },
    select: { ma_thue: true, ten_thue: true, ty_le: true },
    orderBy: { ma_thue: 'asc' },
  });
}

/** Thuế nhập khẩu (dmthuenk) — chỉ bản ghi đang dùng. */
export function listThueNk(db: PrismaClient) {
  return db.dmthuenk.findMany({
    where: { status: '1' },
    select: {
      ma_thue: true,
      ten_thue: true,
      ten_thue2: true,
      thue_suat: true,
      tk_thue: true,
    },
    orderBy: { ma_thue: 'asc' },
  });
}

// Phân nhóm (dmnhvt) do phanNhom.service.ts sở hữu (GET /ton-kho/phan-nhom).
