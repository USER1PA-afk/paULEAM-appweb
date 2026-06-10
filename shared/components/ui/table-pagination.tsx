"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  page,
  totalPages,
  from,
  to,
  total,
  onPageChange,
}: TablePaginationProps) {
  if (total === 0 || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border/50 px-4 py-2.5">
      <span className="text-[11px] text-muted-foreground tabular-nums select-none">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40 transition-colors"
        >
          <ChevronLeft aria-hidden="true" className="h-3 w-3" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40 transition-colors"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight aria-hidden="true" className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
