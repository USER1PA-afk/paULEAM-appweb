# POS (Punto de Venta) — Troubleshooting & Architecture Notes

Last verified working: post-migration `20260616000001_stock-summary-add-pos-fields.sql`.

This document is the runbook for the most common POS failures. If the
kiosk starts acting up, start here.

---

## TL;DR — The Three Things That Will Break POS

1. **`stock_summary` view out of sync with `products` table.**
   The view is hand-curated (`CREATE VIEW ... AS SELECT col1, col2, ...`).
   New columns on `products` are NOT picked up automatically. Re-run the
   `20260616*` migrations if you add a product field that the POS reads.

2. **Stale Insforge SDK refresh token in localStorage.**
   Triggers an infinite 403 loop on `/api/auth/refresh`. Fixed by the
   `AuthRecoveryBoot` component (auto-nukes localStorage and reloads).
   Manual fix: hard reload with DevTools open, run `localStorage.clear()`,
   sign in again.

3. **The POS RPC `process_kiosk_sale` is SECURITY DEFINER.**
   It MUST be called from a context that has a valid `operator_id` in
   the request body. The browser SDK cannot reliably call SECURITY
   DEFINER RPCs when its `edgeFunctionToken` is set (PostgREST returns
   `AUTH_INVALID_CREDENTIALS / No token provided`). **Always go through
   the `/api/pos/sale` server proxy**, never the SDK's `database.rpc()`.

---

## File map

| File | Role |
|------|------|
| `app/api/pos/sale/route.ts` | Server proxy for `process_kiosk_sale`. Reads httpOnly session cookie, validates role, calls RPC server-side, writes audit log. Rate-limited 30 req/min per IP. |
| `app/manifest.ts` | Next.js native PWA manifest route. Includes `start_url: /shop/catalog`, shortcuts for POS and Tienda. |
| `features/pos/hooks/index.ts` | POS hooks — `usePosProducts` (resilient loader), `usePosCart`, `usePosCheckout` (calls `/api/pos/sale`), `usePosCustomerSearch`, `usePosPaymentConfig`. |
| `features/pos/index.ts` | Public re-exports + constants (`CONSUMIDOR_FINAL_ID`, etc.). |
| `app/(pos)/pos/page.tsx` | Kiosk UI. `usePosCheckout` triggers `submitSale` which POSTs to `/api/pos/sale`. |
| `app/(pos)/layout.tsx` | Auth guard — redirects non-staff/non-admin users away. |
| `shared/components/install-pwa-button.tsx` | Floating PWA install CTA. Mounted in root layout so `beforeinstallprompt` is captured on every page. |
| `shared/components/auth-recovery-boot.tsx` | One-shot recovery: kills stale SDK session on first `/api/auth/refresh` 401/403. Also filters expected `stock_summary` 400 noise from the console. |
| `migrations/20260616000000_add-show-in-pos.sql` | Adds `products.show_in_pos BOOLEAN NOT NULL DEFAULT TRUE`. |
| `migrations/20260616000001_stock-summary-add-pos-fields.sql` | Rebuilds `stock_summary` to include `capacity_unit` and `show_in_pos`. |

---

## Architecture decisions

### 1. POS sales go through a server proxy, not the SDK

`process_kiosk_sale` is `SECURITY DEFINER` (`migrations/20260522000000_pos-kiosk-schema.sql`).
SECURITY DEFINER functions require PostgREST to be able to identify the
caller. The browser SDK sometimes holds the httpOnly cookie's
`edgeFunctionToken` in its HTTP client (via `resetBrowserClient` after
`getCurrentUser` returns null on mobile). PostgREST does NOT recognize
`edgeFunctionToken` as a user context — `auth.uid()` resolves to null and
the function fails with `AUTH_INVALID_CREDENTIALS / No token provided`.

`/api/pos/sale` (`app/api/pos/sale/route.ts:1`) bypasses the SDK entirely:

1. Reads the httpOnly `pauleam-session` cookie (XSS-immune).
2. Validates the session server-side via Insforge.
3. Gates by role: must be `sales_kiosk` or `admin`.
4. Validates every field of the body (UUIDs, finite numbers, ranges,
   max 50 items).
5. Calls `process_kiosk_sale` server-side with the operator's verified id.
6. Writes a `POS_SALE` audit row with a SHA-256 hash of the sale.
7. Returns the order id.

The browser only knows the proxy URL. The SDK is not involved.

### 2. `stock_summary` view: hand-curated, must be rebuilt on schema changes

The view's column list is explicit (not `SELECT p.*`). Adding a new
column to `products` does NOT propagate to the view. The pattern for
adding a new column the view should expose:

```sql
-- migrations/YYYYMMDDHHMMSS_<feature>.sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS new_column <TYPE> NOT NULL DEFAULT <DEFAULT>;

DROP VIEW IF EXISTS public.stock_summary CASCADE;
CREATE VIEW public.stock_summary AS
SELECT
  p.id            AS product_id,
  -- ... existing columns ...
  p.new_column,   -- <-- add the new column here
  public.get_stock_balance(p.id)   AS stock_actual,
  public.get_available_stock(p.id) AS stock_available
FROM public.products p
WHERE p.is_active = TRUE;

GRANT SELECT ON public.stock_summary TO authenticated, anon;
```

`CASCADE` is required because other views may depend on `stock_summary`.

### 3. Resilient POS product loader (3-tier fallback)

`features/pos/hooks/index.ts:57` — `loadPosProducts(db)` tries three
tiers in order, falling back if the previous one 400s:

| Tier | Query | Used when |
|------|-------|-----------|
| 1 | `stock_summary` with `show_in_pos` filter | Migration `20260616000001` applied |
| 2 | `stock_summary` without `show_in_pos` | Older view, column not yet added |
| 3 | `stock_summary` minimal select | Even older view |
| 4 | `products` table direct | View is broken or missing; stock shows 0 but UI works |

The SDK's HTTP client logs every 4xx via `console.error`. To keep the
console clean while the fallback chain runs, `AuthRecoveryBoot` filters
`console.error` calls that match `/stock_summary[\s\S]{0,400}400/`. All
other errors pass through.

### 4. Stale-session recovery on first 401/403

`shared/components/auth-recovery-boot.tsx:1`. The Insforge SDK stores
a `refresh_token` in localStorage. If that token becomes invalid (key
rotation, project switch, expired refresh), `getCurrentUser()` triggers
a refresh, the refresh 403s, the SDK retries forever. The recovery boot
patches `window.fetch` once; the first 401/403 from any URL containing
`/api/auth/refresh` triggers a localStorage wipe + hard reload. The user
lands on `/login?reason=session_recovered`.

### 5. PWA install banner

The `beforeinstallprompt` event fires per-origin when install criteria
are met. If the listener is mounted on a page that isn't reached (or is
replaced by a navigation guard), the event is suppressed by
`preventDefault()` and the native banner never appears, producing the
dev-tools warning: *"The page must call
beforeinstallpromptevent.prompt() to show the banner."* Fix: mount the
listener in the root layout (`app/layout.tsx:53`) so it's active on
every route. The `InstallPwaButton` component now lives in
`shared/components/install-pwa-button.tsx` and is mounted globally.

Required assets for `beforeinstallprompt` to fire:

- `public/manifest.webmanifest` (or Next 16's `app/manifest.ts` route).
  DO NOT have BOTH a static file in `public/` AND a Next metadata route —
  they conflict and Next returns 500.
- `public/sw.js` registered at scope `/`.
- HTTPS (Vercel prod/preview both qualify; localhost on Vercel dev also
  works in Chrome).

### 6. Image sources and CSP

Product and receipt images come from `https://cdn.insforge.dev` and
`https://<subdomain>.insforge.app`. The CSP `img-src` directive in
`proxy.ts:118` must allowlist BOTH — `*.insforge.dev` is a separate
host from `*.insforge.app` for CSP purposes.

---

## Diagnostic cheatsheet

### Symptom: POS page loads but products grid is empty

1. DevTools → Network → filter `stock_summary`.
2. Look for a `400 (Bad Request)` response.
3. Click the response → "Response" tab. PostgREST error message tells
   you which column is missing.
4. Apply the matching migration or rebuild `stock_summary`.

If you see `200` with empty array, the kiosk role may not match (POS
gates to `sales_kiosk` or `admin`).

### Symptom: Console shows infinite 403s on `/api/auth/refresh`

The SDK has a stale refresh token. Hard reload with DevTools → Application
→ Local Storage → right-click → Clear. Sign in again. The
`AuthRecoveryBoot` should auto-handle this; if it doesn't, the patch
has been disabled or the sessionStorage flag is stuck.

### Symptom: "AUTH_INVALID_CREDENTIALS" on `process_kiosk_sale`

The browser SDK is calling the RPC directly. This should never happen
in current code — `usePosCheckout` POSTs to `/api/pos/sale`. If you see
this, check that the import in `features/pos/hooks/index.ts` is using
`fetch("/api/pos/sale", ...)` and not `db.database.rpc(...)`.

### Symptom: PWA banner never shows

Check the manifest:

```bash
curl https://<your-domain>/manifest.webmanifest | head -20
```

Should return JSON with `name`, `start_url`, `icons[]`, etc., with
`Content-Type: application/manifest+json`. If you get HTML or a 404,
the manifest is misconfigured.

Check the service worker:

```js
navigator.serviceWorker.getRegistrations().then(r => console.log(r));
```

Should list `/sw.js` with scope `/`.

Check the install criteria:
- HTTPS (or localhost)
- Has a service worker with a `fetch` handler
- Has a manifest with at least one 192px and one 512px icon
- User has visited the site at least once (some browsers also require
  30s dwell time and a click)

### Symptom: Images not loading (red error in console)

CSP is blocking the source. Open DevTools → Console, look for
"Loading the image ... violates the following Content Security Policy
directive: img-src ...". The host in the error message must be added
to `img-src` in `proxy.ts:118`.

### Symptom: "Conflicting public file and page file" on /manifest.webmanifest

You have BOTH `public/manifest.webmanifest` AND `app/manifest.ts` (or
`app/manifest.webmanifest/route.ts`). Delete the public file; Next's
native manifest route takes precedence.

---

## How to apply a migration to the Insforge project

```bash
# If you have insforge CLI configured:
insforge db push migrations/20260616000001_stock-summary-add-pos-fields.sql

# Or via the Insforge dashboard → Database → SQL editor:
# Paste the migration SQL, run, verify the view definition.
```

Verify after applying:

```sql
-- Should include show_in_pos and capacity_unit
SELECT column_name FROM information_schema.columns
WHERE table_name = 'stock_summary'
ORDER BY ordinal_position;
```

Then hard reload the POS page. The 3-tier fallback will land on tier 1
(the new query), no warnings, no errors.

---

## Recovery: the user is stuck in a redirect loop

1. Hard-reload with `?reason=` query string visible: navigate to
   `/login?reason=session_recovered` directly.
2. If that still loops: open DevTools → Application → Cookies → delete
   everything for the current domain.
3. Application → Local Storage → right-click → Clear.
4. Application → Session Storage → right-click → Clear.
5. Hard reload. The proxy will see no cookies, the SDK has no token,
   the user lands on the login form.
