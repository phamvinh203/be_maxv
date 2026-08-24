import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { layChiTietToKhaiDvc, type DvcChiTietToKhai } from "../api/dvc";
import { useBaoPhienChet } from "../useBaoPhienChet";
import { getErrorMessage } from "../../../lib/errors";
import ToKhaiGtgt01Form from "./ToKhaiGtgt01Form";
import ToKhaiTNCN05Form from "./ToKhaiTNCN05Form";

interface Props {
  open: boolean;
  onClose: () => void;
  dvcKey: string | null;
  /** Mã hồ sơ đang xem — `null` khi chưa chọn dòng nào (dialog không fetch). */
  maHoSo: string | null;
  /** Báo lên `DvcPage` để bỏ khóa phiên khi BE nói phiên chết hẳn — xem `boKhoaNeuPhienChet`. */
  onPhienChet?: (err: unknown) => void;
}

function RawXmlView({ xml }: { xml: string }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        bgcolor: "action.hover",
        borderRadius: 1,
        fontSize: 12,
        overflow: "auto",
        maxHeight: 420,
      }}
    >
      {xml}
    </Box>
  );
}

/**
 * Mẫu nào có layout mẫu in riêng thì cần khổ dialog RỘNG (bảng chỉ tiêu nhiều cột, nhãn dài mấy
 * dòng); mẫu `raw` giữ khổ hẹp.
 *
 * Để cạnh chỗ chọn component thay vì viết rời một biểu thức `loai === ... || loai === ...` cách đó
 * mấy chục dòng: thêm mẫu mà quên cập nhật thì trước đây dialog lặng lẽ render khổ hẹp, không lỗi
 * biên dịch nào cả.
 */
const CAN_KHO_RONG: Record<Exclude<DvcChiTietToKhai["loai"], "raw">, true> = {
  gtgt01: true,
  tncn05: true,
};

/** Nội dung đã bóc, tách theo `loai` — mẫu 01/GTGT và 05/KK-TNCN dựng lại đúng layout mẫu in qua
 * form riêng của từng mẫu; mẫu khác hiện bảng tên-thẻ-XML-thô/giá-trị kèm cảnh báo "chưa có
 * layout". */
function NoiDungDaBoc({ data }: { data: DvcChiTietToKhai }) {
  if (data.loai === "gtgt01") return <ToKhaiGtgt01Form data={data.duLieu} />;
  if (data.loai === "tncn05") return <ToKhaiTNCN05Form data={data.duLieu} />;

  if (data.chiTieu.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        Không đọc được chỉ tiêu nào từ tờ khai này.
      </Typography>
    );
  }

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Mẫu tờ khai này chưa có layout riêng — cột "Thẻ" bên dưới là tên thẻ XML gốc.
      </Alert>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
        <Table size="small" stickyHeader>
          <TableBody>
            {data.chiTieu.map((ct, i) => (
              <TableRow key={`${ct.nhan}-${i}`} hover>
                <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", width: "45%" }}>
                  {ct.nhan}
                </TableCell>
                <TableCell sx={{ wordBreak: "break-word" }}>{ct.giaTri}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

/**
 * Dialog "Xem tờ khai" — nội dung bóc từ XML tờ khai đã lưu của một hồ sơ
 * (`GET /dvc/ho-so/to-khai-chi-tiet`), mở khi bấm vào ô cột "Tờ khai / Phụ lục". Xem
 * `NoiDungDaBoc` cho cách tách nhánh theo mẫu. Nút "Xem XML gốc" luôn có để đối chiếu khi cần.
 *
 * Dùng: `BangHoSo` (click cột "Tờ khai / Phụ lục").
 */
export default function ToKhaiXmlDialog({ open, onClose, dvcKey, maHoSo, onPhienChet }: Props) {
  const [xemXmlGoc, setXemXmlGoc] = useState(false);

  const query = useQuery({
    queryKey: ["dvc", "to-khai-chi-tiet", maHoSo],
    // `key` tùy chọn: BE đọc cache trước (hồ sơ đã đồng bộ thì không cần đăng nhập cổng), chỉ
    // dùng `dvcKey` khi BE cần gọi cổng thật vì cache còn thiếu — cùng quy ước `ThongBaoDialog`.
    queryFn: () => layChiTietToKhaiDvc({ key: dvcKey ?? undefined, maHoSo: maHoSo as string }),
    enabled: open && !!maHoSo,
    staleTime: 30_000,
  });

  useBaoPhienChet(query.error, onPhienChet);

  const data = query.data;
  const rong = !!data && data.loai !== "raw" && CAN_KHO_RONG[data.loai];

  return (
    <Dialog open={open} onClose={onClose} maxWidth={rong ? "md" : "sm"} fullWidth scroll="paper">
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}
      >
        Tờ khai{maHoSo ? ` — hồ sơ ${maHoSo}` : ""}
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {query.isLoading ? (
          <Box
            sx={{
              py: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <CircularProgress />
            <Typography variant="body2">Đang đọc tờ khai…</Typography>
          </Box>
        ) : query.isError ? (
          <Alert severity="error">
            {getErrorMessage(query.error, "Không đọc được nội dung tờ khai.")}
          </Alert>
        ) : !data ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            Không đọc được nội dung tờ khai này.
          </Typography>
        ) : (
          <>
            {xemXmlGoc ? <RawXmlView xml={data.xmlTho} /> : <NoiDungDaBoc data={data} />}

            <Button
              size="small"
              sx={{ mt: 1.5, textTransform: "none" }}
              onClick={() => setXemXmlGoc((v) => !v)}
            >
              {xemXmlGoc ? "Xem bảng chỉ tiêu" : "Xem XML gốc"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
