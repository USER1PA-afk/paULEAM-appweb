"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getInsforge } from "@shared/lib/insforge/client";
import {
  Search, Plus, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, SlidersHorizontal, ShoppingBag,
  AlertTriangle,
} from "lucide-react";
import {
  useStoreProducts,
  useCategories,
  useStoreProductMutations,
  type StoreProductsFilters,
  type StoreProductWithStock,
} from "@features/store-products/hooks";
import {
  ProductStatusBadge,
  StockBadge,
  StoreProductThumbnail,
  ProductQuickActions,
} from "@features/store-products/components";

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });

function SortIcon({ col, sortBy, sortDir }: {
  col: "name" | "price" | "created_at";
  sortBy: string;
  sortDir: "asc" | "desc";
}) {
  if (sortBy !== col)
    return <span className="h-3 w-3 opacity-25 inline-block ml-0.5">↕</span>;
  return sortDir === "asc" ? (
    <ChevronUp className="h-3 w-3 inline ml-0.5 text-brand-600" />
  ) : (
    <ChevronDown className="h-3 w-3 inline ml-0.5 text-brand-600" />
  );
}

export default function StoreProductsPage() {
  const router = useRouter();
  const insforge = getInsforge();

  // ── Sets de IDs para badges de origen ──
  const [packagingOutputIds, setPackagingOutputIds] = useState<Set<string>>(new Set());
  const [bulkProductIds, setBulkProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadTemplateIds() {
      const { data } = await insforge.database
        .from("packaging_templates")
        .select("output_product_id, finished_product_id");
      if (data) {
        type TplRow = { output_product_id: string; finished_product_id: string };
        const rows = data as TplRow[];
        setPackagingOutputIds(new Set(rows.map((r) => r.output_product_id)));
        setBulkProductIds(new Set(rows.map((r) => r.finished_product_id)));
      }
    }
    loadTemplateIds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filters, setFilters] = useState<StoreProductsFilters>({
    search: "",
    categoryId: "",
    status: "all",
    sortBy: "name",
    sortDir: "asc",
    page: 1,
    perPage: 15,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreProductWithStock | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { products, total, pages, loading, refetch } = useStoreProducts(filters);
  const { categories } = useCategories();
  const { toggleActive, toggleFeatured, softDelete } = useStoreProductMutations();

  function setFilter(partial: Partial<StoreProductsFilters>) {
    setFilters((prev) => ({ ...prev, ...partial, page: partial.page ?? 1 }));
  }

  function toggleSort(col: "name" | "price" | "created_at") {
    setFilters((prev) => ({
      ...prev,
      sortBy: col,
      sortDir: prev.sortBy === col && prev.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    }));
  }

  async function handleToggleActive(p: StoreProductWithStock) {
    setActionLoading(p.id + "-active");
    await toggleActive(p.id, p.is_active);
    await refetch();
    setActionLoading(null);
  }

  async function handleToggleFeatured(p: StoreProductWithStock) {
    setActionLoading(p.id + "-featured");
    await toggleFeatured(p.id, p.featured);
    await refetch();
    setActionLoading(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id + "-delete");
    await softDelete(deleteTarget.id);
    setDeleteTarget(null);
    await refetch();
    setActionLoading(null);
  }


  return (
    <div className="space-y-5">

      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Tienda / Productos</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Productos de la Tienda</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} producto{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/store/products/new"
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </Link>
      </div>

      {/* ─── Quick status tabs ─── */}
      <div className="flex gap-1 flex-wrap">
        {(["all", "active", "featured", "inactive"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter({ status: s })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.status === s
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all"      && "Todos"}
            {s === "active"   && "Activos"}
            {s === "featured" && "✦ Destacados"}
            {s === "inactive" && "Ocultos"}
          </button>
        ))}
      </div>

      {/* ─── Search + Filters ─── */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              placeholder="Buscar por nombre o SKU..."
              className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              showFilters || filters.categoryId
                ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-3 flex-wrap p-3 rounded-lg bg-muted/30 border border-border">
            {/* Category filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Categoría</label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilter({ categoryId: e.target.value })}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Ordenar por</label>
              <select
                value={`${filters.sortBy}-${filters.sortDir}`}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split("-");
                  setFilter({
                    sortBy: col as "name" | "price" | "created_at",
                    sortDir: dir as "asc" | "desc",
                  });
                }}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="name-asc">Nombre A→Z</option>
                <option value="name-desc">Nombre Z→A</option>
                <option value="price-asc">Precio menor</option>
                <option value="price-desc">Precio mayor</option>
                <option value="created_at-desc">Más reciente</option>
                <option value="created_at-asc">Más antiguo</option>
              </select>
            </div>

            {/* Per page */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Por página</label>
              <select
                value={filters.perPage}
                onChange={(e) => setFilter({ perPage: Number(e.target.value) })}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {(filters.categoryId) && (
              <div className="flex items-end">
                <button
                  onClick={() => setFilter({ categoryId: "" })}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Delete confirm ─── */}
      {deleteTarget && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            ¿Ocultar &ldquo;{deleteTarget.name}&rdquo; del catálogo?
          </p>
          <p className="text-xs text-muted-foreground">
            El producto dejará de aparecer en la tienda pública. Puedes reactivarlo después desde la página de detalle.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={!!actionLoading}
              className="rounded-lg bg-destructive px-4 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? "Ocultando..." : "Sí, ocultar"}
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ─── Table ─── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-center font-medium text-muted-foreground w-12"></th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  <button onClick={() => toggleSort("name")} className="flex items-center gap-0.5 hover:text-foreground transition-colors">
                    Producto <SortIcon col="name" sortBy={filters.sortBy ?? "name"} sortDir={filters.sortDir ?? "asc"} />
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden md:table-cell">Categoría</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  <button onClick={() => toggleSort("price")} className="flex items-center gap-0.5 ml-auto hover:text-foreground transition-colors">
                    Precio <SortIcon col="price" sortBy={filters.sortBy ?? "name"} sortDir={filters.sortDir ?? "asc"} />
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden sm:table-cell">Stock</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden lg:table-cell">Estado</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden xl:table-cell">
                  <button onClick={() => toggleSort("created_at")} className="flex items-center gap-0.5 hover:text-foreground transition-colors">
                    Creado <SortIcon col="created_at" sortBy={filters.sortBy ?? "name"} sortDir={filters.sortDir ?? "asc"} />
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      <span className="text-sm">Cargando productos...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {filters.search || filters.categoryId || filters.status !== "all"
                        ? "No hay productos que coincidan con los filtros."
                        : "No hay productos en la tienda."}
                    </p>
                    {!filters.search && !filters.categoryId && filters.status === "all" && (
                      <Link
                        href="/admin/store/products/new"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" /> Crear primer producto
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    {/* Thumbnail */}
                    <td className="px-4 py-3 text-center">
                      <StoreProductThumbnail imageUrl={p.image_url} name={p.name} />
                    </td>

                    {/* Name + SKU */}
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/store/products/${p.id}`}
                        className="font-medium hover:text-brand-600 transition-colors block"
                      >
                        {p.name}
                      </Link>
                      <div className="flex items-center justify-center flex-wrap gap-1 mt-0.5">
                        <span className="text-[11px] font-mono text-muted-foreground">{p.sku}</span>
                        {packagingOutputIds.has(p.id) && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-100 dark:bg-accent-900/30 border border-accent-200 dark:border-accent-700 px-1.5 py-0.5 text-[9px] font-bold text-accent-700 dark:text-accent-400 uppercase tracking-wide">
                            📦 Empaque
                          </span>
                        )}
                        {bulkProductIds.has(p.id) && (
                          <span
                            title="Producto interno — use empaque para vender en presentaciones"
                            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide cursor-help"
                          >
                            ⚗️ Granel
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-center text-muted-foreground hidden md:table-cell">
                      {p.category_name ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                          {p.category_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-center tabular-nums font-medium">
                      {fmt(p.price || 0)}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <StockBadge stock={p.stock} unit={p.unit} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <ProductStatusBadge
                        isActive={p.is_active}
                        featured={p.featured}
                        stock={p.stock}
                      />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-center text-muted-foreground text-xs hidden xl:table-cell">
                      {fmtDate(p.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      {actionLoading?.startsWith(p.id) ? (
                        <div className="flex justify-end">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                        </div>
                      ) : (
                        <ProductQuickActions
                          product={p}
                          onEdit={() => router.push(`/admin/store/products/${p.id}`)}
                          onToggleActive={() => handleToggleActive(p)}
                          onToggleFeatured={() => handleToggleFeatured(p)}
                          onDelete={() => setDeleteTarget(p)}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination ─── */}
        {pages > 1 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Mostrando {((filters.page! - 1) * filters.perPage!) + 1}–
              {Math.min(filters.page! * filters.perPage!, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter({ page: (filters.page ?? 1) - 1 })}
                disabled={(filters.page ?? 1) <= 1}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    onClick={() => setFilter({ page: pg })}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      filters.page === pg
                        ? "bg-brand-600 text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setFilter({ page: (filters.page ?? 1) + 1 })}
                disabled={(filters.page ?? 1) >= pages}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
