# SCRIPT.md — PAuleam ERP Showreel (On-Screen Text)

This video has **no audio**. The "script" is the on-screen text that appears across the 8 beats, in the order it appears. All copy is in Spanish. No voiceover, no music, no sound effects.

Total on-screen text budget: ~140 words across 60s. Each line is timed to a specific moment in the storyboard.

---

## Beat 1 — Brand Hero (0.0–5.0s)

```
0.0s   [Ecuador flag stripe slides down]
0.3s   [Plant icon pops in]
0.5s   PAuleam
0.8s   Sistema ERP v2
1.5s   Gestión Integral de tu Planta        (5 words, stagger)
4.2s   ULEAM · Planta de Alimentos · 2026
```

## Beat 2 — Dashboard Pulse (5.0–12.0s)

```
5.4s   DASHBOARD
5.6s   Resumen general del sistema
6.0s   [Screenshot of dashboard scales in]
6.4s   [KPI counters tick up: 3, 1, 0, 1]
6.8s   [Stock list rows stagger in]
7.4s   [Stock Bajo amber badge starts pulsing]
8.0s   ● En vivo                           (green pulse, continuous)
```

## Beat 3 — Role 1: Cliente (12.0–22.0s)

```
12.0s  [CLIENTE badge, top-left]
12.2s  Compra y retira con código         (headline)
12.4s  [Shop catalog screenshot scales in]
12.8s  [3 product cards stagger in over screenshot]
14.5s  [Agregar button pulses on first card]
15.5s  [Pickup-code card slides up from bottom: y 60→0, back.out(1.6), 0.7s]
16.2s  Tu código de retiro                 (eyebrow inside card)
16.4s  PAU-                                (gray prefix, appears)
16.6s  79C209F3                            (8 chars type on, 0.48s total)
17.2s  Verificado ●                        (green check pulse, continuous)
21.0s  [hold, parallax drift]
```

## Beat 4 — Role 2: Operario (22.0–32.0s)

```
22.0s  [OPERARIO badge, top-left, persistent for 3 moments]

22.0s  1. RECETAS
22.2s  Materias Primas + Insumos
22.6s  [Recipes screenshot scales in]
25.0s  [hold]

25.3s  2. PRODUCCIÓN
25.5s  Lote PROD-2026-0001 generado automáticamente.
25.7s  [Production screenshot scales in]
26.5s  [PROD-2026-0001 chip bounces in, top-right of screenshot]
28.0s  [hold]

28.3s  3. EMPAQUE
28.5s  Plantilla + materiales consumidos en una corrida.
28.7s  [Packaging screenshot scales in]
31.0s  [hold]
```

## Beat 5 — Role 3: Administrador (32.0–44.0s)

```
32.0s  [ADMINISTRADOR badge, top-left, persistent]

32.0s  1. INVENTARIO
32.2s  Doble entrada inmutable. Cada movimiento es un registro.
32.4s  [Inventory screenshot scales in]
33.0s  [390,00 lt counter chip ticks up]
35.0s  [hold]

36.0s  2. PROVEEDORES
36.2s  Materia prima, insumos, envases.
36.4s  [Suppliers screenshot scales in]
37.0s  MATERIA_PRIMA                      (chip 1)
37.2s  INSUMO                             (chip 2)
37.4s  ENVASE_EMPAQUE                     (chip 3)
39.0s  [hold]

40.0s  3. ÓRDENES
40.2s  Aprueba o rechaza cada pedido.
40.4s  [Orders screenshot scales in]
41.5s  [Pulsing red ring draws around Aprobar button]
43.0s  [Green checkmark stamps on PAU-4D60C57E]
43.5s  [hold]
```

## Beat 6 — Role 4: Punto de Venta (44.0–52.0s)

```
44.0s  PUNTO DE VENTA                     (role badge, top-left)
44.0s  KIOSKO ACTIVO                      (green pill, top-right, breathing)
44.4s  [POS screenshot scales in]
45.0s  [3 product cards stagger in]
46.6s  [Selection ripple on first card]
47.2s  [Cart row appears]
47.6s  $1,00                             (TOTAL ticks up from $0,00)
48.6s  [Cobrar y Despachar button presses]
49.1s  Efectivo · QR Deuna · Sin recibo en pantalla
51.0s  [hold]
```

## Beat 7 — The Four Roles Grid (52.0–57.0s)

```
52.0s  [Grid container fades in]
52.3s  [Q1: CLIENTE pops in, blue badge, catalog thumbnail]
52.6s  [Q2: OPERARIO pops in, amber badge, recipes thumbnail]
52.9s  [Q3: ADMINISTRADOR pops in, red badge, orders thumbnail]
53.2s  [Q4: PUNTO DE VENTA pops in, green badge, POS thumbnail]
53.6s  CLIENTE        Compra en línea y retira con código PAU.
53.8s  OPERARIO       Recetas, producción y empaque con lote automático.
54.0s  ADMINISTRADOR  Inventario, proveedores y aprobación de pedidos.
54.2s  PUNTO DE VENTA Cobra en Efectivo o QR Deuna.
55.0s  [hold, screenshots breathe]
```

## Beat 8 — Tagline Close (57.0–60.0s)

```
57.0s  De la materia prima a la venta, en un solo sistema.
57.6s  [Plant icon SVG path draws]
58.4s  PAuleam                            (wordmark fades in)
58.6s  uleam.edu.ec · Planta de Alimentos · 2026
58.8s  [Red accent line draws across bottom]
60.0s  [end]
```

---

## Text inventory (for sub-agent reference)

| Element                         | Font     | Size  | Weight | Color    |
|---------------------------------|----------|-------|--------|----------|
| Headline (large)                | Inter    | 32px  | 700    | `#121212`|
| Headline (xl) — tagline         | Inter    | 36px  | 700    | `#121212`|
| Headline (huge) — pickup code   | Inter    | 64px  | 800    | `#CC0000`|
| Body                            | Inter    | 16px  | 400    | `#4A4A49`|
| Eyebrow / label                 | Inter    | 12px  | 500    | `#CC0000`|
| Role badge                      | Inter    | 14px  | 700    | `#FFFFFF` (on color bg) |
| Caption                         | Inter    | 14px  | 500    | `#4A4A49`|
| Footer                          | Inter    | 12px  | 500    | `#4A4A49` (opacity 0.6) |
| Chip label                      | Inter    | 11px  | 600    | (per chip color) |
| Pickup code (monospace)         | ui-monospace, "SF Mono", Consolas, monospace | 64px | 800 | `#CC0000` |
| Batch number (monospace)        | ui-monospace | 28px | 800 | `#CC0000` |
| Number (KPI tick-up)            | Inter    | 36px  | 800    | `#121212` (tabular-nums) |
| Price                           | Inter    | 18px  | 700    | `#CC0000` |

## Spanish copy rules

- Always use **comma** for decimals: `$1,50`, `390,00 lt`
- Use `·` (middle dot, not hyphen) as a separator
- "PAuleam" — capital P, lowercase Auleam
- Module names stay as the app uses them: "Inventario" (not "Stock"), "Producción" (not "Manufactura"), "Empaque" (not "Packaging"), "Punto de Venta" (not "POS")
- Status names in caps when used as UI labels: "OK", "PAGADO", "COMPLETADO", "PENDIENTE"
- SKU codes uppercase, monospace: "MP-003", "PROD-2026-0001", "EMP-2026-0001", "PAU-79C209F3"
- Currency: USD ($) — Ecuador uses the US dollar
- "ULEAM" is always uppercase
- No English words in copy
