"use client";

import { useRouter } from "next/navigation";
import { useRecipes, useProducts } from "../hooks";
import { Beaker, Eye, Pencil } from "lucide-react";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";

export function RecipeList() {
  const router = useRouter();
  const { recipes, loading } = useRecipes();
  const { finishedProducts } = useProducts();
  const { page, setPage, paged: pagedRecipes, from, to, total, totalPages } = usePagination(recipes);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
          <span className="sr-only">Cargando recetas...</span>
        </div>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-muted-foreground">
        <div aria-hidden="true" className="flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-50 mb-4 dark:bg-brand-900/20">
          <Beaker className="h-7 w-7 text-brand-600" />
        </div>
        <p className="text-sm font-medium text-foreground">No hay recetas registradas</p>
        <p className="text-xs mt-1.5 text-muted-foreground max-w-xs text-center">
          Crea primero productos terminados en el módulo de Productos y luego define sus recetas de producción.
        </p>
      </div>
    );
  }

  function getProductName(productId: string) {
    const prod = finishedProducts.find((p) => p.id === productId);
    return prod?.name ?? "—";
  }

  return (
    <div className="space-y-4">
      {/* Desktop: Table View */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table aria-label="Lista de recetas" className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Receta
              </th>
              <th className="px-5 py-3.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Producto Final
              </th>
              <th className="px-5 py-3.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Rendimiento Base
              </th>
              <th className="px-5 py-3.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Estado
              </th>
              <th className="px-5 py-3.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pagedRecipes.map((r) => (
              <tr key={r.id} className="group hover:bg-muted/20 transition-colors">
                <td className="px-5 py-4 text-center">
                  <div>
                    <p className="font-semibold text-foreground">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {r.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-center text-sm text-muted-foreground">
                  {getProductName(r.output_product_id)}
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="font-bold text-foreground tabular-nums">
                    {Number(r.yield_base).toLocaleString("es-EC", {
                      minimumFractionDigits: ["kg", "lt"].includes(r.yield_unit?.toLowerCase() || "") ? 2 : 0,
                      maximumFractionDigits: ["kg", "lt"].includes(r.yield_unit?.toLowerCase() || "") ? 2 : 2,
                      useGrouping: false
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">{r.yield_unit}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    Activa
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => router.push(`/admin/recipes/${r.id}`)}
                      aria-label={`Ver ingredientes de ${r.name}`}
                      className="flex items-center gap-1.5 rounded-md bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
                    >
                      <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                      Ver Ingredientes
                    </button>
                    <button
                      onClick={() => router.push(`/admin/recipes/${r.id}/edit`)}
                      aria-label={`Editar receta ${r.name}`}
                      className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  </div>
                </td>
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

      {/* Mobile: Card View */}
      <div className="grid gap-4 lg:hidden">
        {pagedRecipes.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-brand-200 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getProductName(r.output_product_id)}
                </p>
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ml-2 dark:bg-brand-900/30 dark:text-brand-400">
                Activa
              </span>
            </div>

            {r.description && (
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {r.description}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <div>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {Number(r.yield_base).toLocaleString("es-EC", {
                    minimumFractionDigits: ["kg", "lt"].includes(r.yield_unit?.toLowerCase() || "") ? 2 : 0,
                    maximumFractionDigits: ["kg", "lt"].includes(r.yield_unit?.toLowerCase() || "") ? 2 : 2,
                    useGrouping: false
                  })}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.yield_unit} base
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/admin/recipes/${r.id}`)}
                  aria-label={`Ver ingredientes de ${r.name}`}
                  className="flex items-center gap-1.5 rounded-md bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
                >
                  <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                  Ver
                </button>
                <button
                  onClick={() => router.push(`/admin/recipes/${r.id}/edit`)}
                  aria-label={`Editar receta ${r.name}`}
                  className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                >
                  <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                  Editar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="lg:hidden">
        <TablePagination
          page={page}
          totalPages={totalPages}
          from={from}
          to={to}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
