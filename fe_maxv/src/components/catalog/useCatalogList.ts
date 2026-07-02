import { useEffect, useMemo, useState } from 'react';

interface Options<T> {
  /** Toàn bộ dòng đã tải (đã unwrap từ query). */
  rows: T[];
  /** Khóa duy nhất của 1 dòng (vd r => r.ma_vt). */
  getId: (row: T) => string;
  /** Các cột chuỗi để lọc theo ô tìm kiếm. Truyền hằng số ở cấp module để ổn định. */
  searchKeys: string[];
  debounceMs?: number;
  defaultRpp?: number;
}

/**
 * State + logic dùng chung cho mọi bảng danh mục: chọn 1 dòng, tìm kiếm
 * (debounce, tự về trang 1), lọc client-side, phân trang, và lỗi thao tác.
 * Phần bảng/cột và dialog do từng danh mục tự render.
 */
export function useCatalogList<T>({
  rows,
  getId,
  searchKeys,
  debounceMs = 300,
  defaultRpp = 25,
}: Options<T>) {
  const [selected, setSelected] = useState<T | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(defaultRpp);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
      setPage(0);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [searchInput, debounceMs]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter((r) => {
      const rec = r as Record<string, unknown>;
      return searchKeys.some((k) =>
        String(rec[k] ?? '')
          .toLowerCase()
          .includes(search),
      );
    });
  }, [rows, search, searchKeys]);

  const paged = useMemo(
    () => filtered.slice(page * rpp, page * rpp + rpp),
    [filtered, page, rpp],
  );

  const isSelected = (row: T): boolean =>
    !!selected && getId(selected) === getId(row);
  const toggleSelect = (row: T): void =>
    setSelected((cur) => (cur && getId(cur) === getId(row) ? null : row));

  return {
    selected,
    setSelected,
    isSelected,
    toggleSelect,
    searchInput,
    setSearchInput,
    page,
    setPage,
    rpp,
    setRpp,
    filtered,
    paged,
    actionError,
    setActionError,
  };
}
