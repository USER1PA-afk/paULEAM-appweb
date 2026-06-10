"use client";

import { usePackagingTemplates, usePackagingTemplateMutations } from "@features/packaging";
import { useRole } from "@features/auth/hooks";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";

export default function AdminPackagingTemplatesPage() {
  const { templates, loading, error, refetch } = usePackagingTemplates();
  const { updateTemplate } = usePackagingTemplateMutations(refetch);
  const { role } = useRole();
  const isAdmin = role === "admin";
  const { page, setPage, paged: pagedTemplates, from, to, total, totalPages } = usePagination(templates);

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`¿Desactivar la plantilla "${name}"?`)) return;
    await updateTemplate(id, { is_active: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de Empaque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define cómo empacar un producto terminado: presentación, materiales y proporciones.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/packaging"
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            ← Órdenes
          </Link>
          {isAdmin && (
            <Link
              href="/admin/packaging/templates/new"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              + Nueva Plantilla
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-16 gap-3">
          <p className="text-muted-foreground text-sm">No hay plantillas de empaque.</p>
          {isAdmin && (
            <Link
              href="/admin/packaging/templates/new"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              Crear primera plantilla
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Producto Granel</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">→ Presentación</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Por Unidad</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedTemplates.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {t.finished_product_name ?? "—"}
                    {t.finished_product_sku && (
                      <div className="text-[10px] font-mono">{t.finished_product_sku}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.output_product_name ?? "—"}
                    {t.output_product_sku && (
                      <div className="text-[10px] font-mono text-muted-foreground">{t.output_product_sku}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold tabular-nums">
                    {Number(t.bulk_qty_per_unit)} {t.bulk_unit}
                    <div className="text-[10px] text-muted-foreground font-normal">por {t.output_unit}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      t.is_active
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {t.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/admin/packaging/templates/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-600 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </Link>
                        {t.is_active && (
                          <button
                            onClick={() => handleDeactivate(t.id, t.name)}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            from={from}
            to={to}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
