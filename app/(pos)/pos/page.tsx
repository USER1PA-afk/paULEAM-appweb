"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@features/auth/hooks";
import {
  usePosProducts,
  usePosCart,
  usePosCheckout,
  usePosCustomerSearch,
  CONSUMIDOR_FINAL_ID,
  CONSUMIDOR_FINAL_NAME,
  CONSUMIDOR_FINAL_CEDULA,
  type PosProduct,
  type PosPaymentMethod,
  type PosCustomer,
  type PosCartItem,
} from "@features/pos";
import { formatCurrency } from "@shared/lib/utils";
import {
  ShoppingCart,
  Package,
  Plus,
  Minus,
  Trash2,
  User,
  Search,
  Banknote,
  QrCode,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  X,
  AlertCircle,
  Zap,
  FileText,
  Printer,
} from "lucide-react";

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Tarjeta de producto táctil grande */
function ProductCard({
  product,
  onTap,
  cartQty,
}: {
  product: PosProduct;
  onTap: (p: PosProduct) => void;
  cartQty: number;
}) {
  const [pressed, setPressed] = useState(false);
  const outOfStock = product.stock_commercial <= 0;

  const handleTap = () => {
    if (outOfStock) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
    onTap(product);
  };

  return (
    <button
      id={`pos-product-${product.product_id}`}
      onClick={handleTap}
      disabled={outOfStock}
      aria-label={`Agregar ${product.name} al carrito`}
      className={`
        relative flex flex-col overflow-hidden rounded-xl border text-left
        transition-all duration-150 select-none
        ${pressed ? "scale-[0.96]" : "scale-100"}
        ${
          outOfStock
            ? "border-neutral-200 dark:border-white/5 bg-neutral-100 dark:bg-white/3 opacity-40 cursor-not-allowed"
            : "border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-brand-600/50 dark:hover:border-brand-600/50 hover:bg-neutral-50 dark:hover:bg-[#1f1f1f] active:scale-[0.96] cursor-pointer text-neutral-900 dark:text-white"
        }
      `}
      style={{ minHeight: 130 }}
    >
      {/* Badge de cantidad en carrito */}
      {cartQty > 0 && (
        <span className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-black text-white shadow-lg">
          {cartQty}
        </span>
      )}

      {/* Imagen del producto */}
      <div className="relative h-20 w-full shrink-0 overflow-hidden bg-black/20">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 20vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-8 w-8 text-white/20" aria-hidden="true" />
          </div>
        )}
        {/* Overlay top-to-bottom gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-white dark:from-[#1a1a1a] to-transparent opacity-40" />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="text-[11px] font-semibold leading-tight text-neutral-900 dark:text-white line-clamp-2">
          {product.name}
        </p>
        <div className="mt-auto flex items-end justify-between gap-1">
          <div>
            <p className="text-base font-black text-brand-600 dark:text-brand-400 leading-none">
              {formatCurrency(product.price)}
            </p>
            <p className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              / {product.sales_unit_name}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-[10px] font-bold leading-none ${
                product.stock_commercial < 3
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-accent-600 dark:text-accent-400"
              }`}
            >
              {outOfStock ? "Agotado" : `${Math.floor(product.stock_commercial)}`}
            </p>
            {!outOfStock && (
              <p className="text-[8px] text-neutral-500 dark:text-neutral-600 mt-0.5">
                {product.sales_unit_name}s
              </p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/** Ítem del carrito con controles +/- */
function CartRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: { product_id: string; name: string; price: number; quantity: number; sales_unit_name: string };
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-neutral-200 dark:border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{item.name}</p>
        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
          {formatCurrency(item.price)} / {item.sales_unit_name}
        </p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          id={`pos-cart-decrease-${item.product_id}`}
          onClick={onDecrease}
          aria-label={`Reducir cantidad de ${item.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400
            hover:bg-neutral-200 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white active:scale-90 transition-all duration-100"
        >
          <Minus className="h-3 w-3" aria-hidden="true" />
        </button>
        <span className="w-7 text-center text-sm font-black text-neutral-900 dark:text-white">
          {item.quantity}
        </span>
        <button
          id={`pos-cart-increase-${item.product_id}`}
          onClick={onIncrease}
          aria-label={`Aumentar cantidad de ${item.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400
            hover:bg-neutral-200 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white active:scale-90 transition-all duration-100"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {/* Subtotal */}
      <p className="w-14 text-right text-xs font-bold text-neutral-900 dark:text-white shrink-0">
        {formatCurrency(item.price * item.quantity)}
      </p>

      {/* Eliminar */}
      <button
        id={`pos-cart-remove-${item.product_id}`}
        onClick={onRemove}
        aria-label={`Eliminar ${item.name} del carrito`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-600
          hover:bg-red-500/10 dark:hover:bg-red-500/10 hover:text-red-650 dark:hover:text-red-400 active:scale-90 transition-all duration-100 shrink-0"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Invoice Modal ───────────────────────────────────────────────────────────

type InvoiceData = {
  orderId: string;
  createdAt: Date;
  customer: PosCustomer;
  operatorName: string;
  items: PosCartItem[];
  total: number;
  paymentMethod: PosPaymentMethod;
  amountReceived: number;
  change: number;
};

function posPickupCode(orderId: string) {
  return "PAU-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}

function printInvoice(data: InvoiceData) {
  const fmt = (n: number) =>
    n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const dateStr = data.createdAt.toLocaleString("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const code = posPickupCode(data.orderId);

  const rows = data.items.map((i) => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;">${i.name}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center;">${i.quantity} ${i.sales_unit_name}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${fmt(i.price)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${fmt(i.price * i.quantity)}</td>
    </tr>`).join("");

  const payRow = data.paymentMethod === "EFECTIVO"
    ? `<tr><td colspan="3" style="padding:3px 6px;text-align:right;font-size:12px;">Recibido</td><td style="padding:3px 6px;text-align:right;">${fmt(data.amountReceived)}</td></tr>
       <tr><td colspan="3" style="padding:3px 6px;text-align:right;font-size:12px;">Cambio</td><td style="padding:3px 6px;text-align:right;">${fmt(data.change)}</td></tr>`
    : "";

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
    <div><strong>Cliente:</strong> ${data.customer.full_name} ${data.customer.cedula ? `· ${data.customer.cedula}` : ""}</div>
    <div><strong>Operador:</strong> ${data.operatorName}</div>
    <div><strong>Pago:</strong> ${data.paymentMethod === "EFECTIVO" ? "Efectivo" : "QR Deuna"}</div>
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
        <td style="padding:6px;font-weight:900;text-align:right">${fmt(data.total)}</td>
      </tr>
      ${payRow}
    </tfoot>
  </table>
  <hr class="divider">
  <div class="code">${code}</div>
  <div class="footer">Gracias por su compra · Extensión ULEAM Chone</div>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=420,height=600");
  if (w) { w.document.write(html); w.document.close(); }
}

function InvoiceModal({ data, onClose }: { data: InvoiceData; onClose: () => void }) {
  const fmt = (n: number) =>
    n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const code = posPickupCode(data.orderId);
  const dateStr = data.createdAt.toLocaleString("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
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
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 font-mono text-xs text-neutral-800 dark:text-neutral-200">
          {/* Empresa */}
          <div className="text-center space-y-0.5">
            <p className="text-sm font-black text-neutral-900 dark:text-white tracking-tight">PAuleam</p>
            <p className="text-[10px] text-neutral-500">Planta de Alimentos · Extensión ULEAM Chone</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 mt-1">Nota de Venta — Consumidor Final</p>
          </div>

          <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

          {/* Meta */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-neutral-500">Código</span><span className="font-bold tracking-widest text-brand-600 dark:text-brand-400">{code}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Fecha</span><span>{dateStr}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Cliente</span><span className="truncate max-w-[180px] text-right">{data.customer.full_name}</span></div>
            {data.customer.cedula && (
              <div className="flex justify-between"><span className="text-neutral-500">Cédula</span><span>{data.customer.cedula}</span></div>
            )}
            <div className="flex justify-between"><span className="text-neutral-500">Operador</span><span className="truncate max-w-[180px] text-right">{data.operatorName}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Pago</span><span>{data.paymentMethod === "EFECTIVO" ? "Efectivo" : "QR Deuna"}</span></div>
          </div>

          <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

          {/* Items */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[9px] font-bold uppercase tracking-widest text-neutral-400 pb-1 border-b border-neutral-200 dark:border-white/10">
              <span>Producto</span><span className="text-right">Cant.</span><span className="text-right">Total</span>
            </div>
            {data.items.map((item) => (
              <div key={item.product_id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900 dark:text-white">{item.name}</p>
                  <p className="text-[9px] text-neutral-400">{fmt(item.price)} / {item.sales_unit_name}</p>
                </div>
                <span className="text-right text-neutral-600 dark:text-neutral-400 whitespace-nowrap">{item.quantity} {item.sales_unit_name}</span>
                <span className="text-right font-bold text-neutral-900 dark:text-white whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

          {/* Totals */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between font-black text-sm text-neutral-900 dark:text-white">
              <span>TOTAL</span><span className="tabular-nums">{fmt(data.total)}</span>
            </div>
            {data.paymentMethod === "EFECTIVO" && (
              <>
                <div className="flex justify-between text-neutral-500"><span>Recibido</span><span className="tabular-nums">{fmt(data.amountReceived)}</span></div>
                <div className="flex justify-between text-accent-700 dark:text-accent-400 font-bold"><span>Cambio</span><span className="tabular-nums">{fmt(data.change)}</span></div>
              </>
            )}
          </div>

          <div className="border-t border-dashed border-neutral-300 dark:border-white/15" />

          {/* Code */}
          <div className="text-center">
            <p className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1">Código de retiro</p>
            <p className="text-2xl font-black tracking-[6px] text-brand-600 dark:text-brand-400">{code}</p>
          </div>

          <p className="text-center text-[9px] text-neutral-400">Gracias por su compra</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-200 dark:border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/10 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => printInvoice(data)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS Page ───────────────────────────────────────────────────────────

export default function PosPage() {
  const { user } = useAuth();
  const { products, loading: productsLoading, error: productsError, refetch } = usePosProducts();
  const { items, total, isEmpty, addItem, increaseQty, decreaseQty, removeItem, clearCart } = usePosCart();
  const { submitSale, loading: checkoutLoading, error: checkoutError } = usePosCheckout();
  const { query, setQuery, results, searching } = usePosCustomerSearch();

  // ── Local State ──────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("EFECTIVO");
  const [amountReceived, setAmountReceived] = useState("");
  const [customer, setCustomer] = useState<PosCustomer>({
    id: CONSUMIDOR_FINAL_ID,
    full_name: CONSUMIDOR_FINAL_NAME,
    cedula: CONSUMIDOR_FINAL_CEDULA,
  });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [deunaPending, setDeunaPending] = useState(false);
  const [generateInvoice, setGenerateInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Cambio / vuelto ─────────────────────────────────────
  const received = parseFloat(amountReceived) || 0;
  const change = received - total;
  const changeValid = received >= total;

  // ── Puede cobrar ─────────────────────────────────────────
  const canSubmit =
    !isEmpty &&
    !checkoutLoading &&
    (paymentMethod === "QR_DEUNA" ? deunaPending : changeValid);

  // ── Filtro de productos ──────────────────────────────────
  const filteredProducts = productSearch.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
      )
    : products;

  // ── Auto-focus al seleccionar efectivo ───────────────────
  useEffect(() => {
    if (paymentMethod === "EFECTIVO" && amountRef.current) {
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [paymentMethod]);

  // ── Seleccionar cliente del buscador ─────────────────────
  const selectCustomer = useCallback((c: PosCustomer) => {
    setCustomer(c);
    setCustomerSearchOpen(false);
    setQuery("");
  }, [setQuery]);

  const resetToDefaultCustomer = useCallback(() => {
    setCustomer({ id: CONSUMIDOR_FINAL_ID, full_name: CONSUMIDOR_FINAL_NAME, cedula: CONSUMIDOR_FINAL_CEDULA });
    setCustomerSearchOpen(false);
    setQuery("");
  }, [setQuery]);

  // ── Procesar venta ────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!user?.id || !canSubmit) return;

    // Snapshot before async so values are stable
    const saleItems = [...items];
    const saleCustomer = { ...customer };
    const salePayment = paymentMethod;
    const saleTotal = total;
    const saleReceived = parseFloat(amountReceived) || 0;
    const saleChange = saleReceived - saleTotal;
    const saleOperator = user.email ?? user.id;

    const { orderId, error } = await submitSale({
      operatorId: user.id,
      customerId: saleCustomer.id,
      paymentMethod: salePayment,
      items: saleItems,
      total: saleTotal,
    });

    if (error || !orderId) return;

    // Reset
    clearCart();
    setCustomer({ id: CONSUMIDOR_FINAL_ID, full_name: CONSUMIDOR_FINAL_NAME, cedula: CONSUMIDOR_FINAL_CEDULA });
    setPaymentMethod("EFECTIVO");
    setAmountReceived("");
    setDeunaPending(false);
    refetch();

    if (generateInvoice) {
      setInvoiceData({
        orderId,
        createdAt: new Date(),
        customer: saleCustomer,
        operatorName: saleOperator,
        items: saleItems,
        total: saleTotal,
        paymentMethod: salePayment,
        amountReceived: saleReceived,
        change: saleChange,
      });
    } else {
      setSuccessMessage(`✓ Venta procesada — Orden #${orderId.substring(0, 8).toUpperCase()}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  }, [user, canSubmit, submitSale, customer, paymentMethod, items, total, amountReceived, generateInvoice, clearCart, refetch]);

  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {invoiceData && (
        <InvoiceModal
          data={invoiceData}
          onClose={() => {
            setInvoiceData(null);
            setSuccessMessage(`✓ Venta procesada — Orden #${invoiceData.orderId.substring(0, 8).toUpperCase()}`);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* ══════════════════════════════════════════
          LEFT — Product Grid (60%)
      ══════════════════════════════════════════ */}
      <section
        aria-label="Catálogo de productos"
        className="flex flex-col w-[60%] min-w-0 border-r border-neutral-200 dark:border-white/5 overflow-hidden"
      >
        {/* Search bar */}
        <div className="shrink-0 px-3 py-2.5 bg-neutral-50 dark:bg-[#111111] border-b border-neutral-200 dark:border-white/5">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 dark:text-neutral-600"
              aria-hidden="true"
            />
            <input
              id="pos-product-search"
              type="search"
              placeholder="Buscar producto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/8
                text-sm text-neutral-900 dark:text-white placeholder-neutral-450 dark:placeholder-neutral-600 outline-none
                focus:border-brand-600/50 focus:bg-white dark:focus:bg-white/8 transition-all"
            />
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {productsLoading ? (
            <div className="flex h-40 items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-white/10 border-t-brand-500" />
              <span className="text-sm text-neutral-600 dark:text-neutral-500">Cargando productos…</span>
            </div>
          ) : productsError ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-red-500/60" />
              <p className="text-sm text-neutral-650 dark:text-neutral-550">{productsError}</p>
              <button
                onClick={refetch}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-100 dark:bg-white/5 px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Reintentar
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <Package className="h-8 w-8 text-neutral-300 dark:text-white/10" />
              <p className="text-sm text-neutral-500 dark:text-neutral-605">
                {productSearch ? "Sin resultados" : "No hay productos disponibles"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredProducts.map((product) => {
                const cartItem = items.find((i) => i.product_id === product.product_id);
                return (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    onTap={addItem}
                    cartQty={cartItem?.quantity ?? 0}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          RIGHT — Cart + Checkout (40%)
      ══════════════════════════════════════════ */}
      <section
        aria-label="Carrito y pago"
        className="flex w-[40%] min-w-0 flex-col bg-white dark:bg-[#111111] border-l border-neutral-200 dark:border-transparent overflow-hidden"
      >

        {/* ── Customer Selector ──────────────────── */}
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-neutral-200 dark:border-white/5">
          <div className="relative">
            <button
              id="pos-customer-toggle"
              onClick={() => {
                setCustomerSearchOpen((o) => !o);
                setTimeout(() => searchRef.current?.focus(), 100);
              }}
              aria-expanded={customerSearchOpen}
              aria-haspopup="listbox"
              className="flex w-full items-center gap-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/4
                px-3 py-2 text-left hover:border-neutral-350 dark:hover:border-white/20 hover:bg-neutral-100 dark:hover:bg-white/7 transition-all cursor-pointer"
            >
              <User className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 leading-none mb-0.5">
                  Cliente
                </p>
                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate leading-tight">
                  {customer.full_name}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-600 leading-none mt-0.5">
                  {customer.cedula}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-neutral-400 dark:text-neutral-600 transition-transform duration-200 ${
                  customerSearchOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown búsqueda */}
            {customerSearchOpen && (
              <div
                role="listbox"
                aria-label="Buscar cliente"
                className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-neutral-200 dark:border-white/10
                  bg-white dark:bg-[#1a1a1a] shadow-2xl overflow-hidden"
              >
                {/* Search input */}
                <div className="p-2 border-b border-neutral-200 dark:border-white/5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 dark:text-neutral-600" />
                    <input
                      ref={searchRef}
                      id="pos-customer-search"
                      type="text"
                      placeholder="Buscar por cédula / RUC…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 rounded-md bg-neutral-50 dark:bg-white/5 text-sm text-neutral-900 dark:text-white
                        placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:bg-neutral-105 dark:focus:bg-white/8 transition-all border border-neutral-200 dark:border-transparent"
                    />
                  </div>
                </div>

                {/* Consumidor Final always first */}
                <button
                  role="option"
                  aria-selected={customer.id === CONSUMIDOR_FINAL_ID}
                  onClick={() => resetToDefaultCustomer()}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                    customer.id === CONSUMIDOR_FINAL_ID ? "bg-brand-600/10" : ""
                  }`}
                >
                  <Zap className="h-4 w-4 text-brand-500 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">{CONSUMIDOR_FINAL_NAME}</p>
                    <p className="text-[10px] text-neutral-550 dark:text-neutral-500">{CONSUMIDOR_FINAL_CEDULA}</p>
                  </div>
                  {customer.id === CONSUMIDOR_FINAL_ID && (
                    <CheckCircle className="ml-auto h-3.5 w-3.5 text-brand-500" />
                  )}
                </button>

                {/* Resultados búsqueda */}
                {searching && (
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-250 dark:border-white/10 border-t-brand-500" />
                    <span className="text-xs text-neutral-550 dark:text-neutral-500">Buscando…</span>
                  </div>
                )}
                {results.map((c) => (
                  <button
                    key={c.id}
                    role="option"
                    aria-selected={customer.id === c.id}
                    onClick={() => selectCustomer(c)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                      customer.id === c.id ? "bg-brand-600/10" : ""
                    }`}
                  >
                    <User className="h-4 w-4 text-neutral-400 dark:text-neutral-500 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{c.full_name}</p>
                      <p className="text-[10px] text-neutral-550 dark:text-neutral-500">{c.cedula}</p>
                    </div>
                    {customer.id === c.id && (
                      <CheckCircle className="ml-auto h-3.5 w-3.5 text-brand-500" />
                    )}
                  </button>
                ))}

                {/* Cerrar */}
                <button
                  onClick={() => setCustomerSearchOpen(false)}
                  className="flex w-full items-center justify-center gap-1.5 px-3 py-2
                    border-t border-neutral-200 dark:border-white/5 text-xs text-neutral-500 dark:text-neutral-600 hover:text-neutral-800 dark:hover:text-neutral-400 transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" /> Cerrar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Cart Items ─────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-1">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingCart className="h-10 w-10 text-neutral-300 dark:text-white/8" aria-hidden="true" />
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-650">
                Selecciona productos del catálogo
              </p>
            </div>
          ) : (
            <div className="py-1">
              {items.map((item) => (
                <CartRow
                  key={item.product_id}
                  item={item}
                  onIncrease={() => increaseQty(item.product_id)}
                  onDecrease={() => decreaseQty(item.product_id)}
                  onRemove={() => removeItem(item.product_id)}
                />
              ))}
              {/* Limpiar carrito */}
              {!isEmpty && (
                <button
                  id="pos-clear-cart"
                  onClick={clearCart}
                  className="mt-2 flex w-full items-center justify-center gap-1.5
                    rounded-lg py-1.5 text-[10px] font-semibold uppercase tracking-widest
                    text-neutral-500 dark:text-neutral-600 hover:text-red-650 dark:hover:text-red-400 hover:bg-red-500/5 transition-all duration-150 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Vaciar carrito
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Checkout Panel ─────────────────────── */}
        <div className="shrink-0 border-t border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-[#0d0d0d] transition-colors duration-200">

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-white/5">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Total a Cobrar
            </span>
            <span className="text-3xl font-black text-neutral-900 dark:text-white tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Payment method toggle */}
          <div className="px-4 pt-3 pb-2">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-600">
              Método de Pago
            </p>
            <div
              role="radiogroup"
              aria-label="Método de pago"
              className="grid grid-cols-2 gap-2"
            >
              <button
                id="pos-pay-cash"
                role="radio"
                aria-checked={paymentMethod === "EFECTIVO"}
                onClick={() => setPaymentMethod("EFECTIVO")}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3.5
                  font-bold text-sm transition-all duration-200 active:scale-[0.97] cursor-pointer
                  ${
                    paymentMethod === "EFECTIVO"
                      ? "border-accent-500/60 bg-accent-500/10 dark:bg-accent-500/15 text-accent-700 dark:text-accent-400 shadow-md shadow-accent-500/10"
                      : "border-neutral-200 dark:border-white/8 bg-white dark:bg-white/4 text-neutral-550 dark:text-neutral-500 hover:border-neutral-300 dark:hover:border-white/15 hover:text-neutral-800 dark:hover:text-neutral-300"
                  }`}
              >
                <Banknote className="h-5 w-5" aria-hidden="true" />
                Efectivo
              </button>

              <button
                id="pos-pay-deuna"
                role="radio"
                aria-checked={paymentMethod === "QR_DEUNA"}
                onClick={() => { setPaymentMethod("QR_DEUNA"); setDeunaPending(false); }}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3.5
                  font-bold text-sm transition-all duration-200 active:scale-[0.97] cursor-pointer
                  ${
                    paymentMethod === "QR_DEUNA"
                      ? "border-blue-500/60 bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 shadow-md shadow-blue-500/10"
                      : "border-neutral-200 dark:border-white/8 bg-white dark:bg-white/4 text-neutral-550 dark:text-neutral-500 hover:border-neutral-300 dark:hover:border-white/15 hover:text-neutral-800 dark:hover:text-neutral-300"
                  }`}
              >
                <QrCode className="h-5 w-5" aria-hidden="true" />
                QR Deuna
              </button>
            </div>
          </div>

          {/* ── Cash mode ── */}
          {paymentMethod === "EFECTIVO" && (
            <div className="px-4 pb-3 space-y-2">
              <div>
                <label
                  htmlFor="pos-amount-received"
                  className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-600 mb-1"
                >
                  Monto Recibido (USD)
                </label>
                <input
                  ref={amountRef}
                  id="pos-amount-received"
                  type="number"
                  min="0"
                  step="0.25"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className={`w-full h-12 rounded-xl border px-4 text-right text-2xl font-black tabular-nums
                    outline-none transition-all
                    ${
                      amountReceived && !changeValid
                        ? "border-red-500/60 bg-red-500/5 text-red-600 dark:text-red-400"
                        : amountReceived && changeValid
                        ? "border-accent-500/50 bg-accent-500/5 text-neutral-900 dark:text-white"
                        : "border-neutral-200 dark:border-white/10 bg-white dark:bg-white/4 text-neutral-900 dark:text-white"
                    }
                    focus:border-brand-500/60 focus:bg-white dark:focus:bg-white/6`}
                />
              </div>

              {/* Change */}
              {amountReceived && (
                <div
                  className={`flex items-center justify-between rounded-xl px-4 py-2.5
                    ${changeValid ? "bg-accent-500/10 border border-accent-500/20" : "bg-red-500/8 border border-red-500/15"}`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${changeValid ? "text-accent-700 dark:text-accent-400" : "text-red-650 dark:text-red-400"}`}>
                    {changeValid ? "Cambio / Vuelto" : "Monto insuficiente"}
                  </span>
                  <span className={`text-xl font-black tabular-nums ${changeValid ? "text-accent-850 dark:text-accent-300" : "text-red-650 dark:text-red-400"}`}>
                    {changeValid ? formatCurrency(change) : `-${formatCurrency(Math.abs(change))}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── QR Deuna mode ── */}
          {paymentMethod === "QR_DEUNA" && (
            <div className="px-4 pb-3 flex flex-col items-center gap-2.5">
              {/* QR image */}
              <div className="relative overflow-hidden rounded-xl border border-neutral-250 dark:border-white/10 bg-white p-2">
                <Image
                  src="/deuna-qr.png"
                  alt="Código QR Deuna para pago"
                  width={160}
                  height={160}
                  className="block"
                  priority
                />
              </div>
              <p className="text-[10px] text-center text-neutral-500 dark:text-neutral-400 leading-snug max-w-[200px]">
                Muestre este QR al cliente para completar el pago con Deuna
              </p>

              {/* Confirm button */}
              <button
                id="pos-deuna-confirm"
                onClick={() => setDeunaPending(true)}
                disabled={deunaPending}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3
                  text-sm font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer
                  ${
                    deunaPending
                      ? "bg-blue-500/20 border border-blue-500/40 text-blue-700 dark:text-blue-300 cursor-default"
                      : "bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 dark:hover:bg-blue-500/20"
                  }`}
              >
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                {deunaPending ? "Pago Confirmado ✓" : "Confirmar Pago Recibido"}
              </button>
            </div>
          )}

          {/* ── Error display ── */}
          {checkoutError && (
            <div
              role="alert"
              className="mx-4 mb-2 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2"
            >
              <AlertCircle className="h-4 w-4 text-red-650 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-red-650 dark:text-red-400 leading-snug">{checkoutError}</p>
            </div>
          )}

          {/* ── Success overlay ── */}
          {successMessage && (
            <div
              role="status"
              aria-live="polite"
              className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-accent-500/15 border border-accent-500/30 px-3 py-2.5"
            >
              <CheckCircle className="h-5 w-5 text-accent-600 dark:text-accent-400 shrink-0" aria-hidden="true" />
              <p className="text-sm font-bold text-accent-700 dark:text-accent-300">{successMessage}</p>
            </div>
          )}

          {/* ── Invoice toggle ── */}
          <div className="px-4 pb-2">
            <button
              id="pos-invoice-toggle"
              onClick={() => setGenerateInvoice((v) => !v)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200 cursor-pointer
                ${generateInvoice
                  ? "border-brand-500/50 bg-brand-500/8 dark:bg-brand-500/12"
                  : "border-neutral-200 dark:border-white/8 bg-white dark:bg-white/4 hover:border-neutral-300 dark:hover:border-white/15"
                }`}
            >
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors
                ${generateInvoice ? "border-brand-600 bg-brand-600" : "border-neutral-300 dark:border-white/25"}`}
              >
                {generateInvoice && (
                  <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-white" aria-hidden="true">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <FileText className={`h-4 w-4 shrink-0 transition-colors ${generateInvoice ? "text-brand-600 dark:text-brand-400" : "text-neutral-400 dark:text-neutral-500"}`} aria-hidden="true" />
              <div className="flex-1 text-left">
                <p className={`text-xs font-semibold transition-colors ${generateInvoice ? "text-brand-700 dark:text-brand-300" : "text-neutral-600 dark:text-neutral-400"}`}>
                  Generar comprobante
                </p>
                <p className="text-[9px] text-neutral-400 dark:text-neutral-600">
                  {generateInvoice ? "Se mostrará nota de venta al finalizar" : "Sin comprobante"}
                </p>
              </div>
            </button>
          </div>

          {/* ── Final CTA ── */}
          <div className="px-4 pb-4">
            <button
              id="pos-submit-sale"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              className={`relative w-full overflow-hidden rounded-2xl py-4 text-base font-black uppercase
                tracking-widest transition-all duration-200 cursor-pointer
                ${
                  canSubmit
                    ? "bg-brand-600 text-white shadow-lg shadow-brand-900/50 hover:bg-brand-500 active:scale-[0.98]"
                    : "bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-neutral-600 cursor-not-allowed border border-neutral-200 dark:border-white/5"
                }`}
            >
              {checkoutLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Procesando…
                </span>
              ) : (
                "Cobrar y Despachar"
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
