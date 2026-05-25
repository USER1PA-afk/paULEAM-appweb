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
│   │       └── users/page.tsx
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
│   └── suppliers/                    # External supplier management (not users)
│       ├── components/               # SupplierSelect, SupplierQuickAddForm, SuppliersTable
│       └── hooks/                    # useSuppliers(), useAllSuppliers(), useSupplierActions()
├── entities/                         # Zod schemas + TS types
│   ├── user/                         # UserRoleEnum, UserSchema
│   ├── product/                      # ProductTypeEnum (5 types), ProductSchema, ProductImage, PRODUCT_TYPE_LABELS, PURCHASABLE_TYPES, INGREDIENT_TYPES
│   ├── recipe/                       # RecipeSchema, RecipeIngredientSchema (with ingredient_role), InstructionStepSchema, IngredientRoleEnum
│   ├── production/                   # ProductionStatusEnum, ProductionOrderSchema (with batch_number, cost), ScaledIngredient (with cost)
│   ├── packaging/                    # PackagingStatusEnum, PackagingTemplateSchema, PackagingOrderSchema, PackagingOrderPreview
│   ├── order/                        # OrderStatusEnum, OrderSchema, OrderItemSchema
│   └── supplier/                     # SupplierSchema, ProductSupplierSchema
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

## User Roles

| Role | Access |
|------|--------|
| `admin` | Full admin panel, all CRUD, delete products |
| `operario` | Admin panel (no delete), production, inventory |
| `sales_kiosk` | POS only (`/pos`) |
| `cliente` | Shop only (`/shop/*`) |

Roles are stored in `profiles.role` and read from JWT claims. The `proxy.ts` reads the `pauleam-role` cookie set by the client-side layouts after auth.

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

**Views:** `stock_summary` (balance per product), `inventory_ledger_view` (enriched with supplier + packaging info, `reference_type_label`)

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
