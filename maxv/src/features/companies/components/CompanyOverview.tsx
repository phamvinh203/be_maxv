import { useState, type JSX } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { useCompanyOverview } from '@/features/companies/hooks/useCompanies';

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): JSX.Element {
  return (
    <Card variant="outlined" sx={{ minWidth: 150, flex: '1 1 150px' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

/**
 * Tổng quan dữ liệu DB tenant theo cây menu:
 *   Tabs module (Tồn kho, ...) -> sub-tabs section (Danh mục / Chứng từ / Báo cáo)
 *   -> bảng liệt kê từng mục kèm số bản ghi + dung lượng.
 * Mục chưa dựng bảng (exists=false) hiển thị "—".
 */
export function CompanyOverview({ id }: { id: string }): JSX.Element {
  const { data } = useCompanyOverview(id);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [sectionIdx, setSectionIdx] = useState(0);

  const activeModule = data.modules[moduleIdx];
  const activeSection = activeModule?.sections[sectionIdx];

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Tổng quan dữ liệu (DB tenant)</Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <StatCard label="Dung lượng DB" value={data.dbSize} />
        {activeModule && (
          <>
            <StatCard
              label={`Tổng bản ghi · ${activeModule.title}`}
              value={activeModule.totalRows.toLocaleString('vi-VN')}
            />
            <StatCard
              label={`Dung lượng · ${activeModule.title}`}
              value={activeModule.totalSize}
            />
          </>
        )}
      </Box>

      {data.modules.length === 0 ? (
        <Typography color="text.secondary">Chưa có module nào.</Typography>
      ) : (
        <>
          {/* Tabs module: Tồn kho, ... (sau này thêm) */}
          <Tabs
            value={moduleIdx}
            onChange={(_, v: number) => {
              setModuleIdx(v);
              setSectionIdx(0);
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {data.modules.map((m) => (
              <Tab key={m.key} label={m.title} />
            ))}
          </Tabs>

          {activeModule && (
            <Paper variant="outlined">
              {/* Sub-tabs section: Danh mục / Chứng từ / Báo cáo */}
              <Tabs
                value={sectionIdx}
                onChange={(_, v: number) => setSectionIdx(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                {activeModule.sections.map((s) => (
                  <Tab
                    key={s.key}
                    label={`${s.title} (${s.items.length})`}
                  />
                ))}
              </Tabs>

              {activeSection && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mục</TableCell>
                        <TableCell align="right">Số bản ghi</TableCell>
                        <TableCell align="right">Dung lượng</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeSection.items.map((it) => (
                        <TableRow key={it.label} hover>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: 'center' }}
                            >
                              <span>{it.label}</span>
                              {!it.exists && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label="chưa có bảng"
                                  color="default"
                                />
                              )}
                            </Stack>
                            {it.path && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {it.path}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {it.exists
                              ? (it.rows ?? 0).toLocaleString('vi-VN')
                              : '—'}
                          </TableCell>
                          <TableCell align="right">
                            {it.exists ? it.size : '—'}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Dòng tổng của section */}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Tổng</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {activeSection.totalRows.toLocaleString('vi-VN')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {activeSection.totalSize}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          )}
        </>
      )}
    </Stack>
  );
}
