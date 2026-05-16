"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { SupplierSelect } from "@features/suppliers/components";
import { useSupplierActions } from "@features/suppliers/hooks";
import { useRole } from "@features/auth/hooks";
import { Tag, AlertTriangle, Pencil, Trash2, Star } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  type: "MATERIA_PRIMA" | "PRODUCTO_TERMINADO";
  unit: string;
  category_id: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface ProductWithSuppliers extends Product {
  suppliers: { company: string | null; name: string; is_primary: boolean }[];
}

type FormMode = "create" | "edit";

const EMPTY_FORM = {
  name: "",
  sku: "",
  type: "MATERIA_PRIMA" as "MATERIA_PRIMA" | "PRODUCTO_TERMINADO",
  unit: "kg",
  price: "",
  description: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductWithSuppliers[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // Supplier state — solo para MATERIA_PRIMA
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [primarySupplierId, setPrimarySupplierId] = useState<string>("");

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductWithSuppliers | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLedgerCount, setDeleteLedgerCount] = useState(0);
  const [deleteChecking, setDeleteChecking] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insforge = getInsforge();
  const { linkSuppliersToProduct } = useSupplierActions();
  const { role } = useRole();
  const isAdmin = role === "admin";

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await insforge.database
      .from("products")
      .select(`
        *,
        suppliers:product_suppliers(
          is_primary,
          supplier:suppliers(name, company)
        )
      `)
      .order("name");

    const mapped: ProductWithSuppliers[] = ((data as unknown[]) ?? []).map(
      (p: unknown) => {
        const prod = p as Product & {
          suppliers: { is_primary: boolean; supplier: { name: string; company: string | null } }[];
        };
        return {
          ...prod,
          suppliers: (prod.suppliers ?? []).map((ps) => ({
            name: ps.supplier.name,
            company: ps.supplier.company,
            is_primary: ps.is_primary,
          })),
        };
      }
    );
    setProducts(mapped);
    setLoading(false);
  }, [insforge]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function resetForm() {
    setFormData({ ...EMPTY_FORM });
    setSelectedSupplierIds([]);
    setPrimarySupplierId("");
    setError(null);
    setEditingId(null);
    setFormMode("create");
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(p: ProductWithSuppliers) {
    setFormData({
      name: p.name,
      sku: p.sku,
      type: p.type,
      unit: p.unit,
      price: p.price ? String(p.price) : "",
      description: p.description ?? "",
    });
    // Pre-load suppliers
    const ids = p.suppliers.map((s, i) => {
      // Need actual supplier IDs — fetched via join. We don't have IDs here.
      // supplier cards only have name/company. We'll clear and let user re-select.
      void i;
      return "";
    }).filter(Boolean);
    setSelectedSupplierIds(ids);
    setPrimarySupplierId("");
    setEditingId(p.id);
    setFormMode("edit");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSupplierChange(ids: string[], primary: string) {
    setSelectedSupplierIds(ids);
    setPrimarySupplierId(primary);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (formData.type === "MATERIA_PRIMA") {
      if (selectedSupplierIds.length === 0) {
        setError("Debes seleccionar al menos un proveedor para materia prima.");
        return;
      }
      if (selectedSupplierIds.length > 1 && !primarySupplierId) {
        setError("Debes seleccionar un proveedor principal.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    if (formMode === "edit" && editingId) {
      // UPDATE
      const { error: updErr } = await insforge.database
        .from("products")
        .update({
          name: formData.name,
          sku: formData.sku,
          type: formData.type,
          unit: formData.unit,
          price: Number(formData.price) || 0,
          description: formData.description || null,
        })
        .eq("id", editingId);

      if (updErr) {
        setError((updErr as Error).message);
        setSaving(false);
        return;
      }

      // Re-link suppliers if MATERIA_PRIMA and user selected some
      if (formData.type === "MATERIA_PRIMA" && selectedSupplierIds.length > 0) {
        const effective =
          selectedSupplierIds.length === 1 ? selectedSupplierIds[0] : primarySupplierId;
        await linkSuppliersToProduct(editingId, selectedSupplierIds, effective);
      }
    } else {
      // INSERT
      const { data: newProduct, error: insertErr } = await insforge.database
        .from("products")
        .insert({
          name: formData.name,
          sku: formData.sku,
          type: formData.type,
          unit: formData.unit,
          price: Number(formData.price) || 0,
          description: formData.description || null,
        })
        .select()
        .single();

      if (insertErr || !newProduct) {
        setError((insertErr as Error | null)?.message ?? "Error al guardar producto");
        setSaving(false);
        return;
      }

      if (formData.type === "MATERIA_PRIMA" && selectedSupplierIds.length > 0) {
        const effective =
          selectedSupplierIds.length === 1 ? selectedSupplierIds[0] : primarySupplierId;
        const { error: linkErr } = await linkSuppliersToProduct(
          (newProduct as Product).id,
          selectedSupplierIds,
          effective
        );
        if (linkErr) {
          setError(`Producto creado pero error al vincular proveedores: ${linkErr}`);
          setSaving(false);
          fetchProducts();
          return;
        }
      }
    }

    resetForm();
    setShowForm(false);
    setSaving(false);
    fetchProducts();
  }

  /** Open delete confirmation — check ledger entries first */
  async function openDeleteConfirm(p: ProductWithSuppliers) {
    setDeletingId(p.id);
    setDeletingProduct(p);
    setDeleteConfirm(true);
    setShowForm(false);
    resetForm();
    setDeleteChecking(true);
    const { count } = await insforge.database
      .from("inventory_ledger")
      .select("id", { count: "exact", head: true })
      .eq("product_id", p.id);
    setDeleteLedgerCount(count ?? 0);
    setDeleteChecking(false);
  }

  function cancelDelete() {
    setDeletingId(null);
    setDeletingProduct(null);
    setDeleteConfirm(false);
    setDeleteLedgerCount(0);
  }

  /** Hard DELETE — only for products with zero ledger entries */
  async function handleHardDelete() {
    if (!deletingId) return;
    setSaving(true);
    setError(null);
    const { error: delErr } = await insforge.database
      .from("products")
      .delete()
      .eq("id", deletingId);
    setSaving(false);
    cancelDelete();
    if (delErr) {
      setError((delErr as Error).message);
    } else {
      fetchProducts();
    }
  }

  /** Soft DELETE — set is_active = false for products with ledger history */
  async function handleDeactivate() {
    if (!deletingId) return;
    setSaving(true);
    setError(null);
    const { error: updErr } = await insforge.database
      .from("products")
      .update({ is_active: false })
      .eq("id", deletingId);
    setSaving(false);
    cancelDelete();
    if (updErr) {
      setError((updErr as Error).message);
    } else {
      fetchProducts();
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Materias primas y productos terminados del catálogo.
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) { setShowForm(false); resetForm(); }
            else openCreate();
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Nuevo Producto"}
        </button>
      </div>

      {/* ─── Global error ─── */}
      {error && !showForm && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ─── Delete confirmation dialog ─── */}
      {deleteConfirm && deletingId && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          {deleteChecking ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              Verificando movimientos de inventario...
            </div>
          ) : deleteLedgerCount > 0 ? (
            // HAS ledger entries — can only deactivate
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No se puede eliminar &ldquo;{deletingProduct?.name}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground">
                  Este producto tiene <strong>{deleteLedgerCount}</strong> movimiento{deleteLedgerCount !== 1 ? "s" : ""} en el libro de inventario.
                  Eliminarlo rompería la trazabilidad contable. Puedes <strong>desactivarlo</strong> para que no aparezca en formularios ni en el catálogo, conservando el historial.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleDeactivate}
                  disabled={saving}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Desactivando..." : "Desactivar producto"}
                </button>
                <button
                  onClick={cancelDelete}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            // ZERO ledger entries — safe to hard delete
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  ¿Eliminar &ldquo;{deletingProduct?.name}&rdquo; permanentemente?
                </p>
                <p className="text-xs text-muted-foreground">
                  Este producto no tiene movimientos de inventario. La eliminación es permanente e irreversible.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleHardDelete}
                  disabled={saving}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button
                  onClick={cancelDelete}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Create / Edit Form ─── */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5"
        >
          <h3 className="text-lg font-semibold">
            {formMode === "edit" ? "Editar Producto" : "Registrar Producto"}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label htmlFor="prod-name" className="text-xs font-medium text-muted-foreground">
                Nombre *
              </label>
              <input
                id="prod-name"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="Leche entera"
              />
            </div>

            {/* SKU */}
            <div className="space-y-1.5">
              <label htmlFor="prod-sku" className="text-xs font-medium text-muted-foreground">
                SKU *
              </label>
              <input
                id="prod-sku"
                required
                value={formData.sku}
                onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="MP-001"
              />
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <label htmlFor="prod-type" className="text-xs font-medium text-muted-foreground">
                Tipo *
              </label>
              <select
                id="prod-type"
                value={formData.type}
                onChange={(e) => {
                  setFormData((p) => ({
                    ...p,
                    type: e.target.value as "MATERIA_PRIMA" | "PRODUCTO_TERMINADO",
                  }));
                  if (e.target.value === "PRODUCTO_TERMINADO") {
                    setSelectedSupplierIds([]);
                    setPrimarySupplierId("");
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <option value="MATERIA_PRIMA">Materia Prima</option>
                <option value="PRODUCTO_TERMINADO">Producto Terminado</option>
              </select>
            </div>

            {/* Unidad */}
            <div className="space-y-1.5">
              <label htmlFor="prod-unit" className="text-xs font-medium text-muted-foreground">
                Unidad *
              </label>
              <select
                id="prod-unit"
                value={formData.unit}
                onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="lt">Litros (lt)</option>
                <option value="unidades">Unidades</option>
                <option value="gr">Gramos (gr)</option>
                <option value="ml">Mililitros (ml)</option>
              </select>
            </div>

            {/* Precio — solo PRODUCTO_TERMINADO */}
            {formData.type === "PRODUCTO_TERMINADO" && (
              <div className="space-y-1.5">
                <label htmlFor="prod-price" className="text-xs font-medium text-muted-foreground">
                  Precio (USD)
                </label>
                <input
                  id="prod-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Descripción */}
            <div className={`space-y-1.5 ${formData.type === "MATERIA_PRIMA" ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-1"}`}>
              <label htmlFor="prod-desc" className="text-xs font-medium text-muted-foreground">
                Descripción
              </label>
              <input
                id="prod-desc"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* ─── Proveedores (solo MATERIA_PRIMA) ─── */}
          {formData.type === "MATERIA_PRIMA" && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              {formMode === "edit" && (
                <p className="text-[10px] text-muted-foreground bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                  Al editar, selecciona nuevamente los proveedores para actualizar la vinculación.
                  Si no seleccionas ninguno, los vínculos actuales se mantienen.
                </p>
              )}
              <SupplierSelect
                selectedIds={selectedSupplierIds}
                primaryId={primarySupplierId}
                onChange={handleSupplierChange}
              />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : formMode === "edit" ? "Actualizar Producto" : "Guardar Producto"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="rounded-lg border border-border bg-background px-6 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* ─── Table ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Unidad</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Proveedores</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Precio</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-25" />
                    No hay productos. Crea el primero con el botón de arriba.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.type === "MATERIA_PRIMA"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        {p.type === "MATERIA_PRIMA" ? "Materia Prima" : "Producto Terminado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.unit}</td>

                    {/* Proveedores */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {p.type === "MATERIA_PRIMA" ? (
                        p.suppliers.length === 0 ? (
                          <span className="text-xs text-destructive/70">Sin proveedor</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.suppliers.map((s, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  s.is_primary
                                    ? "bg-brand-100 text-brand-700"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {s.is_primary && <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />}
                                {s.company ?? s.name}
                              </span>
                            ))}
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums font-medium hidden lg:table-cell">
                      {Number(p.price).toLocaleString("es-EC", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${
                          p.is_active ? "bg-brand-500" : "bg-red-500"
                        }`}
                      />
                    </td>

                    {/* Acciones: Editar (todos staff) + Eliminar (solo admin) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-600 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors whitespace-nowrap"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => openDeleteConfirm(p)}
                            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                          >
                            <Trash2 className="h-3 w-3" /> Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
