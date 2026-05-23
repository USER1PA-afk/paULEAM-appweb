"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  Star, Trash2, Upload, Package, Eye, EyeOff, Sparkles,
  GripVertical, Plus, X as XIcon,
} from "lucide-react";
import { useProductImages, type ProductImage, type StoreProductWithStock } from "../hooks";

// ─── ProductStatusBadge ───────────────────────────────────────────────────────

interface StatusBadgeProps {
  isActive: boolean;
  featured: boolean;
  stock: number;
}

export function ProductStatusBadge({ isActive, featured, stock }: StatusBadgeProps) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        <EyeOff className="h-3 w-3" /> Oculto
      </span>
    );
  }
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
        Sin stock
      </span>
    );
  }
  if (featured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Sparkles className="h-3 w-3" /> Destacado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
      <Eye className="h-3 w-3" /> Activo
    </span>
  );
}

// ─── StockBadge ───────────────────────────────────────────────────────────────

export function StockBadge({ stock, unit }: { stock: number; unit: string }) {
  const color =
    stock <= 0   ? "text-red-600 dark:text-red-400" :
    stock <= 5   ? "text-amber-600 dark:text-amber-400" :
                   "text-brand-700 dark:text-brand-400";
  const isPhysical = ["kg", "lt"].includes(unit?.toLowerCase());
  const formatted = Number(stock).toLocaleString("es-EC", {
    minimumFractionDigits: isPhysical ? 2 : 0,
    maximumFractionDigits: isPhysical ? 2 : (stock % 1 === 0 ? 0 : 2),
    useGrouping: false,
  });
  return (
    <span className={`tabular-nums font-medium text-sm ${color}`}>
      {formatted} {unit}
    </span>
  );
}

// ─── ProductPreview ───────────────────────────────────────────────────────────

interface PreviewProps {
  name: string;
  price: number;
  imageUrl?: string | null;
  unit: string;
  isActive: boolean;
  featured: boolean;
  stock?: number;
}

export function ProductPreview({ name, price, imageUrl, unit, isActive, featured, stock = 0 }: PreviewProps) {
  const fmt = (n: number) =>
    n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm w-full max-w-[220px]">
      <div className="relative aspect-square bg-muted flex items-center justify-center">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name || "Producto"}
            fill
            className="object-cover"
            unoptimized={imageUrl.startsWith("blob:")}
          />
        ) : (
          <Package className="h-12 w-12 text-muted-foreground/25" />
        )}
        {featured && (
          <div className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            Destacado
          </div>
        )}
        {!isActive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
              Oculto
            </span>
          </div>
        )}
        {stock <= 0 && isActive && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-medium text-center py-1">
            Sin stock
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-xs font-semibold truncate leading-tight">
          {name || <span className="text-muted-foreground italic">Nombre del producto</span>}
        </p>
        <p className="text-base font-bold text-brand-600">
          {fmt(price || 0)}
          <span className="text-[10px] font-normal text-muted-foreground ml-1">/{unit || "und"}</span>
        </p>
        <div className="w-full rounded-md bg-brand-600 text-white text-[10px] py-1.5 font-medium text-center">
          Agregar al carrito
        </div>
      </div>
    </div>
  );
}

// ─── KVEditor ─────────────────────────────────────────────────────────────────

export type KVPair = { key: string; value: string };

interface KVEditorProps {
  label: string;
  description?: string;
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KVEditor({
  label,
  description,
  pairs,
  onChange,
  keyPlaceholder = "Campo",
  valuePlaceholder = "Valor",
}: KVEditorProps) {
  function update(idx: number, field: "key" | "value", val: string) {
    const next = pairs.map((p, i) => (i === idx ? { ...p, [field]: val } : p));
    onChange(next);
  }
  function remove(idx: number) {
    onChange(pairs.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...pairs, { key: "", value: "" }]);
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-2">
        {pairs.map((pair, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              value={pair.key}
              onChange={(e) => update(idx, "key", e.target.value)}
              placeholder={keyPlaceholder}
              className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={pair.value}
              onChange={(e) => update(idx, "value", e.target.value)}
              placeholder={valuePlaceholder}
              className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar fila
      </button>
    </div>
  );
}

// ─── ImageManager ─────────────────────────────────────────────────────────────

interface ImageManagerProps {
  productId: string;
  onPrimaryChange?: (url: string | null) => void;
}

export function ImageManager({ productId, onPrimaryChange }: ImageManagerProps) {
  const { images, uploading, uploadImage, deleteImage, setPrimary, reorderImages } =
    useProductImages(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDragStart(idx: number) { setDragIdx(idx); }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const newOrder = [...images];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    reorderImages(newOrder);
    setDragIdx(null);
    setDragOverIdx(null);
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const ok = await uploadImage(file);
      if (ok && images.length === 0 && onPrimaryChange) {
        // first image becomes primary — parent needs the new url
        // we refresh after upload so onPrimaryChange gets called by effect
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSetPrimary(img: ProductImage) {
    await setPrimary(img);
    onPrimaryChange?.(img.public_url);
  }

  async function handleDelete(img: ProductImage) {
    await deleteImage(img);
    if (img.is_primary) onPrimaryChange?.(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {images.map((img, idx) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all
              ${img.is_primary
                ? "border-brand-500 shadow-md shadow-brand-200 dark:shadow-brand-900/30"
                : "border-border hover:border-muted-foreground/40"}
              ${dragOverIdx === idx && dragIdx !== idx ? "scale-105 border-brand-400" : ""}
            `}
          >
            <Image
              src={img.public_url}
              alt={img.alt_text ?? "Imagen"}
              fill
              className="object-cover"
              unoptimized
            />

            {/* Drag handle indicator */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-60 transition-opacity">
              <GripVertical className="h-3 w-3 text-white drop-shadow" />
            </div>

            {/* Primary badge */}
            {img.is_primary && (
              <div className="absolute top-1 left-1">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 drop-shadow" />
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                {!img.is_primary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(img)}
                    title="Imagen principal"
                    className="rounded-full bg-amber-500 p-1.5 text-white hover:bg-amber-600 transition-colors shadow"
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(img)}
                  title="Eliminar imagen"
                  className="rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600 transition-colors shadow"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Upload zone */}
        <label
          className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-brand-400
            bg-muted/20 cursor-pointer transition-colors flex flex-col items-center justify-center gap-1"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground/60 font-medium">Subir</span>
            </>
          )}
        </label>
      </div>

      {images.length > 0 && (
        <p className="text-[11px] text-muted-foreground/60">
          <Star className="h-3 w-3 inline text-amber-400 fill-amber-400 mr-0.5" />
          Imagen principal · Arrastra para reordenar · Toca para acciones
        </p>
      )}
    </div>
  );
}

// ─── StoreProductThumbnail ────────────────────────────────────────────────────

export function StoreProductThumbnail({
  imageUrl,
  name,
}: {
  imageUrl?: string | null;
  name: string;
}) {
  return (
    <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={40} height={40} className="object-cover h-full w-full" unoptimized />
      ) : (
        <Package className="h-5 w-5 text-muted-foreground/40" />
      )}
    </div>
  );
}

// ─── ProductQuickActions ──────────────────────────────────────────────────────

interface QuickActionsProps {
  product: StoreProductWithStock;
  onEdit: () => void;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
}

export function ProductQuickActions({
  product,
  onEdit,
  onToggleActive,
  onToggleFeatured,
  onDelete,
}: QuickActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={onEdit}
        className="rounded-md bg-zinc-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
      >
        Editar
      </button>
      <button
        onClick={onToggleActive}
        title={product.is_active ? "Ocultar del catálogo" : "Mostrar en catálogo"}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          product.is_active
            ? "bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700"
            : "bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/20 dark:text-brand-400"
        }`}
      >
        {product.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onToggleFeatured}
        title={product.featured ? "Quitar destacado" : "Marcar como destacado"}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          product.featured
            ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        title="Desactivar / eliminar"
        className="rounded-md px-2 py-1 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
