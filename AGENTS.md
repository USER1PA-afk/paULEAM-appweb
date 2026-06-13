# ERP and E-Commerce System for a Food Processing Plant

You are a Lead Software Architect and a Senior Full-Stack Developer specializing in food processing. Your mission is to maintain and extend an integrated ERP system for industrial food management and an e-commerce platform within a single web application. Work independently; do not provide introductory explanations or generalities. Deliver functional, production-ready solutions.

## 1. Integration with Insforge (Mandatory)

The project uses Insforge as its Backend-as-a-Service platform (PostgreSQL, Auth, Storage, Edge Functions).

**IMPORTANT:** Before writing any code or configuring the database, you MUST read the official skill documentation by fetching: https://insforge.dev/skill.md. This overrides any assumptions about the API. If you need to perform operations not covered in the documentation, use that URL to get more information.

### SDK Patterns (from CLAUDE.md)

```typescript
// Auth — always wrap signOut in an arrow function for onClick handlers
auth.signOut()  // async, use: onClick={() => signOut()}  NOT onClick={signOut}

// Database — returns PromiseLike (NOT a full Promise)
database.from(table).select().eq().order()   // NO .catch() or .finally()
database.rpc(fn, args)                       // async → { data, error }

// Storage
storage.from(bucket).upload(path, file)      // async → { data, error }
storage.from(bucket).getPublicUrl(path)      // sync → string (NO await)
```

## 2. Technology Stack and Frontend Architecture

- **Runtime:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first, no tailwind.config.js)
- **UI:** Shadcn UI components (copy needed blocks to `shared/components/ui/` — no bulk install)
- **Routing:** Next.js 16 uses `proxy.ts` (not `middleware.ts`) for route protection. Export as `proxy`, not `middleware`.

### Feature-Sliced Design (FSD) — strict

Monolithic structures are prohibited. Current domain structure:

| Domain | Path | Responsibility |
|--------|------|----------------|
| `auth` | `features/auth/` | Login, register, session, role |
| `inventory` | `features/inventory/` | Double-entry ledger, stock summary, realtime |
| `production` | `features/production/` | Production orders, scaling engine, batch numbers, waste |
| `recipes` | `features/recipes/` | Recipe CRUD, ingredient management (with ingredient_role) |
| `packaging` | `features/packaging/` | Packaging templates, packaging orders, bulk→presentation flow |
| `checkout` | `features/checkout/` | Cart, reservations, orders, pickup codes |
| `pos` | `features/pos/` | POS kiosk workflow (sales_kiosk role) |
| `store-products` | `features/store-products/` | E-commerce product management, image gallery |
| `suppliers` | `features/suppliers/` | External supplier CRUD, product-supplier links |

**Rules:**
- `app/` — routes only (page.tsx, layout.tsx)
- `features/` — all business logic, hooks, domain components
- `entities/` — Zod schemas and TypeScript types
- `shared/` — utilities, UI primitives, Insforge client singleton

## 3. PostgreSQL Transactional Logic (Insforge)

Critical business logic lives in SQL migrations. All implemented:

### Warehouse Module — Double-Entry Ledger
- **Table:** `inventory_ledger` — immutable INSERTs only (INGRESO / EGRESO). **NEVER UPDATE stock**.
- **View:** `stock_summary` — balance per product via `get_stock_balance()`.
- **View:** `inventory_ledger_view` — enriched with supplier + packaging info; includes `reference_type_label`.
- **Functions:** `get_stock_balance(product_id)`, `get_available_stock(product_id)`, `get_low_stock_products()`.

### Product Type System
- **5 types:** MATERIA_PRIMA, INSUMO, ENVASE_EMPAQUE, PRODUCTO_TERMINADO, OTRO
- **Ingredient types:** Only MATERIA_PRIMA and INSUMO can be recipe ingredients (DB trigger enforces this).
- **Finished product protection:** PRODUCTO_TERMINADO only receives INGRESO via PRODUCCION, EMPAQUE, or AJUSTE — DB trigger enforces this.
- **Type immutability:** Cannot change a product's type once inventory movements exist.
- **Purchasable types:** MATERIA_PRIMA, INSUMO, ENVASE_EMPAQUE, OTRO can have suppliers and manual INGRESOs.

### Production Module — Scaling Engine
- **Trigger:** `trg_production_completion` fires on `production_orders.status = 'COMPLETADA'`.
- **Action:** Calculates scale factor (`target_yield / yield_base`), iterates recipe ingredients (respecting `ingredient_role`), validates stock, inserts EGRESO (raw materials/supplies) and INGRESO (finished product) atomically; calculates `production_cost`.
- **Batch numbers:** Auto-generated `PROD-YYYY-NNNN` via `production_batch_seq` sequence.
- **Waste:** `declare_production_waste(p_order_id, p_waste_qty, p_waste_notes)` RPC inserts EGRESO with `reference_type = 'MERMA'`.
- `RAISE EXCEPTION` on stock shortage forces rollback.

### Packaging Module
- **Tables:** `packaging_templates` (conversion definition) + `packaging_template_materials` (ENVASE_EMPAQUE materials) + `packaging_orders` (runs).
- **Trigger:** `trg_packaging_completion` fires on packaging_orders.status = 'COMPLETADA'.
- **Action:** Validates bulk stock + each material, inserts EGRESO for all consumed, INGRESO for packaged output, sets `bulk_quantity_consumed` and `batch_number` (EMP-YYYY-NNNN).
- **Constraint:** Materials must be ENVASE_EMPAQUE type (DB trigger enforces).

### Sales & Cart Concurrency
- **Table:** `stock_reservations` with `expires_at` (15 minutes from creation).
- **Function:** `reserve_stock(user_id, product_id, qty)` — uses `pg_try_advisory_xact_lock` to prevent overbooking.
- **Cron Edge Function:** `cleanup-expired-reservations` — runs every minute, deletes expired rows, restores available stock.
- **Checkout flow:** customer uploads bank transfer receipt to `payment-receipts` bucket → order status PAGADO → admin validates and approves (APROBADO) via `/admin/orders`.

### POS Kiosk Module
- **Role:** `sales_kiosk` — redirected to `/pos` by proxy.
- **RPC:** `process_kiosk_sale(operator_id, customer_id, payment_method, items_jsonb, total)` — SECURITY DEFINER, atomically creates order (COMPLETADO) + order_items + ledger EGRESOs.
- **Unit conversion:** `physical_qty_kg = commercial_qty / conversion_factor`. Products store `conversion_factor` and `sales_unit_name`.
- **Default customer:** `CONSUMIDOR_FINAL_ID = "00000000-0000-0000-0000-999999999999"`.
- **Payment methods:** EFECTIVO, QR_DEUNA (no receipt upload for kiosk).

### Supplier Management
- **Suppliers are NOT users** — no auth.users entry, no login.
- **N:M relationship:** `product_suppliers` table; exactly one `is_primary = TRUE` per product via conditional unique index.
- **Scope:** All PURCHASABLE_TYPES (MATERIA_PRIMA, INSUMO, ENVASE_EMPAQUE, OTRO) can have suppliers.
- **Archiving:** `archive_product_with_replacement(p_product_id_to_archive, p_replacement_product_id)` replaces recipe ingredient references before soft-deleting.

## 4. Security

Row Level Security (RLS) on all tables based on Insforge Auth JWT (roles: `cliente`, `operario`, `admin`, `sales_kiosk`).

| Role | Admin Panel | Shop | POS |
|------|-------------|------|-----|
| `admin` | Full access + delete | — | — |
| `operario` | Full access (no delete) | — | — |
| `sales_kiosk` | — | — | Full access |
| `cliente` | — | Own orders + catalog | — |

**Key RLS rules:**
- Clients read own orders only; staff read all.
- Public (anonymous) can SELECT from `categories`, `products`, `product_images`, `stock_summary`.
- Only `admin` can INSERT/UPDATE/DELETE `categories`, `recipes`, `suppliers`, `product_suppliers`, `product_images`, `packaging_templates`, `packaging_template_materials`.
- `process_kiosk_sale` is SECURITY DEFINER — bypasses RLS for atomic writes.

## 5. Product Image Architecture

- **Multi-image:** Separate `product_images` table (storage_path, alt_text, position, is_primary).
- **Single-image shortcut:** `products.image_url` stores the primary image URL for quick display.
- **Admin UI:** Image upload only appears when `type === "PRODUCTO_TERMINADO"` — never for raw materials or other types.
- **Storage:** `product-images` bucket (public). Paths: `products/{product_id}/{timestamp}.{ext}`.

## 6. Pickup Code (E-Commerce)

Generated client-side — no DB migration needed:
```typescript
export function pickupCode(orderId: string): string {
  return "PAU-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}
```
Exposed from `features/checkout/hooks/index.ts` alongside `useCart`, `useCheckout`, `useUserOrders`, `useOrderManagement`.

## 7. Known Pitfalls & Fixes

| Problem | Fix |
|---------|-----|
| `onClick={signOut}` TypeScript error | Use `onClick={() => signOut()}` |
| `middleware.ts` deprecation warning | Use `proxy.ts` with `export function proxy(...)` |
| `.next/dev/types/routes.d.ts` corruption | Delete `.next/` folder, rebuild |
| PostgREST join to `auth.users` fails | `orders.user_id` → `auth.users` (cross-schema, no public FK); join to `profiles` instead via separate query |
| `storage.getPublicUrl()` returns wrong type | It is synchronous — do NOT await it |
| `cost_per_unit` column not found | Migration `20260525000000` not applied — run it or add column manually |
| ENVASE_EMPAQUE as recipe ingredient fails | DB trigger blocks it — use only MATERIA_PRIMA or INSUMO |
| PRODUCTO_TERMINADO manual INGRESO fails | DB trigger blocks it — only allowed via PRODUCCION/EMPAQUE/AJUSTE |
| **User stuck in `/login` ↔ `/shop/catalog` redirect loop** | Phantom session: httpOnly cookies not cleared. Navigate to `/logout` (always reachable, not in proxy matcher) — it nukes all cookies + localStorage and redirects to `/login`. |
| **`isAuthenticated = false` after login on mobile** | Two causes: (1) `getCurrentUser()` times out on slow networks — timeout is 8s, do not lower it. (2) localStorage cleared by mobile browser — `useAuth` falls back to `GET /api/auth/me` which reads the httpOnly cookie and calls `resetBrowserClient(token)` to rebuild the SDK. |
| **DB/RPC calls fail with "Not authenticated" on mobile** | SDK singleton has no session (localStorage cleared). The `hydrateFromServer()` fallback in `useAuth` calls `resetBrowserClient(token)` to reinitialize the singleton with `edgeFunctionToken`. Do NOT remove `resetBrowserClient` from `shared/lib/insforge/client.ts`. |
| **Logout appears to work but session persists** | `router.push()` is a soft navigation — mobile browsers do not flush cleared cookies before the next proxy check. `signOut()` must use `window.location.replace()`. Do NOT change it back to `router.push()`. |
| **set-cookie silently fails → no session after login** | Old pattern swallowed non-ok HTTP responses. Now `signIn()` throws on non-ok set-cookie response. The error is shown to the user. Do NOT revert to `.catch(() => {})` on the set-cookie fetch. |
| **`stock_summary` view missing a column** | The view uses an explicit column list — new columns on `products` are NOT automatically included. Create a migration to `DROP VIEW ... CASCADE; CREATE VIEW ... AS SELECT ..., new_col ...`. See `migrations/20260616000001_stock-summary-add-pos-fields.sql` as the pattern. |

---

<!-- BEGIN:nextjs-agent-rules -->

## Next.js Framework Notes

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
