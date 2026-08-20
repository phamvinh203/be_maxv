import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { vnDateParts } from "../../hddt/dateUtils";
import type { CtTagGtgt01, DvcChiTietGtgt01 } from "../api/dvc";

/**
 * Bảng dựng lại layout MẪU IN 01/GTGT (TT80/2021/TT-BTC) — CHỈ ĐÚNG cho mẫu này (khác `BangHoSo`,
 * `ThongBaoDialog`… KHÔNG tái dùng cho mẫu khác). Mỗi hàng khai `giaTri`/`thue` là tên thẻ `ctNN`
 * trong `DvcChiTietGtgt01.ct` (kiểu `CtTagGtgt01` bắt lỗi gõ sai lúc biên dịch) — số ngoặc `[NN]`
 * hiện trên mẫu được TỰ suy từ tên thẻ (`ctNN` -> `[NN]`) thay vì khai tay, tránh gõ lệch giữa
 * nhãn và số. Hàng "A" (checkbox "Không phát sinh…") không nằm trong danh sách này — dựng riêng
 * trong JSX vì là hàng DUY NHẤT không theo khuôn giaTri/thue.
 */
interface HangChiTieu {
  stt: string;
  nhan: string;
  /** Thẻ `ctNN` đổ vào cột "Giá trị hàng hóa, dịch vụ". */
  giaTri?: CtTagGtgt01;
  /** Thẻ `ctNN` đổ vào cột "Thuế giá trị gia tăng". */
  thue?: CtTagGtgt01;
  /** Hàng tiêu đề mục lớn (C/I/II/IV/VI…) — chữ đậm, không có cột số tiền. */
  header?: boolean;
  /** Mức thụt lề (0 = gốc). */
  indent?: number;
}

const HANG: HangChiTieu[] = [
  { stt: "B", nhan: "Thuế giá trị gia tăng còn được khấu trừ kỳ trước chuyển sang", thue: "ct22" },
  {
    stt: "C",
    nhan: "Kê khai thuế giá trị gia tăng phải nộp ngân sách nhà nước",
    header: true,
  },
  { stt: "I", nhan: "Hàng hoá, dịch vụ mua vào trong kỳ", header: true, indent: 1 },
  {
    stt: "1",
    nhan: "Giá trị và thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào",
    giaTri: "ct23",
    thue: "ct24",
    indent: 2,
  },
  {
    stt: "",
    nhan: "Trong đó: hàng hóa, dịch vụ nhập khẩu",
    giaTri: "ct23a",
    thue: "ct24a",
    indent: 3,
  },
  {
    stt: "2",
    nhan: "Thuế giá trị gia tăng của hàng hóa, dịch vụ mua vào được khấu trừ kỳ này",
    thue: "ct25",
    indent: 2,
  },
  { stt: "II", nhan: "Hàng hoá, dịch vụ bán ra trong kỳ", header: true, indent: 1 },
  {
    stt: "1",
    nhan: "Hàng hóa, dịch vụ bán ra không chịu thuế giá trị gia tăng",
    giaTri: "ct26",
    indent: 2,
  },
  {
    stt: "2",
    nhan: "Hàng hóa, dịch vụ bán ra chịu thuế giá trị gia tăng ([27]=[29]+[30]+[32]+[32a]; [28]=[31]+[33])",
    giaTri: "ct27",
    thue: "ct28",
    indent: 2,
  },
  { stt: "a", nhan: "Hàng hóa, dịch vụ bán ra chịu thuế suất 0%", giaTri: "ct29", indent: 3 },
  {
    stt: "b",
    nhan: "Hàng hóa, dịch vụ bán ra chịu thuế suất 5%",
    giaTri: "ct30",
    thue: "ct31",
    indent: 3,
  },
  {
    stt: "c",
    nhan: "Hàng hóa, dịch vụ bán ra chịu thuế suất 10%",
    giaTri: "ct32",
    thue: "ct33",
    indent: 3,
  },
  { stt: "d", nhan: "Hàng hoá, dịch vụ bán ra không tính thuế", giaTri: "ct32a", indent: 3 },
  {
    stt: "3",
    nhan: "Tổng doanh thu và thuế giá trị gia tăng của hàng hóa, dịch vụ bán ra ([34]=[26]+[27]; [35]=[28])",
    giaTri: "ct34",
    thue: "ct35",
    indent: 2,
  },
  {
    stt: "III",
    nhan: "Thuế giá trị gia tăng phát sinh trong kỳ ([36]=[35]-[25])",
    thue: "ct36",
    indent: 1,
  },
  {
    stt: "IV",
    nhan: "Điều chỉnh tăng, giảm thuế giá trị gia tăng còn được khấu trừ của các kỳ trước",
    header: true,
    indent: 1,
  },
  { stt: "1", nhan: "Điều chỉnh giảm", thue: "ct37", indent: 2 },
  { stt: "2", nhan: "Điều chỉnh tăng", thue: "ct38", indent: 2 },
  {
    stt: "V",
    nhan: "Thuế giá trị gia tăng nhận bàn giao được khấu trừ trong kỳ",
    thue: "ct39a",
    indent: 1,
  },
  {
    stt: "VI",
    nhan: "Xác định nghĩa vụ thuế giá trị gia tăng phải nộp trong kỳ:",
    header: true,
    indent: 1,
  },
  {
    stt: "1",
    nhan: "Thuế giá trị gia tăng phải nộp của hoạt động sản xuất kinh doanh trong kỳ {[40a]=([36]-[22]+[37]-[38]-[39a])≥0}",
    thue: "ct40a",
    indent: 2,
  },
  {
    stt: "2",
    nhan: "Thuế giá trị gia tăng mua vào của dự án đầu tư được bù trừ với thuế GTGT còn phải nộp của hoạt động sản xuất kinh doanh cùng kỳ tính thuế ([40b]≤[40a])",
    thue: "ct40b",
    indent: 2,
  },
  {
    stt: "3",
    nhan: "Thuế giá trị gia tăng còn phải nộp trong kỳ ([40]=[40a]-[40b])",
    thue: "ct40",
    indent: 2,
  },
  {
    stt: "4",
    nhan: "Thuế giá trị gia tăng chưa khấu trừ hết kỳ này {[41]=([36]-[22]+[37]-[38]-[39a])≤0}",
    thue: "ct41",
    indent: 2,
  },
  { stt: "4.1", nhan: "Thuế giá trị gia tăng đề nghị hoàn ([42]≤[41])", thue: "ct42", indent: 2 },
  {
    stt: "4.2",
    nhan: "Thuế giá trị gia tăng còn được khấu trừ chuyển kỳ sau ([43]=[41]-[42])",
    thue: "ct43",
    indent: 2,
  },
];

/** `29826193` -> "29.826.193"; `-1446670` -> "(1.446.670)" (âm hiện ngoặc, đúng quy ước mẫu in,
 * KHÁC `fmtMoney` dùng chung — mẫu in luôn hiện cả số 0, không được ẩn như bảng danh sách). */
function fmtSoTien(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n === 0) return "0";
  const abs = Math.abs(n).toLocaleString("vi-VN");
  return n < 0 ? `(${abs})` : abs;
}

/** "2026-07-29" -> "Ngày 29 tháng 07 năm 2026" — dựng trên `vnDateParts` (tách chuỗi thủ công,
 * KHÔNG qua `Date`) như mọi hàm đọc "ngày trên chứng từ" khác trong app, xem `dateUtils.ts`. */
function fmtNgayDai(iso: string | null): string {
  const p = vnDateParts(iso ?? undefined);
  return p ? `Ngày ${p.d} tháng ${p.m} năm ${p.y}` : (iso ?? "");
}

/** "2026-07-29T06:56:37" -> "29/07/2026 06:56:37" — phần ngày qua `vnDateParts` (regex chỉ neo
 * đầu chuỗi nên vẫn khớp dù có đuôi giờ), phần giờ tách riêng vì `vnDateParts` không đọc giờ. */
function fmtNgayGio(iso: string | null): string {
  if (!iso) return "";
  const p = vnDateParts(iso);
  if (!p) return iso;
  const gio = iso.split("T")[1];
  return gio ? `${p.d}/${p.m}/${p.y} ${gio}` : `${p.d}/${p.m}/${p.y}`;
}

/** Cả 2 ô tiền (giá trị + thuế) của một hàng — gộp chung một chỗ thay vì gọi lặp lại cho từng ô,
 * ô nào hàng không khai tag thì để trống (không có chỉ tiêu ở cột đó). */
function OHangTien({ h, ct }: { h: HangChiTieu; ct: DvcChiTietGtgt01["ct"] }) {
  const oMotO = (tag?: CtTagGtgt01) =>
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
          [{tag.replace(/^ct/, "")}]
        </Typography>
        {fmtSoTien(ct[tag])}
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

            {HANG.map((h, i) => (
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

      <Typography variant="body2" sx={{ mt: 2, fontStyle: "italic" }}>
        Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về những số liệu
        đã khai./...
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, gap: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            NHÂN VIÊN ĐẠI LÝ THUẾ
          </Typography>
          <Typography variant="body2" sx={{ mt: 4 }}>
            Họ và tên:
          </Typography>
          <Typography variant="body2">Chứng chỉ hành nghề số:</Typography>
        </Box>

        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body2" sx={{ fontStyle: "italic" }}>
            {fmtNgayDai(data.ngayKy)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
            NGƯỜI NỘP THUẾ hoặc
            <br />
            ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ
          </Typography>
          <Typography variant="caption" sx={{ fontStyle: "italic", display: "block" }}>
            (Ký, ghi rõ họ tên, chức vụ và đóng dấu nếu có)
          </Typography>
          <Typography variant="body2" sx={{ mt: 4, fontWeight: 600 }}>
            {data.nguoiKy}
          </Typography>
        </Box>
      </Box>

      {(data.kyDienTuBoi || data.ngayKyDienTu) && (
        <>
          <Divider sx={{ mt: 3, mb: 1 }} />
          <Typography variant="body2" color="success.main">
            ✓ Ký điện tử bởi: {data.kyDienTuBoi}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ngày ký: {fmtNgayGio(data.ngayKyDienTu)}.
          </Typography>
        </>
      )}
    </Box>
  );
}
