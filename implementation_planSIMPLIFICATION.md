# Producción Unificada — Diseño Técnico Ejecutado

## Estado

> [!IMPORTANT]
> **Phase 1 (schema) + Phase 2 (RPC) — APLICADOS en DB**
> Archivo: [`20260712000000_unified-production-flow.sql`](file:///c:/Users/Alejandro-md/Desktop/ProjectPAuleam/migrations/20260712000000_unified-production-flow.sql)
> **Phase 3 (Frontend) — PENDIENTE de aprobación**

---

## Amendments aprobados y confirmados en el archivo físico

| # | Amendment | Implementación verificada (líneas) |
|---|-----------|-----------------------------------|
| 1 | No crear `product_packaging_materials` | Los materiales se leen directamente de `packaging_templates` (L477–486) + `packaging_template_materials` (L499–502) |
| 2 | Excluir empaque secundario (cajas/cartones) | Filtro `p2.type = 'ENVASE_EMPAQUE'` en L502; `MATERIAL_SECUNDARIO` excluido |
| 3 | No agregar `shrinkage_factor` a recipes | Ningún `ALTER TABLE recipes` en el archivo. `waste_kg` es campo manual en `unified_production_orders` |
| 4 | Costo proporcional por masa (no flat) | `v_pres_raw_cost = v_total_raw_cost × (total_kg_i / batch_kg)` en L468–470; `unit_cost_i = (v_pres_raw_cost + mat_cost_i) / units_i` en L561–569 |

---

## Fase 1 — Cambios de esquema ejecutados

### 1A — `recipe_ingredients.percentage NUMERIC(5,2)`

Columna añadida con backfill automático:
```sql
percentage = ROUND((quantity / yield_base) * 100.0, 2)
```
Solo filas donde `percentage IS NULL AND yield_base > 0`. Columna `quantity` conservada para compatibilidad con órdenes históricas.

### 1B — `inventory_ledger` CHECK constraint ampliado

Constraint `inventory_ledger_reference_type_whitelist` dropeado y recreado añadiendo `'PRODUCCION_UNIFICADA'` a la lista existente (que incluía `PRODUCCION_DEMANDA`, `VENTA_DEMANDA`, etc.).

### 1C — `enforce_finished_product_ingress` actualizado

`PRODUCTO_TERMINADO` ahora acepta INGRESO con `reference_type` en:
- `PRODUCCION` _(existente)_
- `PRODUCCION_DEMANDA` _(existente)_
- `PRODUCCION_UNIFICADA` ✓ **nuevo**
- `EMPAQUE` _(existente)_
- `AJUSTE` _(existente)_

`PRODUCTO_A_GRANEL` sigue restringido a `PRODUCCION` y `AJUSTE` únicamente.

### 1D — Nuevas tablas

**`unified_production_orders`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `recipe_id` | UUID FK→recipes | |
| `batch_kg` | NUMERIC(14,4) | Masa total del lote en kg |
| `status` | production_status | BORRADOR → COMPLETADA |
| `batch_number` | TEXT | Auto-generado PROD-YYYY-NNNN al completar |
| `scheduled_date` | DATE | Opcional |
| `actual_batch_kg` | NUMERIC(14,4) | = `batch_kg − waste_kg` al completar |
| `production_cost` | NUMERIC(14,4) | Costo total de MP+insumos (sin materiales de empaque) |
| `waste_kg` | NUMERIC(14,4) | Merma declarada manualmente en Block C de la UI |
| `notes`, `completed_at`, `created_by` | — | |

**`unified_production_presentations`**

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `order_id` | UUID FK→unified_production_orders CASCADE | |
| `product_id` | UUID FK→products | Debe ser PRODUCTO_TERMINADO (trigger valida) |
| `units_to_produce` | NUMERIC(14,4) | Unidades comerciales a obtener |
| `capacity_kg` | NUMERIC(14,4) | Snapshot de `products.capacity × unit_to_kg_factor(capacity_unit)` |
| `total_kg` | NUMERIC(14,4) | = `units_to_produce × capacity_kg` |
| `UNIQUE(order_id, product_id)` | — | Un producto por orden |

Trigger `trg_enforce_unified_presentation` valida que `product_id.type = 'PRODUCTO_TERMINADO'`.

### 1E — `inventory_ledger_view` reconstruida

Vista dropeada con CASCADE y recreada después de las nuevas tablas (para evitar forward reference). Añade:
- `upo.batch_number AS unified_batch_number` (LEFT JOIN a `unified_production_orders`)
- Label `'PRODUCCION_UNIFICADA' → 'Producción unificada'`

---

## Fase 2 — RPC `execute_unified_production(p_order_id UUID)`

`SECURITY DEFINER`, una sola transacción atómica. Cualquier `RAISE EXCEPTION` hace rollback completo.

### Paso 1 — Validaciones previas

1. Orden existe y está en `BORRADOR`
2. Al menos una presentación definida
3. `SUM(presentations.total_kg) ≤ batch_kg + 0.5` (tolerancia de redondeo)
4. `ABS(SUM(recipe_ingredients.percentage) − 100) ≤ 0.10`

### Paso 2 — EGRESO de ingredientes

Para cada ingrediente de la receta con `percentage IS NOT NULL`:

```
required_kg   = (percentage / 100) × batch_kg
required_qty  = convert_unit(required_kg, 'kg', product.stock_unit)
```

Verifica `get_stock_balance ≥ required_qty` → `RAISE EXCEPTION` si no alcanza.

INSERT `inventory_ledger` (`EGRESO`, `reference_type = 'PRODUCCION_UNIFICADA'`).

Acumula `v_total_raw_cost += required_qty × cost_per_unit`.

### Paso 3 — Por cada presentación: EGRESO materiales primarios

1. Busca `packaging_templates WHERE output_product_id = presentation.product_id AND is_active = TRUE LIMIT 1`
2. Si existe plantilla, itera `packaging_template_materials WHERE template_id = <found> AND p2.type = 'ENVASE_EMPAQUE'`
   - `MATERIAL_SECUNDARIO` (cartones, cajas) es **omitido** por el filtro de tipo
3. Calcula cantidad: unidades → directa; kg → `× unit_to_kg_factor(unit)`
4. Verifica stock → `RAISE EXCEPTION` si insuficiente
5. INSERT `inventory_ledger` (`EGRESO`, `reference_type = 'PRODUCCION_UNIFICADA'`)
6. Acumula `v_mat_total_cost` para esta presentación

### Paso 4 — INGRESO de cada presentación con costo proporcional

**Cálculo de costo** (fórmula proporcional por masa, aprobada en Amendment 4):

```
costo_MP_i    = v_total_raw_cost × (presentation.total_kg / batch_kg)
unit_cost_i   = (costo_MP_i + v_mat_total_cost_i) / units_to_produce_i
```

**WAC del catálogo** (mismo patrón que producción y empaque existentes):
```
if stock_before ≤ 0:
    wac = unit_cost_i
else:
    wac = (stock_before × old_cost + units_to_produce_i × unit_cost_i)
          / (stock_before + units_to_produce_i)
```

INSERT `inventory_ledger` (`INGRESO`, `reference_type = 'PRODUCCION_UNIFICADA'`).

UPDATE `products.cost_per_unit = wac` bajo `set_config('app.system_cost_update','true',true)` para pasar el guard `protect_auto_computed_cost`.

### Paso 5 — Cierre de la orden

```sql
UPDATE unified_production_orders SET
  status          = 'COMPLETADA',
  batch_number    = 'PROD-YYYY-NNNN',   -- next_batch_number('PROD')
  actual_batch_kg = batch_kg − waste_kg,
  production_cost = v_total_raw_cost,
  completed_at    = now()
WHERE id = p_order_id
```

### RLS

Ambas tablas nuevas con políticas estándar: `admin + operario` pueden SELECT/INSERT/UPDATE; solo `admin` puede DELETE en `unified_production_orders`.

---

## Lo que NO cambió (integridad histórica preservada)

| Objeto | Estado |
|--------|--------|
| `production_orders` + `trg_production_completion` | Sin cambios — órdenes antiguas siguen funcionando |
| `packaging_orders` + `trg_packaging_completion` | Sin cambios — historial de empaque intacto |
| `packaging_templates` + `packaging_template_materials` | Sin cambios — reutilizados directamente por el RPC |
| `PRODUCTO_A_GRANEL` (enum value) | Sin cambios — filas históricas del ledger lo referencian |
| `declare_production_waste` + `reverse_production_order` RPCs | Sin cambios — siguen operativos para órdenes antiguas |
| `recipe_ingredients.quantity` | Sin cambios — columna conservada para compatibilidad |

---

## Flujo de datos completo

```
Usuario define:
  receta + batch_kg → tabla de ingredientes (percentage × batch_kg)
  N presentaciones  → tabla de alertas de stock + balance de masa

INSERT unified_production_orders (BORRADOR)
INSERT unified_production_presentations (N filas)
         │
         ▼ [usuario confirma "Completar Lote"]
         │
RPC execute_unified_production(order_id)
         │
         ├─ Validar % suma = 100 ± 0.10
         ├─ Validar total_kg_presentaciones ≤ batch_kg + 0.5
         │
         ├─ EGRESO × len(ingredientes)
         │   cantidad = (pct/100) × batch_kg → convertida a stock_unit
         │
         └─ Por cada presentación_i:
               ├─ EGRESO × len(ENVASE_EMPAQUE de su packaging_template)
               │   cantidad = qty_per_unit × units_to_produce_i
               │
               └─ INGRESO de units_to_produce_i unidades
                   unit_cost_i = (raw_cost × kg_i/batch_kg + mat_cost_i)
                                 / units_to_produce_i
                   WAC actualizado en products.cost_per_unit
         │
         ▼
status = COMPLETADA
batch_number = PROD-YYYY-NNNN
production_cost = Σ costo MP + insumos
actual_batch_kg = batch_kg − waste_kg
```

---

## Phase 3 — Frontend (PENDIENTE)

Requiere aprobación antes de ejecutar.

### Archivos a crear/modificar

#### [MODIFY] `entities/recipe/index.ts`
- Añadir `percentage?: number | null` a `RecipeIngredientSchema`

#### [NEW] `entities/production/unified.ts`
- `UnifiedProductionOrder`, `UnifiedPresentation` — tipos TypeScript alineados con tablas nuevas

#### [NEW] `features/production/hooks/use-unified-production.ts`
- CRUD para `unified_production_orders` y `unified_production_presentations`
- Llamada al RPC `execute_unified_production`
- Lógica de validación de masa en cliente (espejo del Paso 1 del RPC)

#### [MODIFY] `app/(admin)/admin/production/page.tsx`
**Block A — Definición del lote**
- Selector de receta
- Input `batch_kg`
- Tabla dinámica: `(percentage/100) × batch_kg` por ingrediente con alert de stock

**Block B — Presentaciones comerciales**
- Añadir PRODUCTO_TERMINADO + cantidad de unidades
- Cálculo en tiempo real: `units × capacity_kg = X kg`
- Barra de balance de masa: total asignado vs `batch_kg`
- Botón "Completar Lote" deshabilitado hasta: balance dentro de tolerancia + todos los stocks suficientes

**Block C — Merma y cierre**
- Input `waste_kg` (manual, actualiza `unified_production_orders.waste_kg` antes de llamar el RPC)
- Historial de órdenes unificadas completadas

#### [MODIFY] `app/(admin)/admin/packaging/page.tsx`
- Banner de deprecación: módulo de empaque independiente desactivado
- Vista de solo lectura de órdenes históricas de `packaging_orders`

### Verificación post-frontend
1. Crear receta con porcentajes que sumen 100
2. Completar lote con 2 presentaciones (ej: 200g + 100g)
3. Verificar ledger: N EGRESOs ingredientes + M EGRESOs materiales + 2 INGRESOs terminados
4. Verificar WAC diferente para cada presentación (proporcional a su masa)
5. Verificar productos disponibles en POS y e-commerce
