"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Tag, Pencil, Trash2, AlertTriangle } from "lucide-react";
import {
  usePromotions,
  usePromotionMutations,
  type AdminPromotion,
} from "@features/promotions/hooks";
import { promotionConfigSummary } from "@features/promotions/lib/apply-promotions";
import { PROMOTION_TYPE_LABELS, PROMOTION_TYPE_COLORS } from "@entities/promotion";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });

function vigencia(p: AdminPromotion): string {
  if (!p.start_date && !p.end_date) return "Siempre";
  if (p.start_date && p.end_date) return `${fmtDate(p.start_date)} — ${fmtDate(p.end_date)}`;
  if (p.start_date) return `Desde ${fmtDate(p.start_date)}`;
  return `Hasta ${fmtDate(p.end_date!)}`;
}

function isExpired(p: AdminPromotion): boolean {
  return !!p.end_date && new Date(p.end_date).getTime() < Date.now();
}

export default function PromotionsPage() {
  const { promotions, loading, error, refetch } = usePromotions();
  const { toggleActive, deletePromotion } = usePromotionMutations();
  const [deleteTarget, setDeleteTarget] = useState<AdminPromotion | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleToggle(p: AdminPromotion) {
    setActionLoading(p.id);
    await toggleActive(p.id, p.is_active);
    await refetch();
    setActionLoading(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    await deletePromotion(deleteTarget.id);
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
            <Tag className="h-3.5 w-3.5" />
            <span>Tienda / Promociones</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Promociones</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Descuentos, combos y ofertas de la tienda online. No aplican al punto de venta.
          </p>
        </div>
        <Link
          href="/admin/store/promotions/new"
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Promoción
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ─── Tabla ─── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Promoción</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Configuración</th>
              <th className="px-4 py-3 font-medium">Productos</th>
              <th className="px-4 py-3 font-medium">Vigencia</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && promotions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-border border-t-brand-600" />
                </td>
              </tr>
            ) : promotions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No hay promociones. Crea la primera con &quot;Nueva Promoción&quot;.
                </td>
              </tr>
            ) : (
              promotions.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">{p.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${PROMOTION_TYPE_COLORS[p.type]}`}>
                      {PROMOTION_TYPE_LABELS[p.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{promotionConfigSummary(p)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs max-w-[220px]">
                      {p.type === "COMBO"
                        ? p.products.map((l, i) => `${l.quantity}× ${p.product_names[i] ?? "—"}`).join(" + ")
                        : (p.product_names[0] ?? "—")}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {vigencia(p)}
                    {isExpired(p) && (
                      <span className="ml-1.5 text-[10px] text-destructive font-medium">Vencida</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(p)}
                      disabled={actionLoading === p.id}
                      className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${
                        p.is_active ? "bg-brand-600" : "bg-muted-foreground/30"
                      }`}
                      aria-label={p.is_active ? "Desactivar promoción" : "Activar promoción"}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                          p.is_active ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/store/promotions/${p.id}`}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Editar promoción"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Eliminar promoción"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Confirmación de eliminación ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Eliminar promoción</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  ¿Eliminar <span className="font-medium text-foreground">{deleteTarget.name}</span>?
                  Los clientes dejarán de verla de inmediato. Las órdenes ya creadas conservan su descuento.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading === deleteTarget.id}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
