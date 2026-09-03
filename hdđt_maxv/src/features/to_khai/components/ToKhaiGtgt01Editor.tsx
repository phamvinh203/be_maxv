import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { toast } from "react-toastify";
import {
  HANG_GTGT01,
  maChiTieu,
  O_SUA_DUOC,
  type HangChiTieu,
} from "../../_shared/to_khai/gtgt01Layout";
import { useDoiTrangThai, useLuuGhiDe, useTinhToKhai } from "../api/gtgt01Queries";
import type { BanToKhai, GhiDeItem } from "../api/gtgt01";
import { nhanKy, type Ky } from "../ky";
import { xuatToKhaiGtgt01 } from "../xuatToKhaiExcel";
import { getXml } from "../api/gtgt01";
import { luuVeMay } from "../../../lib/downloadFile";
import { KHO_GIAY_TO_KHAI } from "../layout";
import PhuLuc204Panel from "./PhuLuc204Panel";
import { docSoTien, fmtSoTien } from "../../_shared/to_khai/soTien";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Mẫu in 01/GTGT ở chế độ NHẬP ĐƯỢC — số tính từ bảng kê của kỳ, kế toán sửa tay được từng ô.
 *
 * Bố cục cố ý khác hai tab bảng kê: bảng kê cần tràn ngang (26 cột), mẫu in cần KHỔ HẸP CĂN GIỮA
 * như tờ giấy. Thanh kỳ ở đây cũng chỉ là một dòng chữ, không phải khối chọn kỳ như bên bảng kê —
 * dựng khối đó ngay trên đầu mẫu in làm tờ khai trông như bị kẹp.
 */


interface Props {
  ky: Ky;
  ban: BanToKhai | null;
  /** Bấm "Đổi kỳ" — cha đưa người dùng về tab bảng kê, nơi có khối chọn kỳ đầy đủ. */
  onDoiKy: () => void;
  dangTai: boolean;
  /** Câu lỗi khi kỳ chưa lập được (chưa kê khai, chưa có bản…). */
  loi?: string | null;
}

export default function ToKhaiGtgt01Editor({ ky, ban, onDoiKy, dangTai, loi }: Props) {
  // Giá trị đang gõ, theo tên thẻ. Chỉ chứa ô người dùng vừa chạm — ô khác đọc thẳng từ `ban.ct`.
  const [nhap, setNhap] = useState<Record<string, string>>({});
  const [dangTaiXml, setDangTaiXml] = useState(false);
  const tinh = useTinhToKhai();
  const luu = useLuuGhiDe();
  const doiTrangThai = useDoiTrangThai();

  const khoa = ban?.trangThai === "chot";
  const dangChay = tinh.isPending || luu.isPending || doiTrangThai.isPending || dangTai;

  const bamTinh = () =>
    tinh.mutate(ky, {
      onSuccess: () => {
        setNhap({});
        toast.success(`Đã lập tờ khai kỳ ${nhanKy(ky)}.`);
      },
      onError: (err) => toast.error(getErrorMessage(err, "Không lập được tờ khai.")),
    });

  /**
   * Gom mọi ô đang gõ dở thành bộ ghi đè gửi lên server.
   *
   * `null` = có ô không đọc được thành số. Tách khỏi `luuVaTinhLai` để nút "Lưu" báo lỗi cho người
   * dùng, còn lượt tính lại tự động lúc rời ô thì im lặng bỏ qua — đang gõ dở mà bị mắng là phiền.
   */
  const dungGhiDe = (): { ghiDe: Record<string, GhiDeItem>; oHong: string[] } | null => {
    if (!ban) return null;
    const ghiDe: Record<string, GhiDeItem> = { ...ban.ghiDe };
    const oHong: string[] = [];
    for (const [tag, chuoi] of Object.entries(nhap)) {
      const gia = docSoTien(chuoi);
      // Ô để trống = xóa ghi đè, giá trị quay về số máy tính (khác hẳn nhập số 0).
      if (gia === null) {
        delete ghiDe[tag];
        continue;
      }
      // Gõ sai (chữ, ký tự lạ) thì giữ lại tên ô để nơi gọi quyết định có báo hay không — tuyệt đối
      // không lặng lẽ lấy số cũ: số trên tờ khai không được phép khác cái người dùng tưởng mình gõ.
      if (gia === undefined) {
        oHong.push(`[${maChiTieu(tag)}]`);
        continue;
      }
      ghiDe[tag] = { gia };
    }
    return { ghiDe, oHong };
  };

  /**
   * Lưu ô sửa tay rồi TÍNH LẠI — server trả về bộ chỉ tiêu mới, `setNhap({})` cho màn hình đọc lại
   * từ đó.
   *
   * Chỉ có một engine tính (bên server). Client cố ý KHÔNG tự tính lại tại chỗ: hai bản công thức
   * là hai bản sẽ trôi lệch, mà đây là số tiền thuế.
   */
  const luuVaTinhLai = (onThanhCong?: () => void) => {
    const gom = dungGhiDe();
    if (!gom) return;
    // Còn ô gõ sai thì KHÔNG lưu ô nào cả. Lưu một phần rồi `setNhap({})` là xóa mất cái người dùng
    // đang gõ dở ở ô kia mà không nói gì — họ chỉ rời con trỏ chứ có bảo bỏ đâu.
    if (gom.oHong.length > 0) return;
    luu.mutate(
      { ky, ghiDe: gom.ghiDe },
      {
        onSuccess: () => {
          setNhap({});
          onThanhCong?.();
        },
        onError: (err) => toast.error(getErrorMessage(err, "Không lưu được tờ khai.")),
      },
    );
  };

  const bamLuu = () => {
    const gom = dungGhiDe();
    if (!gom) return;
    if (gom.oHong.length > 0) {
      toast.error(`Không đọc được số ở ô ${gom.oHong.join(", ")} — kiểm tra lại rồi lưu.`);
      return;
    }
    luuVaTinhLai(() => toast.success("Đã lưu tờ khai."));
  };

  /** Xuất file cần `await` (dựng workbook) — bọc catch để lỗi ghi file không văng ra ngoài lặng lẽ. */
  const bamXuatExcel = () => {
    if (!ban) return;
    void xuatToKhaiGtgt01(ky, ban).catch((err) =>
      toast.error(getErrorMessage(err, "Không xuất được file Excel.")),
    );
  };

  /** Tải XML để nạp vào HTKK. File đã có phụ lục giảm thuế nhưng CHƯA ký số — HTKK ký rồi nộp. */
  const bamXuatXml = async () => {
    if (!ban) return;
    setDangTaiXml(true);
    try {
      const xml = await getXml(ky);
      const ten = `ToKhai01GTGT_${nhanKy(ky).replace("/", "-")}.xml`;
      luuVeMay(new Blob([xml], { type: "application/xml;charset=utf-8" }), ten);
      toast.success(
        ban.phuLuc
          ? "Đã tải XML, kèm phụ lục giảm thuế. Nạp vào HTKK để ký số rồi nộp."
          : "Đã tải XML. Nạp vào HTKK để ký số rồi nộp.",
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tải được file XML."));
    } finally {
      setDangTaiXml(false);
    }
  };

  const bamDoiTrangThai = () =>
    doiTrangThai.mutate(
      { ky, chot: !khoa },
      {
        onSuccess: () => toast.success(khoa ? "Đã mở khóa tờ khai." : "Đã chốt tờ khai."),
        onError: (err) => toast.error(getErrorMessage(err, "Không đổi được trạng thái.")),
      },
    );

  const oTien = (tag?: string) => {
    if (!tag) return <TableCell />;
    const daGhiDe = !!ban?.ghiDe[tag];
    const soMay = ban?.ctMay[tag];
    // Ô công thức thuần KHÔNG cho gõ: backend lọc chúng khỏi `ghi_de`, nên để gõ được là hứa suông
    // — người dùng thấy "Đã lưu" rồi số nhảy về như cũ, mà đây là số tiền thuế.
    // Danh sách lấy TỪ SERVER (`ban.oSuaDuoc`) vì server mới là bên lọc; `O_SUA_DUOC` chỉ dùng khi
    // chưa có bản tờ khai nào — lúc đó mọi ô đã `disabled` sẵn nên chỉ ảnh hưởng màu nền.
    const suaDuoc = ban ? ban.oSuaDuoc.includes(tag) : O_SUA_DUOC.has(tag);
    // Ô đang gõ dở giữ nguyên chuỗi người dùng (chèn dấu chấm giữa chừng làm nhảy con trỏ);
    // ô còn lại hiện số đã định dạng `264.208.827` cho dễ đọc.
    const hienTai = tag in nhap ? nhap[tag] : fmtSoTien(ban?.ct[tag]);

    return (
      <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", lineHeight: 1.4 }}
        >
          [{maChiTieu(tag)}]
        </Typography>
        <Tooltip
          title={
            !suaDuoc
              ? "Ô này là tổng của các ô trên — sửa ô nguồn thì số ở đây tự đổi theo."
              : daGhiDe && soMay !== undefined
                ? `Máy tính: ${fmtSoTien(soMay)}`
                : ""
          }
          placement="left"
        >
          <TextField
            size="small"
            variant="standard"
            disabled={khoa || !ban}
            value={String(hienTai)}
            onChange={(e) => setNhap((cu) => ({ ...cu, [tag]: e.target.value }))}
            // Rời ô thì định dạng lại ngay để người dùng thấy con số mình vừa gõ đã được hiểu đúng
            // (gõ "264208827" rời ô thành "264.208.827"); gõ sai thì giữ nguyên để còn sửa.
            //
            // Rồi LƯU VÀ TÍNH LẠI luôn: [22] chảy tiếp vào [40a]/[41]/[40]/[43], [32] chảy vào
            // [27]/[33]/[34]/[35]/[36]… Bắt bấm "Lưu" mới thấy số đổi thì người dùng gõ xong nhìn
            // các ô dưới đứng im, tưởng phần mềm không nhận.
            onBlur={() => {
              // Ô người dùng KHÔNG chạm tới thì không đụng vào. Thiếu chặn này, chỉ cần bấm vào một
              // ô đã có số rồi tab đi là `docSoTien("")` ra null và ô bị xóa trắng.
              if (!(tag in nhap)) return;
              const gia = docSoTien(nhap[tag]);
              if (gia === undefined) return;
              setNhap((cu) => ({ ...cu, [tag]: gia === null ? "" : fmtSoTien(gia) }));
              // Số không đổi so với bản đã lưu -> khỏi gọi server.
              if (gia !== (ban?.ghiDe[tag]?.gia ?? null)) luuVaTinhLai();
            }}
            slotProps={{
              htmlInput: { readOnly: !suaDuoc, style: { textAlign: "right", fontSize: 13 } },
            }}
            sx={{
              width: 120,
              // Ô nhập tay có nền nhạt; ô đã sửa tay gạch chân cam để nhìn ra ngay số nào của người.
              "& .MuiInput-root": {
                bgcolor: suaDuoc ? "action.hover" : "transparent",
                borderBottom: daGhiDe ? "2px solid" : undefined,
                borderColor: daGhiDe ? "warning.main" : undefined,
              },
            }}
          />
        </Tooltip>
      </TableCell>
    );
  };

  const hang = (h: HangChiTieu, i: number) => (
    <TableRow key={i} hover={!h.header}>
      <TableCell align="center" sx={{ fontWeight: h.header ? 700 : 400, verticalAlign: "top" }}>
        {h.stt}
      </TableCell>
      <TableCell sx={{ fontWeight: h.header ? 700 : 400, pl: 2 + (h.indent ?? 0) * 1.5 }}>
        {h.nhan}
      </TableCell>
      {h.header ? (
        <>
          <TableCell />
          <TableCell />
        </>
      ) : (
        <>
          {oTien(h.giaTri)}
          {oTien(h.thue)}
        </>
      )}
    </TableRow>
  );

  return (
    <Box>
      {/* Thanh kỳ + hành động: một dòng, không phải khối chọn kỳ như bên bảng kê. */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", mb: 2, flexWrap: "wrap", rowGap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          Kỳ {nhanKy(ky)}
        </Typography>
        <Button size="small" onClick={onDoiKy} sx={{ textTransform: "none" }}>
          Đổi kỳ
        </Button>
        {ban && (
          <Chip
            size="small"
            color={khoa ? "success" : "default"}
            label={khoa ? "Đã chốt" : "Bản nháp"}
          />
        )}
        {dangChay && <CircularProgress size={18} />}

        <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
          <Button
            variant="contained"
            size="small"
            onClick={bamTinh}
            disabled={dangChay || khoa}
            sx={{ textTransform: "none" }}
          >
            {ban ? "Tính lại" : "Lập tờ khai"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={bamLuu}
            disabled={dangChay || khoa || !ban || Object.keys(nhap).length === 0}
            sx={{ textTransform: "none" }}
          >
            Lưu nháp
          </Button>
          <Button
            size="small"
            variant="outlined"
            color={khoa ? "warning" : "primary"}
            onClick={bamDoiTrangThai}
            disabled={dangChay || !ban}
            sx={{ textTransform: "none" }}
          >
            {khoa ? "Mở khóa" : "Chốt"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadRounded fontSize="small" />}
            onClick={bamXuatExcel}
            disabled={!ban}
            sx={{ textTransform: "none" }}
          >
            Xuất Excel
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadRounded fontSize="small" />}
            onClick={bamXuatXml}
            disabled={!ban || dangTaiXml}
            sx={{ textTransform: "none" }}
          >
            Xuất XML
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ maxWidth: KHO_GIAY_TO_KHAI, mx: "auto" }}>
        {loi && !ban && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {loi}
          </Alert>
        )}

        {ban && (
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {/* Cảnh báo từ lượt tính (vd [32] sửa tay nhưng phụ lục giữ số cũ) — đứng đầu vì nó
                báo số thuế đang sai, nặng hơn mọi thông báo phía dưới. */}
            {ban.canhBao.map((c) => (
              <Alert key={c} severity="error">
                {c}
              </Alert>
            ))}
            {ban.hdThieuDetail > 0 && (
              <Alert severity="error">
                {ban.hdThieuDetail} hóa đơn bán ra chưa tải chi tiết nên chưa tách được thuế suất —
                số [29]/[30]/[32] đang thiếu. Sang màn Hóa đơn điện tử bấm “Cập nhật từ Thuế điện
                tử” cho kỳ này rồi kê khai lại.
              </Alert>
            )}
            {ban.dieuChinh.soHd > 0 && (
              <Alert severity="warning">
                Kỳ này có {ban.dieuChinh.soHd} hóa đơn điều chỉnh, tổng{" "}
                {fmtSoTien(ban.dieuChinh.giaTri)} — kiểm tra dấu trước khi chốt.
              </Alert>
            )}
            {ban.soHdKhongKeKhai > 0 && (
              <Alert severity="info">
                {ban.soHdKhongKeKhai} hóa đơn trong kỳ được đánh “Không kê khai” nên không tính vào
                tờ khai này.
              </Alert>
            )}
            {ban.nguonCt22 === "nhap_tay" && (
              <Alert severity="info">
                Chỉ tiêu [22] chưa nối được — không tìm thấy kỳ nào đã lập tờ khai trước kỳ này
                trong phần mềm. Nhập tay rồi bấm “Lưu nháp”.
              </Alert>
            )}
            {ban.nguonCt22 === "ky_truoc_nhap" && (
              <Alert severity="warning">
                Chỉ tiêu [22] lấy từ [43] của {ban.kyNguonCt22 ? nhanKy(ban.kyNguonCt22) : "kỳ trước"}, nhưng kỳ đó còn là{" "}
                <b>bản nháp</b> — số có thể đổi khi kỳ đó được tính lại. Chốt kỳ trước rồi tính lại
                kỳ này để số đứng yên.
              </Alert>
            )}
          </Stack>
        )}

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
            <Typography sx={{ fontWeight: 700 }}>Độc lập - Tự do - Hạnh phúc</Typography>
            <Typography sx={{ my: 1.5, fontWeight: 700 }}>
              TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: "italic" }}>
              Kỳ tính thuế: {nhanKy(ky)}
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ textAlign: "right", fontStyle: "italic", mb: 1 }}>
            Đơn vị tiền: đồng Việt Nam
          </Typography>

          <TableContainer sx={{ border: 1, borderColor: "divider" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 40 }}>
                    STT
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Chỉ tiêu</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 160 }}>
                    Giá trị hàng hóa, dịch vụ
                    <br />
                    (chưa có thuế GTGT)
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 160 }}>
                    Thuế giá trị
                    <br />
                    gia tăng
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{HANG_GTGT01.map(hang)}</TableBody>
            </Table>
          </TableContainer>

          {ban && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              Nguồn: {ban.soHdBan} hóa đơn bán ra, {ban.soHdMua} hóa đơn mua vào
              {ban.tinhLuc ? ` · tính lúc ${new Date(ban.tinhLuc).toLocaleString("vi-VN")}` : ""}
            </Typography>
          )}
        </Paper>

        {/* Phụ lục chỉ hiện khi kỳ CÓ hàng 8% — kỳ không có thì không phải nộp, hiện khung rỗng
            chỉ làm người dùng tưởng mình quên điền. */}
        {ban?.phuLuc && <PhuLuc204Panel ky={ky} phuLuc={ban.phuLuc} khoa={khoa} />}
      </Box>
    </Box>
  );
}
