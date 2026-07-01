import { useState, type JSX } from 'react';
import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';

interface Props {
  label: string;
  value: string;
  onChange: TextFieldProps['onChange'];
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

/** TextField mật khẩu kèm nút ẩn/hiện — tự quản lý state hiển thị. */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  helperText,
}: Props): JSX.Element {
  const [show, setShow] = useState(false);
  return (
    <TextField
      label={label}
      type={show ? 'text' : 'password'}
      required={required}
      fullWidth
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShow((v) => !v)} edge="end" tabIndex={-1}>
                {show ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
