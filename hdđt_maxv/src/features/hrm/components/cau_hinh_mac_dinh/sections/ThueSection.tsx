import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import PersonRemoveRounded from "@mui/icons-material/PersonRemoveRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import GavelRounded from "@mui/icons-material/GavelRounded";
import { nhanNguongBacThue } from "../../../_shared/constants";
import { tienVn } from "../../../_shared/format";
import type { BacThue, CauHinhMacDinh } from "../../../types";
import TienField from "../../TienField";
import NhomCauHinh from "../NhomCauHinh";
import SoField from "../../SoField";

interface Props {
  values: CauHinhMacDinh;
  onChange: (values: CauHinhMacDinh) => void;
}

/** Số bậc tối thiểu máy chủ chấp nhận (BR-hrm-082 điều kiện 1, `E-hrm-081`). */
const SO_BAC_TOI_THIEU = 2;

/**
 * Giảm trừ gia cảnh và biểu thuế TNCN lũy tiến từng phần.
 *
 * Ô ngưỡng mang thẳng nghĩa **ngưỡng trên lũy kế** (BR-hrm-080) — đúng cách Điều 22 diễn đạt
 * ("Đến 5 triệu", "Trên 5 đến 10 triệu"), đối chiếu được thẳng với văn bản luật mà không phải
 * cộng trừ gì. Quy ước "độ rộng bậc" cũ đã bị bãi bỏ cùng hai hàm quy đổi ở tầng API.
 *
 * Số bậc **thay đổi được**: bản trước chốt cứng 5 bậc vì nhãn là mảng 5 phần tử và mảng đó còn
 * bị dùng làm khóa danh sách — biểu 7 bậc chuẩn sẽ có hai dòng khóa `undefined` trùng nhau.
 * Nay khóa là vị trí bậc, và nhãn sinh theo vị trí.
 *
 * Dòng cuối là **bậc mở**: ô ngưỡng bị khóa và hiển thị "Không giới hạn", gửi lên `khoang: null`.
 */
export default function ThueSection({ values, onChange }: Props) {
  const bacThue = values.bac_thue;
  const soBac = bacThue.length;

  const dat = <K extends keyof CauHinhMacDinh>(khoa: K, giaTri: CauHinhMacDinh[K]) =>
    onChange({ ...values, [khoa]: giaTri });

  const datBac = (viTri: number, moi: Partial<BacThue>) =>
    onChange({
      ...values,
      bac_thue: bacThue.map((bac, i) => (i === viTri ? { ...bac, ...moi } : bac)),
    });

  /**
   * Thêm một bậc **ngay trước bậc mở** — bậc mở phải luôn nằm cuối (`E-hrm-082`).
   *
   * Cả hai ô để trống (`0`) cho người dùng tự điền: đoán hộ một con số thuế là việc không nên
   * làm. `TienField` hiện ô rỗng khi giá trị là 0, và phép kiểm trước khi gửi trong
   * `useLuuCauHinh` sẽ nói rõ bậc nào còn thiếu nếu người dùng quên.
   */
  const themBac = () => {
    const bacMoi: BacThue = { khoang: 0, thue_suat: 0 };
    onChange({
      ...values,
      bac_thue: [...bacThue.slice(0, soBac - 1), bacMoi, ...bacThue.slice(soBac - 1)],
    });
  };

  const xoaBac = (viTri: number) =>
    onChange({ ...values, bac_thue: bacThue.filter((_, i) => i !== viTri) });

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

      <NhomCauHinh
        tieuDe="Miễn trừ & khấu trừ đặc biệt"
        moTa="Trần miễn thuế phụ cấp ăn trưa (quy đổi theo công thực tế) và tỷ lệ khấu trừ thuế TNCN tại nguồn áp cho hợp đồng thử việc/thời vụ trước khi trả thu nhập."
        icon={<GavelRounded color="primary" />}
        soCot={3}
      >
        <TienField
          label="Trần miễn thuế ăn trưa (VNĐ/tháng)"
          value={values.tran_mien_thue_an_trua}
          onChange={(v) => dat("tran_mien_thue_an_trua", v)}
          helperText="Phần phụ cấp ăn trưa vượt mức này bị tính vào thu nhập chịu thuế."
        />
        <SoField
          label="Tỷ lệ khấu trừ thử việc/thời vụ"
          donVi="%"
          buocNhay={0.5}
          value={values.ty_le_khau_tru_thu_viec}
          onChange={(v) => dat("ty_le_khau_tru_thu_viec", v)}
          helperText="Khấu trừ ngay 10% trước khi trả cho HĐ thử việc/thời vụ (Điều 25 TT 111/2013)."
        />
        <TienField
          label="Ngưỡng áp dụng khấu trừ (VNĐ/lần)"
          value={values.nguong_khau_tru_thu_viec}
          onChange={(v) => dat("nguong_khau_tru_thu_viec", v)}
          helperText="Chỉ khấu trừ khi thu nhập mỗi lần chi trả từ mức này trở lên."
        />
      </NhomCauHinh>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 0.5, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <AccountBalanceRounded color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Bậc thuế TNCN lũy tiến từng phần ({soBac} bậc)
            </Typography>
          </Stack>
          <Button
            size="small"
            startIcon={<AddRounded />}
            onClick={themBac}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            Thêm bậc
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mỗi ô là <strong>ngưỡng thu nhập tính thuế lũy kế</strong> mà bậc đó áp đến — đúng cách
          Điều 22 Luật Thuế TNCN diễn đạt, không phải độ rộng của bậc. Bậc cuối là bậc mở, ôm hết
          phần vượt ngưỡng bậc liền trước. Biểu chuẩn hiện hành có 7 bậc, trần 35%.
        </Typography>

        <Stack spacing={2}>
          {bacThue.map((bac, i) => {
            const laBacCuoi = i === soBac - 1;
            const nguongTruoc = i > 0 ? (bacThue[i - 1]?.khoang ?? null) : 0;
            // Độ rộng bậc là cột PHÁI SINH CHỈ-ĐỌC (hiệu hai ngưỡng liền kề) — được phép hiện
            // cho dễ đọc, nhưng KHÔNG bao giờ là ô nhập và KHÔNG nằm trong nội dung gửi lên.
            const doRong =
              !laBacCuoi && bac.khoang != null && nguongTruoc != null
                ? bac.khoang - nguongTruoc
                : null;

            return (
              <Box
                // Khóa theo vị trí bậc: nhãn không còn là mảng cố định nên không dùng làm khóa
                // được nữa (biểu 7 bậc sẽ có hai nhãn `undefined` trùng nhau).
                key={`bac-thue-${i}`}
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(0, 2fr) minmax(0, 1fr) auto auto",
                  },
                  gap: 2,
                  alignItems: "center",
                }}
              >
                {laBacCuoi ? (
                  <TextField
                    label={nhanNguongBacThue(i, soBac)}
                    size="small"
                    fullWidth
                    disabled
                    value="Không giới hạn"
                    helperText="Bậc mở — áp cho toàn bộ phần vượt ngưỡng bậc liền trước."
                  />
                ) : (
                  <TienField
                    label={`${nhanNguongBacThue(i, soBac)} (VNĐ)`}
                    value={bac.khoang ?? 0}
                    onChange={(v) => datBac(i, { khoang: v })}
                    helperText={
                      doRong != null && doRong > 0
                        ? `Phần chịu thuế bậc này rộng ${tienVn(doRong)} ₫`
                        : undefined
                    }
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
                      ? `Trên ${tienVn(nguongTruoc ?? 0)} ₫`
                      : `Từ trên ${tienVn(nguongTruoc ?? 0)} ₫ đến ${tienVn(bac.khoang ?? 0)} ₫`
                  }
                  sx={{ justifySelf: { xs: "start", md: "end" } }}
                />

                <Tooltip
                  title={
                    laBacCuoi
                      ? "Bậc mở phải luôn là bậc cuối, không xóa được"
                      : soBac <= SO_BAC_TOI_THIEU
                        ? `Biểu thuế phải có ít nhất ${SO_BAC_TOI_THIEU} bậc`
                        : "Xóa bậc này"
                  }
                >
                  {/* Bọc `span`: nút bị `disabled` không phát sự kiện chuột nên Tooltip không hiện được. */}
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={laBacCuoi || soBac <= SO_BAC_TOI_THIEU}
                      onClick={() => xoaBac(i)}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}
