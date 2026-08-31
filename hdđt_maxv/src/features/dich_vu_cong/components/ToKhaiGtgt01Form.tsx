import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { CtTagGtgt01, DvcChiTietGtgt01 } from "../api/dvc";
import { CamDoanVaKhoiKy, ChanChuKySo } from "./mauInChung";
import { fmtSoTien, maChiTieu } from "./mauInFormat";
import { HANG_GTGT01, type HangChiTieu } from "../../_shared/to_khai/gtgt01Layout";

/**
 * Bảng dựng lại layout MẪU IN 01/GTGT (TT80/2021/TT-BTC) ở chế độ CHỈ ĐỌC — số bóc từ XML tờ khai
 * đã nộp.
 *
 * Danh sách hàng chỉ tiêu nằm ở `_shared/to_khai/gtgt01Layout.ts`, dùng chung với màn lập tờ khai
 * (`to_khai/components/ToKhaiGtgt01Editor.tsx`). Hàng "A" (checkbox "Không phát sinh…") không có
 * trong danh sách đó — dựng riêng trong JSX bên dưới vì là hàng DUY NHẤT không theo khuôn
 * giaTri/thue.
 */

/** Cả 2 ô tiền (giá trị + thuế) của một hàng — gộp chung một chỗ thay vì gọi lặp lại cho từng ô,
 * ô nào hàng không khai tag thì để trống (không có chỉ tiêu ở cột đó).
 *
 * `tag` nhận `string` (không phải `CtTagGtgt01`) vì mảng hàng chỉ tiêu nay dùng chung với màn lập
 * tờ khai, nơi bộ chỉ tiêu không đi qua kiểu của API DVC. Đổi lại mất lưới an toàn biên dịch cho
 * tên thẻ: gõ sai `ctNN` trong `gtgt01Layout.ts` giờ chỉ hiện ô trống chứ không đỏ lúc build. */
function OHangTien({ h, ct }: { h: HangChiTieu; ct: DvcChiTietGtgt01["ct"] }) {
  const oMotO = (tag?: string) =>
    !tag ? (
      <TableCell />
    ) : (
      <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", lineHeight: 1.4 }}
        >
          [{maChiTieu(tag)}]
        </Typography>
        {fmtSoTien(ct[tag as CtTagGtgt01])}
      </TableCell>
    );
  return (
    <>
      {oMotO(h.giaTri)}
      {oMotO(h.thue)}
    </>
  );
}

export default function ToKhaiGtgt01Form({ data }: { data: DvcChiTietGtgt01 }) {
  return (
    <Box sx={{ fontSize: 14 }}>
      <Box sx={{ position: "relative", textAlign: "center", mb: 2 }}>
        <Typography sx={{ fontWeight: 700 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
        <Typography sx={{ fontWeight: 700 }}>Độc lập - Tự do - Hạnh phúc</Typography>
        <Typography sx={{ my: 1.5, fontWeight: 700, textTransform: "uppercase" }}>
          {data.tenTKhai}
        </Typography>
        {data.moTaBMau && (
          <Typography variant="body2" sx={{ fontStyle: "italic" }}>
            {data.moTaBMau}
          </Typography>
        )}
      </Box>

      <Box component="dl" sx={{ m: 0, "& > div": { display: "flex", gap: 0.5, mb: 0.5 } }}>
        <div>
          <Typography component="dt" variant="body2">
            [01a] Tên hoạt động sản xuất kinh doanh:
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
            {data.tenNganhNghe}
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="body2">
            [01b] Kỳ tính thuế:
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
            {data.kyTinhThue}
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="body2">
            [02] Lần đầu: [{data.laLanDau ? "X" : " "}] &nbsp;&nbsp; [03] Bổ sung lần thứ: [
            {data.laLanDau ? " " : data.soLanBoSung}]
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="body2">
            [04] Tên người nộp thuế:
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
            {data.tenNNT}
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="body2">
            [05] Mã số thuế:
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
            {data.mst}
          </Typography>
        </div>
      </Box>

      <Typography variant="body2" sx={{ textAlign: "right", fontStyle: "italic", my: 1.5 }}>
        Đơn vị tiền: đồng Việt Nam
      </Typography>

      <TableContainer sx={{ border: 1, borderColor: "divider", maxHeight: 420 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ fontWeight: 700, width: 40 }}>
                STT
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Chỉ tiêu</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 130 }}>
                Giá trị hàng hóa, dịch vụ
                <br />
                (chưa có thuế GTGT)
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 130 }}>
                Thuế giá trị
                <br />
                gia tăng
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow hover>
              <TableCell align="center">A</TableCell>
              <TableCell>Không phát sinh hoạt động mua, bán trong kỳ (đánh dấu "X")</TableCell>
              <TableCell align="center" colSpan={2}>
                {data.ct.ct21 ? "☒" : "☐"} [21]
              </TableCell>
            </TableRow>

            {HANG_GTGT01.map((h, i) => (
              <TableRow key={i} hover={!h.header}>
                <TableCell
                  align="center"
                  sx={{ fontWeight: h.header ? 700 : 400, verticalAlign: "top" }}
                >
                  {h.stt}
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: h.header ? 700 : 400,
                    pl: 2 + (h.indent ?? 0) * 1.5,
                  }}
                >
                  {h.nhan}
                </TableCell>
                <OHangTien h={h} ct={data.ct} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CamDoanVaKhoiKy ngayKy={data.ngayKy} nguoiKy={data.nguoiKy} />

      <ChanChuKySo kyDienTuBoi={data.kyDienTuBoi} ngayKyDienTu={data.ngayKyDienTu} />
    </Box>
  );
}
