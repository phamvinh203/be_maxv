import type { JSX } from 'react';
import { Chip } from '@mui/material';
import type { LogLevel } from '@/features/logs/types/log';

const MAP: Record<LogLevel, { color: 'info' | 'warning' | 'error' }> = {
  INFO: { color: 'info' },
  WARN: { color: 'warning' },
  ERROR: { color: 'error' },
};

export function LevelChip({ level }: { level: LogLevel }): JSX.Element {
  return (
    <Chip
      label={level}
      color={MAP[level].color}
      size="small"
      variant="outlined"
    />
  );
}
