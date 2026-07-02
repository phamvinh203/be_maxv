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

/** Kho (dmkho). */
export function listKho(db: PrismaClient) {
  return db.dmkho.findMany({
    select: {
      ma_kho: true,
      ma_dvcs: true,
      ten_kho: true,
      ten_kho2: true,
      dai_ly_yn: true,
      ma_nh: true,
      ghi_chu: true,
      status: true,
    },
    orderBy: { ma_kho: 'asc' },
  });
}

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

/** Phân nhóm vật tư (dmnhvt) — lọc theo loai_nh (1|2|3). */
export function listPhanNhom(db: PrismaClient, loaiNh?: number) {
  return db.dmnhvt.findMany({
    where: loaiNh ? { loai_nh: loaiNh } : undefined,
    select: {
      loai_nh: true,
      ma_nh: true,
      ten_nh: true,
      ten_nh2: true,
      status: true,
    },
    orderBy: [{ loai_nh: 'asc' }, { ma_nh: 'asc' }],
  });
}
