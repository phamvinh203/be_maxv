import type { ModuleConfig } from "./types";

export const banHangConfig: ModuleConfig = {
  title: "Bán hàng",

  chungTu: [
    {
      label: "Hóa đơn bán hàng",
      path: "/ban-hang/chung_tu/hoa-don-ban-hang",
      icon: <IcoHoaDonBan />,
    },
    {
      label: "Phiếu nhập hàng bán trả lại",
      path: "/ban-hang/chung_tu/tra-lai",
      icon: <IcoTraLai />,
    },
    {
      label: "Hóa đơn điều chỉnh giá hàng bán",
      path: "/ban-hang/chung_tu/dieu-chinh-gia",
      icon: <IcoDieuChinhGia />,
    },
    {
      label: "Hóa đơn dịch vụ",
      path: "/ban-hang/chung_tu/hoa-don-dv",
      icon: <IcoHoaDonDV />,
    },
    {
      label: "Hóa đơn dịch vụ trả lại",
      path: "/ban-hang/chung_tu/hoa-don-dv-tra-lai",
      icon: <IcoHoaDonDVTraLai />,
    },
    {
      label: "Hóa đơn giảm giá hàng hóa - dịch vụ",
      path: "/ban-hang/chung_tu/giam-gia",
      icon: <IcoGiamGia />,
    },
    {
      label: "Bù trừ công nợ",
      path: "/ban-hang/chung_tu/bu-tru-cong-no",
      icon: <IcoBuTru />,
    },
    {
      label: "Phân bổ tiền thu hóa đơn",
      path: "/ban-hang/chung_tu/phan-bo-tien-thu",
      icon: <IcoPhanBo />,
    },
    {
      label: "Phân bổ tiền thu tự động hóa đơn",
      path: "/ban-hang/chung_tu/phan-bo-tu-dong",
      icon: <IcoPhanBoTD />,
    },
    {
      label: "Tất toán cho các hóa đơn",
      path: "/ban-hang/chung_tu/tat-toan",
      icon: <IcoTatToan />,
    },
    {
      label: "Đánh giá CLTG hóa đơn",
      path: "/ban-hang/chung_tu/danh-gia-cltg",
      icon: <IcoCLTG />,
    },
    {
      label: "Cập nhật giá bán",
      path: "/ban-hang/chung_tu/cap-nhat-gia",
      icon: <IcoCapNhatGia />,
    },
  ],

  danhMuc: [
    {
      left: { label: "Danh mục khách hàng", path: "/ban-hang/dm/khach-hang" },
      right: {
        label: "Danh mục phân nhóm khách hàng",
        path: "/ban-hang/dm/phan-nhom-kh",
      },
    },
    {
      left: { label: "Danh mục thanh toán", path: "/ban-hang/dm/thanh-toan" },
      right: { label: "Danh mục hợp đồng", path: "/ban-hang/dm/hop-dong" },
    },
    {
      left: {
        label: "Danh mục nhóm hợp đồng",
        path: "/ban-hang/dm/nhom-hop-dong",
      },
      right: {
        label: "Danh mục nhân viên bán hàng",
        path: "/ban-hang/dm/nhan-vien-bh",
      },
    },
    {
      left: {
        label: "Nhập số dư ban đầu khách hàng",
        path: "/ban-hang/dm/so-du-kh",
      },
      right: {
        label: "Nhập số dư ban đầu hóa đơn",
        path: "/ban-hang/dm/so-du-hd",
      },
    },
    {
      left: {
        label: "Nhập số dư ban đầu hợp đồng",
        path: "/ban-hang/dm/so-du-hop-dong",
      },
      right: {
        label: "Kết chuyển số dư hợp đồng sang năm sau",
        path: "/ban-hang/dm/ket-chuyen-hd",
      },
    },
  ],

  baoCao: [
    {
      items: [
        "Sổ chi tiết công nợ khách hàng",
        "Bảng cân đối phát sinh công nợ (một tài khoản)",
        "Bảng cân đối phát sinh công nợ (nhiều tài khoản)",
        "Sổ đối chiếu công nợ",
        "Bảng xác nhận công nợ",
        "Bảng tổng hợp số dư công nợ",
      ],
    },
    {
      items: [
        "Sổ chi tiết công nợ (nhiều khách hàng)",
        "Sổ đối chiếu công nợ (nhiều khách hàng)",
        "Bảng xác nhận nợ (nhiều khách hàng)",
      ],
    },
    {
      items: [
        "Bảng kê hóa đơn bán hàng",
        "Bảng kê hóa đơn bán hàng bị trả lại",
        "Bảng kê hóa đơn bán hàng, dịch vụ",
      ],
    },
    {
      items: [
        "Báo cáo tổng hợp hàng bán",
        "Báo cáo tổng hợp hàng bán trả lại",
        "Báo cáo tổng hợp hàng bán theo tháng",
        "Báo cáo bán hàng theo 2 chỉ tiêu",
        "Báo cáo tổng hợp bán hàng 3 chỉ tiêu",
      ],
    },
    {
      items: [
        "Báo cáo tổng hợp bán hàng theo thời gian",
        "Báo cáo tổng hợp bán hàng nhiều kỳ",
        "Báo cáo tổng hợp bán hàng theo 2 chỉ tiêu nhiều kỳ",
      ],
    },
    {
      items: [
        "Bảng kê chứng từ theo hợp đồng",
        "Sổ chi tiết hợp đồng",
        "Bảng cân đối phát sinh theo hợp đồng",
        "Báo cáo số dư hợp đồng",
      ],
    },
    {
      items: [
        "Bảng kê công nợ phải thu theo hóa đơn",
        "Bảng kê chi tiết thu tiền của các hóa đơn",
        "Bảng kê chi tiết thu tiền của các hóa đơn có CLTG",
        "Bảng kê công nợ của các hóa đơn theo hạn thanh toán",
        "Báo cáo các hóa đơn sắp đến hạn thanh toán",
        "In bút toán tất toán số dư cho các hóa đơn",
      ],
    },
    {
      items: ["In Hóa đơn hàng bán", "In Hóa đơn dịch vụ"],
    },
  ],
};

// ── Icons chứng từ ─────────────────────────────────────────────────────────

function IcoHoaDonBan() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="10"
        y="6"
        width="44"
        height="52"
        rx="3"
        fill="#fff8e1"
        stroke="#f9a825"
        strokeWidth="2"
      />
      <rect x="10" y="6" width="44" height="14" rx="3" fill="#f9a825" />
      <text
        x="32"
        y="18"
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="white"
      >
        INVOICE
      </text>
      <line
        x1="18"
        y1="30"
        x2="46"
        y2="30"
        stroke="#f9a825"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="38"
        x2="46"
        y2="38"
        stroke="#f9a825"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="46"
        x2="36"
        y2="46"
        stroke="#f9a825"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoTraLai() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="10"
        y="10"
        width="38"
        height="44"
        rx="3"
        fill="#fce4ec"
        stroke="#e91e63"
        strokeWidth="2"
      />
      <rect x="10" y="10" width="38" height="13" rx="3" fill="#e91e63" />
      <text
        x="29"
        y="21"
        textAnchor="middle"
        fontSize="8"
        fontWeight="bold"
        fill="white"
      >
        INVOICE
      </text>
      <path
        d="M44 36 L38 30 L44 24"
        stroke="#e91e63"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line
        x1="38"
        y1="30"
        x2="52"
        y2="30"
        stroke="#e91e63"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoDieuChinhGia() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="8"
        y="8"
        width="38"
        height="48"
        rx="3"
        fill="#fff3e0"
        stroke="#ff6f00"
        strokeWidth="2"
      />
      <rect x="8" y="8" width="38" height="13" rx="3" fill="#ff6f00" />
      <text
        x="27"
        y="19"
        textAnchor="middle"
        fontSize="8"
        fontWeight="bold"
        fill="white"
      >
        INVOICE
      </text>
      <line
        x1="16"
        y1="32"
        x2="38"
        y2="32"
        stroke="#ff6f00"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="40"
        x2="38"
        y2="40"
        stroke="#ff6f00"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="46" r="10" fill="#ff6f00" />
      <text
        x="48"
        y="50"
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        fill="white"
      >
        ✎
      </text>
    </svg>
  );
}

function IcoHoaDonDV() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="10"
        y="8"
        width="44"
        height="48"
        rx="3"
        fill="#e8eaf6"
        stroke="#3949ab"
        strokeWidth="2"
      />
      <rect x="10" y="8" width="44" height="14" rx="3" fill="#3949ab" />
      <text
        x="32"
        y="20"
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="white"
      >
        INVOICE
      </text>
      <circle
        cx="32"
        cy="40"
        r="10"
        fill="none"
        stroke="#3949ab"
        strokeWidth="2"
      />
      <path
        d="M28 40h8M32 36v8"
        stroke="#3949ab"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoHoaDonDVTraLai() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="10"
        y="8"
        width="38"
        height="48"
        rx="3"
        fill="#f3e5f5"
        stroke="#7b1fa2"
        strokeWidth="2"
      />
      <rect x="10" y="8" width="38" height="13" rx="3" fill="#7b1fa2" />
      <text
        x="29"
        y="19"
        textAnchor="middle"
        fontSize="8"
        fontWeight="bold"
        fill="white"
      >
        INVOICE
      </text>
      <path
        d="M36 38 L30 32 L36 26"
        stroke="#7b1fa2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line
        x1="30"
        y1="32"
        x2="44"
        y2="32"
        stroke="#7b1fa2"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoGiamGia() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="8"
        y="8"
        width="44"
        height="48"
        rx="3"
        fill="#e8f5e9"
        stroke="#2e7d32"
        strokeWidth="2"
      />
      <rect x="8" y="8" width="44" height="14" rx="3" fill="#2e7d32" />
      <text
        x="30"
        y="20"
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="white"
      >
        INVOICE
      </text>
      <text
        x="30"
        y="40"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill="#2e7d32"
      >
        %
      </text>
      <line
        x1="20"
        y1="48"
        x2="40"
        y2="48"
        stroke="#2e7d32"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoBuTru() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="6"
        y="14"
        width="52"
        height="36"
        rx="4"
        fill="#ffebee"
        stroke="#c62828"
        strokeWidth="2"
      />
      <text
        x="32"
        y="26"
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        fill="#c62828"
      >
        DEBT
      </text>
      <line
        x1="12"
        y1="34"
        x2="52"
        y2="34"
        stroke="#c62828"
        strokeWidth="1.5"
      />
      <text x="32" y="46" textAnchor="middle" fontSize="10" fill="#c62828">
        Bù trừ
      </text>
    </svg>
  );
}

function IcoPhanBo() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="6"
        y="14"
        width="52"
        height="36"
        rx="4"
        fill="#e3f2fd"
        stroke="#1565c0"
        strokeWidth="2"
      />
      <text
        x="32"
        y="28"
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        fill="#1565c0"
      >
        VAT
      </text>
      <path
        d="M18 42 L28 38 L38 44 L48 36"
        stroke="#1565c0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IcoPhanBoTD() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="6"
        y="14"
        width="52"
        height="36"
        rx="4"
        fill="#e8f5e9"
        stroke="#2e7d32"
        strokeWidth="2"
      />
      <text
        x="32"
        y="28"
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        fill="#2e7d32"
      >
        TAX
      </text>
      <path
        d="M18 42 L28 36 L38 42 L48 34"
        stroke="#2e7d32"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="48" cy="20" r="6" fill="#2e7d32" />
      <path
        d="M45 20l2 2 4-4"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoTatToan() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="8"
        y="8"
        width="48"
        height="48"
        rx="4"
        fill="#e8f5e9"
        stroke="#1b5e20"
        strokeWidth="2"
      />
      <rect x="8" y="8" width="48" height="15" rx="4" fill="#1b5e20" />
      <text
        x="32"
        y="20"
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="white"
      >
        Tất toán
      </text>
      <path
        d="M20 36l8 8 16-16"
        stroke="#1b5e20"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IcoCLTG() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <rect
        x="8"
        y="8"
        width="44"
        height="48"
        rx="3"
        fill="#fff8e1"
        stroke="#f57f17"
        strokeWidth="2"
      />
      <rect x="8" y="8" width="44" height="14" rx="3" fill="#f57f17" />
      <text
        x="30"
        y="20"
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="white"
      >
        CLTG
      </text>
      <text x="30" y="38" textAnchor="middle" fontSize="14" fill="#f57f17">
        $↔₫
      </text>
      <line
        x1="16"
        y1="46"
        x2="44"
        y2="46"
        stroke="#f57f17"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoCapNhatGia() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ width: "100%", height: "100%" }}
    >
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="#e0f7fa"
        stroke="#00838f"
        strokeWidth="2"
      />
      <text
        x="32"
        y="30"
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
        fill="#00838f"
      >
        $
      </text>
      <path
        d="M24 40 Q32 34 40 40"
        stroke="#00838f"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M38 37l2 3 3-2"
        stroke="#00838f"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
