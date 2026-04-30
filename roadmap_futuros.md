# PAuleam ERP — Pasos Futuros y Pendientes

## Estado Actual del Sistema

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 | ✅ Completa | Setup FSD, Next.js 16, Tailwind v4, TypeScript |
| Fase 2 | ✅ Completa | Backend SQL: 11 tablas, RLS, triggers PL/pgSQL, Edge Functions |
| Fase 3 | ✅ Completa | UI/UX Premium: layouts, CRUD productos, recetas, shop, checkout |
| Fase 4 | ✅ Completa | Auth flow, proxy de rutas, realtime, PDF reports, formularios |

---

## 🔜 Fase 5 — Autenticación Avanzada y Notificaciones

> Prioridad: **Alta** — impacta directamente la experiencia de usuario

### 5.1 OAuth (Google / GitHub)
- [ ] Integrar `insforge.auth.signInWithOAuth({ provider: 'google' })` en el `LoginForm`
- [ ] Crear página `/auth/callback` para manejar el retorno OAuth (PKCE flow)
- [ ] El SDK ya tiene `exchangeOAuthCode` y `detectAuthCallback` — solo falta el handler de ruta
- [ ] Agregar botones "Iniciar con Google" en `/login` y `/register`

```ts
// Ejemplo de implementación
const { data } = await insforge.auth.signInWithOAuth({
  provider: 'google',
  redirectTo: `${window.location.origin}/auth/callback`
});
```

### 5.2 Notificaciones por Email (Insforge Emails)
- [ ] Email de bienvenida al registrarse (`insforge.emails.send`)
- [ ] Notificación al admin cuando llega una nueva orden de venta
- [ ] Alerta de stock bajo (< umbral configurable) al admin/operario
- [ ] Notificación al cliente cuando su pago es aprobado/rechazado

### 5.3 Recuperación de Contraseña
- [ ] Página `/forgot-password` — formulario de email
- [ ] Página `/reset-password` — formulario de nueva contraseña con OTP
- [ ] Usar `insforge.auth.sendResetPasswordEmail` + `insforge.auth.resetPassword`

---

## 📊 Fase 6 — Reportes y Analytics

> Prioridad: **Media** — agrega valor de gestión sin impacto en operación diaria

### 6.1 Dashboard con Métricas Reales
- [ ] Gráfico de ventas por período (recharts o Chart.js)
- [ ] Gráfico de stock histórico por producto
- [ ] KPIs: margen de producción, tasa de aprovechamiento
- [ ] Comparativa mes vs mes anterior

### 6.2 Reporte de Costo de Producción
- [ ] Vista que cruce `production_orders` × `inventory_ledger` × `unit_cost`
- [ ] Calcular costo real de cada lote de producción
- [ ] Exportar a PDF con `window.print()` (ya configurado) o generar CSV

### 6.3 Reporte de Ventas
- [ ] Tabla de órdenes filtrable por estado, fecha, cliente
- [ ] Total facturado por período
- [ ] Exportar PDF / CSV

### 6.4 Trazabilidad de Lotes (Lots)
- [ ] Actualmente la tabla `lots` existe pero no se usa en la UI
- [ ] Pantalla de gestión de lotes con fecha de vencimiento
- [ ] Integrar `lot_id` en el formulario de ingreso de stock
- [ ] Alerta de lotes próximos a vencer

---

## 🏪 Fase 7 — E-Commerce Avanzado

> Prioridad: **Media** — mejora la experiencia del cliente

### 7.1 Categorías de Productos
- [ ] La tabla `categories` existe con RLS — falta la UI
- [ ] Filtro por categoría en el catálogo
- [ ] Gestión de categorías en el panel admin

### 7.2 Imágenes de Productos
- [ ] Formulario de upload de imagen en CRUD de productos (`insforge.storage`)
- [ ] Actualmente `image_url` existe en la tabla pero se gestiona manualmente
- [ ] Preview de imagen en el catálogo y carrito

### 7.3 Historial de Pedidos del Cliente
- [ ] Página `/shop/orders` — lista de pedidos del cliente autenticado
- [ ] Estado del pedido en tiempo real (Realtime subscription en canal `orders`)
- [ ] Descargar comprobante de pago subido

### 7.4 Búsqueda y Filtros en Catálogo
- [ ] Input de búsqueda por nombre/SKU en tiempo real
- [ ] Filtro por precio (rango)
- [ ] Ordenar por: precio, nombre, disponibilidad

---

## 🔒 Fase 8 — Seguridad y Hardening

> Prioridad: **Alta para producción**

### 8.1 Refresh de Token Automático
- [ ] Implementar `insforge.auth.refreshSession()` en un intervalo para sesiones largas
- [ ] Manejar el evento de expiración de sesión mostrando modal de re-login

### 8.2 Expiración de Cookie de Rol
- [ ] Actualmente `pauleam-role` dura 1 hora — reducir a 15 minutos en producción
- [ ] Renovar la cookie en cada carga de página del layout

### 8.3 Rate Limiting en Formularios
- [ ] Agregar debounce en el login (evitar brute force desde UI)
- [ ] Captcha opcional (no nativo en Insforge — se puede integrar con hCaptcha)

### 8.4 Auditoría de Acciones Admin
- [ ] Tabla `audit_log` en PostgreSQL (quién hizo qué y cuándo)
- [ ] Trigger que registra INSERT/UPDATE/DELETE en tablas críticas
- [ ] Vista de auditoría en panel admin (solo admin)

---

## 📱 Fase 9 — PWA y Mobile

> Prioridad: **Baja** — valor futuro

- [ ] Configurar `next-pwa` para modo offline básico
- [ ] `manifest.json` con íconos de la marca PAuleam
- [ ] Push notifications para alertas de stock (Web Push API)
- [ ] Optimización de imágenes con `<Image>` de Next.js

---

## 🐛 Deuda Técnica y Mejoras Menores

### Inmediatas
- [ ] **Ingredientes al crear receta**: actualmente se agregan después de crearla — considerar flujo de creación en un solo paso
- [ ] **Paginación en ledger de inventario**: la tabla puede crecer mucho sin paginación
- [ ] **Confirmación de eliminación**: el botón de eliminar ingrediente no tiene modal de confirmación (actualmente hace `window.location.reload()`)
- [ ] **Manejo de sesión expirada**: si el token expira durante una sesión activa, los hooks de Insforge fallan silenciosamente

### Refactoring
- [ ] Mover la lógica de "obtener rol post-login" a `useAuth` como `signInWithRedirect(email, password)`
- [ ] Reemplazar `window.location.reload()` en RecipeIngredientManager por invalidación de caché local
- [ ] Agregar `Suspense` boundaries en páginas admin para mejor UX de carga

---

## 📋 Checklist Pre-Producción

- [ ] Variables de entorno en servidor de producción (`NEXT_PUBLIC_INSFORGE_URL`, etc.)
- [ ] Dominio personalizado configurado
- [ ] RLS revisado y auditado por un DBA
- [ ] `npm audit` — sin vulnerabilidades críticas
- [ ] Imágenes de productos cargadas en Insforge Storage
- [ ] Usuarios de prueba eliminados del seed
- [ ] `AGENTS.md` y `CLAUDE.md` confirmados en `.gitignore`

---

> **Nota sobre OAuth**: La arquitectura ya está 100% preparada. El SDK de Insforge tiene `signInWithOAuth`, `exchangeOAuthCode` y `detectAuthCallback` implementados. Solo falta crear la página `/auth/callback/page.tsx` y los botones en el formulario de login. Tiempo estimado: ~2 horas de trabajo.
