# BRIEF — PAuleam ERP Showreel

## What this video is

A **silent, professional showreel** of the PAuleam ERP + E-Commerce system, designed to **sell the platform** to B2B prospects in the food-processing industry and to academic/institutional stakeholders of ULEAM (Universidad Laica Eloy Alfaro de Manabí, Ecuador). The video is in **Spanish** with **no audio, no narration, no background music** — all messaging is on-screen text and visual storytelling.

## Hard constraints (from the user)

| Constraint        | Value                                                              |
|-------------------|--------------------------------------------------------------------|
| Type              | Product / system showreel                                          |
| Language          | Spanish (Latin American, all copy on screen)                       |
| Duration          | 60 seconds total (per format)                                      |
| Formats           | **1920x1080 landscape** + **1080x1920 portrait** (two separate compositions) |
| Audio             | **None.** No voiceover, no music, no sound effects.                 |
| Captions          | On-screen text only (built into compositions, not burned over)      |
| Modules excluded  | Users, Audit, Payments (per user request)                           |
| Modules included  | Dashboard, Inventory, Products, Store-Products, Recipes, Production, Packaging (+ templates), Suppliers, Orders, Notifications, Settings, POS, Shop catalog |
| Visual source     | Real screenshots of the running system, captured via Puppeteer     |

## Message (the ONE thing this video must say)

> **"PAuleam es un ERP + e-commerce completo para plantas de alimentos. Cuatro roles — cliente, operario, admin y kiosko — cubren toda la cadena, desde la materia prima hasta la venta."**

Translation: "PAuleam is a complete ERP + e-commerce for food plants. Four roles — customer, operator, admin, and kiosk — cover the entire chain, from raw materials to sale."

If the viewer walks away remembering one thing, it should be: **the four roles, in Spanish, working as one integrated system**.

## Narrative arc

```
HOOK        →  CONFIDENCE   →  ROLE TOUR (×4)              →  CLOSE
(0-5s)        (5-12s)         (12-52s, 4 × 10s each)        (52-60s)

Brand intro   Dashboard KPI   Cliente → Operario →         Tagline
+ tagline     fly-through     Admin → Sales Kiosk          + logo + role grid
```

### Beat-by-beat outline (60s total, 8 beats @ 7.5s avg)

| # | Beat              | Time      | What we show                                                       | Text on screen |
|---|-------------------|-----------|--------------------------------------------------------------------|----------------|
| 1 | Brand hero        | 0.0–5.0s  | Ecuador flag stripe, PAuleam logo slides in, tagline types on       | "PAuleam — ERP & E-Commerce · Planta de Alimentos" / "Gestión Integral de tu Planta" |
| 2 | Dashboard pulse   | 5.0–12.0s | Dashboard screenshot with KPI cards ticking up, stock list appearing| "Resumen general del sistema" |
| 3 | Role 1 — Cliente  | 12.0–22.0s| Shop catalog → cart → pickup code "PAU-XXXXXXXX"                   | "CLIENTE · Compra en línea" / "Retira con código PAU-..." |
| 4 | Role 2 — Operario | 22.0–32.0s| Recipes → Production order with batch number → Packaging template  | "OPERARIO · Produce y empaca" / "Lote PROD-2026-0001" / "Empaque EMP-2026-0001" |
| 5 | Role 3 — Admin    | 32.0–44.0s| Inventory ledger → Suppliers → Orders approval                     | "ADMINISTRADOR · Control total" / "Doble entrada inmutable" / "Aprueba y rechaza" |
| 6 | Role 4 — Kiosko   | 44.0–52.0s| POS: product grid → cart → "Cobrar y Despachar"                    | "PUNTO DE VENTA · Cobra en segundos" / "Efectivo · QR Deuna" |
| 7 | All four roles grid | 52.0–57.0s | 4-up grid showing each role's badge + one representative screen    | "Cliente · Operario · Administrador · Kiosko" |
| 8 | Tagline close     | 57.0–60.0s | PAuleam logo + tagline + "uleam.edu.ec" footer                     | "De la materia prima a la venta, en un solo sistema." |

Total: 60.0s. Each beat has an explicit visual plan; timing can flex ±0.5s.

## Audience

- **Primary:** Operations / IT managers at food processing plants in Latin America evaluating ERP options.
- **Secondary:** ULEAM academic stakeholders and partner institutions evaluating the project.
- **Tertiary:** Investors / grant committees.

The viewer is **technical-comfortable but time-poor** — they want to see the system working, not be lectured. The video must let the screenshots sell themselves.

## Tone

- **Confident, not boastful.** The app's own copy is direct and action-led ("Nuevo Ingreso", "Crear Orden", "Aprobar / Rechazar") — match that register.
- **Industrial and clean.** The visual language is flat, white-heavy, with red as the accent. No fluff, no marketing gradients.
- **Ecuadorian identity matters.** The tri-color flag stripe is on every page of the real product; including it in the video ties the system to the institution that built it.

## What this video is NOT

- Not a tutorial. We show what's possible, not how to click.
- Not a feature list. We show flow, not bullets.
- Not a marketing sizzle with stock food photography. Every frame is a real screenshot of the real system.
- Not narrated. All copy is on-screen text.
- Not music-driven. Motion is paced to the visual rhythm of the screenshots, not to a beat.

## Assets available

- 14 high-resolution admin screenshots in `capture/screenshots/admin/` (1920x1080 PNG, full-page).
- 1 login screenshot in `capture/screenshots/` (from the `hyperframes capture` run).
- (Pending) Cliente screenshots in `capture/screenshots/cliente/` — covers shop catalog, cart, checkout, orders from a customer's perspective.
- Design tokens: `capture/extracted/tokens.json` (20 colors, 3 fonts, 2 heading styles).
- Brand: `DESIGN.md` (visual identity, component styles, do's/don'ts).

## Composition strategy

- **Landscape (1920x1080):** single full-screen app screenshot per beat, with the role badge + caption anchored at the top or bottom. App screenshot fills 80% of the frame; remaining 20% holds the brand stripe + caption.
- **Portrait (1080x1920):** same beats, but app screenshot is cropped to a phone-width column (centered) with the caption block above or below. A larger text block (because vertical real estate is generous). The Ecuador flag stripe is rotated 90° (vertical) along the right edge as a brand signature.

## Approval needed

1. Is the message and narrative arc correct? (one-line feedback: "ok", or "more emphasis on X" / "skip beat Y")
2. Is the duration (60s) and format (landscape + portrait) correct?
3. Are the 4 roles and the module list right? (Users, Audit, Payments excluded)
4. Anything to add or remove from the beat outline?
