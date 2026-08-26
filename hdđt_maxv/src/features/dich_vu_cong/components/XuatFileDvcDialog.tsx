import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FolderOpenRounded from "@mui/icons-material/FolderOpenRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { toast } from "react-toastify";

import {
  pickDirectory,
  supportsDirectoryPicker,
  writeFile,
  type FsDirHandle,
} from "../../../lib/fileSystemAccess";
import { getErrorMessage } from "../../../lib/errors";
import { useActiveCompanyMst } from "../../auth/useActiveCompanyMst";
import {
  layDsGtgt01DeXuat,
  layDsKhacDeXuat,
  layDsQtt05DeXuat,
  layDsTncn05DeXuat,
  layDsTndn03DeXuat,
  layDsXmlDeXuat,
  type DvcXuatKhoangNgayParams,
} from "../api/dvc";
import { buildGtgt01WorkbookBuffer, gtgt01WorkbookFilename } from "../xuatGtgt01Excel";
import { buildQtt05WorkbookBuffer, qtt05WorkbookFilename } from "../xuatQtt05Excel";
import { buildTncn05WorkbookBuffer, tncn05WorkbookFilename } from "../xuatTncn05Excel";
import { buildTndn03WorkbookBuffer, tndn03WorkbookFilename } from "../xuatTndn03Excel";
import { buildKhacWorkbookBuffer, khacWorkbookFilename } from "../xuatKhacExcel";

interface Props {
  open: boolean;
  onClose: () => void;
}

const THU_MUC_THONG_KE = "Thống kê tờ khai";

const THU_MUC_XML = "Tờ khai XML";

interface KetQuaXuatMot {
  nhan: string;
  fileName: string;
  soHoSo: number;
}

interface XuatFileParams {
  dir: FsDirHandle;
  mst: string;
  tuNgay: string;
  denNgay: string;
}

interface KhaiLoaiXuat {
  nhan: string;
  layBuffer: (
    params: DvcXuatKhoangNgayParams,
  ) => Promise<{ buffer: ArrayBuffer; soHoSo: number } | null>;
  filename: (mst: string) => string;
}

function khaiLoaiXuat<Row>(
  nhan: string,
  layDs: (params: DvcXuatKhoangNgayParams) => Promise<Row[]>,
  build: (rows: Row[]) => Promise<ArrayBuffer>,
  filename: (mst: string) => string,
): KhaiLoaiXuat {
  return {
    nhan,
    filename,
    layBuffer: async (params) => {
      const rows = await layDs(params);
      if (rows.length === 0) return null;
      return { buffer: await build(rows), soHoSo: rows.length };
    },
  };
}

const CAC_LOAI_XUAT: KhaiLoaiXuat[] = [
  khaiLoaiXuat("01/GTGT", layDsGtgt01DeXuat, buildGtgt01WorkbookBuffer, gtgt01WorkbookFilename),
  khaiLoaiXuat("05/QTT-TNCN", layDsQtt05DeXuat, buildQtt05WorkbookBuffer, qtt05WorkbookFilename),
  khaiLoaiXuat("05/KK-TNCN", layDsTncn05DeXuat, buildTncn05WorkbookBuffer, tncn05WorkbookFilename),
  khaiLoaiXuat("03/TNDN", layDsTndn03DeXuat, buildTndn03WorkbookBuffer, tndn03WorkbookFilename),
  khaiLoaiXuat("Khác", layDsKhacDeXuat, buildKhacWorkbookBuffer, khacWorkbookFilename),
];

async function xuatMotLoai(p: XuatFileParams, khai: KhaiLoaiXuat): Promise<KetQuaXuatMot> {
  const fileName = khai.filename(p.mst);
  const ket = await khai.layBuffer(p);
  if (ket) await writeFile(p.dir, fileName, ket.buffer);
  return { nhan: khai.nhan, fileName, soHoSo: ket?.soHoSo ?? 0 };
}

const CO_LO_GHI_XML = 25;

async function xuatXmlHangLoat(dirGoc: FsDirHandle, tuNgay: string, denNgay: string): Promise<number> {
  const rows = await layDsXmlDeXuat({ tuNgay, denNgay });
  if (rows.length === 0) return 0;
  const xmlDir = await dirGoc.getDirectoryHandle(THU_MUC_XML, { create: true });
  for (let i = 0; i < rows.length; i += CO_LO_GHI_XML) {
    const lo = rows.slice(i, i + CO_LO_GHI_XML);
    await Promise.all(lo.map((row) => writeFile(xmlDir, row.fileName, row.xml)));
  }
  return rows.length;
}

/**
 * Xuất file đối soát của khu Dịch vụ công.
 *
 * Ghi thẳng vào thư mục người dùng chọn qua File System Access API thay vì tải
 * từng file về Downloads — một lượt đối soát ra nhiều file, thả hết vào
 * Downloads thì người dùng phải tự gom lại.
 */
export default function XuatFileDvcDialog({ open, onClose }: Props) {
  const [tuNgay, setTuNgay] = useState("");
  const [denNgay, setDenNgay] = useState("");
  const [dir, setDir] = useState<FsDirHandle | null>(null);
  const [dangXuat, setDangXuat] = useState(false);

  const activeMst = useActiveCompanyMst();

  // Firefox và Safari chưa có File System Access API — không chọn thư mục được.
  const canPick = supportsDirectoryPicker();
  const canExport = !!tuNgay && !!denNgay && !!dir && !!activeMst && !dangXuat;

  const chonThuMuc = async () => {
    try {
      const d = await pickDirectory();
      if (d) setDir(d);
    } catch (e) {
      toast.error(getErrorMessage(e, "Không chọn được thư mục."));
    }
  };

  const xuatFile = async () => {
    if (!dir || !activeMst) return;
    setDangXuat(true);
    try {
      const thuMucDich = await dir.getDirectoryHandle(THU_MUC_THONG_KE, { create: true });
      const p = { dir: thuMucDich, mst: activeMst, tuNgay, denNgay };
      const [ketQua, soXml] = await Promise.all([
        Promise.all(CAC_LOAI_XUAT.map((khai) => xuatMotLoai(p, khai))),
        xuatXmlHangLoat(dir, tuNgay, denNgay),
      ]);
      const daGhi = ketQua.filter((k) => k.soHoSo > 0);
      if (daGhi.length === 0 && soXml === 0) {
        const dsNhan = CAC_LOAI_XUAT.map((k) => k.nhan).join(", ");
        toast.info(`Không có hồ sơ nào (${dsNhan}) trong khoảng ngày đã chọn.`);
        return;
      }

      toast.success(`Đã xuất excel thống kê đối soát Dịch vụ công và tờ khai xml. `);
    } catch (e) {
      toast.error(getErrorMessage(e, "Xuất file đối soát Dịch vụ công thất bại."));
    } finally {
      setDangXuat(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        Thống kê giấy nộp tiền
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Xuất file đối soát và tải tờ khai, giấy nộp tiền (dịch vụ công)
        </Typography>

        {!canPick && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Trình duyệt hiện tại không hỗ trợ chọn thư mục để lưu. Vui lòng dùng
            Chrome hoặc Edge.
          </Alert>
        )}

        {!activeMst && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Chưa chọn công ty (mã số thuế) nên chưa xuất được file.
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Từ ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={tuNgay}
            onChange={(e) => setTuNgay(e.target.value)}
          />
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Đến ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={denNgay}
            onChange={(e) => setDenNgay(e.target.value)}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Button
            variant="outlined"
            startIcon={<FolderOpenRounded />}
            onClick={chonThuMuc}
            disabled={!canPick}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Chọn thư mục lưu tải file ra
          </Button>
          <Typography
            variant="body2"
            sx={{
              color: dir ? "text.primary" : "text.secondary",
              wordBreak: "break-all",
            }}
          >
            {dir ? dir.name : "Chưa chọn thư mục"}
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          startIcon={dangXuat ? <CircularProgress size={16} color="inherit" /> : <FileDownloadRounded />}
          onClick={() => void xuatFile()}
          disabled={!canExport}
          sx={{ textTransform: "none" }}
        >
          {dangXuat ? "Đang xuất…" : "Xuất file"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
