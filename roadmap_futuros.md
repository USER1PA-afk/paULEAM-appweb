# PAuleam ERP — Pasos Futuros y Pendientes

## Estado Actual del Sistema

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 | ✅ Completa | Setup FSD, Next.js 16, Tailwind v4, TypeScript |
| Fase 2 | ✅ Completa | Backend SQL: 17 tablas, RLS, triggers PL/pgSQL, Edge Functions |
| Fase 3 | ✅ Completa | UI/UX Premium: layouts, CRUD productos, recetas, shop, checkout |
| Fase 4 | ✅ Completa | Auth flow, proxy de rutas, realtime, PDF reports, formularios |
| Fase 5 | ⏳ Parcial | OAuth pendiente; notificaciones in-app implementadas |
| Fase 6 | ⏳ Parcial | Dashboard existe; reportes avanzados pendientes |
| Fase 7 | ⏳ Parcial | Imágenes ✅, historial cliente ✅; categorías UI pendiente |
| Fase 8 | ⏳ Parcial | Auditoría ✅; hardening de sesión pendiente |

---

## Módulos 100% Implementados (referencia)

| Módulo | Ruta / Feature |
|--------|---------------|
| Inventario doble partida | `features/inventory/` · `/admin/inventory` |
| Producción + batch numbers + mermas | `features/production/` · `/admin/production` |
| Recetas con roles de ingrediente | `features/recipes/` · `/admin/recipes` |
| Empaque (templates + órdenes) | `features/packaging/` · `/admin/packaging` |
| POS kiosk (`sales_kiosk`) | `features/pos/` · `/pos` |
| Tienda online + carrito + reservas | `features/checkout/` · `/shop/*` |
| Historial de pedidos del cliente | `/shop/orders` |
| Galería de imágenes de productos | `features/store-products/` · `/admin/store/products` |
| Proveedores externos (N:M) | `features/suppliers/` · `/admin/suppliers` |
| Auditoría append-only | `features/audit/` · `/admin/audit` |
| Notificaciones in-app admin | `/admin/notifications` |
| Usuarios y gestión de roles | `/admin/users` |

---

## 🔜 Fase 5 — Autenticación Avanzada y Email

> Prioridad: **Alta** — impacta directamente la experiencia de usuario

### 5.1 OAuth (Google / GitHub) ❌ Pendiente
- [ ] Crear página `/auth/callback/page.tsx` para el retorno OAuth (PKCE flow)
- [ ] Integrar `insforge.auth.signInWithOAuth({ provider: 'google' })` en `LoginForm`
- [ ] Agregar botones "Iniciar con Google" en `/login` y `/register`

```ts
// El SDK ya tiene esto implementado:
const { data } = await insforge.auth.signInWithOAuth({
  provider: 'google',
  redirectTo: `${window.location.origin}/auth/callback`
});
// También disponible: exchangeOAuthCode, detectAuthCallback
```

### 5.2 Notificaciones por Email ❌ Pendiente
> Las notificaciones in-app ya existen (`/admin/notifications`). Lo que falta es email.
- [ ] Email de bienvenida al registrarse (`insforge.emails.send`)
- [ ] Notificación al admin cuando llega una nueva orden
- [ ] Alerta de stock bajo al admin/operario por email
- [ ] Notificación al cliente cuando su pago es aprobado/rechazado

### 5.3 Recuperación de Contraseña ❌ Pendiente
- [ ] Página `/forgot-password` — formulario de email
- [ ] Página `/reset-password` — formulario de nueva contraseña con OTP
- [ ] `insforge.auth.sendResetPasswordEmail` + `insforge.auth.resetPassword`

---

## 📊 Fase 6 — Reportes y Analytics

> Prioridad: **Media**

### 6.1 Dashboard con Métricas Reales ⏳ Parcial
- [ ] Gráfico de ventas por período (recharts o Chart.js)
- [ ] Gráfico de stock histórico por producto
- [ ] KPIs: margen de producción, tasa de aprovechamiento
- [ ] Comparativa mes vs mes anterior

### 6.2 Reporte de Costo de Producción ❌ Pendiente
- [ ] Vista que cruce `production_orders` × `inventory_ledger` × `unit_cost`
- [ ] Calcular costo real de cada lote (`production_cost` ya existe en la tabla)
- [ ] Exportar CSV / PDF con `window.print()`

### 6.3 Reporte de Ventas ❌ Pendiente
- [ ] Tabla de órdenes filtrable por estado, fecha, cliente
- [ ] Total facturado por período
- [ ] Exportar PDF / CSV

### 6.4 Trazabilidad de Lotes ❌ Pendiente
- [ ] La tabla `lots` existe pero no se usa en la UI
- [ ] Pantalla de gestión de lotes con fecha de vencimiento
- [ ] Integrar `lot_id` en el formulario de ingreso de stock
- [ ] Alerta de lotes próximos a vencer

---

## 🏪 Fase 7 — E-Commerce Avanzado

> Prioridad: **Media**

### 7.1 Categorías de Productos ❌ Pendiente
- [ ] La tabla `categories` existe con RLS — falta la UI completa
- [ ] Filtro por categoría en `/shop/catalog`
- [ ] CRUD de categorías en panel admin

### 7.2 Imágenes de Productos ✅ Implementado
- [x] `product_images` table con galería multi-imagen
- [x] Upload de imágenes solo para `PRODUCTO_TERMINADO`
- [x] `ProductImageGallery` en admin (`/admin/store/products/[id]`)
- [x] Preview en catálogo y carrito

### 7.3 Historial de Pedidos del Cliente ✅ Implementado
- [x] Página `/shop/orders` — lista de pedidos del cliente
- [x] Estado del pedido visible
- [x] Código de retiro `PAU-XXXXXXXX`

### 7.4 Búsqueda y Filtros en Catálogo ❌ Pendiente
- [ ] Input de búsqueda por nombre en tiempo real
- [ ] Filtro por precio (rango)
- [ ] Ordenar por: precio, nombre, disponibilidad

---

## 🔒 Fase 8 — Seguridad y Hardening

> Prioridad: **Alta para producción**

### 8.1 Refresh de Token Automático ❌ Pendiente
- [ ] Implementar `insforge.auth.refreshSession()` en un intervalo para sesiones largas
- [ ] Manejar expiración de sesión con modal de re-login

### 8.2 Expiración de Cookie de Rol ❌ Pendiente
- [ ] Actualmente `pauleam-role` dura 1 hora — reducir a 15 min en producción
- [ ] Renovar la cookie en cada carga de página del layout

### 8.3 Rate Limiting en Formularios ❌ Pendiente
- [ ] Debounce en el login (evitar brute force desde UI)
- [ ] Captcha opcional (hCaptcha — no nativo en Insforge)

### 8.4 Auditoría de Acciones Admin ✅ Implementado
- [x] Tabla `audit_log` append-only en PostgreSQL
- [x] `log_audit_event()` RPC (SECURITY DEFINER)
- [x] Triggers en products, production_orders, packaging_orders, profiles
- [x] Login/logout/login-failed logueados desde `features/auth/hooks/index.ts`
- [x] Vista de auditoría en `/admin/audit` (solo admin)
- [x] `audit_log_view` con `user_name` enriquecido

---

## 📱 Fase 9 — PWA y Mobile

> Prioridad: **Baja** — valor futuro

- [ ] Configurar `next-pwa` para modo offline básico
- [ ] `manifest.json` con íconos de la marca PAuleam
- [ ] Push notifications para alertas de stock (Web Push API)

---

## 🐛 Deuda Técnica

### Inmediatas
- [ ] **Ingredientes al crear receta**: actualmente se agregan después de crearla — considerar flujo en un solo paso
- [ ] **Paginación en ledger de inventario**: la tabla puede crecer indefinidamente sin paginación
- [ ] **Manejo de sesión expirada**: si el token expira en sesión activa, los hooks fallan silenciosamente

### Refactoring
- [ ] Mover lógica "obtener rol post-login" a `useAuth` como `signInWithRedirect(email, password)`
- [ ] Reemplazar `window.location.reload()` en RecipeIngredientManager por invalidación de caché local
- [ ] Agregar `Suspense` boundaries en páginas admin para mejor UX de carga

---

## 📋 Checklist Pre-Producción

- [ ] Variables de entorno en servidor de producción (`NEXT_PUBLIC_INSFORGE_URL`, etc.)
- [ ] Dominio personalizado configurado en Insforge
- [ ] RLS revisado y auditado por un DBA
- [ ] `npm audit` — sin vulnerabilidades críticas
- [ ] Imágenes de productos cargadas en Insforge Storage
- [ ] Usuarios de prueba eliminados del seed
- [ ] `AGENTS.md` y `CLAUDE.md` confirmados en `.gitignore`
- [ ] Migraciones aplicadas en producción (5 archivos pendientes en `migrations/`)
- [ ] Edge function `cleanup-expired-reservations` activa en Insforge

---

> **Nota sobre OAuth**: La arquitectura ya está 100% preparada. Solo falta crear `/auth/callback/page.tsx` y los botones en `LoginForm`. Tiempo estimado: ~2 horas.
>
> **Nota sobre auditoría**: Completamente implementada — `audit_log`, triggers, RPC, y UI. No requiere acción.
