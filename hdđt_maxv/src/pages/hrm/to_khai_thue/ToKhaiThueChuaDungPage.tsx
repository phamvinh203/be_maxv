import ManHinhDangPhatTrien from "../../../components/ManHinhDangPhatTrien";

interface Props {
  ten: string;
  moTa?: string;
}

/**
 * Chỗ giữ dùng chung cho cả năm tab của khu "Tờ khai thuế".
 *
 * NB-3: nhãn/mô tả nhận thẳng qua props (route sinh từ `MAN_HINH_TO_KHAI_THUE` truyền vào,
 * xem `routes/AppRouter.tsx`) thay vì tự tra bằng `useLocation` + `pathname.startsWith`+`find` —
 * cách cũ khớp nhầm phần tử ĐẦU TIÊN có path là tiền tố của path đang mở.
 */
export default function ToKhaiThueChuaDungPage({ ten, moTa }: Props) {
  return <ManHinhDangPhatTrien ten={ten} moTa={moTa} />;
}
