import { useLocation } from "react-router-dom";
import ManHinhDangPhatTrien from "../../features/hrm/components/ManHinhDangPhatTrien";
import { MAN_HINH_TO_KHAI_THUE } from "../../features/hrm/components/to_khai_thue/tabs";

/**
 * Chỗ giữ dùng chung cho cả năm tab của khu "Tờ khai thuế".
 *
 * Tra nhãn và mô tả theo path đang mở thay vì viết một page cho mỗi tab: năm màn
 * hình chỉ khác nhau đúng hai chuỗi đó, mà chúng đã nằm sẵn ở `tabs.ts`.
 */
export default function ToKhaiThueChuaDungPage() {
  const { pathname } = useLocation();
  const manHinh = MAN_HINH_TO_KHAI_THUE.find((mh) =>
    pathname.startsWith(`/hrm/to-khai-thue/${mh.path}`),
  );

  return (
    <ManHinhDangPhatTrien ten={manHinh?.label ?? "Tờ khai thuế"} moTa={manHinh?.moTa} />
  );
}
