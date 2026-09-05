import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import PersonRemoveRounded from "@mui/icons-material/PersonRemoveRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import { NHAN_BAC_THUE } from "../../../constants";
import { tienVn } from "../../../format";
import type { BacThue, CauHinhMacDinh } from "../../../types";
import TienField from "../../TienField";
import NhomCauHinh from "../NhomCauHinh";
import SoField from "../SoField";

interface Props {
  values: CauHinhMacDinh;
  onChange: (values: CauHinhMacDinh) => void;
}

/** Giảm trừ gia cảnh và biểu thuế lũy tiến rút gọn 5 bậc. */
export default function ThueSection({ values, onChange }: Props) {
  const dat = <K extends keyof CauHinhMacDinh>(khoa: K, giaTri: CauHinhMacDinh[K]) =>
    onChange({ ...values, [khoa]: giaTri });

  const datBac = (viTri: number, moi: Partial<BacThue>) =>
    onChange({
      ...values,
      bac_thue: values.bac_thue.map((bac, i) => (i === viTri ? { ...bac, ...moi } : bac)),
    });

  /**
   * Mốc lũy kế của từng bậc. Người dùng nhập độ rộng khoảng, nhưng cái họ cần
   * kiểm tra là ngưỡng thu nhập — không hiện ra thì phải tự cộng dồn năm con số.
   */
  const mocLuyKe: number[] = [];
  let cong = 0;
  for (const bac of values.bac_thue) {
    cong += bac.khoang;
    mocLuyKe.push(cong);
  }

  return (
    <Stack spacing={2.5}>
      <NhomCauHinh
        tieuDe="Giảm trừ thuế TNCN"
        moTa="Trừ khỏi thu nhập trước khi áp biểu thuế lũy tiến."
        icon={<PersonRemoveRounded color="primary" />}
        soCot={2}
      >
        <TienField
          label="Giảm trừ bản thân (VNĐ/tháng)"
          value={values.giam_tru_ban_than}
          onChange={(v) => dat("giam_tru_ban_than", v)}
        />
        <TienField
          label="Giảm trừ người phụ thuộc (VNĐ/người)"
          value={values.giam_tru_npt}
          onChange={(v) => dat("giam_tru_npt", v)}
          helperText="Nhân với số người phụ thuộc đã đăng ký giảm trừ."
        />
      </NhomCauHinh>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.5 }}>
          <AccountBalanceRounded color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bậc thuế TNCN (5 bậc lũy tiến)
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bậc 1 nhập mức chịu thuế tối đa, bậc 2–4 nhập độ rộng khoảng cộng thêm, bậc 5 áp
          cho toàn bộ phần vượt bậc 4.
        </Typography>

        <Stack spacing={2}>
          {values.bac_thue.map((bac, i) => {
            const laBacCuoi = i === values.bac_thue.length - 1;
            return (
              <Box
                key={NHAN_BAC_THUE[i]}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(0, 1fr) auto" },
                  gap: 2,
                  alignItems: "center",
                }}
              >
                {laBacCuoi ? (
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      borderRadius: 1,
                      bgcolor: "action.hover",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {NHAN_BAC_THUE[i]}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Toàn bộ phần vượt {tienVn(mocLuyKe[i - 1] ?? 0)} ₫
                    </Typography>
                  </Box>
                ) : (
                  <TienField
                    label={`${NHAN_BAC_THUE[i]} (VNĐ)`}
                    value={bac.khoang}
                    onChange={(v) => datBac(i, { khoang: v })}
                  />
                )}

                <SoField
                  label={`Bậc ${i + 1}: Thuế suất`}
                  donVi="%"
                  value={bac.thue_suat}
                  onChange={(v) => datBac(i, { thue_suat: v })}
                />

                <Chip
                  size="small"
                  variant="outlined"
                  label={
                    laBacCuoi
                      ? `Trên ${tienVn(mocLuyKe[i - 1] ?? 0)} ₫`
                      : `Lũy kế đến ${tienVn(mocLuyKe[i] ?? 0)} ₫`
                  }
                  sx={{ justifySelf: { xs: "start", md: "end" } }}
                />
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}
