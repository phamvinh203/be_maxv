import { useLocation } from "react-router-dom";
import ManHinhDangPhatTrien from "../../features/hrm/components/ManHinhDangPhatTrien";
import { MAN_HINH_HO_SO_LUONG } from "../../features/hrm/components/ho_so_luong/tabs";

/**
 * Chỗ giữ dùng chung cho cả mười bốn tab của khu "Hồ sơ lương".
 *
 * Tra nhãn và mô tả theo path đang mở thay vì viết một page cho mỗi tab: các màn
 * hình chỉ khác nhau đúng hai chuỗi đó, mà chúng đã nằm sẵn ở `tabs.ts`.
 */
export default function HoSoLuongChuaDungPage() {
  const { pathname } = useLocation();
  const manHinh = MAN_HINH_HO_SO_LUONG.find((mh) =>
    pathname.startsWith(`/hrm/ho-so-luong/${mh.path}`),
  );

  return (
    <ManHinhDangPhatTrien ten={manHinh?.label ?? "Hồ sơ lương"} moTa={manHinh?.moTa} />
  );
}
