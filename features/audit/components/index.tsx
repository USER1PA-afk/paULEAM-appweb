"use client";

import { useState } from "react";
import { useAuditLog } from "@features/audit/hooks";
import {
  type AuditLog,
  type AuditAction,
  type AuditEntityType,
  type AuditFilters,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ACTION_COLORS,
  AuditActionEnum,
  AuditEntityTypeEnum,
} from "@entities/audit";
import { formatDate } from "@shared/lib/utils";
import { Shield, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

// ============================================================
// AuditStats — tarjetas de resumen
// ============================================================
export function AuditStats({ entries }: { entries: AuditLog[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = entries.filter((e) => e.created_at.startsWith(today)).length;

  const countByAction = AuditActionEnum.options.reduce<Record<string, number>>(
    (acc, action) => {
      acc[action] = entries.filter((e) => e.action === action).length;
      return acc;
    },
    {}
  );

  const topActions = Object.entries(countByAction)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 mb-1">
          Hoy
        </p>
        <p className="text-2xl font-bold tabular-nums">{todayCount}</p>
        <p className="text-xs text-muted-foreground mt-0.5">eventos</p>
      </div>

      {topActions.map(([action, count]) => {
        const colors = AUDIT_ACTION_COLORS[action as AuditAction];
        return (
          <div key={action} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 mb-1">
              {AUDIT_ACTION_LABELS[action as AuditAction]}
            </p>
            <p className="text-2xl font-bold tabular-nums">{count}</p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold mt-1 ${colors.bg} ${colors.text}`}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              {action}
            </span>
          </div>
        );
      })}

      {topActions.length === 0 && (
        <div className="col-span-4 rounded-xl border border-dashed border-border bg-muted/20 p-4 flex items-center justify-center text-xs text-muted-foreground">
          Sin actividad reciente
        </div>
      )}
    </div>
  );
}

// ============================================================
// AuditLogTable — tabla filtrable, paginada y con filas expandibles
// ============================================================
export function AuditLogTable() {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, page_size: 50 });
  const [expanded, setExpanded] = useState<string | null>(null);

  const { entries, loading, error, total, totalPages, refetch } = useAuditLog(filters);

  function setFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  const pillBase =
    "rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium transition-colors hover:bg-muted cursor-pointer";
  const pillActive =
    "bg-brand-600 text-white border-brand-600 hover:bg-brand-700";

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Filtro por acción */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("action", "")}
            className={`${pillBase} ${!filters.action ? pillActive : ""}`}
          >
            Todas
          </button>
          {AuditActionEnum.options.map((action) => (
            <button
              key={action}
              onClick={() => setFilter("action", action as AuditAction)}
              className={`${pillBase} ${filters.action === action ? pillActive : ""}`}
            >
              {AUDIT_ACTION_LABELS[action as AuditAction]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {/* Filtro por entidad */}
        <select
          value={filters.entity_type ?? ""}
          onChange={(e) =>
            setFilter("entity_type", e.target.value as AuditEntityType | "")
          }
          className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filtrar por entidad"
        >
          <option value="">Todas las entidades</option>
          {AuditEntityTypeEnum.options.map((type) => (
            <option key={type} value={type}>
              {AUDIT_ENTITY_LABELS[type as AuditEntityType]}
            </option>
          ))}
        </select>

        {/* Rango de fechas */}
        <input
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) => setFilter("date_from", e.target.value || undefined)}
          className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Desde"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) => setFilter("date_to", e.target.value || undefined)}
          className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Hasta"
        />

        <button
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
          aria-label="Actualizar"
        >
          <RefreshCw aria-hidden="true" className="h-3 w-3" />
          Actualizar
        </button>
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div
            role="status"
            className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
          >
            <span className="sr-only">Cargando auditoría...</span>
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-muted-foreground">
          <Shield aria-hidden="true" className="h-10 w-10 mb-3 opacity-25" />
          <p className="font-medium">Sin eventos de auditoría</p>
          <p className="text-sm mt-1">Los cambios aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 w-36">
                  Fecha
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 w-36">
                  Usuario
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 w-40">
                  Acción
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 hidden sm:table-cell">
                  Entidad
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 hidden md:table-cell">
                  Descripción
                </th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {entries.map((entry) => {
                const colors = AUDIT_ACTION_COLORS[entry.action];
                const isOpen = expanded === entry.id;
                const hasDetail = !!(entry.old_values || entry.new_values);

                return (
                  <>
                    <tr
                      key={entry.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium max-w-[140px] truncate">
                        {entry.user_name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
                          />
                          {AUDIT_ACTION_LABELS[entry.action]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {AUDIT_ENTITY_LABELS[entry.entity_type]}
                        {entry.entity_id && (
                          <span className="ml-1 font-mono text-[10px] text-muted-foreground/60">
                            #{entry.entity_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate">
                        {entry.details ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {hasDetail && (
                          <button
                            onClick={() => setExpanded(isOpen ? null : entry.id)}
                            aria-label={isOpen ? "Ocultar valores" : "Ver valores"}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
                          >
                            {isOpen ? (
                              <ChevronUp aria-hidden="true" className="h-4 w-4" />
                            ) : (
                              <ChevronDown aria-hidden="true" className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Fila expandida con old_values / new_values */}
                    {isOpen && hasDetail && (
                      <tr key={`${entry.id}-detail`} className="bg-muted/10">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid sm:grid-cols-2 gap-4">
                            {entry.old_values && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
                                  Valores anteriores
                                </p>
                                <pre className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 p-3 text-[11px] text-rose-800 dark:text-rose-300 overflow-x-auto">
                                  {JSON.stringify(entry.old_values, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.new_values && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
                                  Valores nuevos
                                </p>
                                <pre className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-3 text-[11px] text-emerald-800 dark:text-emerald-300 overflow-x-auto">
                                  {JSON.stringify(entry.new_values, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} eventos totales</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setFilters((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))
              }
              disabled={(filters.page ?? 1) <= 1}
              className="rounded-full border border-border px-3 py-1 font-medium hover:bg-muted disabled:opacity-40 transition-colors"
            >
              Anterior
            </button>
            <span>
              Página {filters.page ?? 1} de {totalPages}
            </span>
            <button
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  page: Math.min(totalPages, (p.page ?? 1) + 1),
                }))
              }
              disabled={(filters.page ?? 1) >= totalPages}
              className="rounded-full border border-border px-3 py-1 font-medium hover:bg-muted disabled:opacity-40 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
