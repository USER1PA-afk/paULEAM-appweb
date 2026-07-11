# DESIGN.md — PAuleam ERP Video

Brand cheat sheet for the HyperFrames build. Sub-agents receive the color/typography values below directly via prompt.

## 1. Brand identity

- **Name:** PAuleam — ERP & E-Commerce | Planta de Alimentos
- **Owner:** ULEAM (Universidad Laica Eloy Alfaro de Manabí, Ecuador) — Planta de Alimentos
- **Type:** Integrated ERP + e-commerce for a food processing plant (Manabí, Ecuador)
- **Tagline (login page H2):** "Gestión Integral de tu Planta"
- **Value line (login page body):** "Inventario, producción, recetas y ventas en un solo lugar. Control total de tu operación alimentaria con trazabilidad completa."
- **Module count:** 9 admin modules (Inventory, Production, Recipes, Packaging, Suppliers, Products, Store-Products, Orders, Notifications) + 4 roles (cliente, operario, admin, sales_kiosk)
- **Voice:** Professional, industrial, bilingual-friendly (UI is Spanish). Short, action-led copy: "Nuevo Ingreso", "Crear Orden de Producción", "Aprobar / Rechazar".
- **Audience for this video:** Potential B2B clients (food plants, dairy processors), academic stakeholders, and partner investors evaluating the system.

## 2. Color palette

Use these exact hex values. They are the CSS custom properties defined in the app.

| Token             | Hex       | Use                                        |
|-------------------|-----------|---------------------------------------------|
| `--color-brand-600` | `#CC0000` | Primary red — buttons, accents, alerts, logo text |
| `--color-brand-500` | `red`     | Same family — hover, secondary              |
| `--color-brand-50`  | `#FFF0F0` | Red tint background — destructive surfaces  |
| `--color-accent-500`| `#94C11F` | ULEAM green — success, "Kiosko Activo", availability dots |
| `--color-accent-400`| `#A0CE32` | ULEAM green lighter — alt status            |
| `--color-uleam-gray`| `#4A4A49` | Body / muted text                           |
| `--background`      | `#FFFFFF` | Page background                              |
| `--foreground`      | `#121212` | Headings, primary text                       |
| `--muted`           | `#F9F9F9` | Card alt surface, table headers              |
| `--muted-foreground`| `#4A4A49` | Secondary text                              |
| `--border`          | `#E5E5E5` | Card / table borders                         |
| `--warning`         | `#F59E0B` | Stock-bajo badge                             |
| `--info`            | `#3B82F6` | Production status                            |
| Ecuador flag stripe | `#FCD116` / `#003893` / `#CC0000` | Top 4px stripe on every page (Ecuadorian flag) |

**Brand-accent rule:** red `#CC0000` is the dominant brand color. Green `#94C11F` is ULEAM's institutional color and should appear in success states, availability dots, and the "KIOSKO ACTIVO" indicator. Never swap them.

**Status color logic (carry over from the app):**
- OK / success / disponible / aprobado → `#94C11F` (green)
- Pendiente / warning / stock-bajo → `#F59E0B` (amber)
- Rechazado / error / sin stock → `#CC0000` (red)
- Pagado / En proceso → `#3B82F6` (blue)

## 3. Typography

**Font family:** Inter, variable axis (100–900). Fallbacks: `system-ui, -apple-system, "Segoe UI", sans-serif`. Code: `__nextjs-Geist Mono`.

**Type scale (use the app's actual values):**

| Role     | Size | Weight | Line-height | Letter-spacing | Use                           |
|----------|------|--------|-------------|----------------|-------------------------------|
| Display  | 36px | 800    | 45px        | normal         | Hero H2 ("Gestión Integral…") |
| H1       | 24px | 700    | 32px        | -0.6px         | Page titles ("Dashboard")     |
| H2       | 20px | 700    | 28px        | normal         | Section titles                |
| H3       | 16px | 600    | 24px        | normal         | Card titles                   |
| Body     | 14px | 400    | 22.75px     | normal         | Body / descriptions           |
| Label    | 14px | 500    | 20px        | normal         | Form labels, table headers    |
| Caption  | 12px | 500    | 16px        | normal         | Status badges, hints          |
| Number / Stat | 36–48px | 800 | 1.1 | -1px        | KPI numbers on dashboard      |

**Tabular numbers for prices/quantities:** use `font-variant-numeric: tabular-nums` (or `font-feature-settings: "tnum"`) whenever displaying prices, SKUs, or stock counts. The app uses regular Inter which supports this.

**Spanish punctuation:** always use `,` for decimals (`$1,50`, `390,00 kg`), `.` for thousands, and ` ` (narrow space) as thousands separator when space allows.

## 4. Component styles

**Buttons:**
- Primary (`Iniciar Sesión`, `Agregar`, `Aprobar`): bg `#CC0000`, color `#FFFFFF`, padding `8px 16px`, radius `10px`, font 14px/500, no shadow, height 36–38px.
- Secondary (outlined): bg `#FFFFFF`, color `#121212`, border `1px solid #E5E5E5`, same padding/radius.
- Ghost: no border, color `#CC0000`, hover bg `#FFF0F0`.
- Disabled: opacity 0.5, no pointer.

**Cards / panels:** white bg, `1px solid #E5E5E5` border, radius `10px`, no shadow (the app is shadow-free). Generous padding `24px` on outer cards, `12px` on table cells.

**Tables:** row borders `#E5E5E5`, header row text in `--muted-foreground` weight 500 uppercase or sentence case, zebra off (clean white). Status cells = pill badge (e.g. `OK` green-50, `Pendiente` amber-50, `Sin stock` red-50).

**Inputs:** border `1px solid #E5E5E5`, radius `10px`, padding `10px 14px`, focus ring `#CC0000 2px`.

**Top bar:** height 64px, white bg, `1px solid #E5E5E5` bottom border, role badge as a red pill (`ADMINISTRADOR`, `OPERARIO`, `CLIENTE`, `KIOSKO`). The Ecuador flag tri-color stripe (`#FCD116` 4px / `#003893` 4px / `#CC0000` 4px) sits flush at the top of the page above the bar — this is a signature element.

**Sidebar (admin/operario):** 240px wide, white bg, active item = red bg `#FFF0F0` with red `#CC0000` text + red left border (3px). Inactive items: gray text `#4A4A49`, hover `#F9F9F9`.

## 5. Layout principles

- **Density:** comfortable. The app uses `space-y-6` between sections and `gap-4` inside grids. Do not pack information tighter than the app does.
- **Two-column main area:** sidebar (240px) + content (flex-1, max-width 1400px centered).
- **Top-of-page header:** H1 + subtitle (`text-muted-foreground` 14px), then `flex justify-between` row with action buttons on the right.
- **Grid cards on dashboard:** 4 equal columns on desktop (`lg:grid-cols-4`), each card has a colored icon tile (red/amber/blue) on the right.
- **Product grid (catalog):** 3–4 columns on desktop, each card = square image + name + price + `Agregar` button.
- **POS layout:** left 60% product grid, right 40% cart panel (sticky), bottom-right `Cobrar y Despachar` button (red, full width).
- **Pill / chip:** radius `999px`, padding `2px 10px`, font 12px/500, semantic bg + text.

## Do's and Don'ts

**Do:**
- Lean on red `#CC0000` for primary CTAs and brand moments. Pair with white + neutral grays.
- Show the Ecuador flag tri-color stripe at the top of any frame that uses real product screenshots — it identifies the brand instantly.
- Use the app's actual module names in captions: "Inventario", "Producción", "Recetas", "Empaque", "Tienda", "Punto de Venta", "Órdenes de Venta". Don't paraphrase ("Stock" → "Inventario").
- Use real prices in USD with comma decimals: `$1,50`, `$2,70`, `$390,00`. Currency is the US dollar (Ecuador).
- Show role badges: "ADMINISTRADOR", "OPERARIO", "CLIENTE" in the corner of the role-card frames.

**Don't:**
- Don't invent screen layouts. Always use the actual app screenshots.
- Don't use the green ULEAM color for primary CTAs (red owns the brand). Green is for success/availability.
- Don't add shadows, gradients, or glassmorphism — the app is flat and clean.
- Don't add background music, voiceover, or sound effects (user requirement: silent video).
- Don't include Users, Audit, or Payments module screenshots (user exclusion).
- Don't show the login page in the main flow (it's a transitional state, not a product feature).
- Don't use English copy in captions. The whole video is in Spanish.

## Animation direction (for Step 5)

Since there's no audio, the visuals carry the pacing. Use:
- **Staggered list reveals** (rows fade up one-by-one, 80ms apart) for tables and product grids.
- **Left-slide cards** for the role-intro frames (role card slides in from the left, screenshot from the right).
- **Number tick-up** for the dashboard KPI cards (count animates from 0 to its value over 1.2s).
- **Ecuador flag stripe** slides down from the top of the frame in the opening beat to establish brand.
- **Type-on headline** for the hero text: each word fades in 150ms apart.
- **Bezier easings:** `power2.out` for entrances, `power2.inOut` for transitions, `back.out(1.2)` for emphasis bounces (e.g. the "Aprobar" button on the orders page).
- **No screen-recording video.** Every "app view" is a static screenshot, not a screen capture. Motion is applied to the static image (parallax, zoom, crop-reveal).
