import type { ReactNode } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface HrmFormDialogProps<TSchema extends z.ZodType<any, any, any>> {
  open: boolean;
  title: string;
  schema: TSchema;
  defaultValues: DefaultValues<z.infer<TSchema>>;
  onClose: () => void;
  onSubmit: (values: z.infer<TSchema>) => Promise<void> | void;
  /** Nội dung field, nhận `form` (từ `useForm`) để tự gắn `Controller`/`register`. */
  renderFields: (form: ReturnType<typeof useForm<z.infer<TSchema>>>) => ReactNode;
  submitLabel?: string;
}

/**
 * Khung dialog CRUD dùng chung cho HRM — validate qua `zod`, quản lý form qua
 * `react-hook-form`. Chưa có màn nào dùng (ADR-011): dựng sẵn để pilot kế tiếp
 * (gộp 1 trong 8 cặp dialog ở `du_lieu_tinh_luong`) dùng ngay, không dựng lại.
 *
 * Cách dùng dự kiến:
 * ```tsx
 * const schema = z.object({ ten: z.string().min(1, "Bắt buộc") });
 * <HrmFormDialog
 *   open={open}
 *   title="Thêm phòng ban"
 *   schema={schema}
 *   defaultValues={{ ten: "" }}
 *   onClose={onClose}
 *   onSubmit={async (values) => { await luuPhongBan(values); onClose(); }}
 *   renderFields={(form) => (
 *     <TextField
 *       label="Tên phòng ban"
 *       {...form.register("ten")}
 *       error={!!form.formState.errors.ten}
 *       helperText={form.formState.errors.ten?.message}
 *     />
 *   )}
 * />
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function HrmFormDialog<TSchema extends z.ZodType<any, any, any>>({
  open,
  title,
  schema,
  defaultValues,
  onClose,
  onSubmit,
  renderFields,
  submitLabel = "Lưu",
}: HrmFormDialogProps<TSchema>) {
  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    defaultValues,
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  const handleClose = () => {
    form.reset(defaultValues);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {renderFields(form)}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={form.formState.isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={form.formState.isSubmitting}
            startIcon={form.formState.isSubmitting ? <CircularProgress size={16} /> : undefined}
          >
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
