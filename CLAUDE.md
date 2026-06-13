@AGENTS.md

# PAuleam — ERP & E-Commerce (Food Processing Plant)

## Architecture

- **Backend-as-a-Service:** Insforge (PostgreSQL, Auth, Storage, Edge Functions)
- **Frontend:** Next.js 16 App Router + TypeScript + Tailwind CSS v4
- **UI Components:** Shadcn UI (copied into `shared/components/ui/`)
- **Structure:** Feature-Sliced Design (FSD)
- **Runtime:** React 19

## Folder Structure (FSD)

```
paULEAM-appweb/
├── app/                              # Next.js App Router (routes ONLY)
│   ├── (admin)/                      # Admin panel route group
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── layout.tsx
│   │       ├── dashboard/page.tsx
│   │       ├── inventory/page.tsx
│   │       ├── production/page.tsx
│   │       ├── packaging/
│   │       │   ├── page.tsx          # Packaging orders list
│   │       │   └── templates/
│   │       │       ├── page.tsx      # Templates list
│   │       │       ├── new/page.tsx  # Create template
│   │       │       └── [id]/page.tsx # Edit template (pending)
│   │       ├── recipes/
│   │       │   ├── page.tsx          # List recipes
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/
│   │       │       ├── page.tsx      # View recipe
│   │       │       └── edit/page.tsx
│   │       ├── products/page.tsx     # All 5 product types (ERP)
│   │       ├── store/
│   │       │   └── products/
│   │       │       ├── page.tsx      # E-commerce product list
│   │       │       ├── new/page.tsx
│   │       │       └── [id]/page.tsx # Edit product + image gallery
│   │       ├── suppliers/page.tsx
│   │       ├── orders/page.tsx       # Customer order approval workflow
│   │       ├── users/page.tsx
│   │       └── audit/page.tsx        # Audit log viewer (admin only)
│   ├── (shop)/                       # Public e-commerce route group
│   │   ├── layout.tsx
│   │   └── shop/
│   │       ├── catalog/page.tsx
│   │       ├── cart/page.tsx
│   │       ├── checkout/page.tsx
│   │       └── orders/page.tsx       # Customer order history
│   ├── (auth)/                       # Auth route group
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (pos)/                        # POS kiosk route group
│   │   ├── layout.tsx
│   │   └── pos/page.tsx
│   ├── layout.tsx                    # Root layout (ThemeProvider)
│   ├── page.tsx                      # Landing page (ProductCarousel + HomeAuthNav)
│   ├── not-found.tsx
│   └── globals.css
├── features/                         # Isolated business domains (FSD)
│   ├── auth/                         # Login, register, session, role
│   │   ├── components/               # LoginForm, RegisterForm, HomeAuthNav
│   │   └── hooks/                    # useAuth(), useRole()
│   ├── inventory/                    # Double-entry ledger, stock summary
│   │   ├── components/               # StockSummaryTable, StockEntryForm, InventoryLedgerTable
│   │   └── hooks/                    # useStockSummary(), useInventoryLedger(), useInventoryActions()
│   ├── production/                   # Production orders, scaling engine
│   │   ├── components/
│   │   ├── hooks/                    # useProductionOrders(), useRecipes(), useScalePreview()
│   │   └── lib/                      # calculateScaleFactor(), scaleIngredientsWithStock(), calculateTotalProductionCost()
│   ├── recipes/                      # Recipe CRUD
│   │   ├── components/               # RecipeForm, RecipeDetail, RecipeList
│   │   ├── hooks/                    # useRecipes(), useRecipe(), useRecipeIngredients(), useProducts(), useRecipeMutations()
│   │   └── lib/
│   ├── packaging/                    # Packaging orders + templates
│   │   └── hooks/                    # usePackagingTemplates(), usePackagingTemplate(), usePackagingOrders(), usePackagingActions(), usePackagingTemplateMutations(), usePackagingPreview()
│   ├── checkout/                     # Cart, reservations, checkout flow
│   │   └── hooks/                    # useCart(), useCheckout(), useOrderManagement(), useUserOrders(), pickupCode()
│   ├── pos/                          # POS kiosk (sales_kiosk role)
│   │   └── hooks/                    # usePosProducts(), usePosCart(), usePosCheckout(), usePosCustomerSearch()
│   ├── store-products/               # E-commerce product management
│   │   ├── components/               # ProductCarousel, StoreProductCard, ProductImageGallery
│   │   └── hooks/                    # useStoreProducts(), useStoreProductDetail(), useStoreProductMutations(), useProductImages()
│   ├── suppliers/                    # External supplier management (not users)
│   │   ├── components/               # SupplierSelect, SupplierQuickAddForm, SuppliersTable
│   │   └── hooks/                    # useSuppliers(), useAllSuppliers(), useSupplierActions()
│   └── audit/                        # Audit trail module (admin-only)
│       ├── components/               # AuditLogTable, AuditStats
│       └── hooks/                    # useAuditLog(), useAuditActions()
├── entities/                         # Zod schemas + TS types
│   ├── user/                         # UserRoleEnum, UserSchema
│   ├── product/                      # ProductTypeEnum (5 types), ProductSchema, ProductImage, PRODUCT_TYPE_LABELS, PURCHASABLE_TYPES, INGREDIENT_TYPES
│   ├── recipe/                       # RecipeSchema, RecipeIngredientSchema (with ingredient_role), InstructionStepSchema, IngredientRoleEnum
│   ├── production/                   # ProductionStatusEnum, ProductionOrderSchema (with batch_number, cost), ScaledIngredient (with cost)
│   ├── packaging/                    # PackagingStatusEnum, PackagingTemplateSchema, PackagingOrderSchema, PackagingOrderPreview
│   ├── order/                        # OrderStatusEnum, OrderSchema, OrderItemSchema
│   ├── supplier/                     # SupplierSchema, ProductSupplierSchema
│   └── audit/                        # AuditActionEnum, AuditEntityTypeEnum, AuditLogSchema, AUDIT_ACTION_LABELS/COLORS
├── shared/
│   ├── components/
│   │   ├── footer.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── theme-provider.tsx
│   │   └── ui/                       # Shadcn UI components
│   ├── hooks/
│   │   └── use-session-guard.ts
│   ├── lib/
│   │   ├── utils.ts                  # formatCurrency(), formatDate(), cn()
│   │   └── insforge/client.ts        # getInsforge() singleton
│   └── types/                        # ApiResponse<T>, PaginationParams, PaginatedResult<T>
├── insforge/
│   └── functions/
│       └── cleanup-expired-reservations.js  # Edge function cron job
├── migrations/                       # SQL migration files (Insforge CLI)
├── proxy.ts                          # Route protection (Next.js 16+ uses proxy.ts)
└── public/
```

## Critical Rules

1. **Immutable inventory:** NEVER use `UPDATE` for stock. Every movement is an INSERT into `inventory_ledger` (INGRESO or EGRESO).
2. **Business logic in SQL:** PL/pgSQL triggers and functions for atomic operations.
3. **RLS mandatory:** All tables must have Row Level Security based on JWT roles.
4. **Advisory locks:** Use `pg_try_advisory_xact_lock` for concurrency in stock reservations and kiosk sales.
5. **Strict FSD:** `app/` contains routes only. Business logic in `features/`. Models in `entities/`.
6. **signOut must be wrapped:** Always `onClick={() => signOut()}` — never `onClick={signOut}`. The function accepts an optional boolean, not a MouseEvent.
7. **Route protection uses `proxy.ts`:** Next.js 16 uses `proxy.ts` (not `middleware.ts`). Export must be `export function proxy(...)` or `export async function proxy(...)`.
8. **Product images only for finished goods:** Image upload UI in admin forms must only appear when `type === "PRODUCTO_TERMINADO"`.
9. **PromiseLike restriction:** `database.from().select()` returns PromiseLike — it has NO `.catch()` or `.finally()`. Use `.then(onOk, onErr)` or `await`.
10. **Delete `.next` on corruption:** If TypeScript reports errors in `.next/dev/types/routes.d.ts`, delete `.next/` and rebuild.
11. **POS sales:** Use `process_kiosk_sale` RPC — never write kiosk orders manually. Converts commercial qty to kg via `conversion_factor`.
12. **Suppliers are not users:** `suppliers` table has no auth.users entry. N:M via `product_suppliers` with one primary per product.
13. **5 product types:** MATERIA_PRIMA, INSUMO, ENVASE_EMPAQUE, PRODUCTO_TERMINADO, OTRO. Only MATERIA_PRIMA and INSUMO are valid recipe ingredients. PRODUCTO_TERMINADO only receives INGRESO via PRODUCCION, EMPAQUE, or AJUSTE.
14. **Ingredient roles:** `recipe_ingredients.ingredient_role` distinguishes MATERIA_PRIMA from INSUMO within a recipe. DB trigger blocks ENVASE_EMPAQUE and PRODUCTO_TERMINADO as ingredients.
15. **Production batch numbers:** Auto-generated as `PROD-YYYY-NNNN` via `production_batch_seq` sequence. Packaging uses `EMP-YYYY-NNNN` from the same sequence.
16. **Production cost:** Calculated at trigger level as `SUM(scaled_qty × cost_per_unit)` per ingredient. `products.cost_per_unit` must be set for accurate costing.
17. **Waste declaration:** Use `declare_production_waste(p_order_id, p_waste_qty, p_waste_notes)` RPC — inserts EGRESO with `reference_type = 'MERMA'`.
18. **Packaging module:** `packaging_templates` define bulk→presentation conversion. `packaging_orders` trigger `trg_packaging_completion` which atomically EGRESOs bulk product + materials and INGRESOs packaged output.
19. **Supplier scope:** All PURCHASABLE_TYPES (MATERIA_PRIMA, INSUMO, ENVASE_EMPAQUE, OTRO) can have suppliers. Not just MATERIA_PRIMA.
20. **Audit module append-only:** `audit_log` never uses UPDATE or DELETE. The only write path is `log_audit_event()` RPC (SECURITY DEFINER). Audit failures must be silenced with `console.warn` — they must never block the primary operation.
21. **Audit events from frontend:** Login/logout/login-failed events are logged in `features/auth/hooks/index.ts` via `useAuditActions().logEvent()`. Data-change events (products, status changes, role changes) are logged automatically by PostgreSQL triggers.

## Auth System Architecture — Two-Track Design

The app uses **two parallel auth mechanisms** that must stay in sync. Never collapse them into one.

### Track A — httpOnly Cookies (Proxy / Route Protection)

| Cookie | Written by | Cleared by | Read by |
|--------|-----------|------------|---------|
| `pauleam-session` | `POST /api/auth/set-cookie` | `POST /api/auth/logout` | `proxy.ts` only |
| `pauleam-role` | `POST /api/auth/set-cookie` | `POST /api/auth/logout` | `proxy.ts` only |

- JavaScript **cannot** read httpOnly cookies — they are invisible to the SDK and all client code.
- The proxy has a **fast path** (both cookies present → trust immediately, zero network calls) and a **fallback path** (session present, role missing → one Insforge call to resolve role).
- Cookie attributes in `set-cookie` and `logout` **must match exactly** (httpOnly, secure, sameSite, path). A mismatch means the browser treats them as different cookies and logout fails to delete the session → phantom session.

### Track B — Insforge SDK Session (React State / DB Calls)

- Stored in **localStorage** by the SDK after `signInWithPassword()`.
- Used by every hook that calls `getInsforge()` for authenticated DB/RPC calls.
- Managed by `useAuth()` in `features/auth/hooks/index.ts`.

### Why Two Tracks?

`proxy.ts` runs as Next.js middleware (server-side, edge runtime). It cannot access the SDK or React state. It needs a server-readable credential → httpOnly cookies.

Client components need the SDK session to make authenticated Insforge API calls → localStorage.

### The Mobile Problem & Fix

On some mobile browsers (Chrome Android with aggressive privacy settings), **localStorage is cleared between page navigations**. Track B breaks — SDK returns null — React shows "not logged in" even though Track A (httpOnly cookie) is valid.

**Fix implemented:**

1. `checkSession()` in `useAuth` gives the SDK **8 seconds** (not 3) before timing out.
2. If SDK returns null or times out → `hydrateFromServer()` calls `GET /api/auth/me`.
3. `/api/auth/me` reads `pauleam-session` (httpOnly) server-side, validates it, returns `{ user, token }`.
4. `resetBrowserClient(token)` in `shared/lib/insforge/client.ts` rebuilds the SDK singleton with `edgeFunctionToken: token` so all subsequent DB/RPC calls work without localStorage.

### Login Flow Critical Rules

- Token extraction must try all variants: `accessToken → access_token → session.access_token` (SDK may return camelCase or snake_case).
- `set-cookie` response **must be checked for ok status** — a non-ok response must throw, not be silently ignored. Silent failure was the original cause of phantom sessions on mobile.
- After `set-cookie`, wait **100ms** before `window.location.href` — mobile browsers need time to flush `Set-Cookie` headers to the cookie jar before the next navigation fires.

### Logout Flow Critical Rules

- **Always use `window.location.replace()`**, never `router.push()`. Soft navigation does not cause the browser to re-read the cookie jar; the proxy would see stale cookies on the first post-logout request → redirect loop.
- `signOut()` must call three things in order: `POST /api/auth/logout` → `insforge.auth.signOut()` → `localStorage.clear()`.
- `localStorage.clear()` wipes ALL storage (except the cart, which is preserved). Do NOT revert to key-pattern filtering — it missed SDK token key names.

### Emergency Escape Hatch

`/logout` page (`app/logout/page.tsx`):
- Calls `POST /api/auth/logout` + clears `localStorage` + clears `sessionStorage` + redirects to `/login`.
- **NOT in the proxy matcher** — always reachable even with a phantom session.
- User can navigate to it directly in the browser address bar to break any stuck session.

### Proxy Matcher — What Is and Is Not Protected

```
matcher: ["/admin", "/admin/:path*", "/login", "/register"]
```

- `/shop/*` — NOT protected by proxy. Shop pages render for all users; `useAuth()` controls the UI.
- `/logout` — NOT protected. Must be reachable in all states (escape hatch).
- `/api/auth/me` — NOT protected. Must be callable when the SDK has no session (it IS the fallback).
- `/pos` — NOT in matcher. POS layout handles its own role check client-side.

## User Roles

| Role | Access |
|------|--------|
| `admin` | Full admin panel, all CRUD, delete products |
| `operario` | Admin panel (no delete), production, inventory |
| `sales_kiosk` | POS only (`/pos`) |
| `cliente` | Shop only (`/shop/*`) |

Roles are stored in `profiles.role` and read from JWT claims. The `proxy.ts` reads the `pauleam-role` cookie set server-side by `/api/auth/set-cookie` after login.

## Insforge SDK — Correct API

```typescript
// Auth
auth.signUp({ email, password, name })           // async → { data, error }
auth.signInWithPassword({ email, password })      // async → { data, error }
auth.signOut()                                     // async → { error } — wrap in arrow fn for onClick
auth.getCurrentUser()                              // async → { data: { user }, error }
auth.refreshSession()                              // async → { data, error }
auth.getProfile(userId)                            // async → { data, error }

// Database (PostgREST) — returns PromiseLike, NOT a full Promise
database.from(table).select().eq().order()         // PromiseLike → { data, error }
database.from(table).select("*", { count: "exact", head: true }) // count only
database.rpc(fn, args)                             // async → { data, error }
// ⚠️ NO .catch() / .finally() — use await or .then(onOk, onErr)

// Storage
storage.from(bucket).upload(path, file)            // async → { data, error }
storage.from(bucket).getPublicUrl(path)            // sync → string (no await)
storage.from(bucket).remove(path)                  // async → { data, error }
```

## Insforge Project

- **Project ID:** `72a1bb81-178c-498a-8901-71267d29b38f`
- **AppKey:** `8i4ga35v`
- **API URL:** `https://8i4ga35v.us-east.insforge.app`
- **Functions URL:** `https://8i4ga35v.functions.insforge.app`
- **SDK:** `@insforge/sdk@^1.2.5`
- **Docs:** https://insforge.dev/skill.md

## Database — 17 Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to auth.users; holds `role` |
| `categories` | Product categories |
| `products` | All 5 product types; includes `cost_per_unit`, `min_stock_alert`, e-commerce metadata, `conversion_factor`, `sales_unit_name`, `featured` |
| `product_images` | Multi-image gallery per product (Insforge Storage paths) |
| `lots` | Raw material batches with expiry dates |
| `inventory_ledger` | Immutable stock movements (INGRESO/EGRESO) |
| `recipes` | Production formulas with JSONB instructions |
| `recipe_ingredients` | Ingredients per recipe; has `ingredient_role` (MATERIA_PRIMA/INSUMO) and `notes` |
| `production_orders` | Orders with `batch_number`, `scheduled_date`, `actual_yield`, `waste_quantity`, `production_cost`; trigger on COMPLETADA |
| `packaging_templates` | Bulk→presentation conversion definitions; links finished_product_id → output_product_id |
| `packaging_template_materials` | ENVASE_EMPAQUE materials per template with qty_per_unit |
| `packaging_orders` | Packaging runs; trigger on COMPLETADA atomically adjusts stock |
| `orders` | E-commerce and kiosk sales; has `sale_origin` (ECOMMERCE/KIOSK), `payment_method` |
| `order_items` | Line items per order (qty in sales/commercial units) |
| `stock_reservations` | 15-min cart holds with `expires_at` |
| `suppliers` | External suppliers (not users); N:M via product_suppliers |
| `product_suppliers` | Maps products to suppliers; one `is_primary` per product |
| `audit_log` | Append-only audit trail; action, entity_type, entity_id, old_values, new_values, user_id, created_at |

**Views:** `stock_summary` (balance per product), `inventory_ledger_view` (enriched with supplier + packaging info, `reference_type_label`), `audit_log_view` (audit_log joined to profiles for `user_name`)

**Functions:**
- `get_stock_balance(product_id)` → balance (INGRESO − EGRESO)
- `get_available_stock(product_id)` → balance minus active reservations
- `get_low_stock_products()` → products where stock < min_stock_alert
- `reserve_stock(user_id, product_id, qty)` → reservation UUID (uses advisory lock)
- `cleanup_expired_reservations()` → count deleted (called by cron edge function)
- `process_kiosk_sale(operator_id, customer_id, payment_method, items_jsonb, total)` → order UUID (SECURITY DEFINER, atomic POS transaction)
- `get_user_role()` → TEXT (reads from profiles via auth.uid())
- `archive_product_with_replacement(p_product_id_to_archive, p_replacement_product_id)` → replaces ingredient references in recipes then soft-deletes product
- `declare_production_waste(p_order_id, p_waste_qty, p_waste_notes)` → inserts EGRESO MERMA, updates waste_quantity on order
- `next_batch_number(prefix)` → auto-generates `PROD-YYYY-NNNN` or `EMP-YYYY-NNNN`
- `log_audit_event(p_user_id, p_action, p_entity_type, p_entity_id, p_old_values, p_new_values, p_details)` → UUID (SECURITY DEFINER, used by triggers and frontend)

**Triggers:**
- `trg_production_completion` — fires on production_orders status → COMPLETADA; scales ingredients, validates stock, inserts EGRESO+INGRESO, calculates production_cost
- `trg_packaging_completion` — fires on packaging_orders status → COMPLETADA; validates and EGRESOs bulk product + materials, INGRESOs packaged output
- `trg_prevent_product_type_change` — blocks type change if inventory movements exist
- `trg_enforce_finished_ingress` — PRODUCTO_TERMINADO only accepts INGRESO via PRODUCCION, EMPAQUE, AJUSTE
- `trg_prevent_packaging_ingredient` — blocks ENVASE_EMPAQUE and PRODUCTO_TERMINADO as recipe ingredients

## Storage Buckets

- `payment-receipts` (public) — Customer payment receipt uploads for admin validation
- `product-images` (public) — Product images (finished goods only; multi-image via `product_images` table)

## Key Flows

### E-Commerce Order Flow
1. Customer browses `/shop/catalog` → must be authenticated to add to cart
2. `addItem()` calls `reserve_stock()` RPC (advisory lock, 15-min hold)
3. `/shop/checkout` → customer uploads bank transfer receipt to `payment-receipts` bucket → creates order (status: PENDIENTE → PAGADO)
4. Admin in `/admin/orders` views receipt → approves (APROBADO) or rejects (CANCELADO)
5. Customer sees status in `/shop/orders` with pickup code `PAU-XXXXXXXX`

### POS Kiosk Flow (sales_kiosk role)
1. Operator logs in → redirected to `/pos`
2. Selects products (stock displayed in commercial units via `conversion_factor`)
3. Select customer (search profiles) or use `CONSUMIDOR_FINAL_ID`
4. Choose payment: EFECTIVO or QR_DEUNA
5. `process_kiosk_sale()` RPC atomically creates order (COMPLETADO) + inserts ledger EGRESOs (in kg)
6. No stock reservations needed

### Production Flow
1. Admin creates recipe with scaled ingredients (MATERIA_PRIMA + INSUMO roles) + JSONB instruction steps
2. Creates production order with `target_yield`, optional `batch_number` and `scheduled_date`
3. On status → COMPLETADA: `trg_production_completion` fires
4. Trigger scales ingredients by `(target_yield / yield_base)`, validates stock, inserts EGRESO (raw materials/supplies) and INGRESO (finished product) atomically; calculates `production_cost`
5. Post-completion: admin may declare waste via `declare_production_waste` RPC

### Packaging Flow
1. Admin defines `packaging_template`: bulk product → packaged presentation, with ENVASE_EMPAQUE materials
2. Creates `packaging_order` linked to template with `units_to_package`
3. On status → COMPLETADA: `trg_packaging_completion` fires
4. Trigger atomically EGRESOs bulk product + each material, INGRESOs packaged output; sets `bulk_quantity_consumed` and `batch_number` (EMP-YYYY-NNNN)

### Unit Conversion
```
physical_qty_kg = commercial_qty / conversion_factor
```
- `conversion_factor` stored on product (e.g., 1 libra = 0.4536 kg → conversion_factor = 0.4536)
- `sales_unit_name` is the display label (e.g., "libra", "unidad")
- POS shows `stock_commercial = floor(stock_actual_kg / conversion_factor)`

## Product Type Taxonomy

| Type | Label | Can be ingredient | Can have supplier | Enters stock via |
|------|-------|:-----------------:|:-----------------:|-----------------|
| `MATERIA_PRIMA` | Materia Prima | ✅ | ✅ | INGRESO manual |
| `INSUMO` | Insumo | ✅ | ✅ | INGRESO manual |
| `ENVASE_EMPAQUE` | Envase/Empaque | ❌ | ✅ | INGRESO manual |
| `PRODUCTO_TERMINADO` | Producto Terminado | ❌ | ❌ | PRODUCCION / EMPAQUE / AJUSTE only |
| `OTRO` | Otro | ❌ | ✅ | INGRESO manual |

## Pickup Code

Derived client-side from the order UUID — no DB migration needed:
```typescript
export function pickupCode(orderId: string): string {
  return "PAU-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}
```

## Migrations Applied

| File | Status | Description |
|------|--------|-------------|
| `20260525000000_expand-product-types.sql` | ⏳ Pending | 5 product types, cost_per_unit, min_stock_alert, enforcement triggers |
| `20260525000001_add-ingredient-role.sql` | ⏳ Pending | ingredient_role + notes on recipe_ingredients |
| `20260525000002_production-enrichment.sql` | ⏳ Pending | batch_number, production_cost, declare_production_waste RPC |
| `20260525000003_packaging-module.sql` | ⏳ Pending | packaging_templates, packaging_template_materials, packaging_orders |
| `20260601000000_audit-module.sql` | ⏳ Pending | audit_log table, audit_log_view, log_audit_event RPC, triggers on products/production_orders/packaging_orders/profiles |

## tsconfig Path Aliases

```json
"@/*"          → "./*"
"@features/*"  → "./features/*"
"@entities/*"  → "./entities/*"
"@shared/*"    → "./shared/*"
"@insforge/*"  → "./insforge/*"
```

## next.config.ts — Image Domains

```typescript
images: {
  remotePatterns: [{ protocol: "https", hostname: "*.insforge.app" }]
}
```
