import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Step from "@mui/material/Step";
import StepContent from "@mui/material/StepContent";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import type { HuongDan } from "./noiDung";

interface Props {
  open: boolean;
  onClose: () => void;
  huongDan: HuongDan;
}

/** Hộp hướng dẫn từng bước của một khu HRM — mọi bước mở sẵn, đọc lướt từ trên xuống. */
export default function HuongDanDialog({ open, onClose, huongDan }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Hướng dẫn {huongDan.tenKhu}</DialogTitle>
      <DialogContent>
        {huongDan.gioiThieu && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {huongDan.gioiThieu}
          </Typography>
        )}
        <Stepper orientation="vertical" nonLinear activeStep={-1}>
          {huongDan.buoc.map((b) => (
            <Step key={b.tieuDe} active expanded>
              <StepLabel>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {b.tieuDe}
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  {b.moTa}
                </Typography>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: "none" }}>
          Đã hiểu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
