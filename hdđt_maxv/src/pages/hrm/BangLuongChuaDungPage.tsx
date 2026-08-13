import { useLocation } from "react-router-dom";
import ManHinhDangPhatTrien from "../../features/hrm/components/ManHinhDangPhatTrien";
import { MAN_HINH_BANG_LUONG } from "../../features/hrm/components/bang_luong/tabs";

/**
 * Chỗ giữ dùng chung cho cả hai tab của khu "Bảng lương".
 *
 * Tra nhãn và mô tả theo path đang mở thay vì viết một page cho mỗi tab: hai màn
 * hình chỉ khác nhau đúng hai chuỗi đó, mà chúng đã nằm sẵn ở `tabs.ts`.
 */
export default function BangLuongChuaDungPage() {
  const { pathname } = useLocation();
  const manHinh = MAN_HINH_BANG_LUONG.find((mh) =>
    pathname.startsWith(`/hrm/bang-luong/${mh.path}`),
  );

  return (
    <ManHinhDangPhatTrien ten={manHinh?.label ?? "Bảng lương"} moTa={manHinh?.moTa} />
  );
}
