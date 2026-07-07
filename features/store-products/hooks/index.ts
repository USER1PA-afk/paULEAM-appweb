"use client";
import { useState, useEffect, useCallback } from "react";
import { getInsforge } from "@shared/lib/insforge/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreProduct {
  id: string;
  name: string;
  sku: string;
  type: "MATERIA_PRIMA" | "PRODUCTO_TERMINADO";
  unit: string;
  category_id: string | null;
  description: string | null;
  short_description: string | null;
  long_description: string | null;
  specifications: Record<string, string>;
  ingredients: string | null;
  nutritional_info: Record<string, string>;
  weight: number | null;
  commercial_details: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  featured: boolean;
  capacity_unit?: string | null;
  show_in_pos?: boolean;
  conversion_factor?: number;
  sales_unit_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreProductWithStock extends StoreProduct {
  stock: number;
  category_name: string | null;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  position: number;
  is_primary: boolean;
  created_at: string;
  public_url: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface SalesStats {
  totalOrders: number;
  totalUnits: number;
  totalRevenue: number;
}

export interface StoreProductsFilters {
  search?: string;
  categoryId?: string;
  status?: "all" | "active" | "inactive" | "featured";
  sortBy?: "name" | "price" | "created_at";
  sortDir?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

// ─── useCategories ────────────────────────────────────────────────────────────

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getInsforge();
    db.database
      .from("categories")
      .select("id, name")
      .order("name")
      .then(
        ({ data }) => { setCategories((data as Category[]) ?? []); setLoading(false); },
        () => setLoading(false)
      );
  }, []);

  return { categories, loading };
}

// ─── useStoreProducts ─────────────────────────────────────────────────────────

export function useStoreProducts(filters: StoreProductsFilters = {}) {
  const {
    search = "",
    categoryId = "",
    status = "all",
    sortBy = "name",
    sortDir = "asc",
    page = 1,
    perPage = 15,
  } = filters;

  const [products, setProducts] = useState<StoreProductWithStock[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const db = getInsforge();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.database
      .from("products")
      .select("*")
      .eq("type", "PRODUCTO_TERMINADO");

    if (categoryId) q = q.eq("category_id", categoryId);
    if (status === "active")   q = q.eq("is_active", true).eq("featured", false);
    if (status === "inactive") q = q.eq("is_active", false);
    if (status === "featured") q = q.eq("featured", true);
    q = q.order(sortBy, { ascending: sortDir === "asc" });

    const { data } = await q;
    let prods = (data as StoreProduct[]) ?? [];

    // Client-side search by name + SKU
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      prods = prods.filter(
        (p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)
      );
    }

    setTotal(prods.length);
    const paginated = prods.slice((page - 1) * perPage, page * perPage);

    // Batch-fetch stock for visible products
    if (paginated.length > 0) {
      const ids = paginated.map((p) => p.id);
      const { data: stockRows } = await db.database
        .from("stock_summary")
        .select("product_id, stock_actual")
        .in("product_id", ids);

      const stockMap: Record<string, number> = {};
      ((stockRows as { product_id: string; stock_actual: number }[]) ?? []).forEach(
        (s) => { stockMap[s.product_id] = Number(s.stock_actual); }
      );

      // Fetch category names for this batch
      const catIds = [...new Set(paginated.map((p) => p.category_id).filter(Boolean))] as string[];
      const catMap: Record<string, string> = {};
      if (catIds.length > 0) {
        const { data: catRows } = await db.database
          .from("categories")
          .select("id, name")
          .in("id", catIds);
        ((catRows as { id: string; name: string }[]) ?? []).forEach(
          (c) => { catMap[c.id] = c.name; }
        );
      }

      setProducts(
        paginated.map((p) => ({
          ...p,
          stock: stockMap[p.id] ?? 0,
          category_name: p.category_id ? (catMap[p.category_id] ?? null) : null,
        }))
      );
    } else {
      setProducts([]);
    }

    setLoading(false);
  }, [search, categoryId, status, sortBy, sortDir, page, perPage]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return {
    products,
    total,
    pages: Math.ceil(total / perPage),
    loading,
    refetch: fetchProducts,
  };
}

// ─── useStoreProductDetail ────────────────────────────────────────────────────

export function useStoreProductDetail(id: string | null) {
  const [product, setProduct]       = useState<StoreProduct | null>(null);
  const [images, setImages]         = useState<ProductImage[]>([]);
  const [stock, setStock]           = useState(0);
  const [salesStats, setSalesStats] = useState<SalesStats>({ totalOrders: 0, totalUnits: 0, totalRevenue: 0 });
  const [loading, setLoading]       = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    const db = getInsforge();

    const { data: prod } = await db.database
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (!prod) { setLoading(false); return; }
    setProduct(prod as StoreProduct);

    // Images
    const { data: imgs } = await db.database
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("position");
    setImages(
      ((imgs as ProductImage[]) ?? []).map((img) => ({
        ...img,
        public_url: db.storage.from("product-images").getPublicUrl(img.storage_path),
      }))
    );

    // Stock
    const { data: stockRow } = await db.database
      .from("stock_summary")
      .select("stock_actual")
      .eq("product_id", id)
      .single();
    setStock(Number((stockRow as { stock_actual: number } | null)?.stock_actual ?? 0));

    // Sales stats from approved/completed orders
    const { data: salesRows } = await db.database
      .from("order_items")
      .select("quantity, subtotal, order:orders(status)")
      .eq("product_id", id);

    type SaleRow = { quantity: number; subtotal: number; order: { status: string } };
    const approved = ((salesRows as unknown as SaleRow[]) ?? []).filter((r) =>
      ["APROBADO", "COMPLETADO", "ENVIADO"].includes(r.order?.status ?? "")
    );

    setSalesStats({
      totalOrders:  approved.length,
      totalUnits:   approved.reduce((s, r) => s + Number(r.quantity), 0),
      totalRevenue: approved.reduce((s, r) => s + Number(r.subtotal), 0),
    });

    setLoading(false);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  return { product, images, stock, salesStats, loading, refetch: fetchDetail };
}

// ─── useStoreProductMutations ─────────────────────────────────────────────────

export function useStoreProductMutations() {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function createProduct(data: Partial<StoreProduct>): Promise<string | null> {
    setSaving(true); setError(null);
    const db = getInsforge();
    const { data: result, error: err } = await db.database
      .from("products")
      .insert({ ...data, type: "PRODUCTO_TERMINADO" })
      .select("id")
      .single();
    setSaving(false);
    if (err) { setError((err as Error).message); return null; }
    return (result as { id: string }).id;
  }

  async function updateProduct(id: string, data: Partial<StoreProduct>): Promise<boolean> {
    setSaving(true); setError(null);
    const db = getInsforge();
    const { error: err } = await db.database
      .from("products")
      .update(data)
      .eq("id", id);
    setSaving(false);
    if (err) { setError((err as Error).message); return false; }
    return true;
  }

  async function toggleActive(id: string, current: boolean): Promise<boolean> {
    const db = getInsforge();
    const { error: err } = await db.database
      .from("products")
      .update({ is_active: !current })
      .eq("id", id);
    if (err) { setError((err as Error).message); return false; }
    return true;
  }

  async function toggleFeatured(id: string, current: boolean): Promise<boolean> {
    const db = getInsforge();
    const { error: err } = await db.database
      .from("products")
      .update({ featured: !current })
      .eq("id", id);
    if (err) { setError((err as Error).message); return false; }
    return true;
  }

  async function softDelete(id: string): Promise<boolean> {
    const db = getInsforge();
    const { error: err } = await db.database
      .from("products")
      .update({ is_active: false })
      .eq("id", id);
    if (err) { setError((err as Error).message); return false; }
    return true;
  }

  async function togglePosVisibility(id: string, current: boolean): Promise<boolean> {
    const db = getInsforge();
    const { error: err } = await db.database
      .from("products")
      .update({ show_in_pos: !current })
      .eq("id", id);
    if (err) { setError((err as Error).message); return false; }
    return true;
  }

  return { createProduct, updateProduct, toggleActive, toggleFeatured, togglePosVisibility, softDelete, saving, error, setError };
}

// ─── useProductImages ─────────────────────────────────────────────────────────

export function useProductImages(productId: string | null) {
  const [images,      setImages]      = useState<ProductImage[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    if (!productId) { setImages([]); return; }
    setLoading(true);
    const db = getInsforge();
    const { data } = await db.database
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("position");
    setImages(
      ((data as ProductImage[]) ?? []).map((img) => ({
        ...img,
        public_url: db.storage.from("product-images").getPublicUrl(img.storage_path),
      }))
    );
    setLoading(false);
  }, [productId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchImages(); }, [fetchImages]);

  async function uploadImage(file: File, forceFirst = false): Promise<boolean> {
    if (!productId) return false;
    setUploadError(null);

    // Validación de tipo/tamaño en cliente antes de tocar el servidor
    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.type && !ALLOWED_MIME.includes(file.type)) {
      setUploadError("Formato no permitido. Usa JPG, PNG, WEBP, GIF o AVIF.");
      return false;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("La imagen supera el límite de 10 MB.");
      return false;
    }

    setUploading(true);
    try {
      const db = getInsforge();

      // Upload via server proxy to avoid presigned URL CORS/auth issues
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", productId);

      const uploadRes = await fetch("/api/storage/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include", // send httpOnly cookies
      });

      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({ error: uploadRes.statusText }));
        const msg = body?.error ?? `Error ${uploadRes.status}`;
        console.warn("[useProductImages] server upload failed:", msg);
        setUploadError(`No se pudo subir la imagen: ${msg}`);
        return false;
      }

      const { path, publicUrl } = await uploadRes.json();

      const isFirst    = images.length === 0 || forceFirst;
      const maxPos     = images.length > 0 ? Math.max(...images.map((i) => i.position)) + 1 : 0;

      if (isFirst) {
        await db.database.from("product_images").update({ is_primary: false }).eq("product_id", productId);
        await db.database.from("products").update({ image_url: publicUrl }).eq("id", productId);
      }

      const { error: insErr } = await db.database.from("product_images").insert({
        product_id:   productId,
        storage_path: path,
        position:     maxPos,
        is_primary:   isFirst,
        alt_text:     file.name.split(".")[0] ?? null,
      });
      if (insErr) {
        const msg = (insErr as { message?: string })?.message ?? String(insErr);
        console.warn("[useProductImages] insert row failed:", insErr);
        // Orphaned file in storage — try to clean up
        await db.storage.from("product-images").remove(path).then(() => {}, () => {});
        setUploadError(`No se pudo registrar la imagen: ${msg}`);
        return false;
      }

      await fetchImages();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[useProductImages] upload exception:", err);
      setUploadError(`Error al subir la imagen: ${msg}`);
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function deleteImage(img: ProductImage): Promise<void> {
    const db = getInsforge();
    await db.storage.from("product-images").remove(img.storage_path);
    await db.database.from("product_images").delete().eq("id", img.id);

    if (img.is_primary && productId) {
      const remaining = images.filter((i) => i.id !== img.id);
      if (remaining.length > 0) {
        await db.database.from("product_images").update({ is_primary: true }).eq("id", remaining[0].id);
        await db.database.from("products").update({ image_url: remaining[0].public_url }).eq("id", productId);
      } else {
        await db.database.from("products").update({ image_url: null }).eq("id", productId);
      }
    }
    await fetchImages();
  }

  async function setPrimary(img: ProductImage): Promise<void> {
    if (!productId) return;
    const db = getInsforge();
    await db.database.from("product_images").update({ is_primary: false }).eq("product_id", productId);
    await db.database.from("product_images").update({ is_primary: true }).eq("id", img.id);
    await db.database.from("products").update({ image_url: img.public_url }).eq("id", productId);
    await fetchImages();
  }

  async function reorderImages(newOrder: ProductImage[]): Promise<void> {
    setImages(newOrder);
    const db = getInsforge();
    await Promise.all(
      newOrder.map((img, i) =>
        db.database.from("product_images").update({ position: i }).eq("id", img.id)
      )
    );
  }

  return { images, loading, uploading, uploadError, clearUploadError: () => setUploadError(null), uploadImage, deleteImage, setPrimary, reorderImages, refetch: fetchImages };
}
