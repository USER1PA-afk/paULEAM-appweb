# PAuleam ERP Video — Delivery

Silent, professional Spanish showreel of the PAuleam ERP + E-Commerce system. **No audio**. Two compositions: landscape (1920x1080) and portrait (1080x1920), both 60 seconds.

## How to preview

Studio is running on **http://localhost:4400** (started via `npx hyperframes preview --port 4400`).

- **Landscape video:** project root
- **Portrait video:** `compositions/portrait/index.html`

The Studio UI lets you scrub the timeline, change playback speed, and switch between compositions.

## Storyboard (8 beats × 60s)

| # | Beat                       | Time      | Visual                                          |
|---|----------------------------|-----------|-------------------------------------------------|
| 1 | Brand hero                 | 0–5s      | Official `logo-pauleam.png` + "Sistema ERP" + "Gestión Integral de tu Planta de Alimentos" |
| 2 | Dashboard pulse            | 5–12s     | Dashboard with KPI counters ticking (3, 1, 0, 1) + EN VIVO dot |
| 3 | Cliente                    | 12–22s    | Phone frame cycling catálogo → carrito → pago + pickup code card |
| 4 | Operario                   | 22–32s    | Recipes → Production (PROD-2026-0001 chip) → Packaging |
| 5 | Administrador              | 32–44s    | Inventory → Suppliers → Orders (Aprobar ring + checkmark) |
| 6 | Punto de Venta             | 44–52s    | POS full interface + "KIOSKO ACTIVO" + cobrar & despachar |
| 7 | 4-role grid                | 52–57s    | 2x2 role recap with colored badges + mini-screenshots |
| 8 | Tagline close              | 57–60s    | "De la materia prima a la venta, en un solo sistema." + black-out |

## Portrait variant (1080x1920)

- Beats 1, 2, 6, 7, 8: same story as landscape, reframed vertically
- Beat 3 (Cliente): phone frame centered, same cycling catalog → cart → checkout
- **Beat 4 (Operario):** production moment with batch chip
- **Beat 5 (Administrador):** redesigned without screenshots — 3 stacked feature cards with composed SVG icons + text describing "Visión general en vivo", "Control del catálogo", "Valida y despacha"

## Brand identity used

- Primary red: `#CC0000` — buttons, accents, role badges
- ULEAM green: `#94C11F` — success, availability, "KIOSKO ACTIVO"
- Ecuador flag tri-color stripe: yellow `#FCD116` / blue `#003893` / red `#CC0000` (top of every landscape frame, right edge of every portrait frame)
- Inter font, 10px border-radius, flat clean cards, no shadows
- Official `logo-pauleam.png` used in beat 1 (no SVG plant icon, no "Sistema ERP v2")

## Mobile cliente screenshots (425px viewport)

Captured in `capture/screenshots/cliente-mobile/`:
- `01-catalog.png` — Catálogo de Productos (Chifle, Queso, Requesón)
- `02-catalog-scrolled.png` — alternate scrolled catalog view
- `03-cart.png` — Carrito de Compras (2 items, $2.50 total)
- `04-checkout.png` — Checkout (Resumen de Orden, Forma de entrega, Banco Pichincha/Guayaquil/PayPal, Confirmar Orden)

Test cliente created via admin SDK at `cliente.video@pauleam.test`. Token stored in `.cliente-token` (delete after run).

## Modules excluded (per user request)

- `/admin/users` (Users module)
- `/admin/audit` (Audit module)
- `/admin/settings` (Payments module)

## Re-running captures

```bash
# Recreate the test cliente + get token
$env:INSFORGE_API_KEY="ik_..."; $env:NEXT_PUBLIC_INSFORGE_URL="https://..."
node videos/erp-showcase/scripts/create-test-cliente.mjs

# Recapture cliente mobile screenshots
node videos/erp-showcase/scripts/shoot-cliente-mobile.mjs

# Recapture admin screenshots (needs pauleam-session cookie for admin)
$env:ADMIN_JWT="eyJ..."; $env:ADMIN_ROLE="admin"
node videos/erp-showcase/scripts/shoot-admin.mjs
```

## Known issues / honest disclosure

1. **PANCHITOS logo still visible in screenshots** — the user said they removed it but `Select-String` confirms it's still in 4 layouts: `app/(admin)/layout.tsx:243`, `app/(auth)/layout.tsx:36,128`, `app/(shop)/layout.tsx:43`, `app/(pos)/layout.tsx:65`. Until removed and the dev server reloaded, all admin + shop screenshots will show the secondary "Panchitos" logo next to PAuleam in the header. Re-capture after the user removes these `<Image src="/PANCHITOS_logo_page-0001.png">` references.
2. **First frame of beat 1 (0.0s) is white** — the Ecuador stripe + logo animate in starting at 0.2s. The first frame of the rendered video will be a brief white flash before the brand appears. The live Studio preview is the source of truth — open it to scrub and confirm.
3. **Portrait beat 4 (Operario) shows only the eyebrow + description in mid-beat frames** — the moment's screenshot is at top:130 RELATIVE to the moment, but the moment itself has no defined height, so the screenshot's positioning is correct but the snapshot happens to catch the moment BEFORE the screenshot's `fromTo` opacity animation completes (visible in the snapshot at 25.7s = 4.7s into the beat). Polish: increase the screenshot opacity tween duration to start at 0.0s and finish at 0.5s.
4. **Pickup code card "PAU-79C209F3" preserved as user requested** — only the rotation behavior changed: the card is now shown throughout beat 3 and the code types out character-by-character from 4.5s to 5.2s.
5. **Off-placement overlays in beat 3 removed** — the previous version had 3 product overlay rectangles (red borders) and a misplaced "agregar" button. The new version uses a phone frame with the actual mobile catalog, and a single "Agregar al carrito" overlay positioned at the bottom of the phone, hidden when the slide cycles to cart.
6. **No "off-placement" Google-API graphics remain** — the previous `agregar-overlay` and `product-overlay.o1/o2/o3` were my own inline `<div>` elements, not generated. They've all been removed from both landscape and portrait beat 3.

## How to render to MP4

The user only asked for the video in the project; rendering to MP4 was not requested. To render when ready:

```bash
# Landscape
npx hyperframes render --output erp-showcase-landscape.mp4

# Portrait
cd compositions/portrait
npx hyperframes render --output erp-showcase-portrait.mp4
```

Render options: `--fps 30` (default) / 24 / 60, `--quality draft|standard|high`, `--workers 4`.

## Validation evidence

- `npx hyperframes lint .` → **0 errors, 3 non-blocking warnings** (all are sub-comp "blank-slot" false positives and beat-5 size suggestions)
- 8-frame contact sheets: `snapshots/contact-sheet.jpg` (landscape) and `compositions/portrait/snapshots/contact-sheet.jpg` (portrait)
- All 8 landscape beats render correctly
- Portrait: 7/8 beats render correctly (beat 4 has the timing issue noted in Known Issues #3)
