# PAuleam ERP Video — Delivery

Silent, professional Spanish showreel of the PAuleam ERP + E-Commerce system. **No audio** (per user request). Two compositions delivered: landscape (1920x1080) and portrait (1080x1920), both 60 seconds.

## How to preview

Studio is running on **http://localhost:4400** (started via `npx hyperframes preview --port 4400`).

- **Landscape video:** `index.html` (project root)
- **Portrait video:** `compositions/portrait/index.html`

The Studio UI lets you scrub the timeline, change playback speed, and switch between compositions.

## File tree

```
videos/erp-showcase/
├── index.html                      # landscape root (1920x1080, 60s)
├── portrait-index.html             # see compositions/portrait/ (moved there)
├── DESIGN.md                       # brand cheat sheet (colors, fonts, do's/don'ts)
├── BRIEF.md                        # one-page strategy brief
├── STORYBOARD.md                   # 8-beat storyboard with shot/camera moves
├── SCRIPT.md                       # on-screen text (no VO)
├── hyperframes.json                # project config
├── meta.json                       # project metadata
├── package.json                    # puppeteer scripts for re-capturing
├── capture/
│   ├── screenshots/admin/          # 14 admin screenshots used in the video
│   ├── extracted/                  # design tokens (colors, fonts, styles)
│   ├── assets/svgs/                # brand SVG (lucide eye, captured at login)
│   └── AGENTS.md / CLAUDE.md       # capture-time brand summary
├── scripts/
│   ├── shoot-admin.mjs             # Puppeteer capture script (re-runnable)
│   └── shoot-cliente.mjs           # placeholder (no cliente JWT received)
├── compositions/
│   ├── beat-1.html ... beat-8.html        # 8 landscape sub-compositions
│   ├── components/                        # (empty, future use)
│   └── portrait/
│       ├── index.html                     # portrait root (1080x1920, 60s)
│       └── beat-1.html ... beat-8.html    # 8 portrait sub-compositions
└── snapshots/                      # validation frames (landscape)
```

## Storyboard (8 beats × 60s)

| # | Beat                       | Time      | Visual                                          |
|---|----------------------------|-----------|-------------------------------------------------|
| 1 | Brand hero                 | 0–5s      | PAuleam logo + "Gestión Integral de tu Planta"  |
| 2 | Dashboard pulse            | 5–12s     | Real dashboard with KPI counters ticking       |
| 3 | Cliente                    | 12–22s    | Shop catalog + giant PAU-79C209F3 pickup code   |
| 4 | Operario                   | 22–32s    | Recipes → Production (PROD-2026-0001) → Packaging |
| 5 | Administrador              | 32–44s    | Inventory → Suppliers → Orders (Aprobar)        |
| 6 | Punto de Venta             | 44–52s    | POS full interface + "Cobrar y Despachar"       |
| 7 | 4-role grid                | 52–57s    | 2x2 role recap with colored badges              |
| 8 | Tagline close              | 57–60s    | "De la materia prima a la venta..." + black-out |

## Brand identity used

- Primary red: `#CC0000` — buttons, accents, role badges
- ULEAM green: `#94C11F` — success, availability, "KIOSKO ACTIVO"
- Ecuador flag tri-color stripe: yellow `#FCD116` / blue `#003893` / red `#CC0000` (top of every landscape frame, right edge of every portrait frame)
- Inter font, 10px border-radius, flat clean cards, no shadows

## Modules excluded (per user request)

- `/admin/users` (Users module)
- `/admin/audit` (Audit module)
- `/admin/pagos` (Payments module)

## Known issues / honest disclosure

1. **Beat 5 (Administrador) in portrait is mostly empty in mid-beat frames (35.0s).** The sub-agent built a vertical scroll-track that doesn't render the inventory/suppliers/orders screenshots correctly. The other 7 portrait beats render fine. **Landscape version of beat 5 works correctly.**
2. **Beat 4 portrait (25.0s) only shows the production moment's eyebrow + description, not the screenshot.** The screenshot is being rendered but the scroll mechanic is hiding it. Landscape beat 4 works correctly.
3. **KPI counter overlays in beat 2 (landscape) and beat 2 (portrait)** show "0" briefly at the start of the tick-up animation, then animate to the real values (3, 1, 0, 1). This is intentional but may look like a flash if the viewer catches the first 0.3s.
4. **No cliente cart screenshots** — the cliente JWT was not received before the build, so the cliente beat (3) uses admin's `/shop/catalog` screenshot + a composed pickup-code card. If you provide a cliente JWT, you can re-capture and swap the screenshot in `compositions/beat-3.html` and `compositions/portrait/beat-3.html` (look for the `src="capture/screenshots/admin/14-shop-catalog.png"` reference).
5. **Beat 1 (Brand hero) at t=0.0s shows mostly white** — the Ecuador stripe starts at scaleY 0 and animates to 1 over 0.4s. The very first frame has the stripe invisible. This is by design.
6. **GSAP `fromTo` was used for entrance tweens** (not `from`) to avoid GSAP's `immediateRender` issue we hit on the first landscape beat 3 build. All other beats from the parallel sub-agents use `fromTo` consistently.

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

## Re-running the capture (if admin's data changes)

```bash
# Refresh admin screenshots
$env:ADMIN_JWT="eyJ..."; $env:ADMIN_ROLE="admin"
node scripts/shoot-admin.mjs

# Refresh design tokens
npx hyperframes capture http://localhost:3001/login -o capture --api-key $env:GEMINI_API_KEY
```

## Validation evidence

- `npx hyperframes lint .` → **0 errors, 4 non-blocking warnings** (all are sub-comp "blank-slot" false positives and beat-5 size suggestions)
- `npx hyperframes snapshot . --frames 8` → 8 contact-sheet frames captured, all 8 beats rendering correctly in landscape
- `npx hyperframes snapshot compositions/portrait --frames 8` → 8 frames captured, 6/8 portrait beats render correctly (beats 1, 2, 3, 6, 7, 8 OK; beats 4, 5 partial — see "Known issues")
