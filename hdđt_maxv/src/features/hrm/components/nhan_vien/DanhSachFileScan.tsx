import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ImageRounded from "@mui/icons-material/ImageRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import LinkOffRounded from "@mui/icons-material/LinkOffRounded";
import { SO_FILE_TOI_DA, type FileScanApi } from "../../api/taiLieuQueries";

/** `284512` -> `278 KB`. Dưới 1MB hiện KB cho gọn, từ 1MB trở lên hiện MB một chữ số lẻ. */
function coFile(byte: number): string {
  return byte < 1024 * 1024
    ? `${Math.round(byte / 1024)} KB`
    : `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  files: FileScanApi[];
  /** Đang tải một file nào đó về để xem — khóa mọi nút xem để không bắn chồng nhiều lượt. */
  dangTaiXem: boolean;
  onXem: (file: FileScanApi) => void;
  onGo: (file: FileScanApi) => void;
  /** Mở form sửa dòng giấy tờ để đính thêm file. */
  onThemFile: () => void;
}

/**
 * Danh sách file scan **thuộc MỘT dòng giấy tờ**, hiện ngay trong ô "File scan" của dòng đó.
 *
 * `[QĐ #21]` Vì sao lồng trong ô của dòng chứ không phải một danh sách phẳng riêng: căn cước là
 * MỘT giấy tờ có hai mặt (BR-hrm-037). Bày hai file thành hai dòng ngang hàng nhau là người đọc
 * lại tưởng có hai giấy tờ "CCCD" — đúng cái sai mà QĐ #21 sinh ra để sửa. Khung của hàng bảng
 * chính là dấu hiệu gộp nhóm: mọi file nằm TRONG một hàng thì hiển nhiên thuộc về hàng đó.
 *
 * Vì vậy các ô khác của hàng phải căn `verticalAlign: "top"` (xem `HoSoTab`) — hàng cao lên khi
 * có nhiều file, để chữ căn giữa thì loại giấy tờ trôi xuống giữa dãy file, mất liên hệ thị giác.
 */
export default function DanhSachFileScan({
  files,
  dangTaiXem,
  onXem,
  onGo,
  onThemFile,
}: Props) {
  // Không có file KHÔNG phải lỗi: giấy tờ đã khai nhưng chưa scan. Nói thẳng ra và mời đính,
  // đừng để một danh sách rỗng trơ khiến người dùng tưởng màn hình lỗi.
  if (files.length === 0) {
    return (
      <Stack spacing={0.25} sx={{ alignItems: "flex-start" }}>
        <Typography variant="body2" color="text.disabled">
          Chưa đính file scan
        </Typography>
        <Button
          size="small"
          startIcon={<UploadFileRounded fontSize="small" />}
          onClick={onThemFile}
          sx={{ textTransform: "none", px: 0.5 }}
        >
          Đính file
        </Button>
      </Stack>
    );
  }

  const dayFile = files.length >= SO_FILE_TOI_DA;

  return (
    <Stack spacing={0.25} sx={{ minWidth: 220 }}>
      <Typography variant="caption" color="text.secondary">
        {files.length} file{dayFile ? ` (đã đủ ${SO_FILE_TOI_DA})` : ""}
      </Typography>

      {files.map((f) => (
        <Stack
          key={f.id}
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: "center",
            // Vạch dọc + thụt vào: dấu hiệu "cái này nằm BÊN TRONG giấy tờ ở hàng này",
            // không phải một mục ngang hàng.
            pl: 0.75,
            borderLeft: 2,
            borderColor: "divider",
          }}
        >
          {f.mime_type === "application/pdf" ? (
            <PictureAsPdfRounded sx={{ fontSize: 16, color: "text.disabled" }} />
          ) : (
            <ImageRounded sx={{ fontSize: 16, color: "text.disabled" }} />
          )}

          <Tooltip title={f.ten_file}>
            <Typography
              variant="body2"
              sx={{
                flexGrow: 1,
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {f.ten_file}
            </Typography>
          </Tooltip>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
          >
            {coFile(f.kich_thuoc)}
          </Typography>

          <Tooltip title="Xem file">
            {/* `span` bọc ngoài: Tooltip không nhận sự kiện chuột từ nút đang disabled. */}
            <Box component="span">
              <IconButton
                size="small"
                disabled={dangTaiXem}
                onClick={() => onXem(f)}
              >
                <VisibilityRounded fontSize="small" />
              </IconButton>
            </Box>
          </Tooltip>

          {/* Icon PHẢI khác cái ghim giấy của nút đính file bên form: cùng hình mà một bên
              đính vào, một bên xóa đi thì người dùng bấm nhầm. */}
          <Tooltip title="Gỡ file này khỏi giấy tờ">
            <IconButton size="small" color="error" onClick={() => onGo(f)}>
              <LinkOffRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ))}

      {!dayFile && (
        <Button
          size="small"
          startIcon={<UploadFileRounded fontSize="small" />}
          onClick={onThemFile}
          sx={{ textTransform: "none", px: 0.5, alignSelf: "flex-start" }}
        >
          Đính thêm file
        </Button>
      )}
    </Stack>
  );
}
