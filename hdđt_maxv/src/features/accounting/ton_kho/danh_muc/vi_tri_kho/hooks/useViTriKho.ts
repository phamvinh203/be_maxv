import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createViTri,
  deleteViTri,
  listViTri,
  updateViTri,
} from '@/features/accounting/ton_kho/danh_muc/vi_tri_kho/api/viTriKhoApi';
import type { ViTriForm } from '@/features/accounting/ton_kho/danh_muc/vi_tri_kho/types';

export const viTriKeys = {
  all: ['vi-tri-kho'] as const,
  list: ['vi-tri-kho', 'list'] as const,
};

export function useViTriList() {
  return useQuery({
    queryKey: viTriKeys.list,
    queryFn: () => listViTri(),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: viTriKeys.all });
}

export function useCreateViTri() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: ViTriForm) => createViTri(body),
    onSuccess: invalidate,
  });
}

export function useUpdateViTri() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      maKho,
      maViTri,
      body,
    }: {
      maKho: string;
      maViTri: string;
      body: ViTriForm;
    }) => updateViTri(maKho, maViTri, body),
    onSuccess: invalidate,
  });
}

export function useDeleteViTri() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maKho, maViTri }: { maKho: string; maViTri: string }) =>
      deleteViTri(maKho, maViTri),
    onSuccess: invalidate,
  });
}
