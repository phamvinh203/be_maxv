/** Hàm hiển thị dùng chung của khu HRM — thuần, không phụ thuộc React. */

import type { LuaChon } from "./constants";

/** `2026-08-11` → `11/08/2026`. Chuỗi rỗng hoặc sai định dạng trả về `—`. */
export function ngayVn(iso: string): string {
  const phan = iso.split("-");
  if (phan.length !== 3) return "—";
  const [nam, thang, ngay] = phan;
  return `${ngay}/${thang}/${nam}`;
}

/** `2026-08` → `08/2026`. */
function thangVn(iso: string): string {
  const phan = iso.split("-");
  if (phan.length !== 2) return "";
  const [nam, thang] = phan;
  return `${thang}/${nam}`;
}

/** `15000000` → `15.000.000`. */
export function tienVn(so: number): string {
  return so.toLocaleString("vi-VN");
}

/**
 * Bỏ mọi ký tự không phải số — dùng cho ô nhập tiền có dấu phân cách.
 *
 * CHỦ Ý chỉ nhận số KHÔNG ÂM: dấu `-` bị coi là ký tự rác và loại bỏ cùng các ký tự khác (tiền/mã
 * số trong HRM không âm) — ô nào thật sự cần nhập số âm phải dùng hàm khác, KHÔNG dùng `chiSo`.
 * Kẹp trần `MAX_SAFE_INTEGER` để không tràn khi dán chuỗi số quá dài.
 */
export function chiSo(text: string): number {
  const so = Number(text.replace(/\D/g, ""));
  if (!Number.isFinite(so)) return 0;
  return Math.min(so, Number.MAX_SAFE_INTEGER);
}

/** Tra nhãn hiển thị từ mã. Mã lạ thì trả lại chính nó, không nuốt mất dữ liệu. */
export function nhan<T extends string>(danhSach: LuaChon<T>[], ma: string): string {
  return danhSach.find((item) => item.value === ma)?.label ?? ma;
}

/** `01/2026 – 12/2026`, để trống đến tháng thì `01/2026 – nay`. */
export function kyGiamTru(tuThang: string, denThang: string): string {
  if (!tuThang) return "—";
  return `${thangVn(tuThang)} – ${denThang ? thangVn(denThang) : "nay"}`;
}

/** `08:00` → số phút từ nửa đêm. Sai định dạng (kể cả không phải số) trả `0`. */
function phutTrongNgay(hhmm: string): number {
  const phan = hhmm.split(":");
  if (phan.length !== 2) return 0;
  const gio = Number(phan[0]);
  const phut = Number(phan[1]);
  if (!Number.isFinite(gio) || !Number.isFinite(phut)) return 0;
  return gio * 60 + phut;
}

/**
 * Số giờ công của một ca, đã trừ nghỉ giữa ca.
 *
 * Giờ ra ≤ giờ vào nghĩa là ca qua đêm (vd 22:00 → 06:00) nên cộng thêm 24 giờ,
 * không phải dữ liệu sai.
 */
export function soGioCa(gioVao: string, gioRa: string, nghiPhut: number): number {
  if (!gioVao || !gioRa) return 0;
  const vao = phutTrongNgay(gioVao);
  const ra = phutTrongNgay(gioRa);
  const tong = (ra > vao ? ra - vao : ra + 24 * 60 - vao) - nghiPhut;
  return Math.max(0, Math.round((tong / 60) * 100) / 100);
}

/** Hôm nay dạng `YYYY-MM-DD` theo giờ máy — dùng làm mốc so sánh hợp đồng. */
export function homNay(): string {
  const d = new Date();
  const thang = String(d.getMonth() + 1).padStart(2, "0");
  const ngay = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${thang}-${ngay}`;
}

/**
 * Cảnh báo MỀM khi số chữ số không khớp độ dài thường gặp (CCCD/SĐT/MST) — KHÔNG chặn submit:
 * hồ sơ cũ (CMND 9 số trước khi đổi sang CCCD 12 số...) có thể lệch chuẩn mà vẫn là dữ liệu thật.
 * Dùng ở `ThongTinTab.tsx` (nhân viên) và `NguoiPhuThuocForm.tsx` (người phụ thuộc).
 */
export function canhBaoDoDai(gia: string, doDaiHopLe: number[]): string | undefined {
  const so = gia.replace(/\D/g, "");
  if (!so) return undefined;
  return doDaiHopLe.includes(so.length) ? undefined : `Thường có ${doDaiHopLe.join(" hoặc ")} số.`;
}
