import type { CtTagTncn05 } from "../../../types/toKhaiThue";

export interface HangChiTieuTncn05 {
  stt: string;
  nhan: string;
  tag: CtTagTncn05;
  donVi: "Người" | "VNĐ";
  dam?: boolean;
}

export const HANG_TNCN05: HangChiTieuTncn05[] = [
  { stt: "1", nhan: "Tổng số người lao động:", tag: "ct16", donVi: "Người", dam: true },
  {
    stt: "",
    nhan: "Trong đó: Cá nhân cư trú có hợp đồng lao động từ 3 tháng trở lên",
    tag: "ct17",
    donVi: "Người",
  },
  {
    stt: "2",
    nhan: "Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20]",
    tag: "ct18",
    donVi: "Người",
    dam: true,
  },
  { stt: "2.1", nhan: "Cá nhân cư trú", tag: "ct19", donVi: "Người" },
  { stt: "2.2", nhan: "Cá nhân không cư trú", tag: "ct20", donVi: "Người" },
  {
    stt: "3",
    nhan: "Tổng thu nhập chịu thuế (TNCT) trả cho cá nhân [21]=[22]+[23]",
    tag: "ct21",
    donVi: "VNĐ",
    dam: true,
  },
  { stt: "3.1", nhan: "Cá nhân cư trú", tag: "ct22", donVi: "VNĐ" },
  { stt: "3.2", nhan: "Cá nhân không cư trú", tag: "ct23", donVi: "VNĐ" },
  {
    stt: "3.3",
    nhan:
      "Trong đó: Tổng thu nhập chịu thuế từ tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động",
    tag: "ct24",
    donVi: "VNĐ",
  },
  {
    stt: "4",
    nhan: "Trong đó: Tổng thu nhập chịu thuế được miễn theo quy định của Hợp đồng dầu khí",
    tag: "ct25",
    donVi: "VNĐ",
    dam: true,
  },
  {
    stt: "5",
    nhan: "Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế [26]=[27]+[28]",
    tag: "ct26",
    donVi: "VNĐ",
    dam: true,
  },
  { stt: "5.1", nhan: "Cá nhân cư trú", tag: "ct27", donVi: "VNĐ" },
  { stt: "5.2", nhan: "Cá nhân không cư trú", tag: "ct28", donVi: "VNĐ" },
  {
    stt: "6",
    nhan: "Tổng số thuế thu nhập cá nhân đã khấu trừ [29]=[30]+[31]",
    tag: "ct29",
    donVi: "VNĐ",
    dam: true,
  },
  { stt: "6.1", nhan: "Cá nhân cư trú", tag: "ct30", donVi: "VNĐ" },
  { stt: "6.2", nhan: "Cá nhân không cư trú", tag: "ct31", donVi: "VNĐ" },
  {
    stt: "6.3",
    nhan:
      "Trong đó: Tổng số thuế thu nhập cá nhân đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động",
    tag: "ct32",
    donVi: "VNĐ",
  },
];

// Danh sách chỉ tiêu sửa được KHÔNG chép ở đây nữa (hợp đồng Mục 5.1): lấy `ctGocSuaDuoc` từ phản hồi
// máy chủ. Giữ bản sao ở giao diện là tự tạo nguồn sự thật thứ hai, hôm mẫu tờ khai đổi là lệch ngay.

