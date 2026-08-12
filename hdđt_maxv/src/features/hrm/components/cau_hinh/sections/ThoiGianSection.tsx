import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import BeachAccessRounded from "@mui/icons-material/BeachAccessRounded";
import MoreTimeRounded from "@mui/icons-material/MoreTimeRounded";
import ReportProblemRounded from "@mui/icons-material/ReportProblemRounded";
import { CHINH_SACH_NGAY, PHUONG_PHAP_NGAY_CONG } from "../../../constants";
import type {
  CauHinhMacDinh,
  ChinhSachNgay,
  PhuongPhapNgayCong,
} from "../../../types";
import NhomCauHinh from "../NhomCauHinh";
import SoField from "../SoField";

interface Props {
  values: CauHinhMacDinh;
  onChange: (values: CauHinhMacDinh) => void;
}

/** Ngày công, nghỉ phép và toàn bộ tham số tăng ca. */
export default function ThoiGianSection({ values, onChange }: Props) {
  const dat = <K extends keyof CauHinhMacDinh>(khoa: K, giaTri: CauHinhMacDinh[K]) =>
    onChange({ ...values, [khoa]: giaTri });

  return (
    <Stack spacing={2.5}>
      <NhomCauHinh
        tieuDe="Ngày công & giờ công"
        moTa="Quyết định mẫu số khi quy đổi lương tháng ra lương ngày và lương giờ."
        icon={<CalendarMonthRounded color="primary" />}
      >
        <TextField
          select
          label="Phương pháp tính ngày công chuẩn"
          size="small"
          value={values.phuong_phap_ngay_cong}
          onChange={(e) => dat("phuong_phap_ngay_cong", e.target.value as PhuongPhapNgayCong)}
        >
          {PHUONG_PHAP_NGAY_CONG.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Chính sách thứ 7"
          size="small"
          value={values.chinh_sach_thu_7}
          onChange={(e) => dat("chinh_sach_thu_7", e.target.value as ChinhSachNgay)}
        >
          {CHINH_SACH_NGAY.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Chính sách chủ nhật"
          size="small"
          value={values.chinh_sach_chu_nhat}
          onChange={(e) => dat("chinh_sach_chu_nhat", e.target.value as ChinhSachNgay)}
        >
          {CHINH_SACH_NGAY.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <SoField
          label="Giờ công chuẩn/ngày"
          donVi="giờ"
          buocNhay={0.5}
          value={values.gio_cong_chuan_ngay}
          onChange={(v) => dat("gio_cong_chuan_ngay", v)}
        />
      </NhomCauHinh>

      <NhomCauHinh
        tieuDe="Nghỉ phép có lương"
        icon={<BeachAccessRounded color="primary" />}
        soCot={2}
      >
        <SoField
          label="Số ngày phép cơ bản/năm"
          donVi="ngày"
          value={values.ngay_phep_co_ban}
          onChange={(v) => dat("ngay_phep_co_ban", v)}
        />
        <SoField
          label="Số năm thâm niên cho 1 ngày phép thêm"
          donVi="năm"
          value={values.nam_tham_nien_them_phep}
          onChange={(v) => dat("nam_tham_nien_them_phep", v)}
          helperText="Cứ đủ số năm này thì được cộng thêm một ngày phép."
        />
      </NhomCauHinh>

      <NhomCauHinh
        tieuDe="Hệ số tăng ca"
        moTa="Tỷ lệ phần trăm so với đơn giá giờ công bình thường. 150% nghĩa là một giờ tăng ca được trả bằng 1,5 giờ công."
        icon={<MoreTimeRounded color="primary" />}
      >
        <SoField
          label="Ngày thường — ban ngày"
          donVi="%"
          buocNhay={5}
          value={values.tc_ngay_thuong_ngay}
          onChange={(v) => dat("tc_ngay_thuong_ngay", v)}
        />
        <SoField
          label="Ngày thường — ban đêm"
          donVi="%"
          buocNhay={5}
          value={values.tc_ngay_thuong_dem}
          onChange={(v) => dat("tc_ngay_thuong_dem", v)}
        />
        <SoField
          label="Chủ nhật — ban ngày"
          donVi="%"
          buocNhay={5}
          value={values.tc_chu_nhat_ngay}
          onChange={(v) => dat("tc_chu_nhat_ngay", v)}
        />
        <SoField
          label="Chủ nhật — ban đêm"
          donVi="%"
          buocNhay={5}
          value={values.tc_chu_nhat_dem}
          onChange={(v) => dat("tc_chu_nhat_dem", v)}
        />
        <SoField
          label="Ngày lễ — ban ngày"
          donVi="%"
          buocNhay={5}
          value={values.tc_ngay_le_ngay}
          onChange={(v) => dat("tc_ngay_le_ngay", v)}
        />
        <SoField
          label="Ngày lễ — ban đêm"
          donVi="%"
          buocNhay={5}
          value={values.tc_ngay_le_dem}
          onChange={(v) => dat("tc_ngay_le_dem", v)}
        />
      </NhomCauHinh>

      <NhomCauHinh
        tieuDe="Giới hạn giờ tăng ca"
        moTa="Mốc để cảnh báo khi chấm công, không tự chặn việc nhập."
        icon={<ReportProblemRounded color="primary" />}
      >
        <SoField
          label="Giới hạn giờ tăng ca / tháng"
          donVi="giờ"
          value={values.gioi_han_tc_thang}
          onChange={(v) => dat("gioi_han_tc_thang", v)}
        />
        <SoField
          label="Ngưỡng cảnh báo giờ tăng ca / năm"
          donVi="giờ"
          value={values.nguong_canh_bao_tc_nam}
          onChange={(v) => dat("nguong_canh_bao_tc_nam", v)}
        />
        <SoField
          label="Ngưỡng vượt mức giờ tăng ca / năm"
          donVi="giờ"
          value={values.nguong_vuot_muc_tc_nam}
          onChange={(v) => dat("nguong_vuot_muc_tc_nam", v)}
        />
      </NhomCauHinh>
    </Stack>
  );
}
