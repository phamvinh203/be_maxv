import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AssignmentLateRounded from "@mui/icons-material/AssignmentLateRounded";
import TaskAltRounded from "@mui/icons-material/TaskAltRounded";
import { ngayVn } from "../../_shared/format";
import {
  NGUONG_GAP_NGAY,
  NGUONG_SAP_HET_HAN_NGAY,
  NHAN_NHOM_HOP_DONG,
  type DongHopDongSapHet,
} from "../../calculations/dashboard/tongQuan";
import TheDashboard, { DanhSach, DongDanhSach, ThongBaoRong } from "./TheDashboard";

interface Props {
  rows: DongHopDongSapHet[];
  isLoading: boolean;
  loi: string | null;
  onXem: (maNv: string) => void;
}

function ChipConLai({ conLai }: { conLai: number }) {
  if (conLai < 0) {
    return <Chip size="small" color="error" label={`Quá ${-conLai} ngày`} sx={{ height: 22 }} />;
  }
  if (conLai === 0) {
    return <Chip size="small" color="error" label="Hết hạn hôm nay" sx={{ height: 22 }} />;
  }
  return (
    <Chip
      size="small"
      variant="outlined"
      color={conLai <= NGUONG_GAP_NGAY ? "warning" : "default"}
      label={`Còn ${conLai} ngày`}
      sx={{ height: 22 }}
    />
  );
}

export default function HopDongSapHetCard({ rows, isLoading, loi, onXem }: Props) {
  const soGap = rows.filter((r) => r.con_lai_ngay <= NGUONG_GAP_NGAY).length;

  const noiDung = () => {
    if (rows.length === 0) {
      return (
        <ThongBaoRong icon={<TaskAltRounded />}>
          Không có hợp đồng nào kết thúc trong {NGUONG_SAP_HET_HAN_NGAY} ngày tới.
        </ThongBaoRong>
      );
    }
    return (
      <DanhSach>
        {rows.map((r) => (
          <DongDanhSach
            key={r.ma_nv}
            onClick={() => onXem(r.ma_nv)}
            tieuDe={r.ho_ten}
            phu={`${NHAN_NHOM_HOP_DONG[r.nhom]} · ${r.so_hd}`}
            cuoi={
              <>
                <ChipConLai conLai={r.con_lai_ngay} />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  {ngayVn(r.ngay_ket_thuc)}
                </Typography>
              </>
            }
          />
        ))}
      </DanhSach>
    );
  };

  return (
    <TheDashboard
      tieuDe="Nhân viên sắp kết thúc hợp đồng"
      phuDe={`Hợp đồng hiện hành hết hạn trong ${NGUONG_SAP_HET_HAN_NGAY} ngày tới hoặc đã quá hạn`}
      icon={<AssignmentLateRounded />}
      hanhDong={
        rows.length > 0 ? (
          <Chip
            size="small"
            color={soGap > 0 ? "warning" : "default"}
            label={soGap > 0 ? `${soGap} gấp / ${rows.length}` : `${rows.length} người`}
          />
        ) : undefined
      }
      chan={{ loi, dangTai: isLoading }}
    >
      {noiDung}
    </TheDashboard>
  );
}
