import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PaidRounded from "@mui/icons-material/PaidRounded";
import HealthAndSafetyRounded from "@mui/icons-material/HealthAndSafetyRounded";
import BusinessRounded from "@mui/icons-material/BusinessRounded";
import Diversity3Rounded from "@mui/icons-material/Diversity3Rounded";
import type { CauHinhMacDinh } from "../../../types";
import TienField from "../../TienField";
import NhomCauHinh from "../NhomCauHinh";
import SoField from "../SoField";

interface Props {
  values: CauHinhMacDinh;
  onChange: (values: CauHinhMacDinh) => void;
}

/** Lương nền, ba loại bảo hiểm bắt buộc và phí/kinh phí công đoàn. */
export default function LuongBaoHiemSection({ values, onChange }: Props) {
  const dat = <K extends keyof CauHinhMacDinh>(khoa: K, giaTri: CauHinhMacDinh[K]) =>
    onChange({ ...values, [khoa]: giaTri });

  const tongNv = values.bhxh_nv + values.bhyt_nv + values.bhtn_nv;
  const tongCt = values.bhxh_ct + values.bhyt_ct + values.bhtn_ct;

  return (
    <Stack spacing={2.5}>
      <NhomCauHinh
        tieuDe="Lương cơ sở / Tối thiểu vùng"
        moTa="Lương cơ sở dùng làm trần đóng bảo hiểm và đoàn phí; lương tối thiểu vùng là sàn của lương thỏa thuận."
        icon={<PaidRounded color="primary" />}
        soCot={2}
      >
        <TienField
          label="Lương cơ sở (VNĐ/tháng)"
          value={values.luong_co_so}
          onChange={(v) => dat("luong_co_so", v)}
        />
        <TienField
          label="Lương tối thiểu vùng (VNĐ/tháng)"
          value={values.luong_toi_thieu_vung}
          onChange={(v) => dat("luong_toi_thieu_vung", v)}
        />
      </NhomCauHinh>

      <NhomCauHinh
        tieuDe="Bảo hiểm — Nhân viên đóng"
        icon={<HealthAndSafetyRounded color="primary" />}
      >
        <SoField
          label="Bảo hiểm xã hội (Nhân viên)"
          donVi="%"
          buocNhay={0.5}
          value={values.bhxh_nv}
          onChange={(v) => dat("bhxh_nv", v)}
        />
        <SoField
          label="Bảo hiểm y tế (Nhân viên)"
          donVi="%"
          buocNhay={0.5}
          value={values.bhyt_nv}
          onChange={(v) => dat("bhyt_nv", v)}
        />
        <SoField
          label="Bảo hiểm thất nghiệp (Nhân viên)"
          donVi="%"
          buocNhay={0.5}
          value={values.bhtn_nv}
          onChange={(v) => dat("bhtn_nv", v)}
        />
        <TongTyLe nhan_="Tổng nhân viên đóng" giaTri={tongNv} />
      </NhomCauHinh>

      <NhomCauHinh
        tieuDe="Bảo hiểm — Công ty đóng"
        icon={<BusinessRounded color="primary" />}
      >
        <SoField
          label="Bảo hiểm xã hội (Công ty)"
          donVi="%"
          buocNhay={0.5}
          value={values.bhxh_ct}
          onChange={(v) => dat("bhxh_ct", v)}
        />
        <SoField
          label="Bảo hiểm y tế (Công ty)"
          donVi="%"
          buocNhay={0.5}
          value={values.bhyt_ct}
          onChange={(v) => dat("bhyt_ct", v)}
        />
        <SoField
          label="Bảo hiểm thất nghiệp (Công ty)"
          donVi="%"
          buocNhay={0.5}
          value={values.bhtn_ct}
          onChange={(v) => dat("bhtn_ct", v)}
        />
        <TongTyLe nhan_="Tổng công ty đóng" giaTri={tongCt} />
      </NhomCauHinh>

      <NhomCauHinh
        tieuDe="Công đoàn"
        moTa="Đoàn phí do đoàn viên đóng, kinh phí công đoàn do công ty đóng trên quỹ lương đóng BHXH."
        icon={<Diversity3Rounded color="primary" />}
      >
        <SoField
          label="Tỷ lệ đoàn phí công đoàn (Nhân viên đóng)"
          donVi="%"
          buocNhay={0.5}
          value={values.doan_phi_nv}
          onChange={(v) => dat("doan_phi_nv", v)}
        />
        <TienField
          label="Trần cơ sở đóng đoàn phí (VNĐ)"
          value={values.tran_co_so_doan_phi}
          onChange={(v) => dat("tran_co_so_doan_phi", v)}
          helperText="Phần lương vượt trần này không tính thêm đoàn phí."
        />
        <SoField
          label="Tỷ lệ kinh phí công đoàn (Công ty đóng)"
          donVi="%"
          buocNhay={0.5}
          value={values.kinh_phi_cong_doan_ct}
          onChange={(v) => dat("kinh_phi_cong_doan_ct", v)}
        />
      </NhomCauHinh>
    </Stack>
  );
}

/** Tổng ba tỷ lệ — sai một số là thấy ngay, không phải tự cộng nhẩm. */
function TongTyLe({ nhan_, giaTri }: { nhan_: string; giaTri: number }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        px: 2,
        borderRadius: 1,
        bgcolor: "action.hover",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {nhan_}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {Math.round(giaTri * 100) / 100}%
      </Typography>
    </Box>
  );
}
