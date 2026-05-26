"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { SupplierSelect } from "@features/suppliers/components";
import { useSupplierActions } from "@features/suppliers/hooks";
import { useRole } from "@features/auth/hooks";
import { Tag, AlertTriangle, Pencil, Trash2, Star, ImagePlus, X as XIcon } from "lucide-react";
import Image from "next/image";

type ProductType = "MATERIA_PRIMA" | "INSUMO" | "ENVASE_EMPAQUE" | "PRODUCTO_A_GRANEL" | "PRODUCTO_TERMINADO" | "OTRO";

interface Product {
  id: string;
  name: string;
  sku: string;
  type: ProductType;
  unit: string;
  category_id: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  min_stock_alert: number | null;
  cost_per_unit: number;
  capacity: number | null;
  created_at: string;
}

interface PackagingLink {
  template_id: string;
  template_name: string;
  finished_product_name: string;
  output_product_name: string;
  qty_per_unit: number;
  unit: string;
}

interface ProductWithSuppliers extends Product {
  suppliers: { supplier_id: string; company: string | null; name: string; is_primary: boolean }[];
}

type FormMode = "create" | "edit";

const PRODUCT_TYPE_OPTIONS: { value: ProductType; label: string; color: string }[] = [
  { value: "MATERIA_PRIMA",      label: "Materia Prima",        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "INSUMO",             label: "Insumo / Auxiliar",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "ENVASE_EMPAQUE",     label: "Envase / Empaque",     color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "PRODUCTO_A_GRANEL",  label: "Producto a Granel",    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  { value: "PRODUCTO_TERMINADO", label: "Producto Terminado",   color: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" },
  { value: "OTRO",               label: "Otro",                 color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
];

// Tipos que requieren proveedor y pueden comprarse externamente
const PURCHASABLE_TYPES: ProductType[] = ["MATERIA_PRIMA", "INSUMO", "ENVASE_EMPAQUE", "OTRO"];

const EMPTY_FORM = {
  name: "",
  sku: "",
  type: "MATERIA_PRIMA" as ProductType,
  unit: "kg",
  price: "",
  cost_per_unit: "",
  min_stock_alert: "",
  description: "",
  capacity: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductWithSuppliers[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });

  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [primarySupplierId, setPrimarySupplierId] = useState<string>("");

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductWithSuppliers | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLedgerCount, setDeleteLedgerCount] = useState(0);
  const [deleteChecking, setDeleteChecking] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Packaging links (for ENVASE_EMPAQUE edit)
  const [packagingLinks, setPackagingLinks] = useState<PackagingLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Archived products (loaded on demand)
  const [archivedProducts, setArchivedProducts] = useState<ProductWithSuppliers[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoaded, setArchivedLoaded] = useState(false);

  // Recipe conflict modal
  const [recipeConflicts, setRecipeConflicts] = useState<{ id: string; name: string }[]>([]);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [replacementProductId, setReplacementProductId] = useState("");
  const [conflictSaving, setConflictSaving] = useState(false);

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
          supplier_id,
          is_primary,
          supplier:suppliers(name, company)
        )
      `)
      .eq("is_active", true)
      .order("name");

    const mapped: ProductWithSuppliers[] = ((data as unknown[]) ?? []).map(
      (p: unknown) => {
        const prod = p as Product & {
          suppliers: { supplier_id: string; is_primary: boolean; supplier: { name: string; company: string | null } }[];
        };
        return {
          ...prod,
          capacity: (prod as unknown as { capacity?: number | null }).capacity ?? null,
          suppliers: (prod.suppliers ?? []).map((ps) => ({
            supplier_id: ps.supplier_id,
            name: ps.supplier.name,
            company: ps.supplier.company,
            is_primary: ps.is_primary,
          })),
        };
      }
    );
    setProducts(mapped);
    setLoading(false);
    setArchivedLoaded(false);

    const { count } = await insforge.database
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", false);
    setArchivedCount(count ?? 0);
  }, [insforge]);

  const fetchArchivedProducts = useCallback(async () => {
    setLoadingArchived(true);
    const { data } = await insforge.database
      .from("products")
      .select(`
        *,
        suppliers:product_suppliers(
          supplier_id,
          is_primary,
          supplier:suppliers(name, company)
        )
      `)
      .eq("is_active", false)
      .order("name");

    const mapped: ProductWithSuppliers[] = ((data as unknown[]) ?? []).map(
      (p: unknown) => {
        const prod = p as Product & {
          suppliers: { supplier_id: string; is_primary: boolean; supplier: { name: string; company: string | null } }[];
        };
        return {
          ...prod,
          capacity: (prod as unknown as { capacity?: number | null }).capacity ?? null,
          suppliers: (prod.suppliers ?? []).map((ps) => ({
            supplier_id: ps.supplier_id,
            name: ps.supplier.name,
            company: ps.supplier.company,
            is_primary: ps.is_primary,
          })),
        };
      }
    );
    setArchivedProducts(mapped);
    setArchivedLoaded(true);
    setLoadingArchived(false);
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  async function handleReactivate(id: string) {
    setSaving(true);
    await insforge.database.from("products").update({ is_active: true }).eq("id", id);
    setSaving(false);
    fetchProducts();
    if (archivedLoaded) fetchArchivedProducts();
  }

  async function handleToggleArchived() {
    if (!showArchived) {
      setShowArchived(true);
      if (!archivedLoaded) fetchArchivedProducts();
    } else {
      setShowArchived(false);
    }
  }

  async function fetchPackagingLinks(productId: string) {
    setLoadingLinks(true);
    const { data } = await insforge.database
      .from("packaging_template_materials")
      .select(`
        id,
        quantity_per_unit,
        unit,
        template:packaging_templates(
          id,
          name,
          finished_product:products!finished_product_id(name),
          output_product:products!output_product_id(name)
        )
      `)
      .eq("material_product_id", productId);

    const links: PackagingLink[] = ((data as unknown[]) ?? []).map((row) => {
      const r = row as {
        quantity_per_unit: number;
        unit: string;
        template: {
          id: string;
          name: string;
          finished_product: { name: string };
          output_product: { name: string };
        };
      };
      return {
        template_id: r.template.id,
        template_name: r.template.name,
        finished_product_name: r.template.finished_product.name,
        output_product_name: r.template.output_product.name,
        qty_per_unit: r.quantity_per_unit,
        unit: r.unit,
      };
    });
    setPackagingLinks(links);
    setLoadingLinks(false);
  }

  function resetForm() {
    setFormData({ ...EMPTY_FORM } as typeof EMPTY_FORM);
    setSelectedSupplierIds([]);
    setPrimarySupplierId("");
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setEditingId(null);
    setFormMode("create");
    setPackagingLinks([]);
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
      cost_per_unit: p.cost_per_unit ? String(p.cost_per_unit) : "",
      min_stock_alert: p.min_stock_alert != null ? String(p.min_stock_alert) : "",
      description: p.description ?? "",
      capacity: p.capacity != null ? String(p.capacity) : "",
    });
    if (p.type === "ENVASE_EMPAQUE") {
      fetchPackagingLinks(p.id);
    }
    setImageFile(null);
    setImagePreview(p.image_url);
    const ids = p.suppliers.map((s) => s.supplier_id).filter(Boolean);
    const primaryId = p.suppliers.find((s) => s.is_primary)?.supplier_id ?? (ids[0] ?? "");
    setSelectedSupplierIds(ids);
    setPrimarySupplierId(primaryId);
    setEditingId(p.id);
    setFormMode("edit");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSupplierChange(ids: string[], primary: string) {
    setSelectedSupplierIds(ids);
    setPrimarySupplierId(primary);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const isPurchasable = PURCHASABLE_TYPES.includes(formData.type);
    if (isPurchasable && selectedSupplierIds.length > 1 && !primarySupplierId) {
      setError("Debes seleccionar un proveedor principal.");
      return;
    }

    setSaving(true);
    setError(null);

    // Upload image if selected (admin only)
    let uploadedImageUrl: string | undefined;
    if (isAdmin && imageFile) {
      const ext = imageFile.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await insforge.storage
        .from("product-images")
        .upload(path, imageFile);
      if (upErr) {
        setError("Error al subir imagen: " + (upErr as Error).message);
        setSaving(false);
        return;
      }
      uploadedImageUrl = insforge.storage.from("product-images").getPublicUrl(path);
    }

    if (formMode === "edit" && editingId) {
      const updatePayload: Record<string, unknown> = {
        name: formData.name,
        sku: formData.sku,
        type: formData.type,
        unit: formData.unit,
        price: Number(formData.price) || 0,
        cost_per_unit: Number(formData.cost_per_unit) || 0,
        min_stock_alert: formData.min_stock_alert ? Number(formData.min_stock_alert) : null,
        description: formData.description || null,
        capacity: formData.capacity ? Number(formData.capacity) : null,
      };
      if (uploadedImageUrl !== undefined) {
        updatePayload.image_url = uploadedImageUrl;
      }

      const { error: updErr } = await insforge.database
        .from("products")
        .update(updatePayload)
        .eq("id", editingId);

      if (updErr) {
        setError((updErr as Error).message);
        setSaving(false);
        return;
      }

      const isPurchasableEdit = PURCHASABLE_TYPES.includes(formData.type);
      if (isPurchasableEdit && selectedSupplierIds.length > 0) {
        const effective =
          selectedSupplierIds.length === 1 ? selectedSupplierIds[0] : primarySupplierId;
        await linkSuppliersToProduct(editingId, selectedSupplierIds, effective);
      }
    } else {
      const { data: newProduct, error: insertErr } = await insforge.database
        .from("products")
        .insert({
          name: formData.name,
          sku: formData.sku,
          type: formData.type,
          unit: formData.unit,
          price: Number(formData.price) || 0,
          cost_per_unit: Number(formData.cost_per_unit) || 0,
          min_stock_alert: formData.min_stock_alert ? Number(formData.min_stock_alert) : null,
          description: formData.description || null,
          image_url: uploadedImageUrl ?? null,
          capacity: formData.capacity ? Number(formData.capacity) : null,
        })
        .select()
        .single();

      if (insertErr || !newProduct) {
        setError((insertErr as Error | null)?.message ?? "Error al guardar producto");
        setSaving(false);
        return;
      }

      const isPurchasableCreate = PURCHASABLE_TYPES.includes(formData.type);
      if (isPurchasableCreate && selectedSupplierIds.length > 0) {
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

  /** Soft DELETE — check recipe links first, then deactivate or show conflict modal */
  async function handleDeactivate() {
    if (!deletingId) return;
    setDeleteChecking(true);

    const { data: ingRows } = await insforge.database
      .from("recipe_ingredients")
      .select("recipe_id")
      .eq("product_id", deletingId);

    const recipeIds = [
      ...new Set(((ingRows as { recipe_id: string }[]) ?? []).map((r) => r.recipe_id)),
    ];

    if (recipeIds.length > 0) {
      const { data: recipesData } = await insforge.database
        .from("recipes")
        .select("id, name")
        .in("id", recipeIds);
      setRecipeConflicts((recipesData as { id: string; name: string }[]) ?? []);
      setDeleteChecking(false);
      setShowRecipeModal(true);
      return;
    }

    setDeleteChecking(false);
    await archiveProductRpc(null);
  }

  async function archiveProductRpc(replacementId: string | null) {
    if (!deletingId) return;
    setSaving(true);
    setError(null);
    const { error: rpcErr } = await insforge.database.rpc(
      "archive_product_with_replacement",
      {
        p_product_id_to_archive: deletingId,
        p_replacement_product_id: replacementId ?? null,
      }
    );
    setSaving(false);
    if (rpcErr) {
      setError((rpcErr as Error).message);
      return;
    }
    cancelDelete();
    setShowRecipeModal(false);
    setRecipeConflicts([]);
    setReplacementProductId("");
    fetchProducts();
    if (archivedLoaded) fetchArchivedProducts();
  }

  async function handleReplaceAndDeactivate() {
    if (!replacementProductId) return;
    setConflictSaving(true);
    await archiveProductRpc(replacementProductId);
    setConflictSaving(false);
  }

  async function handleSkipAndDeactivate() {
    await archiveProductRpc(null);
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

      {error && !showForm && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ─── Delete confirmation ─── */}
      {deleteConfirm && deletingId && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          {deleteChecking ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              Verificando movimientos de inventario...
            </div>
          ) : deleteLedgerCount > 0 ? (
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No se puede eliminar &ldquo;{deletingProduct?.name}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground">
                  Este producto tiene <strong>{deleteLedgerCount}</strong> movimiento{deleteLedgerCount !== 1 ? "s" : ""} en el libro de inventario.
                  Eliminarlo rompería la trazabilidad contable. Puedes <strong>desactivarlo</strong> para que no aparezca en formularios ni en el catálogo.
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

      {/* ─── Recipe conflict modal ─── */}
      {showRecipeModal && deletingProduct && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-600/40 p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              &ldquo;{deletingProduct.name}&rdquo; está vinculado a {recipeConflicts.length} receta{recipeConflicts.length !== 1 ? "s" : ""}
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {recipeConflicts.map((r) => (
                <li key={r.id} className="text-[11px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-md px-2 py-0.5 font-medium">
                  {r.name}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-1">
              Las recetas existentes conservan la referencia histórica. Elige cómo proceder:
            </p>
          </div>

          {/* Option A: Replace */}
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">A. Reemplazar en todas las recetas afectadas</p>
            <select
              value={replacementProductId}
              onChange={(e) => setReplacementProductId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Seleccionar materia prima activa...</option>
              {products
                .filter((p) => p.type === "MATERIA_PRIMA" && p.id !== deletingId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
            </select>
            <button
              onClick={handleReplaceAndDeactivate}
              disabled={!replacementProductId || conflictSaving}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {conflictSaving ? "Reemplazando..." : "Reemplazar y archivar"}
            </button>
          </div>

          {/* Option B: Skip */}
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">B. Archivar sin reemplazar</p>
            <p className="text-xs text-muted-foreground">
              Las recetas ya creadas conservan la referencia histórica. El ingrediente no aparecerá al crear nuevas recetas.
            </p>
            <button
              onClick={handleSkipAndDeactivate}
              disabled={conflictSaving}
              className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              Confirmar archivo
            </button>
          </div>

          <button
            onClick={() => { setShowRecipeModal(false); setRecipeConflicts([]); setReplacementProductId(""); }}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ─── Create / Edit Form ─── */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {formMode === "edit" ? "Editar Producto" : "Registrar Producto"}
            </h3>
            {formData.type === "ENVASE_EMPAQUE" && (
              <span className="inline-flex rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
                Envase / Empaque
              </span>
            )}
          </div>

          {/* ─── Tipo selector (siempre visible) ─── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="prod-type" className="text-xs font-medium text-muted-foreground">
                Tipo *
              </label>
              <select
                id="prod-type"
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value as ProductType;
                  setFormData((p) => ({
                    ...p,
                    type: newType,
                    unit: newType === "ENVASE_EMPAQUE" ? "unidades" : p.unit,
                    capacity: "",
                  }));
                  if (!PURCHASABLE_TYPES.includes(newType)) {
                    setSelectedSupplierIds([]);
                    setPrimarySupplierId("");
                  }
                  if (newType !== "ENVASE_EMPAQUE") setPackagingLinks([]);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                {PRODUCT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {formData.type === "PRODUCTO_A_GRANEL" && (
                <p className="text-[10px] text-teal-600 dark:text-teal-400">
                  El producto a granel solo ingresa al inventario mediante producción (o ajuste).
                </p>
              )}
              {formData.type === "PRODUCTO_TERMINADO" && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  El producto terminado solo ingresa al inventario mediante empaque (o ajuste).
                </p>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════
              FORMULARIO ESPECIAL — ENVASE / EMPAQUE
          ════════════════════════════════════════ */}
          {formData.type === "ENVASE_EMPAQUE" ? (
            <div className="space-y-5">
              {/* Info banner */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                Los envases/empaques se consumen durante el proceso de empaque. Define su capacidad para facilitar la gestión de plantillas.
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Nombre */}
                <div className="space-y-1.5">
                  <label htmlFor="env-name" className="text-xs font-medium text-muted-foreground">
                    Nombre del Envase *
                  </label>
                  <input
                    id="env-name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    placeholder="Ej: Tarro 500g, Bolsa 1kg"
                  />
                </div>

                {/* SKU */}
                <div className="space-y-1.5">
                  <label htmlFor="env-sku" className="text-xs font-medium text-muted-foreground">
                    SKU *
                  </label>
                  <input
                    id="env-sku"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    placeholder="ENV-001"
                  />
                </div>

                {/* Capacidad del envase */}
                <div className="space-y-1.5">
                  <label htmlFor="env-capacity" className="text-xs font-medium text-muted-foreground">
                    Capacidad del Envase
                  </label>
                  <input
                    id="env-capacity"
                    type="number"
                    min="0"
                    step="0.001"
                    value={formData.capacity}
                    onChange={(e) => setFormData((p) => ({ ...p, capacity: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    placeholder="500"
                  />
                  <p className="text-[10px] text-muted-foreground">Cantidad que soporta (ej: 500 para 500g)</p>
                </div>

                {/* Unidad de la capacidad */}
                <div className="space-y-1.5">
                  <label htmlFor="env-unit" className="text-xs font-medium text-muted-foreground">
                    Unidad de la Capacidad *
                  </label>
                  <select
                    id="env-unit"
                    value={formData.unit}
                    onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <optgroup label="Masa">
                      <option value="g">Gramos (g)</option>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="lb">Libras (lb)</option>
                      <option value="oz">Onzas (oz)</option>
                    </optgroup>
                    <optgroup label="Volumen">
                      <option value="ml">Mililitros (ml)</option>
                      <option value="lt">Litros (lt)</option>
                    </optgroup>
                    <optgroup label="Unidades">
                      <option value="unidades">Unidades</option>
                      <option value="paquete">Paquete</option>
                      <option value="rollo">Rollo</option>
                    </optgroup>
                  </select>
                </div>

                {/* Costo unitario */}
                <div className="space-y-1.5">
                  <label htmlFor="env-cost" className="text-xs font-medium text-muted-foreground">
                    Costo unitario (USD)
                  </label>
                  <input
                    id="env-cost"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={formData.cost_per_unit}
                    onChange={(e) => setFormData((p) => ({ ...p, cost_per_unit: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">Costo por unidad de envase.</p>
                </div>

                {/* Alerta de stock mínimo */}
                <div className="space-y-1.5">
                  <label htmlFor="env-min-stock" className="text-xs font-medium text-muted-foreground">
                    Alerta stock mínimo
                  </label>
                  <input
                    id="env-min-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData((p) => ({ ...p, min_stock_alert: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    placeholder="Opcional"
                  />
                </div>

                {/* Descripción / notas */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <label htmlFor="env-desc" className="text-xs font-medium text-muted-foreground">
                    Notas / Especificaciones
                  </label>
                  <input
                    id="env-desc"
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    placeholder="Ej: Material PET, tapa rosca, apto alimentario…"
                  />
                </div>
              </div>

              {/* Proveedor */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Proveedor del Envase</p>
                <SupplierSelect
                  selectedIds={selectedSupplierIds}
                  primaryId={primarySupplierId}
                  onChange={handleSupplierChange}
                />
              </div>

              {/* ─── Productos vinculados (solo en edición) ─── */}
              {formMode === "edit" && (
                <div className="rounded-lg border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/10 p-4 space-y-3">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Productos vinculados a este envase
                    {loadingLinks && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
                    )}
                  </p>
                  {!loadingLinks && packagingLinks.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Este envase aún no está asociado a ninguna plantilla de empaque.
                    </p>
                  )}
                  {!loadingLinks && packagingLinks.length > 0 && (
                    <div className="space-y-2">
                      {packagingLinks.map((lk) => (
                        <div
                          key={lk.template_id}
                          className="flex items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-2 text-xs"
                        >
                          <div>
                            <p className="font-medium">{lk.template_name}</p>
                            <p className="text-muted-foreground">
                              {lk.finished_product_name}
                              {lk.output_product_name !== lk.finished_product_name &&
                                ` → ${lk.output_product_name}`}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-semibold">
                            {lk.qty_per_unit} {lk.unit}/unid.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    La vinculación se gestiona desde{" "}
                    <a href="/admin/packaging/templates" className="underline underline-offset-2 text-amber-700 dark:text-amber-400 hover:text-amber-600">
                      Plantillas de Empaque
                    </a>.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ════════════════════════════════════════
               FORMULARIO ESTÁNDAR — otros tipos
            ════════════════════════════════════════ */
            <div className="space-y-4">
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
                    <optgroup label="Masa">
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="g">Gramos (g)</option>
                      <option value="lb">Libras (lb)</option>
                      <option value="oz">Onzas (oz)</option>
                    </optgroup>
                    <optgroup label="Volumen">
                      <option value="lt">Litros (lt)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="gal">Galones (gal)</option>
                    </optgroup>
                    <optgroup label="Unidades">
                      <option value="unidades">Unidades</option>
                      <option value="paquete">Paquete</option>
                      <option value="caja">Caja</option>
                      <option value="rollo">Rollo</option>
                    </optgroup>
                  </select>
                </div>

                {/* Precio — solo PRODUCTO_TERMINADO */}
                {formData.type === "PRODUCTO_TERMINADO" && (
                  <div className="space-y-1.5">
                    <label htmlFor="prod-price" className="text-xs font-medium text-muted-foreground">
                      Precio de venta (USD)
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

                {/* Costo unitario */}
                {formData.type !== "PRODUCTO_TERMINADO" && (
                  <div className="space-y-1.5">
                    <label htmlFor="prod-cost" className="text-xs font-medium text-muted-foreground">
                      Costo unitario (USD)
                    </label>
                    <input
                      id="prod-cost"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={formData.cost_per_unit}
                      onChange={(e) => setFormData((p) => ({ ...p, cost_per_unit: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                      placeholder="0.00"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Se usa para calcular el costo de producción automáticamente.
                    </p>
                  </div>
                )}

                {/* Alerta de stock mínimo */}
                {PURCHASABLE_TYPES.includes(formData.type) && (
                  <div className="space-y-1.5">
                    <label htmlFor="prod-min-stock" className="text-xs font-medium text-muted-foreground">
                      Alerta stock mínimo
                    </label>
                    <input
                      id="prod-min-stock"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.min_stock_alert}
                      onChange={(e) => setFormData((p) => ({ ...p, min_stock_alert: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                      placeholder="Opcional"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Se mostrará una alerta cuando el stock sea igual o inferior a este valor.
                    </p>
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

              {/* Imagen del Producto (solo admin, solo producto terminado) */}
              {isAdmin && formData.type === "PRODUCTO_TERMINADO" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Imagen del Producto
                  </p>
                  <div className="flex items-start gap-4 flex-wrap">
                    {imagePreview ? (
                      <div className="relative h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-border bg-muted">
                        <Image
                          src={imagePreview}
                          alt="Vista previa"
                          fill
                          className="object-cover"
                          unoptimized={imagePreview.startsWith("blob:")}
                        />
                        <button
                          type="button"
                          onClick={clearImage}
                          aria-label="Quitar imagen"
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground">
                        <ImagePlus className="h-7 w-7 opacity-40" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="prod-image"
                        className="cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2"
                      >
                        <ImagePlus className="h-4 w-4 text-muted-foreground" />
                        {imageFile ? "Cambiar imagen" : imagePreview ? "Reemplazar imagen" : "Subir imagen"}
                        <input
                          ref={imageInputRef}
                          id="prod-image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                      {imageFile && (
                        <p className="text-xs text-muted-foreground">
                          {imageFile.name} — {(imageFile.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                      {!imageFile && !imagePreview && (
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG o WebP. Recomendado: 500×500 px.
                        </p>
                      )}
                      {formMode === "edit" && !imageFile && imagePreview && (
                        <p className="text-xs text-muted-foreground">
                          Imagen actual. Sube una nueva para reemplazarla.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Proveedores (tipos comprables) */}
              {PURCHASABLE_TYPES.includes(formData.type) && (
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <SupplierSelect
                    selectedIds={selectedSupplierIds}
                    primaryId={primarySupplierId}
                    onChange={handleSupplierChange}
                  />
                </div>
              )}
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

      {/* ─── Archived toggle ─── */}
      {archivedCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleToggleArchived}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            {showArchived ? "Ocultar archivados" : `Mostrar archivados (${archivedCount})`}
          </button>
        </div>
      )}


      {/* ─── Tables ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {PRODUCT_TYPE_OPTIONS.map(({ value: typeValue, label: typeLabel, color: typeColor }) => {
            const typeProducts = products.filter((p) => p.type === typeValue);
            const typeArchived = archivedProducts.filter((p) => p.type === typeValue);
            const isPurchasable = PURCHASABLE_TYPES.includes(typeValue);
            return (
              <div key={typeValue} className="space-y-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeColor}`}>
                    {typeLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">({typeProducts.length})</span>
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground">SKU</th>
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground">Nombre</th>
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden sm:table-cell">Unidad</th>
                        {typeValue === "ENVASE_EMPAQUE" && <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden sm:table-cell">Capacidad</th>}
                        {isPurchasable && <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden md:table-cell">Proveedores</th>}
                        {typeValue === "PRODUCTO_TERMINADO" && <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden lg:table-cell">Precio</th>}
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeProducts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            <Tag className="h-6 w-6 mx-auto mb-1 opacity-25" />
                            No hay {typeLabel.toLowerCase()} registrados.
                          </td>
                        </tr>
                      ) : (
                        typeProducts.map((p) => (
                          <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">{p.sku}</td>
                            <td className="px-4 py-3 text-center font-medium">{p.name}</td>
                            <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell">{p.unit}</td>
                            {typeValue === "ENVASE_EMPAQUE" && (
                              <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell">
                                {p.capacity != null
                                  ? `${p.capacity} ${p.unit}`
                                  : <span className="text-muted-foreground/50">—</span>}
                              </td>
                            )}
                            {isPurchasable && (
                              <td className="px-4 py-3 text-center hidden md:table-cell">
                                {p.suppliers.length === 0 ? (
                                  <span className="text-xs text-muted-foreground/60">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {p.suppliers.map((s, i) => (
                                      <span key={i} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${s.is_primary ? 'bg-brand-100 text-brand-700' : 'bg-muted text-muted-foreground'}`}>
                                        {s.is_primary && <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />}
                                        {s.company ?? s.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            )}
                            {typeValue === "PRODUCTO_TERMINADO" && (
                              <td className="px-4 py-3 text-center tabular-nums font-medium hidden lg:table-cell">
                                {Number(p.price).toLocaleString('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                              </td>
                            )}
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex h-2 w-2 rounded-full ${p.is_active ? 'bg-brand-500' : 'bg-red-500'}`} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1 rounded-md bg-zinc-600 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors whitespace-nowrap">
                                  <Pencil className="h-3 w-3" /> Editar
                                </button>
                                {isAdmin && (
                                  <button onClick={() => openDeleteConfirm(p)} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors whitespace-nowrap">
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
                {showArchived && !loadingArchived && typeArchived.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-muted/20 shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-amber-50/60 dark:bg-amber-900/10">
                          <th className="px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">SKU</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">Nombre</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">Estado</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typeArchived.map((p) => (
                          <tr key={p.id} className="border-b border-border/30 last:border-0 opacity-60">
                            <td className="px-4 py-2.5 text-center font-mono text-xs text-muted-foreground">{p.sku}</td>
                            <td className="px-4 py-2.5 text-center text-sm font-medium">{p.name}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Archivado</span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button onClick={() => handleReactivate(p.id)} disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-2 py-1 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-50 transition-colors">
                                Reactivar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}