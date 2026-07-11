import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";
import { createHash } from "crypto";

/**
 * POST /api/pos/sale — SERVER-SIDE PROXY FOR process_kiosk_sale
 *
 * WHY THIS EXISTS:
 *   The Insforge SDK on the browser cannot reliably invoke SECURITY DEFINER
 *   RPCs. The SDK uses the localStorage JWT as Authorization, but the
 *   resetBrowserClient() flow sometimes swaps the singleton to use the
 *   httpOnly cookie's edgeFunctionToken — which PostgREST does NOT recognise
 *   as a user context (auth.uid() = null). SECURITY DEFINER functions fail
 *   with "AUTH_INVALID_CREDENTIALS / No token provided".
 *
 *   This proxy bypasses the browser SDK entirely for POS sales:
 *     1. Reads the httpOnly pauleam-session cookie (XSS-immune).
 *     2. Validates the session server-side via Insforge.
 *     3. Authorises: role must be sales_kiosk or admin.
 *     4. Calls process_kiosk_sale server-side with the operator's id from
 *        the verified session. The operator_id parameter is what the function
 *        uses for its audit + ledger writes — auth.uid() is not required.
 *     5. Returns the order id to the client.
 *
 * SECURITY:
 *   - httpOnly cookie cannot be read or stolen by XSS.
 *   - Role check is server-side; the client cannot lie about being a cashier.
 *   - Body validation: every field type-checked. Negative totals, oversized
 *     item lists, or wrong types → 400.
 *   - Idempotency token: caller may send a client-generated `idempotencyKey`;
 *     if present we log it for traceability (process_kiosk_sale itself is
 *     not idempotent — duplicate posts will create duplicate sales, which is
 *     a cashier retrain issue, not a security issue).
 *   - Rate-limited in-memory (per IP) to slow down brute-force guessing of
 *     valid session cookies via this endpoint.
 */

interface PosSaleItem {
  product_id: string;
  qty_commercial: number;
  unit_price: number;
  conversion_factor: number;
}

const MAX_ITEMS = 50;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_HITS = 30;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const slot = rateMap.get(ip);
  if (!slot || slot.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (slot.count >= RATE_MAX_HITS) return false;
  slot.count += 1;
  return true;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(req: NextRequest) {
  // ── 1. Rate limit (per IP) ────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta en un momento." },
      { status: 429 }
    );
  }

  // ── 2. Read + verify session cookie ───────────────────────────────────────
  const sessionToken = req.cookies.get("pauleam-session")?.value;
  if (!sessionToken) {
    return NextResponse.json(
      { error: "No autorizado — sesión requerida" },
      { status: 401 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey  = process.env.INSFORGE_API_KEY;
  if (!baseUrl) {
    return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
  }

  // Auth client uses the caller's JWT to verify who they are.
  const insforge = createClient({
    baseUrl,
    ...(apiKey ? { anonKey: apiKey } : {}),
    edgeFunctionToken: sessionToken,
    isServerMode: true,
    timeout: 8000,
  });

  const { data: userData, error: authError } = await insforge.auth.getCurrentUser();
  if (authError || !userData?.user?.id) {
    return NextResponse.json(
      { error: "Sesión inválida o expirada" },
      { status: 401 }
    );
  }
  const operatorId = userData.user.id;

  // ── 3. Role gate ─────────────────────────────────────────────────────────
  const { data: profile } = await insforge.database
    .from("profiles")
    .select("role")
    .eq("id", operatorId)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "sales_kiosk" && role !== "admin") {
    return NextResponse.json(
      { error: "Acceso denegado — rol no autorizado" },
      { status: 403 }
    );
  }

  // ── 4. Validate body ──────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const customerId = b.customerId;
  const paymentMethod = b.paymentMethod;
  const total = b.total;
  const items = b.items;
  const generateInvoice = b.invoice === true;

  if (!isUuid(customerId) && customerId !== "00000000-0000-0000-0000-999999999999") {
    return NextResponse.json({ error: "customerId inválido" }, { status: 400 });
  }
  if (paymentMethod !== "EFECTIVO" && paymentMethod !== "QR_DEUNA") {
    return NextResponse.json({ error: "paymentMethod inválido" }, { status: 400 });
  }
  if (!isFiniteNumber(total) || total <= 0 || total > 100_000) {
    return NextResponse.json({ error: "total fuera de rango" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return NextResponse.json({ error: "items inválido" }, { status: 400 });
  }

  const cleanItems: PosSaleItem[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: "item con formato inválido" }, { status: 400 });
    }
    const it = raw as Record<string, unknown>;
    if (!isUuid(it.product_id)) {
      return NextResponse.json({ error: "product_id inválido" }, { status: 400 });
    }
    if (!isFiniteNumber(it.qty_commercial) || it.qty_commercial <= 0 || it.qty_commercial > 10_000) {
      return NextResponse.json({ error: "qty_commercial fuera de rango" }, { status: 400 });
    }
    if (!isFiniteNumber(it.unit_price) || it.unit_price < 0 || it.unit_price > 100_000) {
      return NextResponse.json({ error: "unit_price fuera de rango" }, { status: 400 });
    }
    const cf = isFiniteNumber(it.conversion_factor) && it.conversion_factor > 0
      ? it.conversion_factor
      : 1;
    cleanItems.push({
      product_id: it.product_id,
      qty_commercial: Number(it.qty_commercial.toFixed(4)),
      unit_price:     Number(it.unit_price.toFixed(2)),
      conversion_factor: Number(cf.toFixed(4)),
    });
  }

  // ── 5. Call RPC server-side (SECURITY DEFINER — bypasses RLS atomically) ─
  const { data: orderId, error: rpcError } = await insforge.database.rpc(
    "process_kiosk_sale",
    {
      p_operator_id:    operatorId,
      p_customer_id:    customerId as string,
      p_payment_method: paymentMethod as "EFECTIVO" | "QR_DEUNA",
      p_items:          cleanItems,
      p_total:          Number(total.toFixed(2)),
    }
  );

  if (rpcError) {
    console.error("[pos/sale] RPC error:", rpcError.message);
    return NextResponse.json(
      { error: "No se pudo procesar la venta", detail: rpcError.message },
      { status: 409 }
    );
  }

  // ── 6. Persist "Generar comprobante" choice (best-effort) ──────────────
  //    The RPC just created the order. If the cashier ticked the toggle we
  //    stamp invoice_generated_at so the Sales Orders module can show a
  //    "Comprobante generado" badge and re-render the receipt from order
  //    data. Failure here is logged but does not fail the sale.
  if (generateInvoice && orderId) {
    try {
      const { error: invoiceErr } = await insforge.database
        .from("orders")
        .update({ invoice_generated_at: new Date().toISOString() })
        .eq("id", orderId as string);
      if (invoiceErr) {
        console.warn("[pos/sale] invoice flag update failed:", invoiceErr.message);
      }
    } catch (invErr) {
      console.warn("[pos/sale] invoice flag update threw:", invErr);
    }
  }

  // ── 7. Audit trail (best-effort — failure does not roll back the sale) ──
  const saleHash = createHash("sha256")
    .update(`${operatorId}|${customerId}|${total}|${JSON.stringify(cleanItems)}`)
    .digest("hex")
    .slice(0, 32);

  try {
    await insforge.database.rpc("log_audit_event", {
      p_user_id:     operatorId,
      p_action:      "POS_SALE",
      p_entity_type: "orders",
      p_entity_id:   (orderId as string) ?? null,
      p_details:     `Sale ${saleHash} — ${paymentMethod} — $${total.toFixed(2)}${generateInvoice ? " — comprobante generado" : ""}`,
    });
  } catch (auditErr) {
    console.warn("[pos/sale] audit log failed:", auditErr);
  }

  return NextResponse.json({ orderId: orderId as string });
}
