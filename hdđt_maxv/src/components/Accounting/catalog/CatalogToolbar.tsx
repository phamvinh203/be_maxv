import { useState, type JSX, type ReactNode } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/** Nút thao tác trên dòng đang chọn (Sửa/Copy/Xem/Đổi mã/Xóa...). */
export interface CatalogAction {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: 'error';
}

/** Mục trong menu "..." (thao tác phụ ít dùng). */
export interface CatalogMoreItem {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface Props {
  addLabel: string;
  onAdd: () => void;
  actions: CatalogAction[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
  searchPlaceholder?: string;
  moreItems?: CatalogMoreItem[];
}

/** Thanh công cụ chuẩn cho các bảng danh mục: Thêm + nhóm icon + tìm kiếm + làm tươi + menu phụ. */
export function CatalogToolbar({
  addLabel,
  onAdd,
  actions,
  searchValue,
  onSearchChange,
  onRefresh,
  searchPlaceholder = 'Tìm kiếm…',
  moreItems,
}: Props): JSX.Element {
  const [moreEl, setMoreEl] = useState<null | HTMLElement>(null);
  const closeMore = () => setMoreEl(null);

  return (
    <Paper
      elevation={0}
      square
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        flexWrap: 'wrap',
      }}
    >
      <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onAdd}>
        {addLabel}
      </Button>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {actions.map((a) => (
        <Tooltip key={a.title} title={a.title}>
          <span>
            <IconButton
              size="small"
              color={a.color}
              disabled={a.disabled}
              onClick={a.onClick}
            >
              {a.icon}
            </IconButton>
          </span>
        </Tooltip>
      ))}

      <Box sx={{ flex: 1 }} />

      <TextField
        size="small"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ minWidth: 240 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Tooltip title="Làm tươi">
        <IconButton size="small" onClick={onRefresh}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {moreItems && moreItems.length > 0 && (
        <>
          <Tooltip title="Thêm thao tác">
            <IconButton size="small" onClick={(e) => setMoreEl(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={moreEl} open={!!moreEl} onClose={closeMore}>
            {moreItems.map((m) => (
              <MenuItem
                key={m.label}
                onClick={() => {
                  m.onClick();
                  closeMore();
                }}
              >
                <Box component="span" sx={{ mr: 1, display: 'inline-flex' }}>
                  {m.icon}
                </Box>
                {m.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Paper>
  );
}
