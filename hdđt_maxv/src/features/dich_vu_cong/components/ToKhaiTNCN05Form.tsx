import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { CtTagTncn05, DvcChiTietTncn05 } from "../api/dvc";
import { CamDoanVaKhoiKy, ChanChuKySo, Ma } from "./mauInChung";
import { fmtSoTien, maChiTieu } from "./mauInFormat";

/**
 * Bảng dựng lại layout MẪU IN 05/KK-TNCN — Tờ khai khấu trừ thuế thu nhập cá nhân (TT80/2021),
 * áp dụng cho tổ chức trả thu nhập từ tiền lương, tiền công.
 *
 * Song song `ToKhaiGtgt01Form` (mẫu 01/GTGT) chứ KHÔNG dùng chung: hai mẫu khác hẳn khung bảng —
 * 01/GTGT có hai cột tiền (giá trị / thuế) và không có cột đơn vị tính, còn mẫu này chỉ MỘT cột số
 * nhưng thêm cột "Mã chỉ tiêu" và "Đơn vị tính" (có hàng đếm "Người", có hàng tiền "VNĐ"). Gộp
 * chung sẽ thành một component đầy cờ điều kiện, mỗi lần sửa mẫu này lại sợ vỡ mẫu kia.
 *
 * Phần KHÔNG khác nhau giữa các mẫu (định dạng số/ngày, khối cam đoan + ô ký, chân chữ ký số) nằm
 * ở `mauInChung` — xem chú thích ở đó.
 */
interface HangChiTieu {
  /** Cột STT — để rỗng cho hàng "Trong đó:" không đánh số (xem hàng [17] trên mẫu). */
  stt: string;
  nhan: string;
  /** Thẻ `ctNN` đổ vào cột "Số người/Số tiền"; cũng là nguồn suy ra ô "Mã chỉ tiêu". */
  tag: CtTagTncn05;
  /** Cột "Đơn vị tính" — nhóm chỉ tiêu đếm người ([16]..[20]) khác nhóm tiền ([21]..[32]). */
  donVi: "Người" | "VNĐ";
  /** Hàng tổng của một mục lớn (1, 2, 3, 4, 5, 6) — in đậm như mẫu giấy. */
  dam?: boolean;
}

const HANG: HangChiTieu[] = [
  { stt: "1", nhan: "Tổng số người lao động:", tag: "ct16", donVi: "Người", dam: true },
  {
    stt: "",
    nhan: "Trong đó: Cá nhân cư trú có hợp đồng lao động",
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
      "Trong đó: Tổng thu nhập chịu thuế từ tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt " +
      "buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động",
    tag: "ct24",
    donVi: "VNĐ",
  },
  {
    stt: "4",
    nhan: "Trong đó tổng thu nhập chịu thuế được miễn theo quy định của Hợp đồng dầu khí",
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
      "Trong đó: Tổng số thuế thu nhập cá nhân đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, " +
      "bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho " +
      "người lao động",
    tag: "ct32",
    donVi: "VNĐ",
  },
];

/** Ba gạch đầu dòng cuối mẫu in — văn bản pháp quy CỐ ĐỊNH, giống hệt nhau ở mọi hồ sơ nên khai
 * thẳng ở đây, không phải dữ liệu bóc từ XML. */
const GHI_CHU: string[] = [
  "Tờ khai này chỉ áp dụng đối với tổ chức, cá nhân phát sinh trả thu nhập từ tiền lương, tiền " +
    "công cho cá nhân trong tháng/quý, không phân biệt có phát sinh khấu trừ thuế hay không phát " +
    "sinh khấu trừ thuế.",
  "Kỳ khai thuế theo tháng áp dụng đối với tổ chức, cá nhân trả thu nhập có tổng doanh thu bán " +
    "hàng hóa và cung cấp dịch vụ của năm trước liền kề trên 50 tỷ đồng hoặc trường hợp tổ chức, " +
    "cá nhân trả thu nhập lựa chọn khai thuế theo tháng.",
  "Kỳ khai thuế theo quý áp dụng đối với tổ chức, cá nhân trả thu nhập có tổng doanh thu bán hàng " +
    "hóa và cung cấp dịch vụ của năm trước liền kề từ 50 tỷ đồng trở xuống, bao gồm cả tổ chức, " +
    "cá nhân trả thu nhập không phát sinh doanh thu bán hàng hóa và cung cấp dịch vụ.",
];

/** Một dòng "[NN] Nhãn: giá trị" của khối thông tin người nộp thuế.
 *
 * Dùng `dt`/`dd` (trong `dl` của component cha) thay vì hai `span`: đây đúng là cặp nhãn–giá trị,
 * và đó là thứ báo cho trình đọc màn hình biết đâu là nhãn đâu là giá trị — cùng cách
 * `ToKhaiGtgt01Form` dựng khối tương ứng. */
function Dong({ ma, nhan, giaTri }: { ma: string; nhan: string; giaTri?: string }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
      <Typography component="dt" variant="body2">
        <Ma n={ma} /> {nhan}:
      </Typography>
      {giaTri ? (
        <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
          {giaTri}
        </Typography>
      ) : null}
    </Box>
  );
}

export default function ToKhaiTNCN05Form({ data }: { data: DvcChiTietTncn05 }) {
  return (
    <Box sx={{ fontSize: 14 }}>
      {/* Khối đầu: quốc hiệu ở giữa, hộp "Mẫu số" neo góc phải như mẫu giấy. `position: relative`
          + `absolute` để hộp KHÔNG đẩy lệch phần canh giữa của quốc hiệu. */}
      <Box sx={{ position: "relative", mb: 2 }}>
        <Box
          sx={{
            position: { xs: "static", sm: "absolute" },
            top: 0,
            right: 0,
            width: { xs: "100%", sm: 200 },
            mb: { xs: 2, sm: 0 },
            p: 1,
            border: 1,
            // `divider` chứ KHÔNG `text.primary`: bảng chỉ tiêu ngay dưới cũng dùng token này, và
            // `text.primary` ở dark mode là màu trắng nguyên chất -> khung sáng chói lệch hẳn bảng.
            borderColor: "divider",
            textAlign: "center",
          }}
        >
          <Typography variant="body2">
            Mẫu số:{" "}
            <Box component="span" sx={{ fontWeight: 700 }}>
              05/KK-TNCN
            </Box>
          </Typography>
          {data.moTaBMau && (
            <Typography variant="caption" sx={{ fontStyle: "italic", display: "block", mt: 0.5 }}>
              {data.moTaBMau}
            </Typography>
          )}
        </Box>

        <Box sx={{ textAlign: "center", pr: { sm: "210px" } }}>
          <Typography sx={{ fontWeight: 700 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
          <Typography sx={{ fontWeight: 700 }}>Độc lập - Tự do - Hạnh phúc</Typography>
          <Typography sx={{ letterSpacing: 1 }}>-------------------------</Typography>
          <Typography sx={{ mt: 1.5, fontWeight: 700, textTransform: "uppercase" }}>
            {data.tenTKhai}
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: "italic" }}>
            (Áp dụng cho tổ chức, cá nhân trả các khoản thu nhập từ tiền lương, tiền công)
          </Typography>
        </Box>
      </Box>

      {/* [01]-[03] canh giữa như mẫu in, khác khối [04]+ canh trái bên dưới. */}
      <Box sx={{ textAlign: "center", mb: 2 }}>
        <Typography variant="body2">
          <Ma n="01" /> Kỳ tính thuế: {data.kyTinhThue}
        </Typography>
        <Typography variant="body2">
          <Ma n="02" /> Lần đầu: [{data.laLanDau ? "X" : " "}] &nbsp;&nbsp;
          <Ma n="03" /> Bổ sung lần thứ: [{data.laLanDau ? " " : data.soLanBoSung}]
        </Typography>
      </Box>

      <Box component="dl" sx={{ m: 0, mb: 1.5 }}>
        <Dong ma="04" nhan="Tên người nộp thuế" giaTri={data.tenNNT} />
        <Dong ma="05" nhan="Mã số thuế" giaTri={data.mst} />
        <Dong ma="06" nhan="Địa chỉ" giaTri={data.diaChi} />

        {/* [07]+[08] và [09]+[10]+[11] nằm chung dòng trên mẫu giấy — dùng flex có `wrap` để màn
            hẹp tự xuống dòng thay vì tràn ngang. */}
        <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 4 }}>
          <Dong ma="07" nhan="Xã/phường/đặc khu" giaTri={data.phuongXa} />
          <Dong ma="08" nhan="Tỉnh/Thành phố" giaTri={data.tinhTP} />
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 4 }}>
          <Dong ma="09" nhan="Điện thoại" giaTri={data.dienThoai} />
          <Dong ma="10" nhan="Fax" giaTri={data.fax} />
          <Dong ma="11" nhan="E-mail" giaTri={data.email} />
        </Box>

        <Dong ma="12" nhan="Tên đại lý thuế (nếu có)" giaTri={data.tenDaiLyThue} />
        <Dong ma="13" nhan="Mã số thuế" giaTri={data.mstDaiLyThue} />

        <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 4 }}>
          <Dong ma="14" nhan="Hợp đồng đại lý thuế: Số" giaTri={data.hopDongDaiLySo} />
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Ngày: {data.hopDongDaiLyNgay}
          </Typography>
        </Box>

        <Dong
          ma="15"
          nhan="Phân bổ thuế do có đơn vị hạch toán phụ thuộc tại địa bàn cấp tỉnh khác nơi có trụ sở chính"
          giaTri={`[${data.phanBoThue ? "X" : " "}]`}
        />
      </Box>

      <Typography variant="body2" sx={{ textAlign: "right", fontStyle: "italic", my: 1.5 }}>
        Đơn vị tiền: Đồng Việt Nam
      </Typography>

      <TableContainer sx={{ border: 1, borderColor: "divider", maxHeight: 460 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ fontWeight: 700, width: 56 }}>
                STT
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Chỉ tiêu
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 70 }}>
                Mã chỉ
                <br />
                tiêu
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 80 }}>
                Đơn vị
                <br />
                tính
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 130 }}>
                Số người/Số
                <br />
                tiền
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {HANG.map((h) => (
              // Quy tắc chung của cả hàng đặt một lần trên `TableRow` thay vì lặp `sx` ở từng ô:
              // 5 ô mỗi hàng, lặp tay là kiểu gì cũng có ô bị sót (bản trước sót đúng ô "Chỉ tiêu",
              // làm nhãn dài nằm lệch so với chính số thứ tự của hàng đó).
              <TableRow
                key={h.tag}
                hover
                sx={{ "& > td": { verticalAlign: "top", fontWeight: h.dam ? 700 : 400 } }}
              >
                <TableCell align="center">{h.stt}</TableCell>
                <TableCell>{h.nhan}</TableCell>
                {/* Mã chỉ tiêu luôn đậm, kể cả ở hàng thường — theo đúng mẫu giấy. */}
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  <Ma n={maChiTieu(h.tag)} />
                </TableCell>
                <TableCell align="center">{h.donVi}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {fmtSoTien(data.ct[h.tag])}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CamDoanVaKhoiKy ngayKy={data.ngayKy} nguoiKy={data.nguoiKy} />

      <Box sx={{ mt: 3 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, fontStyle: "italic", textDecoration: "underline" }}
        >
          Ghi chú:
        </Typography>
        {GHI_CHU.map((dong, i) => (
          <Typography key={i} variant="body2" sx={{ fontStyle: "italic" }}>
            - {dong}
          </Typography>
        ))}
      </Box>

      <ChanChuKySo kyDienTuBoi={data.kyDienTuBoi} ngayKyDienTu={data.ngayKyDienTu} />
    </Box>
  );
}
