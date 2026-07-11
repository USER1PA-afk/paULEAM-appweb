"use client";

import { useEffect } from "react";
import { FileText, Printer, X, AlertCircle } from "lucide-react";
import { getInsforge } from "@shared/lib/insforge/client";

/**
 * Receipt data the admin/orders page can re-render from the DB.
 * All fields are read from `orders` + `order_items` (+ customer profile).
 */
export interface KioskReceiptData {
  orderId: string;
  createdAt: string;
  customerName: string;
  customerCedula: string | null;
  operatorName: string;
  paymentMethod: "EFECTIVO" | "QR_DEUNA" | "TRANSFERENCIA" | string;
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    sales_unit_name: string | null;
  }[];
  total: number;
}

interface Props {
  data: KioskReceiptData | null;
  loading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
}

function posPickupCode(orderId: string): string {
  return "PAU-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}

function fmtMoney(n: number): string {
  return n.toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function printReceipt(data: KioskReceiptData) {
  const code = posPickupCode(data.orderId);
  const dateStr = new Date(data.createdAt).toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const rows = data.items
    .map(
      (i) => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;">${i.name}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center;">${i.quantity} ${i.sales_unit_name ?? ""}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(i.unit_price)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${fmtMoney(i.subtotal)}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprobante ${code}</title>
  <style>body{font-family:monospace,sans-serif;font-size:13px;color:#111;max-width:380px;margin:0 auto;padding:16px}
  h1{font-size:15px;text-align:center;margin:0}h2{font-size:12px;text-align:center;color:#555;margin:2px 0 12px}
  .divider{border:none;border-top:1px dashed #aaa;margin:8px 0}table{width:100%;border-collapse:collapse}
  th{font-size:11px;text-align:left;padding:4px 6px;border-bottom:2px solid #333}
  .footer{text-align:center;margin-top:14px;font-size:11px;color:#888}
  .code{text-align:center;font-size:18px;font-weight:900;letter-spacing:4px;margin:10px 0}
  @media print{@page{margin:8mm}}</style></head><body>
  <h1>PAuleam · Planta de Alimentos</h1>
  <h2>NOTA DE VENTA — CONSUMIDOR FINAL</h2>
  <hr class="divider">
  <div style="font-size:12px;margin-bottom:8px;">
    <div><strong>Código:</strong> ${code}</div>
    <div><strong>Fecha:</strong> ${dateStr}</div>
    <div><strong>Cliente:</strong> ${data.customerName} ${data.customerCedula ? `· ${data.customerCedula}` : ""}</div>
    <div><strong>Operador:</strong> ${data.operatorName}</div>
    <div><strong>Pago:</strong> ${data.paymentMethod === "EFECTIVO" ? "Efectivo" : data.paymentMethod === "QR_DEUNA" ? "QR Deuna" : data.paymentMethod}</div>
  </div>
  <hr class="divider">
  <table>
    <thead><tr>
      <th>Producto</th><th style="text-align:center">Cant.</th>
      <th style="text-align:right">P.U.</th><th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#f5f5f5">
        <td colspan="3" style="padding:6px;font-weight:900;text-align:right">TOTAL</td>
        <td style="padding:6px;font-weight:900;text-align:right">${fmtMoney(data.total)}</td>
      </tr>
    </tfoot>
  </table>
  <hr class="divider">
  <div class="code">${code}</div>
  <div class="footer">Gracias por su compra · Extensión ULEAM Chone</div>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=420,height=600");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

/**
 * Modal that re-renders a POS nota de venta from the data stored on
 * the order. Used by the Sales Orders module for orders whose
 * `invoice_generated_at` is set. Same visual format as the POS local
 * `InvoiceModal` so the printed artifact is consistent.
 */
export function KioskReceiptModal({ data, loading, errorMessage, onClose }: Props) {
  const open = !!data || !!loading || !!errorMessage;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del comprobante"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-sm max-h-[92vh] rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <span className="text-sm font-bold text-neutral-900 dark:text-white">Comprobante de Venta</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar comprobante"
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-700 dark:hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div role="status" className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600">
              <span className="sr-only">Cargando comprobante...</span>
            </div>
          </div>
        ) : errorMessage ? (
          <div role="alert" className="flex items-start gap-2 p-5 text-sm text-red-700 dark:text-red-400">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        ) : data ? (
          <ReceiptBody data={data} />
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-200 dark:border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/10 transition-colors"
          >
            Cerrar
          </button>
          {data && (
            <button
              onClick={() => printReceipt(data)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptBody({ data }: { data: KioskReceiptData }) {
  const code = posPickupCode(data.orderId);
  const dateStr = new Date(data.createdAt).toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 font-mono text-xs text-neutral-800 dark:text-neutral-200">
      <div className="text-center space-y-0.5">
        <p className="text-sm font-black text-neutral-900 dark:text-white tracking-tight">PAuleam</p>
        <p className="text-[10px] text-neutral-500">Planta de Alimentos · Extensión ULEAM Chone</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 mt-1">
          Nota de Venta — Consumidor Final
        </p>
      </div>

      <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-neutral-500">Código</span>
          <span className="font-bold tracking-widest text-brand-600 dark:text-brand-400">{code}</span>
        </div>
        <div className="flex justify-between"><span className="text-neutral-500">Fecha</span><span>{dateStr}</span></div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Cliente</span>
          <span className="truncate max-w-[180px] text-right">{data.customerName}</span>
        </div>
        {data.customerCedula && (
          <div className="flex justify-between"><span className="text-neutral-500">Cédula</span><span>{data.customerCedula}</span></div>
        )}
        <div className="flex justify-between">
          <span className="text-neutral-500">Operador</span>
          <span className="truncate max-w-[180px] text-right">{data.operatorName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Pago</span>
          <span>{data.paymentMethod === "EFECTIVO" ? "Efectivo" : data.paymentMethod === "QR_DEUNA" ? "QR Deuna" : data.paymentMethod}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

      <div className="space-y-1.5">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[9px] font-bold uppercase tracking-widest text-neutral-400 pb-1 border-b border-neutral-200 dark:border-white/10">
          <span>Producto</span><span className="text-right">Cant.</span><span className="text-right">Total</span>
        </div>
        {data.items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px]">
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-900 dark:text-white">{item.name}</p>
              <p className="text-[9px] text-neutral-400">{fmtMoney(item.unit_price)} / {item.sales_unit_name ?? "unidad"}</p>
            </div>
            <span className="text-right text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
              {item.quantity} {item.sales_unit_name ?? ""}
            </span>
            <span className="text-right font-bold text-neutral-900 dark:text-white whitespace-nowrap">
              {fmtMoney(item.subtotal)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

      <div className="flex justify-between font-black text-sm text-neutral-900 dark:text-white">
        <span>TOTAL</span>
        <span className="tabular-nums">{fmtMoney(data.total)}</span>
      </div>

      <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

      <div className="text-center">
        <p className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1">Código de retiro</p>
        <p className="text-2xl font-black tracking-[6px] text-brand-600 dark:text-brand-400">{code}</p>
      </div>

      <p className="text-center text-[9px] text-neutral-400">Gracias por su compra</p>
    </div>
  );
}

/**
 * Fetches the data needed to re-render a POS receipt for an order.
 * - Customer name/cedula: from `profiles` (separate query — no FK to auth.users).
 * - Operator name: from `audit_log_view` (POS_SALE action, entity_id = orderId).
 *   Falls back to "Kiosko" if not found.
 * Returns null on hard failure.
 */
export async function loadKioskReceipt(orderId: string): Promise<KioskReceiptData | null> {
  const db = getInsforge();

  const { data: orderRow, error: orderErr } = await db.database
    .from("orders")
    .select("id, created_at, user_id, payment_method, total, sale_origin")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderRow) return null;
  const o = orderRow as {
    id: string;
    created_at: string;
    user_id: string;
    payment_method: string | null;
    total: number;
    sale_origin: string | null;
  };

  const { data: items, error: itemsErr } = await db.database
    .from("order_items")
    .select("id, quantity, unit_price, subtotal, products(name, sales_unit_name)")
    .eq("order_id", orderId);

  if (itemsErr) return null;

  const { data: profile, error: profileErr } = await db.database
    .from("profiles")
    .select("full_name, phone")
    .eq("id", o.user_id)
    .maybeSingle();

  // Operator: best-effort lookup of the audit log entry.
  // RLS on audit_log_view is admin-only; if it fails (e.g. preview is opened
  // by an operario) we just fall back to "Kiosko" — receipt still renders.
  let operatorName = "Kiosko";
  try {
    const { data: auditRow } = await db.database
      .from("audit_log_view")
      .select("user_name, action")
      .eq("entity_id", orderId)
      .eq("action", "POS_SALE")
      .maybeSingle();
    const ar = auditRow as { user_name?: string } | null;
    if (ar?.user_name) operatorName = ar.user_name;
  } catch {
    // ignore — RLS denied or table missing in some envs
  }

  const customerName =
    (profile as { full_name?: string } | null)?.full_name ?? "Consumidor Final";
  const customerCedula =
    (profile as { phone?: string | null } | null)?.phone ?? null;
  void profileErr;

  return {
    orderId: o.id,
    createdAt: o.created_at,
    customerName,
    customerCedula,
    operatorName,
    paymentMethod: o.payment_method ?? "EFECTIVO",
    items: ((items as unknown as Array<{
      quantity: number | string;
      unit_price: number | string;
      subtotal: number | string;
      products: { name: string; sales_unit_name: string | null } | { name: string; sales_unit_name: string | null }[] | null;
    }> | null) ?? []).map((it) => {
      const product = Array.isArray(it.products) ? it.products[0] : it.products;
      return {
        name: product?.name ?? "Producto",
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        subtotal: Number(it.subtotal),
        sales_unit_name: product?.sales_unit_name ?? null,
      };
    }),
    total: Number(o.total),
  };
}
