import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { useAuth } from "../../auth/useAuth";
import { deleteCompany, listCompanies, type CompanyDetail } from "../api/companyApi";
import CompanyFormDialog from "./CompanyFormDialog";

export default function CompanyManagementTab() {
  const { accessToken, currentCompanyId, user, switchCompany } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [companies, setCompanies] = useState<CompanyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyDetail | undefined>(undefined);
  const [deleting, setDeleting] = useState<CompanyDetail | undefined>(undefined);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState("");

  const fetchCompanies = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      setCompanies(await listCompanies(accessToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lấy được danh sách công ty.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // Tải danh sách công ty khi mở tab — cố ý fetch-on-mount, không có lib data-fetching riêng.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCompanies();
  }, [fetchCompanies]);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (company: CompanyDetail) => {
    setEditing(company);
    setFormOpen(true);
  };

  const handleSwitch = async (id: string) => {
    setSwitchError("");
    setSwitchingId(id);
    try {
      await switchCompany(id);
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Không đổi được công ty.");
    } finally {
      setSwitchingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || !accessToken) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteCompany(accessToken, deleting.id);
      setDeleting(undefined);
      await fetchCompanies();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Không xóa được công ty.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Quản lý công ty/Hộ kinh doanh
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Thêm mới và chuyển đổi linh hoạt giữa các không gian làm việc
      </Typography>

      {isOwner && (
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          fullWidth
          sx={{ mb: 3, textTransform: "none", py: 1.2 }}
          onClick={openCreate}
        >
          Thêm công ty/ Hộ kinh doanh
        </Button>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {switchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSwitchError("")}>
          {switchError}
        </Alert>
      )}

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : (
        <Stack spacing={2}>
          {companies.map((company) => {
            const isCurrent = company.id === currentCompanyId;
            const card = (
              <Box
                key={company.id}
                onClick={() => !isCurrent && switchingId === null && handleSwitch(company.id)}
                sx={{
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 2,
                  p: 2,
                  pl: isCurrent ? 3 : 2,
                  border: "1px solid",
                  borderColor: isCurrent ? "primary.main" : "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  cursor: isCurrent ? "default" : "pointer",
                  transition: "background-color 0.15s",
                  "&:hover": isCurrent ? undefined : { bgcolor: "action.hover" },
                  opacity: switchingId !== null && switchingId !== company.id ? 0.6 : 1,
                }}
              >
                {isCurrent && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 6,
                      bgcolor: "primary.main",
                    }}
                  />
                )}
                {isCurrent && (
                  <CheckCircleRounded
                    color="primary"
                    fontSize="small"
                    sx={{ position: "absolute", left: 14, top: "50%", mt: "-10px" }}
                  />
                )}

                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 700 }}>{company.tenDonVi}</Typography>
                    {switchingId === company.id && <CircularProgress size={14} />}
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <Box component="span" color="text.secondary">
                      Tài khoản Hóa đơn điện tử:{" "}
                    </Box>
                    <Box component="span" color="primary.main" sx={{ fontWeight: 600 }}>
                      {company.maSoThue}
                    </Box>
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    Tài khoản Thuế điện tử:
                  </Typography>
                </Box>

                {isOwner && (
                  <Stack
                    spacing={1}
                    sx={{ flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditRounded fontSize="small" />}
                      sx={{ textTransform: "none" }}
                      onClick={() => openEdit(company)}
                    >
                      Chỉnh sửa
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteRounded fontSize="small" />}
                      sx={{ textTransform: "none" }}
                      onClick={() => {
                        setDeleteError("");
                        setDeleting(company);
                      }}
                    >
                      Xóa
                    </Button>
                  </Stack>
                )}
              </Box>
            );
            return isCurrent ? (
              card
            ) : (
              <Tooltip key={company.id} title="Bấm để chuyển sang công ty này" placement="top">
                {card}
              </Tooltip>
            );
          })}

          {companies.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: "center", py: 4 }}>
              Chưa có công ty/hộ kinh doanh nào.
            </Typography>
          )}
        </Stack>
      )}

      <CompanyFormDialog
        open={formOpen}
        company={editing}
        onClose={() => setFormOpen(false)}
        onSaved={fetchCompanies}
      />

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(undefined)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa công ty/Hộ kinh doanh</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bạn có chắc muốn xóa "{deleting?.tenDonVi}"? Dữ liệu công ty sẽ được lưu trữ, không
            còn hiển thị trong danh sách nữa.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(undefined)} disabled={deleteBusy}>
            Hủy
          </Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={deleteBusy}>
            {deleteBusy ? <CircularProgress size={20} color="inherit" /> : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
