import {
  Suspense,
  useMemo,
  useState,
  type FormEvent,
  type JSX,
} from 'react';
import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { Loading } from '@/components/Loading';
import { getCurrentUser } from '@/features/auth/hooks/useAuth';
import { UsersTable } from '@/features/users/components/UsersTable';
import { ChangeRoleDialog } from '@/features/users/components/ChangeRoleDialog';
import { ResetPasswordDialog } from '@/features/users/components/ResetPasswordDialog';
import {
  useUsers,
  useSetUserActive,
  useResetPassword,
} from '@/features/users/hooks/useUsers';
import {
  ROLES,
  ROLE_LABELS,
  type AdminUser,
  type ListUsersParams,
  type Role,
  type UserStatus,
} from '@/features/users/types/user';

const STATUS_OPTIONS: { value: UserStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
];

type Params = ListUsersParams & { page: number; pageSize: number };

interface SectionProps {
  params: Params;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function UsersSection({
  params,
  onPageChange,
  onPageSizeChange,
}: SectionProps): JSX.Element {
  const { data } = useUsers(params);
  const setActive = useSetUserActive();
  const reset = useResetPassword();
  const meId = getCurrentUser()?.id;
  const [roleUser, setRoleUser] = useState<AdminUser | null>(null);
  const [resetPw, setResetPw] = useState<string | null>(null);

  function handleToggle(u: AdminUser): void {
    if (u.isActive && !window.confirm(`Khóa tài khoản "${u.hoTen}"?`)) return;
    setActive.mutate({ id: u.id, active: !u.isActive });
  }

  function handleReset(u: AdminUser): void {
    if (!window.confirm(`Đặt lại mật khẩu cho "${u.hoTen}"?`)) return;
    reset.mutate(u.id, { onSuccess: (d) => setResetPw(d.password) });
  }

  return (
    <>
      <UsersTable
        rows={data.data}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        meId={meId}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onToggleActive={handleToggle}
        onChangeRole={setRoleUser}
        onResetPassword={handleReset}
      />
      {roleUser && (
        <ChangeRoleDialog
          key={roleUser.id}
          user={roleUser}
          onClose={() => setRoleUser(null)}
        />
      )}
      {resetPw && (
        <ResetPasswordDialog
          password={resetPw}
          onClose={() => setResetPw(null)}
        />
      )}
    </>
  );
}

export function UsersPage(): JSX.Element {
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<Params>(
    () => ({
      page,
      pageSize,
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
    }),
    [page, pageSize, role, status, q],
  );

  function applySearch(e: FormEvent): void {
    e.preventDefault();
    setPage(1);
    setQ(qInput);
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        direction="row"
        spacing={2}
        component="form"
        onSubmit={applySearch}
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <TextField
          select
          label="Vai trò"
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value as Role | '');
          }}
          sx={{ width: 180 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {ROLES.map((r) => (
            <MenuItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Trạng thái"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as UserStatus | '');
          }}
          sx={{ width: 160 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Tìm theo email / tên / SĐT"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          sx={{ width: 280 }}
        />
        <Button type="submit" variant="contained">
          Tìm
        </Button>
      </Stack>

      <Suspense fallback={<Loading />}>
        <UsersSection
          params={params}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPage(1);
            setPageSize(s);
          }}
        />
      </Suspense>
    </Stack>
  );
}
