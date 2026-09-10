import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { getErrorMessage } from "../../../../../lib/errors";
import { ngayVn } from "../../../_shared/format";
import {
  DAI_NAM_TAO_NHANH,
  NAM_TAO_NHANH_MAX,
  NAM_TAO_NHANH_MIN,
} from "../../../api/cau_hinh_mac_dinh/holidaysApi";
import {
  useTaoNhanhNgayLe,
  useXemTruocTaoNhanh,
} from "../../../api/cau_hinh_mac_dinh/holidaysQueries";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Năm mở sẵn khi vào hộp thoại.
 *
 * Năm hiện tại nằm trong dải máy chủ nhận thì lấy đúng năm đó; ngoài dải thì **kẹp về đầu hoặc
 * cuối dải** — gần nhất với ý người dùng, và không bao giờ mở ra ở một năm máy chủ từ chối.
 * Bản cũ hơn nữa luôn lùi về `NAM_TAO_NHANH_MIN`, tức người dùng năm 2029 mở hộp thoại ra thấy
 * 2024; đừng dựng lại cách đó.
 */
function namMoSan(): number {
  const namNay = new Date().getFullYear();
  if (namNay < NAM_TAO_NHANH_MIN) return NAM_TAO_NHANH_MIN;
  if (namNay > NAM_TAO_NHANH_MAX) return NAM_TAO_NHANH_MAX;
  return namNay;
}

/**
 * Sinh lịch nghỉ lễ chuẩn Việt Nam cho một năm — Điều 112 Bộ luật Lao động 2019.
 *
 * 🔴 **Danh sách xem trước ĐỌC TỪ MÁY CHỦ, đừng dựng lại ở đây.** Bản trước gọi `ngayLeChuanVN()`
 * — bảng tra âm lịch chép tay của giao diện — trong khi máy chủ sinh bằng thuật toán. Hai nguồn
 * đã lệch thật: hộp thoại hiện khối Tết 2026 là **16–20/02** còn máy chủ ghi **15–19/02**, người
 * dùng thấy một đằng lưu một nẻo. Nay xem trước gọi `POST /hrm/holidays/quick-generate` với
 * `dryRun: true`: cùng một thuật toán sinh ra cả danh sách hiện lên lẫn dữ liệu sẽ được ghi,
 * nên không còn khe để lệch. Chi tiết ở `api/holidaysQueries.ts` → `useXemTruocTaoNhanh`.
 *
 * 🔴 **Chip trạng thái cũng ĐỌC TỪ MÁY CHỦ** (`items[].alreadyCovered`), đừng đối chiếu lại ở
 * đây. `BUG-HRM-51`: tenant đã có `2026-01-01 Tết Dương lịch` lặp hàng năm, mở Tạo nhanh cho
 * 2027 vẫn báo "11/11 ngày sẽ thêm; 0 ngày đã có" — phép so cặp `(ngày, tên)` ở trình duyệt
 * đúng ở mức dòng nhưng sai ở mức nghiệp vụ, vì nó không biết luật "một dòng lặp hàng năm phủ
 * mọi năm". Luật đó là của máy chủ và phải ở lại máy chủ.
 *
 * ⚠️ **Dải năm lấy từ RÀNG BUỘC MÁY CHỦ** (`DAI_NAM_TAO_NHANH` ở `holidaysApi.ts`, khớp
 * `min(2024).max(2030)` của `quickGenerateHolidaySchema`), **không** lấy từ bảng tra âm lịch của
 * giao diện. Muốn mở thêm năm thì nới validator máy chủ trước, rồi mới sửa hai hằng số đó.
 */
export default function TaoNhanhDialog({ open, onClose }: Props) {
  const taoNhanh = useTaoNhanhNgayLe();

  const namMacDinh = namMoSan();

  const [nam, setNam] = useState(namMacDinh);
  const [dangTao, setDangTao] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNam(namMacDinh);
  }, [open, namMacDinh]);

  // Truyền `open` xuống làm điều kiện `enabled`: hộp thoại đóng thì không gọi máy chủ.
  const xemTruoc = useXemTruocTaoNhanh(nam, open);

  /*
   * Chỉ tô trạng thái từng dòng khi máy chủ chấm **đủ** mọi dòng.
   *
   * Hành vi lui khi thiếu cờ (máy chủ cũ chưa vá `BUG-HRM-51`, hoặc vá nửa vời): **không đánh
   * dấu dòng nào cả** và nói rõ vì sao — thay vì đoán. Hai lựa chọn kia đều tệ hơn: coi thiếu cờ
   * là "chưa có" thì hộp thoại lại khẳng định đúng điều đang sai (mọi ngày sẽ được tạo); coi là
   * "đã có" thì dọa người dùng rằng bấm Tạo không có tác dụng. Không biết thì im, và hiện hai
   * con số của máy chủ kèm cảnh báo.
   */
  const toTrangThaiTungDong = xemTruoc.coCoTungDong;

  const handleTao = async () => {
    setDangTao(true);
    try {
      const soDaThem = await taoNhanh(nam);
      toast.success(
        soDaThem > 0
          ? `Đã thêm ${soDaThem} ngày lễ chuẩn năm ${nam}.`
          : `Lịch năm ${nam} đã đầy đủ, không có ngày nào cần thêm.`,
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được lịch ngày lễ."));
    } finally {
      setDangTao(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Tạo nhanh lịch nghỉ lễ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Hệ thống tự thêm các ngày nghỉ lễ chuẩn Việt Nam theo Điều 112 Bộ luật Lao động
            2019. Ngày đã có sẵn sẽ được bỏ qua, không tạo trùng — bấm lại lần nữa cũng không
            sao.
          </Alert>

          <TextField
            select
            label="Năm cần tạo"
            size="small"
            fullWidth
            value={nam}
            onChange={(e) => setNam(Number(e.target.value))}
            helperText={`Hệ thống nhận các năm ${NAM_TAO_NHANH_MIN}–${NAM_TAO_NHANH_MAX}.`}
          >
            {DAI_NAM_TAO_NHANH.map((n) => (
              <MenuItem key={n} value={n}>
                Năm {n}
              </MenuItem>
            ))}
          </TextField>

          {/* Bốn trạng thái tách bạch: đang tải · lỗi · rỗng · có dữ liệu. Không được để hộp
              thoại trống trơn mà không nói vì sao — người dùng sẽ tưởng năm đó không có ngày lễ
              nào và bấm Tạo trong vô định.
              (MUI v9: `alignItems` không còn là prop rời của Stack, phải nằm trong `sx`.) */}
          {xemTruoc.dangTai && (
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                py: 3,
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
              }}
            >
              <CircularProgress size={20} />
              <Typography variant="body2">
                Đang lấy danh sách ngày lễ chuẩn năm {nam} từ máy chủ…
              </Typography>
            </Stack>
          )}

          {!xemTruoc.dangTai && xemTruoc.loi && (
            <Alert severity="error">
              Không lấy được danh sách ngày lễ chuẩn năm {nam}
              {xemTruoc.loiMoTa ? `: ${xemTruoc.loiMoTa}` : "."} Kiểm tra kết nối rồi đóng và mở
              lại hộp thoại. Chưa có ngày nào được tạo.
            </Alert>
          )}

          {!xemTruoc.dangTai && !xemTruoc.loi && xemTruoc.dong.length === 0 && (
            <Alert severity="warning">
              Máy chủ không trả về ngày lễ chuẩn nào cho năm {nam}. Đóng và mở lại hộp thoại;
              nếu vẫn vậy thì báo bộ phận kỹ thuật — đừng tạo lịch thủ công đè lên.
            </Alert>
          )}

          {!xemTruoc.dangTai && !xemTruoc.loi && xemTruoc.dong.length > 0 && (
            <>
              <Paper variant="outlined" sx={{ maxHeight: 280, overflowY: "auto" }}>
                <List dense disablePadding>
                  {xemTruoc.dong.map((nl) => {
                    const daPhu = toTrangThaiTungDong && nl.daPhu === true;
                    return (
                      <ListItem key={`${nl.ngay}-${nl.ten}`} divider>
                        <ListItemText
                          primary={nl.ten}
                          secondary={ngayVn(nl.ngay)}
                          sx={{ opacity: daPhu ? 0.5 : 1 }}
                        />
                        {/* Nhãn CHUNG cho cả hai nghĩa của `alreadyCovered` (trùng đúng dòng /
                            đã được dòng lặp hàng năm phủ) — hợp đồng chỉ trả một cờ gộp, chip
                            mà nói rõ "trùng" hay "được phủ" là bịa ra thông tin không có.
                            "Đã có trong lịch" đúng ở mức nghiệp vụ trong cả hai, và mức nghiệp
                            vụ mới là chỗ `BUG-HRM-51` sai. Phân biệt hai nghĩa để một câu ở
                            khối tổng kết bên dưới lo. */}
                        {daPhu && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label="Đã có trong lịch"
                            sx={{ height: 20, flexShrink: 0 }}
                          />
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>

              {!toTrangThaiTungDong && (
                <Alert severity="warning">
                  Máy chủ đang chạy chưa báo trạng thái của từng ngày, nên danh sách trên không
                  đánh dấu ngày nào đã có. Hai con số dưới đây lấy nguyên của máy chủ và có thể
                  chưa tính những ngày lễ đã được một dòng lặp hàng năm phủ sẵn — số "sẽ thêm"
                  vì vậy có thể cao hơn thực tế. Bấm Tạo vẫn an toàn: máy chủ mới là bên quyết
                  định ngày nào được ghi.
                </Alert>
              )}

              {/* Nhãn "bản tham khảo" cũ đã bỏ: danh sách trên GIỜ CHÍNH LÀ dữ liệu sắp được
                  lưu, cùng một nguồn sinh ra. Câu lưu ý còn lại chỉ nói về tính thời điểm —
                  con số là dự báo lúc mở, người khác sửa lịch xen vào thì kết quả thật khác.

                  Hai con số này đếm từ CHÍNH các cờ đã tô chip (`api/holidaysQueries.ts`), nên
                  dòng tổng kết và danh sách bên trên không thể nói ngược nhau — đúng cái cảnh
                  `BUG-HRM-51`: "0 ngày đã có" trong khi ngày lễ đó đã được phủ từ năm trước. */}
              <Alert severity={xemTruoc.soSeThem > 0 ? "success" : "info"}>
                {xemTruoc.soSeThem > 0
                  ? `Sẽ thêm ${xemTruoc.soSeThem}/${xemTruoc.tongChuan} ngày; ${xemTruoc.soBoQua} ngày đã có trong lịch nên được bỏ qua.`
                  : `Lịch năm ${nam} đã đủ ${xemTruoc.tongChuan} ngày lễ chuẩn — bấm Tạo sẽ không thêm dòng nào.`}{" "}
                {/* Chỉ giải nghĩa khi thật sự có dòng bị đánh dấu — không có dòng nào thì câu
                    này chỉ làm dài thêm cảnh báo mà không nói gì thêm cho người đọc. */}
                {toTrangThaiTungDong && xemTruoc.soBoQua > 0 && (
                  <>
                    Một ngày được tính là đã có khi lịch công ty đã có đúng ngày đó, hoặc đã có
                    một ngày lễ <strong>lặp lại hàng năm</strong> phủ sẵn nó.{" "}
                  </>
                )}
                Số liệu tính tại thời điểm mở hộp thoại; nếu có người vừa thêm hoặc xóa ngày lễ
                thì kết quả thật có thể khác đôi chút.
              </Alert>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        {/* Không khóa nút theo bản xem trước — kể cả khi xem trước lỗi. Máy chủ mới là bên quyết
            định (`skipDuplicates`, thao tác idempotent: bấm lại chỉ tạo 0 dòng chứ không hỏng
            gì), còn xem trước chỉ là dự báo. Khóa theo dự báo sẽ chặn oan đúng lúc người dùng
            cần nhất: mạng chập chờn, xem trước hỏng, nhưng lệnh tạo vẫn đi được. */}
        <Button
          variant="contained"
          onClick={handleTao}
          disabled={dangTao}
          sx={{ textTransform: "none" }}
        >
          {dangTao ? "Đang tạo…" : `Tạo lịch năm ${nam}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
