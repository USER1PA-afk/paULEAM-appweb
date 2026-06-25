# STORYBOARD.md — PAuleam ERP Showreel

## Concept

**Message:** PAuleam es un ERP + e-commerce completo para plantas de alimentos. Cuatro roles — cliente, operario, admin y kiosko — cubren toda la cadena, desde la materia prima hasta la venta.

**Arc:** Reveal / Demonstration — opens with brand identity, establishes credibility through the dashboard, then tours each of the four roles in sequence showing real working screens. Closes with a unified role grid + tagline. The video "shows" rather than "tells."

**Audience:** B2B operations/IT managers at Latin American food plants, ULEAM academic stakeholders, and partner investors. Technical-comfortable, time-poor, will watch on mute (LinkedIn, embedded on landing page, sales deck auto-play).

**Brand voice:** Confident, industrial, direct. Spanish, action-led, no marketing fluff. Matches the app's own copy register ("Nuevo Ingreso", "Crear Orden", "Aprobar / Rechazar").

**Why this matters now:** A showreel of the actual running system — not a pitch deck. Every frame is real UI, captured today from the live deployment. The Ecuadorian flag tri-color stripe is the brand's signature element, repeated in every frame that includes a real screenshot.

**Single-sentence test:** "What makes this different from a generic ERP demo video?" Answer: it's the only one that shows the real app screens of a ULEAM-built food-plant system, with the Ecuadorian flag tri-color stripe as a visual signature, narrated in Spanish, with four clearly named roles.

## Global Direction

- **Format:** 1920×1080 landscape + 1080×1920 portrait (two separate compositions, shared storyboard)
- **Audio:** None. Silent video. All messaging is on-screen text. No music, no VO, no SFX.
- **Style basis:** DESIGN.md — Inter font, red `#CC0000` + ULEAM green `#94C11F`, Ecuador flag tri-color stripe, flat clean cards, 10px radius, no shadows.
- **Pacing:** Moderate with arc — 8 beats total, durations 5–10s each, 60s total. Slow hero opener, brisk middle, emphatic close.
- **No text-effects skill** — on-screen text uses GSAP tweens (type-on, stagger-up, scale-in) directly. The text-effects catalog is overkill for this brand.

## Architecture

- **Landscape (1920x1080):** main app screenshot fills 80% of frame (centered, with deliberate top 12% reserved for the Ecuador flag stripe + role badge + headline) and bottom 8% for the caption. Each beat's screenshot is a real captured PNG.
- **Portrait (1080x1920):** app screenshot is a phone-width column (60% width, vertically centered) with headline above and caption below. The Ecuador flag stripe runs vertically along the right edge as a brand signature.
- **No HTML-in-Canvas needed** — the screenshots are 1920x1080, 16:9; placing them as `<img>` in scaled containers is sufficient. No 3D mockups. No device frames (we want to show the app, not frame it).
- **No shader transitions** between beats — silent video + clean cuts reads more professional than flashy. Use a 200ms CSS crossfade with a 3-frame hold-overlap so the stripe transitions smoothly.
- **Each beat is independent** — `compositions/beat-N.html`. Shared index.html orchestrates the timeline.

## Required Capabilities (scan)

Standard GSAP / CSS / HTML toolkit. No shader transitions, no Lottie, no WebGL. The hyperframes-cli confirms: TTS Kokoro present, FFmpeg present, Chrome present.

## Asset Audit

**Captured assets (real product):**
- `capture/screenshots/admin/01-dashboard.png` — Dashboard with 4 KPI cards (Productos 3, Stock Bajo 1, Producción 0, Ventas 1) and "Acciones Rápidas" list
- `capture/screenshots/admin/02-inventory.png` — Inventory double-entry table (Materias Primas, Insumos, Envases, Productos a Granel)
- `capture/screenshots/admin/03-products.png` — Products master list
- `capture/screenshots/admin/04-store-products.png` — E-commerce product admin (with images, prices, "Destacado" badge)
- `capture/screenshots/admin/05-recipes.png` — Recipes list (Materias Primas + Insumos only — DB-enforced)
- `capture/screenshots/admin/06-production.png` — Production orders with batch numbers (PROD-YYYY-NNNN)
- `capture/screenshots/admin/07-packaging.png` — Packaging orders (EMP-YYYY-NNNN)
- `capture/screenshots/admin/08-packaging-templates.png` — Packaging templates with material lists
- `capture/screenshots/admin/09-suppliers.png` — Supplier list
- `capture/screenshots/admin/10-orders.png` — Sales orders (PAU-XXXXXXXX pickup codes, Aprobar/Rechazar buttons)
- `capture/screenshots/admin/11-notifications.png` — Admin notifications
- `capture/screenshots/admin/12-settings.png` — Settings page
- `capture/screenshots/admin/13-pos-kiosk.png` — POS kiosk: product grid (left), cart panel + Efectivo/QR Deuna payment (right)
- `capture/screenshots/admin/14-shop-catalog.png` — Shop catalog (3 product cards: Chifle, Queso Manaba, Requesón)

**Pending:** none. Beat 3 simplified to use admin's shop catalog + a composed pickup-code card (the actual `PAU-79C209F3` code is a real-format example from the app's pickup-code generator; the card itself is composed but brand-consistent).

**Brand assets:** PAuleam logo wordmark + "Sistema ERP v2" label (rendered in CSS using the small plant icon SVG captured in `capture/assets/svgs/`).

**Asset usage plan:**

| Asset                                  | Beat | Role         |
|----------------------------------------|------|--------------|
| Ecuador flag tri-color stripe (CSS)    | All  | Brand signature, top of every frame |
| PAuleam logo + "Sistema ERP v2"        | 1, 8 | Brand mark, opener + closer |
| 01-dashboard.png                       | 2    | Primary visual — KPI dashboard |
| 14-shop-catalog.png + composed pickup-code card | 3 | Cliente role — catalog + giant PAU- code |
| 05-recipes.png + 06-production.png + 07-packaging.png | 4 | Operario role — recipes → production → packaging |
| 02-inventory.png + 09-suppliers.png + 10-orders.png | 5 | Admin role — inventory → suppliers → orders |
| 13-pos-kiosk.png                       | 6    | Kiosko role — POS interface |
| 14-shop-catalog + 05-recipes + 10-orders + 13-pos-kiosk (mini thumbnails) | 7 | 2x2 grid — "all four roles" |
| 11-notifications.png                   | SKIP | Less critical for the showreel |
| 12-settings.png                        | SKIP | Admin area, not a role demo |
| 04-store-products.png                  | SKIP | Not used — 14-shop-catalog is the cliente visual |
| 03-products.png                        | SKIP | Covered by 04-store-products (more visually rich) |
| 08-packaging-templates.png             | SKIP | 07-packaging.png is enough for the operario beat |

---

## BEATS

Format: `Beat N (time) — Concept | Visual | Composition | Text | Timing`

---

### BEAT 1 — BRAND HERO (0.0–5.0s)

**Concept:** A silent, confident opener. The Ecuador flag tri-color stripe slides down from the top edge of the frame. The PAuleam logo assembles from the bottom up. The tagline "Gestión Integral de tu Planta" types on character by character. This beat establishes brand and stakes a claim: this is a professional industrial system built by a real institution.

**Visual:** White background (`#FFFFFF`). Tri-color stripe at top (yellow `#FCD116` 4px, blue `#003893` 4px, red `#CC0000` 4px = 12px total, full width). Logo: small plant icon SVG (16x16) + "PAuleam" wordmark in Inter 800, 64px, color `#CC0000`. Below: "Sistema ERP v2" in Inter 500, 14px, `#4A4A49`. Below that: tagline in Inter 700, 36px, `#121212`. Bottom 15% of frame: subtle "ULEAM · Planta de Alimentos · 2026" in monospace 11px, opacity 0.5, centered.

**Composition:**
- **Techniques:** GSAP timeline (techniques #1) · staggered word entrance (techniques #4) · character-by-character typing via `tl.set` per character (techniques #15)
- **Ecuador stripe:** `clipPath` reveals from `inset(0 0 100% 0)` to `inset(0)` over 0.4s, power2.out
- **Logo:** plant icon scales `0.3→1` with `back.out(1.6)` over 0.5s; "PAuleam" wordmark fades up + slight `y: 12→0` over 0.5s, 0.15s after icon
- **Tagline:** 5 words stagger in (`y: 20→0, opacity: 0→1`, `power3.out`, 0.5s each, 0.08s apart) starting at 1.5s
- **Subtitle "Sistema ERP v2":** fades in at 0.8s, `power2.out`
- **Footer ULEAM line:** fades in at 4.2s, 0.4s
- **Camera motion:** subtle dolly — entire content drifts `y: 0→-6px` over the 5s (gentle lift)

**Text:**
- "PAuleam" (wordmark)
- "Sistema ERP v2"
- "Gestión Integral de tu Planta"
- "ULEAM · Planta de Alimentos · 2026"

**Transition in at:** 0.0s · **GSAP duration:** 5.0s
**Animation sequence:** stripe slides down → icon pops in → wordmark + subtitle stagger up → tagline word-stagger → footer → 0.8s hold

---

### BEAT 2 — DASHBOARD PULSE (5.0–12.0s)

**Concept:** "Resumen general del sistema." The dashboard screenshot is the credibility beat. The four KPI numbers (Productos 3, Stock Bajo 1, Producción 0, Ventas 1) tick up from 0 to their real values. A "Stock Bajo" warning badge pulses. The stock list rows stagger in. Viewer sees the system is alive, not mocked up.

**Visual:** White background, Ecuador stripe at top (4-12px, full width). Centered: `01-dashboard.png` at 80% width, 4% padding, with a subtle drop "card" border (1px `#E5E5E5` since the app has no shadows but this is the only beat where a soft shadow is acceptable for depth). Top: red "DASHBOARD" eyebrow label (Inter 500, 12px, uppercase, letter-spacing 0.1em) + "Resumen general del sistema" headline (Inter 700, 28px, `#121212`). Bottom-right: a small green "● En vivo" pulse indicator.

**Composition:**
- **Techniques:** GSAP timeline · staggered row entrance (techniques #4) · counter tick-up via `tl.set` on text content (techniques #15) · pulse animation (techniques #9)
- **Screenshot entrance:** scales `0.96→1.0`, `y: 16→0`, opacity `0→1`, 0.6s, `power2.out`
- **KPI counters** (overlay divs positioned over the 4 dashboard cards): 4 `tl.set` text tweens that count from 0 → real value over 1.2s, `power2.out`, started 0.4s after screenshot settles
- **"Stock Bajo" amber badge** overlay: `pulse` (scale 1 → 1.08 → 1, 1.4s, sine.inOut, yoyo) starting at 3.0s
- **Stock list rows** (overlay divs on the right card): 3 rows stagger in (`y: 12→0, opacity: 0→1`, 0.4s each, 0.1s apart) starting at 1.8s
- **"En vivo" pulse:** scale + opacity breathe, 1.6s sine.inOut yoyo, continuous
- **Camera motion:** slight dolly-in `scale: 1.0 → 1.02` over 7s

**Text:**
- "DASHBOARD" (eyebrow)
- "Resumen general del sistema" (headline)
- Numbers tick up: "3", "1", "0", "1" (the actual KPI values)
- "En vivo" (pulse indicator)

**Transition in at:** 4.8s · **GSAP duration:** 7.0s
**Animation sequence:** screenshot scales in → 0.4s pause → counters tick up → rows stagger in → badge pulses → "en vivo" breathes throughout

---

### BEAT 3 — ROLE 1: CLIENTE (12.0–22.0s)

**Concept:** "El cliente compra en línea." A single shot of the public shop catalog, then a pickup code card lands as the hero. The pickup code is the brand's most shareable element — every order gets one (`PAU-XXXXXXXX`), generated client-side from the order UUID. We make it the visual payoff of the entire beat: it bounces in with `back.out(1.8)`, types on character-by-character, then a green dot stamps a "verificado" confirmation.

**Visual:** White background, Ecuador stripe at top. The shop catalog screenshot (`14-shop-catalog.png`) is the background context at 80% width, top 60% of frame. A floating white card (1px `#E5E5E5` border, 10px radius, 32px padding) overlays the bottom 40% of the frame, centered, containing: "Tu código de retiro" eyebrow + the giant pickup code "PAU-79C209F3" in monospace red, plus a small "Verificado ●" indicator. Top-left red "CLIENTE" role badge. Headline above the card: "Compra y retira con código" (Inter 700, 32px, `#121212`).

**Composition:**
- **Techniques:** GSAP timeline · catalog screenshot scale-in · card slide-up + back.out overshoot · monospace big-number character-by-character reveal (techniques #15) · green check pulse
- **0.0–0.7s:** catalog screenshot entrance (scale 0.97→1, y 16→0, opacity 0→1, 0.7s, power2.out). 3 product cards stagger in (`y: 20→0`, 0.4s each, 0.1s apart) — overlay divs positioned over the cards
- **2.5s:** "Agregar" button on first card pulses (scale 1 → 1.05 → 1, 0.4s, power2.inOut)
- **3.5s:** pickup-code card slides up from `y: 60 → 0` with `back.out(1.6)`, 0.7s, opacity 0→1
- **4.2s:** "PAU-" prefix appears (Inter 500 28px, `#4A4A49`, no animation — instant)
- **4.4s:** 8-character hex code "79C209F3" types on character-by-character (tl.set on text, 0.06s per char, 0.48s total)
- **5.0s:** "Verificado ●" green dot pulses (scale 0 → 1 with back.out, then opacity 0.4 → 1.0 sine.inOut yoyo)
- **5.5–9.0s:** hold — subtle parallax drift on the catalog screenshot (y: 0 → -3px, 1.5s, sine.inOut, yoyo, repeat 1)
- **Camera motion:** static on the first 3.5s, slight `scale: 1.0 → 1.03` over the last 5.5s (subtle push toward the code)

**Text:**
- "CLIENTE" (role badge, top-left)
- "Compra y retira con código" (headline)
- "Tu código de retiro" (eyebrow inside card)
- "PAU-79C209F3" (giant monospace, types on)
- "Verificado ●" (green confirmation pulse)

**Transition in at:** 11.8s · **GSAP duration:** 9.0s
**Animation sequence:** catalog scales in → cards stagger → Agregar pulse → card slides up with overshoot → "PAU-" appears → 8-char code types on → check pulse → 3.5s parallax hold

---

### BEAT 4 — ROLE 2: OPERARIO (22.0–32.0s)

**Concept:** "El operario produce y empaca." Three rapid moments showing the production line: a recipe (Materias Primas + Insumos), a production order with a freshly-generated batch number, and a packaging template. Each is a "stamp" — a label slides in from the left, the screenshot pushes in from the right, then both fade out together. The batch number "PROD-2026-0001" is the visual payoff — it proves the system auto-generates unique identifiers.

**Visual:** White background, Ecuador stripe at top. The beat runs three mini-moments (~3.3s each):
- **Moment A (0.0–3.3s):** recipes screenshot (05-recipes.png) at 70% width, centered. Left-anchored red label: "1. RECETAS" (Inter 700, 14px, uppercase, letter-spacing 0.1em) + "Materias Primas + Insumos" (Inter 500, 22px, `#121212`)
- **Moment B (3.3–6.6s):** production screenshot (06-production.png) at 70% width. Label changes to "2. PRODUCCIÓN" + "Lote PROD-2026-0001 generado automáticamente." A red overlay chip with the batch number "PROD-2026-0001" (Inter 800, 28px, monospace) appears in the top-right corner of the screenshot, with a back.out bounce.
- **Moment C (6.6–10.0s):** packaging screenshot (07-packaging.png or 08-packaging-templates.png) at 70% width. Label changes to "3. EMPAQUE" + "Plantilla + materiales consumidos en una corrida."

**Composition:**
- **Techniques:** GSAP timeline · label slide-in (techniques #6) · screenshot scale-and-fade (techniques #2) · chip bounce (techniques #3) · text crossfade (techniques #1)
- **Each moment (0.0–3.3s):**
  - 0.0–0.4s: previous content fades out (opacity 1→0, scale 1→0.97, power2.in)
  - 0.0–0.4s: new label slides in from `x: -40 → 0` + fades up, 0.4s, power2.out
  - 0.2–0.9s: new screenshot scales in (`0.94 → 1.0`, `y: 12 → 0`, 0.7s, power2.out)
  - 1.2–2.0s: secondary text or batch chip appears (chip uses back.out(1.6), 0.5s)
  - 2.0–3.3s: hold (subtle parallax drift: screenshot y: 0→-3px, 1.3s, sine.inOut)
- **Camera motion:** none (rapid cuts feel rhythmic without dolly)

**Text:**
- "OPERARIO" (role badge, top-left, persistent)
- "1. RECETAS" / "Materias Primas + Insumos"
- "2. PRODUCCIÓN" / "Lote PROD-2026-0001 generado automáticamente." / "PROD-2026-0001" (chip)
- "3. EMPAQUE" / "Plantilla + materiales consumidos en una corrida."

**Transition in at:** 21.8s · **GSAP duration:** 10.0s
**Animation sequence:** 3 mini-moments × (label in → screenshot in → chip/text in → 1.3s hold)

---

### BEAT 5 — ROLE 3: ADMINISTRADOR (32.0–44.0s)

**Concept:** "El administrador controla todo." Three rapid moments showing the admin's breadth: inventory double-entry ledger, suppliers, and the orders approval queue (with the Aprobar/Rechazar buttons as the hero). The orders screenshot has a pulsing red ring around the Aprobar button to draw the eye — the admin's "power moment."

**Visual:** Same architecture as beat 4. White background, Ecuador stripe at top, "ADMINISTRADOR" badge top-left. Three mini-moments:
- **Moment A (0.0–4.0s):** 02-inventory.png at 70% width. Label: "1. INVENTARIO" + "Doble entrada inmutable. Cada movimiento es un registro." A green counter chip overlay animates: "390,00 lt" (the first stock entry) ticks up.
- **Moment B (4.0–8.0s):** 09-suppliers.png at 70% width. Label: "2. PROVEEDORES" + "Materia prima, insumos, envases. Un producto, N proveedores." Three category chips (MATERIA_PRIMA, INSUMO, ENVASE_EMPAQUE) stagger in below the label.
- **Moment C (8.0–12.0s):** 10-orders.png at 70% width. Label: "3. ÓRDENES" + "Aprueba o rechaza cada pedido." A pulsing red ring (animated SVG `<circle>` with stroke-dasharray) draws around the Aprobar button, then a green checkmark `<svg>` stamps in on the "PAU-4D60C57E" row.

**Composition:**
- **Techniques:** GSAP timeline · label slide-in · screenshot entrance · counter tick · pulsing SVG ring · SVG checkmark stamp (techniques #16)
- **Each moment follows the beat 4 pattern** (label in, screenshot in, hold)
- **Moment C additions:**
  - Red ring: SVG circle with `stroke-dasharray` 0 → circumference, 0.8s, `power2.out`, at 9.5s
  - Ring pulses (scale 1 → 1.05 → 1, 1.2s, sine.inOut, yoyo) twice
  - Checkmark stamp: SVG path with `stroke-dashoffset` 0 (drawn), 0.4s, at 10.8s. The path is a 24px checkmark, `#94C11F` stroke, 3px width
- **Camera motion:** subtle dolly-in on moment C only, `scale: 1.0 → 1.04` over 4s (focus pull toward the approval action)

**Text:**
- "ADMINISTRADOR" (role badge)
- "1. INVENTARIO" / "Doble entrada inmutable. Cada movimiento es un registro." / "390,00 lt" (chip)
- "2. PROVEEDORES" / "Materia prima, insumos, envases." / chip labels: "MATERIA_PRIMA", "INSUMO", "ENVASE_EMPAQUE"
- "3. ÓRDENES" / "Aprueba o rechaza cada pedido."

**Transition in at:** 31.8s · **GSAP duration:** 12.0s
**Animation sequence:** 3 mini-moments with richer micro-animations in the orders moment (ring draw → pulse → checkmark stamp)

---

### BEAT 6 — ROLE 4: PUNTO DE VENTA (44.0–52.0s)

**Concept:** "El kiosko cobra en segundos." The POS interface is the fastest, most product-shaped beat. The product grid (left half) gets 3 cards stagger-in, then a "selection" ripple happens on the first card (a CSS ring expands from the card center, signifying "added to cart"), then the right cart panel updates with a red "TOTAL $1,00" punch. The "Cobrar y Despachar" button has a back.out press animation.

**Visual:** Full screenshot of 13-pos-kiosk.png at 95% width, filling the frame (POS is a split-screen interface, so the whole frame IS the system). Top: red "PUNTO DE VENTA" badge top-left + "KIOSKO ACTIVO" green pill top-right (recreating the green indicator from the screenshot). Bottom: caption "Efectivo · QR Deuna · Sin recibo en pantalla" (Inter 500, 16px, `#4A4A49`).

**Composition:**
- **Techniques:** GSAP timeline · card stagger (techniques #4) · selection ripple (techniques #11) · number punch (techniques #15) · button press (techniques #3)
- **0.0–0.5s:** screenshot entrance (scale 0.97→1, y 12→0, opacity 0→1, 0.5s, power2.out)
- **0.5–2.0s:** 3 product cards stagger in (y 20→0, opacity 0→1, 0.4s each, 0.1s apart) — overlay divs positioned over the cards in the screenshot
- **2.0–2.6s:** selection ripple on first card (Chifle Alargado Manabita 150g) — expanding ring (`scale: 0 → 2.5`, opacity 0.6 → 0, 0.6s, power2.out, easeOut), centered on card
- **2.6–3.2s:** cart row appears (y 12→0, opacity 0→1, 0.4s, power2.out) — overlay div
- **3.0–4.0s:** total $0,00 → $1,00 ticks up (tl.set on text, 1s, power2.out)
- **4.0–4.5s:** "Cobrar y Despachar" button press (scale 1 → 0.95 → 1, 0.4s, power2.inOut, easeIn)
- **4.5–7.0s:** hold with subtle "KIOSKO ACTIVO" green pill breathing (opacity 0.85 → 1.0 → 0.85, 1.4s, sine.inOut, yoyo)
- **Camera motion:** none — POS layout is dense, hold the framing

**Text:**
- "PUNTO DE VENTA" (role badge)
- "KIOSKO ACTIVO" (green status pill, breathing)
- "Efectivo · QR Deuna · Sin recibo en pantalla" (caption)
- "$1,00" (TOTAL, ticking up from $0,00)

**Transition in at:** 43.8s · **GSAP duration:** 7.0s
**Animation sequence:** screenshot in → cards stagger → ripple → cart updates → total ticks → button press → 2.5s hold with breathing pill

---

### BEAT 7 — THE FOUR ROLES GRID (52.0–57.0s)

**Concept:** A 2x2 grid that recaps the four roles in one frame. Each quadrant has: a role badge (color-coded), a one-line description, and a small thumbnail of that role's signature screen. The grid assembles quadrant by quadrant (top-left first, then top-right, bottom-left, bottom-right) with a back.out overshoot. The Ecuador stripe remains at the top.

**Visual:** White background, Ecuador stripe at top. Centered 2x2 grid with 32px gutters. Each quadrant is a white card with 1px `#E5E5E5` border, 10px radius, 32px padding. Each contains:
- Top: a colored role badge (CLIENTE = blue `#3B82F6`, OPERARIO = amber `#F59E0B`, ADMINISTRADOR = red `#CC0000`, PUNTO DE VENTA = green `#94C11F`)
- Middle: a 320x180px scaled-down screenshot of that role's signature screen (catalog, recipes, orders, POS)
- Bottom: a one-line description in Inter 500 14px `#4A4A49`

**Composition:**
- **Techniques:** GSAP timeline · quadrant stagger (techniques #4) · back.out overshoot (techniques #3) · screen mini-zoom (techniques #1)
- **0.0–0.3s:** grid container fades in
- **0.3s onward:** 4 quadrants enter, 0.3s apart, each `scale: 0.7 → 1.0` with `back.out(1.6)`, 0.6s
  - Q1 top-left (CLIENTE, blue): 0.3s
  - Q2 top-right (OPERARIO, amber): 0.6s
  - Q3 bottom-left (ADMINISTRADOR, red): 0.9s
  - Q4 bottom-right (PUNTO DE VENTA, green): 1.2s
- **1.8s onward:** each quadrant's screenshot has a subtle continuous zoom (`scale: 1.0 → 1.03`, 2s, sine.inOut, yoyo) — staggered start
- **Camera motion:** static. The 2x2 grid is the whole frame.

**Text:**
- "CLIENTE" / "Compra en línea y retira con código PAU."
- "OPERARIO" / "Recetas, producción y empaque con lote automático."
- "ADMINISTRADOR" / "Inventario, proveedores y aprobación de pedidos."
- "PUNTO DE VENTA" / "Cobra enEfectivo o QR Deuna."

**Transition in at:** 51.8s · **GSAP duration:** 5.0s
**Animation sequence:** grid fades in → 4 quadrants pop in with back.out → screenshots breathe → 2s hold

---

### BEAT 8 — TAGLINE CLOSE (57.0–60.0s)

**Concept:** A 3-second closing statement. The PAuleam logo and tagline land together — the logo draws in via SVG path animation (the plant icon's outline), the tagline fades up, and a thin red accent line draws across the bottom. The viewer walks away with one sentence.

**Visual:** White background, Ecuador stripe at top. Centered:
- Line 1: "De la materia prima a la venta, en un solo sistema." (Inter 700, 36px, `#121212`)
- Line 2 (below): PAuleam logo (plant icon + "PAuleam" wordmark) at 80% scale
- Line 3 (footer): "uleam.edu.ec · Planta de Alimentos · 2026" (Inter 500, 12px, `#4A4A49`, opacity 0.6)
- A thin 2px red accent line (`#CC0000`) draws across the bottom 25% of the frame, full width

**Composition:**
- **Techniques:** GSAP timeline · SVG path draw (techniques #16) · word fade-up (techniques #1) · accent line draw (techniques #17)
- **0.0–0.6s:** tagline Line 1 fades up (`y: 16 → 0, opacity 0 → 1`, 0.6s, power3.out)
- **0.6–1.4s:** plant icon SVG path draws (`stroke-dasharray: <len>; stroke-dashoffset: <len> → 0`, 0.8s, power2.out)
- **0.9–1.2s:** "PAuleam" wordmark fades up (y 12→0, 0.3s, power2.out) — wordmark appears AFTER the icon finishes drawing
- **1.2–1.4s:** footer fades in (0.2s, power2.out)
- **1.4–2.0s:** red accent line draws across (scaleX 0→1, 0.6s, expo.out, transform-origin: left)
- **2.0–3.0s:** hold — entire composition gently drifts (y: 0 → -3 → 0, 1.0s, sine.inOut, yoyo, repeat 1)
- **Camera motion:** static

**Text:**
- "De la materia prima a la venta, en un solo sistema." (tagline)
- "PAuleam" (wordmark)
- "uleam.edu.ec · Planta de Alimentos · 2026" (footer)

**Transition in at:** 56.8s · **GSAP duration:** 3.0s
**Animation sequence:** tagline fades up → icon draws → wordmark + footer → accent line draws → 1s breathing hold

---

## Total

**60.0s · 8 beats · 2 formats (landscape 1920x1080 + portrait 1080x1920)**

| Beat | Time      | Duration | Role focus | Primary visual |
|------|-----------|----------|------------|----------------|
| 1    | 0.0–5.0s  | 5.0s     | (brand)    | Logo + tagline |
| 2    | 5.0–12.0s | 7.0s     | (system)   | Dashboard with KPI tick-up |
| 3    | 12.0–22.0s| 10.0s    | Cliente    | Shop catalog → cart + pickup code |
| 4    | 22.0–32.0s| 10.0s    | Operario   | Recipes → Production (lote) → Packaging |
| 5    | 32.0–44.0s| 12.0s    | Admin      | Inventory → Suppliers → Orders (aprobación) |
| 6    | 44.0–52.0s| 8.0s     | Kiosko     | POS full interface |
| 7    | 52.0–57.0s| 5.0s     | All four   | 2x2 role grid |
| 8    | 57.0–60.0s| 3.0s     | (brand)    | Tagline close |

## Brand Accents Pass

| Asset                                | Where (beat #) | Role                                                |
|--------------------------------------|----------------|-----------------------------------------------------|
| Ecuador flag tri-color stripe (CSS)  | All 8          | Brand signature, top of every frame (or right edge in portrait) |
| PAuleam logo (icon + wordmark)       | 1, 7, 8        | Brand mark: opener stamp, grid quadrant stamps, closer stamp |
| Real product screenshots (14)        | 2, 3, 4, 5, 6, 7 | Primary visuals — never composited, never rebuilt in CSS |
| 11-notifications.png                 | SKIP           | Less critical for the showreel — admin detail, not a role demo |
| 12-settings.png                      | SKIP           | Admin config, not a role demo                       |
| 03-products.png                      | SKIP           | Covered by 04-store-products (more visually rich)   |
| capture/assets/svgs/svg-f30ba208.svg | 1, 8           | Plant icon used in logo (path-draw in beat 8)        |

## Production Architecture

```
videos/erp-showcase/
├── index.html                    landscape orchestration
├── portrait-index.html           portrait orchestration
├── DESIGN.md                     (Step 1)
├── BRIEF.md                      (Step 2)
├── STORYBOARD.md                 THIS FILE
├── SCRIPT.md                     on-screen text (no VO)
├── capture/
│   ├── screenshots/
│   │   ├── admin/                14 admin screenshots
│   │   └── cliente/              (pending) cliente screenshots
│   ├── extracted/                tokens, fonts, styles
│   └── assets/svgs/              plant icon SVG
├── compositions/
│   ├── beat-1.html
│   ├── beat-2.html
│   ├── ...
│   ├── beat-8.html
│   └── portrait/
│       ├── beat-1.html
│       ├── ...
│       └── beat-8.html
├── snapshots/                    build-time validation
└── scripts/
    ├── shoot-admin.mjs
    └── shoot-cliente.mjs
```

## What this video is NOT (per Step 2 brief)

- No audio, no VO, no music, no SFX
- No Users, Audit, or Payments module screenshots
- No macOS/browser window chrome around the screenshots
- No 3D device mockups (the app screenshots ARE the visual)
- No shadows or gradients (app is flat)
- No English copy — Spanish only
- No filler/breathing micro-animations — every motion has a purpose
- No settled holds > 1.5s without continuous change
