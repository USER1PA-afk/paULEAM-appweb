import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize = 5) {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, page, pageSize]
  );

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return { page: safePage, setPage, paged, total, totalPages, from, to };
}
