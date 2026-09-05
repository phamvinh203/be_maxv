/**
 * Module đang bật cờ "đang phát triển" — thay vì route thật, mọi URL con của
 * module (kể cả gõ thẳng, không chỉ bấm nút ở header) trả về trang thông báo
 * "Tính năng đang phát triển". Xem cách dùng trong `routes/AppRouter.tsx`.
 *
 * Module xong thì đổi giá trị về `false`, route thật quay lại ngay — không
 * phải sửa lại route tree.
 */
const MODULE_UNDER_DEVELOPMENT = {
  hrm: true,
  accounting: true,
} as const;

/**
 * Module này có bị chặn ở bản build hiện tại không.
 *
 * Chỉ có hiệu lực trên bản build production (`npm run build`) — `npm run dev`
 * luôn vào route thật bất kể cờ trên, để không phải đổi `true`/`false` qua lại
 * mỗi lần code tiếp module đó. Muốn xem lại giao diện trang "đang phát triển"
 * lúc dev thì chạy `npm run build && npm run preview`.
 */
export function isModuleUnderDevelopment(
  module: keyof typeof MODULE_UNDER_DEVELOPMENT,
): boolean {
  return MODULE_UNDER_DEVELOPMENT[module] && import.meta.env.PROD;
}
