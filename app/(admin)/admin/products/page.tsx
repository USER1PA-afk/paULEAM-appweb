"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { SupplierSelect } from "@features/suppliers/components";
import { useSupplierActions } from "@features/suppliers/hooks";
import { useRole } from "@features/auth/hooks";
import { Tag, AlertTriangle, Pencil, Trash2, Star, ImagePlus, X as XIcon } from "lucide-react";
import { TablePagination } from "@shared/components/ui/table-pagination";
import Image from "next/image";

type ProductType = "MATERIA_PRIMA" | "INSUMO" | "ENVASE_EMPAQUE" | "PRODUCTO_A_GRANEL" | "PRODUCTO_TERMINADO" | "MATERIAL_SECUNDARIO";

interface Product {
  id: string;
  name: string;
  sku: string;
  type: ProductType;
  unit: string;
  capacity_unit: string | null;
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
  { value: "MATERIA_PRIMA",        label: "Materia Prima",              color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "INSUMO",               label: "Insumo / Auxiliar",          color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "ENVASE_EMPAQUE",       label: "Envase / Empaque",           color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "PRODUCTO_A_GRANEL",    label: "Producto a Granel",          color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  { value: "PRODUCTO_TERMINADO",   label: "Producto Terminado",         color: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" },
  { value: "MATERIAL_SECUNDARIO",  label: "Material Secundario / Otro", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
];

// Tipos que requieren proveedor y pueden comprarse externamente
const PURCHASABLE_TYPES: ProductType[] = ["MATERIA_PRIMA", "INSUMO", "ENVASE_EMPAQUE", "MATERIAL_SECUNDARIO"];

// Tipos cuyo costo se auto-calcula (no editable manualmente)
const AUTO_COST_TYPES: ProductType[] = ["PRODUCTO_A_GRANEL", "PRODUCTO_TERMINADO"];

// Tipos que NO admiten capacidad de envase
const NO_CAPACITY_TYPES: ProductType[] = ["MATERIA_PRIMA", "INSUMO", "PRODUCTO_A_GRANEL", "PRODUCTO_TERMINADO", "MATERIAL_SECUNDARIO"];

const EMPTY_FORM = {
  name: "",
  sku: "",
  type: "MATERIA_PRIMA" as ProductType,
  unit: "kg",
  capacity_unit: "",
  price: "",
  cost_per_unit: "",
  min_stock_alert: "",
  description: "",
  capacity: "",
};

/** Shows 2 decimals when that's lossless (e.g. 1.50 → $1.50), otherwise 4 (e.g. 0.015 → $0.0150). */
function formatCost(value: number): string {
  const s2 = value.toFixed(2);
  const s4 = value.toFixed(4);
  return `$${parseFloat(s2) === parseFloat(s4) ? s2 : s4}`;
}

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
  const [showForceConfirm, setShowForceConfirm] = useState(false);
  const [forceConfirmText, setForceConfirmText] = useState("");

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

  const [productPages, setProductPages] = useState<Partial<Record<ProductType, number>>>({});
  const insforge = getInsforge();
  const { linkSuppliersToProduct } = useSupplierActions();
  const { role } = useRole();
  const isAdmin = role === "admin";
  const PROD_PAGE_SIZE = 5;

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
      capacity_unit: p.capacity_unit ?? "",
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
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
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
    if (isPurchasable && selectedSupplierIds.length === 0) {
      setError("Debes seleccionar al menos un proveedor para este tipo de producto.");
      return;
    }
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

    const isAutoCost = AUTO_COST_TYPES.includes(formData.type);
    const hasCapacity = formData.type === "ENVASE_EMPAQUE";

    if (formMode === "edit" && editingId) {
      const updatePayload: Record<string, unknown> = {
        name: formData.name,
        sku: formData.sku,
        type: formData.type,
        // ENVASE_EMPAQUE: inventory unit is always "unidades"; capacity unit is separate
        unit: hasCapacity ? "unidades" : formData.unit,
        capacity_unit: hasCapacity ? (formData.capacity_unit || null) : null,
        price: Number(formData.price) || 0,
        // Auto-cost types: omit cost_per_unit from UPDATE — DB trigger owns it
        ...(!isAutoCost && { cost_per_unit: Number(formData.cost_per_unit) || 0 }),
        min_stock_alert: formData.min_stock_alert !== "" ? Number(formData.min_stock_alert) : 0,
        description: formData.description || null,
        capacity: hasCapacity && formData.capacity ? Number(formData.capacity) : null,
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
          unit: hasCapacity ? "unidades" : formData.unit,
          capacity_unit: hasCapacity ? (formData.capacity_unit || null) : null,
          price: Number(formData.price) || 0,
          cost_per_unit: isAutoCost ? 0 : (Number(formData.cost_per_unit) || 0),
          min_stock_alert: formData.min_stock_alert !== "" ? Number(formData.min_stock_alert) : 0,
          description: formData.description || null,
          image_url: uploadedImageUrl ?? null,
          capacity: hasCapacity && formData.capacity ? Number(formData.capacity) : null,
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
    setShowForceConfirm(false);
    setForceConfirmText("");
  }

  async function handlePurge() {
    if (!deletingId || forceConfirmText !== deletingProduct?.name) return;
    setSaving(true);
    setError(null);
    const { error: rpcErr } = await insforge.database.rpc("purge_product", {
      p_product_id: deletingId,
    });
    setSaving(false);
    if (rpcErr) {
      setError((rpcErr as Error).message);
      return;
    }
    cancelDelete();
    fetchProducts();
    if (archivedLoaded) fetchArchivedProducts();
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Productos</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {products.length} activos
              {archivedCount > 0 && ` · ${archivedCount} archivados`}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (showForm) { setShowForm(false); resetForm(); }
            else openCreate();
          }}
          className={showForm ? "btn-outline" : "btn-primary"}
        >
          {showForm ? "Cancelar" : "+ Nuevo Producto"}
        </button>
      </div>

      {/* ─── Tipos de productos ─── */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { value: "MATERIA_PRIMA",       color: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-400",      title: "Materia Prima",              desc: "Ingredientes crudos que entran al proceso de producción. Ej: leche, harina, ajonjolí." },
          { value: "INSUMO",              color: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800/40 dark:text-purple-400", title: "Insumo / Auxiliar",          desc: "Materiales auxiliares del proceso. Ej: cuajo, sal, cloruro de calcio." },
          { value: "ENVASE_EMPAQUE",      color: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-400",   title: "Envase / Empaque",           desc: "Contenedores con capacidad definida. Ej: tarros, fundas de vacío, botellas." },
          { value: "PRODUCTO_A_GRANEL",   color: "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800/40 dark:text-teal-400",        title: "Producto a Granel",          desc: "Resultado intermedio de producción. Ej: queso fresco sin envasar." },
          { value: "PRODUCTO_TERMINADO",  color: "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/20 dark:border-brand-800/40 dark:text-brand-400",  title: "Producto Terminado",         desc: "Listo para la venta. Entra al inventario mediante empaque o ajuste." },
          { value: "MATERIAL_SECUNDARIO", color: "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-900/20 dark:border-zinc-700/40 dark:text-zinc-400",        title: "Material Secundario / Otro", desc: "Etiquetas, cajas, materiales de apoyo. Se controlan por unidades o piezas." },
        ].map(({ value, color, title, desc }) => {
          const count = products.filter((p) => p.type === value).length;
          return (
            <div key={value} className={`rounded-lg border px-3 py-2.5 ${color}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-black">{title}</p>
                <span className="text-xs font-black tabular-nums">{count}</span>
              </div>
              <p className="text-[11px] leading-snug opacity-80">{desc}</p>
            </div>
          );
        })}
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
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Desactivando..." : "Desactivar producto"}
                </button>
                <button
                  onClick={cancelDelete}
                  className="btn-outline"
                >
                  Cancelar
                </button>
              </div>

              {isAdmin && !showForceConfirm && (
                <button
                  onClick={() => setShowForceConfirm(true)}
                  className="text-xs text-destructive underline underline-offset-2 hover:no-underline"
                >
                  Forzar eliminación permanente (purgar historial)
                </button>
              )}

              {isAdmin && showForceConfirm && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-destructive">
                    Eliminará el producto y todos sus movimientos de inventario, recetas, órdenes y referencias. Irreversible.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Escribe <strong className="text-foreground">{deletingProduct?.name}</strong> para confirmar:
                  </p>
                  <input
                    value={forceConfirmText}
                    onChange={(e) => setForceConfirmText(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={deletingProduct?.name ?? ""}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handlePurge}
                      disabled={forceConfirmText !== deletingProduct?.name || saving}
                      className="btn-danger disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving ? "Eliminando..." : "Eliminar permanentemente"}
                    </button>
                    <button
                      onClick={() => { setShowForceConfirm(false); setForceConfirmText(""); }}
                      className="btn-outline"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
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
                  className="btn-danger"
                >
                  {saving ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button
                  onClick={cancelDelete}
                  className="btn-outline"
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
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="btn-secondary"
            >
              Confirmar archivo
            </button>
          </div>

          <button
            onClick={() => { setShowRecipeModal(false); setRecipeConflicts([]); setReplacementProductId(""); }}
            className="btn-outline"
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
          <div className="grid gap-4">
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
                    // unit = stock/inventory unit; always "unidades" for ENVASE_EMPAQUE
                    unit: newType === "ENVASE_EMPAQUE" ? "unidades" : (p.type === "ENVASE_EMPAQUE" ? "kg" : p.unit),
                    // capacity_unit = physical content unit (g/kg/ml/lb); only for ENVASE_EMPAQUE
                    capacity_unit: newType === "ENVASE_EMPAQUE" ? "g" : "",
                    capacity: "",
                    cost_per_unit: (newType === "PRODUCTO_A_GRANEL" || newType === "PRODUCTO_TERMINADO") ? "0" : p.cost_per_unit,
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
                  Solo ingresa al inventario mediante producción (o ajuste). Costo calculado automáticamente.
                </p>
              )}
              {formData.type === "PRODUCTO_TERMINADO" && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Solo ingresa al inventario mediante empaque (o ajuste). Costo calculado automáticamente.
                </p>
              )}
              {formData.type === "MATERIAL_SECUNDARIO" && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Etiquetas, cajas, suministros y materiales de apoyo. Se controlan por unidades o piezas sueltas.
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

              {/* Stock unit locked notice */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Unidad de inventario:</span>
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
                  Unidades (no editable)
                </span>
                <span className="text-[10px] text-muted-foreground">— el stock se gestiona en piezas</span>
              </div>

              <div className="grid gap-4">
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

                {/* Capacidad del envase — obligatoria */}
                <div className="space-y-1.5">
                  <label htmlFor="env-capacity" className="text-xs font-medium text-muted-foreground">
                    Capacidad del Envase *
                  </label>
                  <input
                    id="env-capacity"
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData((p) => ({ ...p, capacity: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    placeholder="500"
                  />
                  <p className="text-[10px] text-muted-foreground">Cantidad que contiene (ej: 500 para un tarro de 500 g)</p>
                </div>

                {/* Unidad de la capacidad — obligatoria, distinta de la unidad de inventario */}
                <div className="space-y-1.5">
                  <label htmlFor="env-capacity-unit" className="text-xs font-medium text-muted-foreground">
                    Unidad de la Capacidad *
                  </label>
                  <select
                    id="env-capacity-unit"
                    required
                    value={formData.capacity_unit}
                    onChange={(e) => setFormData((p) => ({ ...p, capacity_unit: e.target.value }))}
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
                  </select>
                  <p className="text-[10px] text-muted-foreground">Unidad del contenido — independiente de la unidad de inventario (unidades)</p>
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
                <div className="space-y-1.5">
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
              <div className="grid gap-4">
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
                <div className="space-y-1.5">
                  <label htmlFor="prod-cost" className="text-xs font-medium text-muted-foreground">
                    Costo unitario (USD)
                    {AUTO_COST_TYPES.includes(formData.type) && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2 py-0 text-[10px] font-semibold">
                        Auto-calculado
                      </span>
                    )}
                  </label>
                  <input
                    id="prod-cost"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={AUTO_COST_TYPES.includes(formData.type) ? (formData.cost_per_unit || "0") : formData.cost_per_unit}
                    onChange={(e) => {
                      if (!AUTO_COST_TYPES.includes(formData.type))
                        setFormData((p) => ({ ...p, cost_per_unit: e.target.value }));
                    }}
                    disabled={AUTO_COST_TYPES.includes(formData.type)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {AUTO_COST_TYPES.includes(formData.type)
                      ? formData.type === "PRODUCTO_A_GRANEL"
                        ? "Se calcula automáticamente al completar la orden de producción."
                        : "Se calcula automáticamente al completar la orden de empaque."
                      : "Se usa para calcular el costo de producción automáticamente."}
                  </p>
                </div>

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
                <div className="space-y-1.5">
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
              className="btn-primary px-6"
            >
              {saving ? "Guardando..." : formMode === "edit" ? "Actualizar Producto" : "Guardar Producto"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="btn-outline px-6"
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
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, gi) => (
            <div key={gi} className="space-y-3">
              <div className="skeleton h-5 w-36 rounded-full" />
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {Array.from({ length: 5 }).map((_, ci) => (
                        <th key={ci} className="px-4 py-3">
                          <div className="skeleton h-3 w-16 mx-auto" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 4 }).map((_, ri) => (
                      <tr key={ri} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3"><div className="skeleton h-3.5 w-20 mx-auto" /></td>
                        <td className="px-4 py-3"><div className="skeleton h-3.5 w-32 mx-auto" /></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><div className="skeleton h-3.5 w-12 mx-auto" /></td>
                        <td className="px-4 py-3"><div className="skeleton h-4 w-10 mx-auto rounded-full" /></td>
                        <td className="px-4 py-3"><div className="skeleton h-7 w-16 mx-auto rounded-md" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {PRODUCT_TYPE_OPTIONS.map(({ value: typeValue, label: typeLabel, color: typeColor }) => {
            const typeProducts = products.filter((p) => p.type === typeValue);
            const typeArchived = archivedProducts.filter((p) => p.type === typeValue);
            const isPurchasable = PURCHASABLE_TYPES.includes(typeValue);
            const typeTotalPages = Math.max(1, Math.ceil(typeProducts.length / PROD_PAGE_SIZE));
            const typePage = Math.min(Math.max(1, productPages[typeValue] ?? 1), typeTotalPages);
            const pagedTypeProducts = typeProducts.slice((typePage - 1) * PROD_PAGE_SIZE, typePage * PROD_PAGE_SIZE);
            const typeFrom = typeProducts.length === 0 ? 0 : (typePage - 1) * PROD_PAGE_SIZE + 1;
            const typeTo = Math.min(typePage * PROD_PAGE_SIZE, typeProducts.length);
            return (
              <div key={typeValue} className="space-y-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeColor}`}>
                    {typeLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">({typeProducts.length})</span>
                </h2>
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium text-muted-foreground w-28">SKU</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground w-32">Unidad</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground w-32 text-right">Costo/u</th>
                        {typeValue === "PRODUCTO_TERMINADO" && (
                          <>
                            <th className="px-4 py-3 font-medium text-muted-foreground w-32 text-right">Precio venta</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground w-28 text-right">Margen bruto</th>
                          </>
                        )}
                        <th className="px-4 py-3 font-medium text-muted-foreground w-28 text-center">Estado</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground w-44 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeProducts.length === 0 ? (
                        <tr>
                          <td colSpan={typeValue === "PRODUCTO_TERMINADO" ? 8 : 6} className="px-4 py-8 text-center text-muted-foreground">
                            <Tag className="h-6 w-6 mx-auto mb-1 opacity-25" />
                            No hay {typeLabel.toLowerCase()} registrados.
                          </td>
                        </tr>
                      ) : (
                        pagedTypeProducts.map((p) => {
                          const price  = Number(p.price);
                          const cost   = Number(p.cost_per_unit);
                          const margin = typeValue === "PRODUCTO_TERMINADO" && price > 0
                            ? ((price - cost) / price) * 100
                            : null;
                          const marginLow = margin !== null && margin < 30;
                          return (
                            <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-foreground">{p.name}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {typeValue === "ENVASE_EMPAQUE" && p.capacity != null && (
                                    <span className="text-[10px] text-muted-foreground">Cap: {p.capacity} {p.capacity_unit ?? p.unit}</span>
                                  )}
                                  {isPurchasable && p.suppliers.length > 0 && p.suppliers.map((s, i) => (
                                    <span key={i} className={`inline-flex items-center rounded-full px-2 py-0 text-[10px] font-medium ${s.is_primary ? 'bg-brand-100 text-brand-700' : 'bg-muted text-muted-foreground'}`}>
                                      {s.is_primary && <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />}
                                      {s.company ?? s.name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{p.unit}</td>
                              {/* Costo/u — always */}
                              <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-foreground">
                                {cost > 0
                                  ? formatCost(cost)
                                  : <span className="text-muted-foreground/40">—</span>}
                              </td>
                              {/* Precio venta + Margen — PRODUCTO_TERMINADO only */}
                              {typeValue === "PRODUCTO_TERMINADO" && (
                                <>
                                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-foreground">
                                    {price > 0
                                      ? price.toLocaleString('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
                                      : <span className="text-muted-foreground/40">—</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                                    {margin === null
                                      ? <span className="text-muted-foreground/40">—</span>
                                      : <span className={marginLow ? "font-semibold text-orange-600 dark:text-orange-400" : "text-foreground"}>
                                          {margin.toFixed(1)}%
                                        </span>}
                                  </td>
                                </>
                              )}
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${p.is_active ? 'bg-accent-500' : 'bg-red-500'}`} />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1 rounded-md bg-zinc-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors">
                                    <Pencil className="h-3 w-3" /> Editar
                                  </button>
                                  {isAdmin && (
                                    <button onClick={() => openDeleteConfirm(p)} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors">
                                      <Trash2 className="h-3 w-3" /> Eliminar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  <TablePagination
                    page={typePage}
                    totalPages={typeTotalPages}
                    from={typeFrom}
                    to={typeTo}
                    total={typeProducts.length}
                    onPageChange={(p) => setProductPages((prev) => ({ ...prev, [typeValue]: p }))}
                  />
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