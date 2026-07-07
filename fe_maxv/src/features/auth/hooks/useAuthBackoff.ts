import { useCallback, useEffect, useState } from 'react';

const BASE_MS = 2000;
const MAX_MS = 30000;

/**
 * Backoff phía CLIENT sau các lần đăng nhập sai liên tiếp — chỉ là UX + phòng vệ sâu,
 * KHÔNG thay thế rate-limit thật (đã có ở backend /auth/login). Dữ liệu chỉ tồn tại
 * trong state React (mất khi reload) — kẻ tấn công dùng script/curl bỏ qua dễ dàng,
 * nhưng vẫn chặn được việc vô tình double-submit/spam nhanh qua UI thật.
 *
 * 2 lần sai đầu chưa khóa (tránh làm phiền khi gõ nhầm) — từ lần 3 khóa tăng dần
 * theo cấp số nhân (2s, 4s, 8s...), tối đa 30s. Reset về 0 khi đăng nhập thành công.
 */
export function useLoginBackoff() {
  const [, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setLockedUntil(null);
        setRemainingSec(0);
      } else {
        setRemainingSec(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const reportFailure = useCallback(() => {
    setFailCount((n) => {
      const next = n + 1;
      if (next >= 3) {
        const delay = Math.min(BASE_MS * 2 ** (next - 3), MAX_MS);
        setLockedUntil(Date.now() + delay);
      }
      return next;
    });
  }, []);

  const reportSuccess = useCallback(() => {
    setFailCount(0);
    setLockedUntil(null);
  }, []);

  return { locked: remainingSec > 0, remainingSec, reportFailure, reportSuccess };
}

/**
 * Cooldown đơn giản sau MỖI lần submit (không phân biệt thành công/lỗi) — dùng cho
 * form đăng ký để chống spam tạo tài khoản qua double-click/double-submit nhanh.
 * Cũng chỉ là UX; chặn thật (per-IP/per-account) phải ở backend /auth/register.
 */
export function useSubmitCooldown(seconds = 3) {
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setLockedUntil(null);
        setRemainingSec(0);
      } else {
        setRemainingSec(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const startCooldown = useCallback(() => {
    setLockedUntil(Date.now() + seconds * 1000);
  }, [seconds]);

  return { locked: remainingSec > 0, remainingSec, startCooldown };
}
