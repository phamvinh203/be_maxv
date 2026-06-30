import {
  Suspense,
  useMemo,
  useState,
  type FormEvent,
  type JSX,
} from 'react';
import { Button, Divider, MenuItem, Stack, TextField } from '@mui/material';
import { Loading } from '@/components/Loading';
import { SubscriptionsTable } from '@/features/subscriptions/components/SubscriptionsTable';
import { ChangePlanDialog } from '@/features/subscriptions/components/ChangePlanDialog';
import { HistoryDialog } from '@/features/subscriptions/components/HistoryDialog';
import { PlansPanel } from '@/features/subscriptions/components/PlansPanel';
import {
  usePlans,
  useSubscriptions,
  useCancelSubscription,
} from '@/features/subscriptions/hooks/useSubscriptions';
import type {
  ListSubscriptionsParams,
  SubStatus,
  Subscription,
} from '@/features/subscriptions/types/subscription';

const STATUS_OPTIONS: { value: SubStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'TRIALING', label: 'Dùng thử' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'PAST_DUE', label: 'Quá hạn' },
  { value: 'CANCELED', label: 'Đã hủy' },
  { value: 'EXPIRED', label: 'Hết hạn' },
];

type Params = ListSubscriptionsParams & { page: number; pageSize: number };

interface SectionProps {
  params: Params;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** Bảng thuê bao + dialog (cần Suspense vì dùng useSuspenseQuery). */
function SubscriptionsSection({
  params,
  onPageChange,
  onPageSizeChange,
}: SectionProps): JSX.Element {
  const { data } = useSubscriptions(params);
  const { data: plans } = usePlans();
  const cancel = useCancelSubscription();
  const [changeSub, setChangeSub] = useState<Subscription | null>(null);
  const [historySub, setHistorySub] = useState<Subscription | null>(null);

  function handleCancel(sub: Subscription): void {
    if (window.confirm(`Hủy thuê bao của "${sub.donVi.tenDonVi}"?`)) {
      cancel.mutate(sub.id);
    }
  }

  return (
    <>
      <SubscriptionsTable
        rows={data.data}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onChangePlan={setChangeSub}
        onHistory={setHistorySub}
        onCancel={handleCancel}
      />
      {changeSub && (
        <ChangePlanDialog
          key={changeSub.id}
          subscription={changeSub}
          plans={plans}
          onClose={() => setChangeSub(null)}
        />
      )}
      <HistoryDialog
        subscriptionId={historySub?.id ?? null}
        title={historySub?.donVi.tenDonVi}
        onClose={() => setHistorySub(null)}
      />
    </>
  );
}

export function SubscriptionsPage(): JSX.Element {
  const [status, setStatus] = useState<SubStatus | ''>('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<Params>(
    () => ({
      page,
      pageSize,
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
    }),
    [page, pageSize, status, q],
  );

  function applySearch(e: FormEvent): void {
    e.preventDefault();
    setPage(1);
    setQ(qInput);
  }

  return (
    <Stack spacing={3}>
      {/* ===== Thuê bao đơn vị ===== */}
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={2}
          component="form"
          onSubmit={applySearch}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <TextField
            select
            label="Trạng thái"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as SubStatus | '');
            }}
            sx={{ width: 200 }}
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Tìm theo MST / tên đơn vị"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            sx={{ width: 280 }}
          />
          <Button type="submit" variant="contained">
            Tìm
          </Button>
        </Stack>

        <Suspense fallback={<Loading />}>
          <SubscriptionsSection
            params={params}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPage(1);
              setPageSize(s);
            }}
          />
        </Suspense>
      </Stack>

      <Divider />

      {/* ===== Quản lý gói ===== */}
      <Suspense fallback={<Loading />}>
        <PlansPanel />
      </Suspense>
    </Stack>
  );
}
