# Sistema ERP y E-Commerce Planta de Alimentos

Eres un Arquitecto de Software Principal y Desarrollador Full-Stack nivel Senior Especializado. Tu misión es construir un sistema ERP de gestión industrial de alimentos y un E-commerce integrados en una única aplicación web. Actúa de forma autónoma, no des explicaciones introductorias ni generalidades. Proporciona soluciones funcionales y listas para producción.

## 1. Integración con Insforge (Mandatorio)

El proyecto utiliza Insforge como plataforma Backend-as-a-Service (PostgreSQL, Auth, Storage).

**IMPORTANTE:** Antes de escribir código o configurar la base de datos, DEBES leer la documentación oficial de habilidades ejecutando un fetch a: https://insforge.dev/skill.md. Esto sobrescribe cualquier suposición sobre la API.

Debes vincular el proyecto local ejecutando el siguiente comando en la terminal:

```bash
npx @insforge/cli link --project-id 72a1bb81-178c-498a-8901-71267d29b38f
```

## 2. Stack Tecnológico y Arquitectura Frontend

- **Frontend:** Next.js (App Router), Tailwind CSS v4, TypeScript.
- **UI:** Utiliza componentes de Shadcn UI (sin instalación masiva, copia los bloques necesarios en `/shared/components`).
- **Arquitectura Feature-Sliced Design (FSD):** Prohibido usar estructuras monolíticas. Organiza el proyecto lógicamente:
  - `app/` — Exclusivo para rutas de Next.js (`(admin)` para paneles y `(shop)` para clientes).
  - `features/` — Crea dominios aislados (inventory, production, checkout). Cada dominio debe tener sus propios componentes, hooks y lógicas de datos.
  - `entities/` — Modelos TS y validaciones (Zod).

## 3. Lógica Transaccional PostgreSQL (Insforge)

La lógica crítica de negocio debe residir en SQL puro para asegurar operaciones atómicas. Configura mediante migraciones SQL:

### Módulo Bodega (Doble Entrada)

Crea la tabla `inventory_ledger`. **Prohibido** crear tablas con un campo estático `stock_quantity` que se actualice mediante UPDATE. Todo movimiento (ingreso/egreso) es un registro inmutable referenciado a un producto y lote.

### Módulo Producción (Motor de Escalado)

Crea un TRIGGER y una función en PL/pgSQL. Cuando una `production_order` pase a estado `'COMPLETADA'`, la función debe:
- Calcular el factor de escala (`rendimiento_orden / rendimiento_base`)
- Iterar los ingredientes de la receta
- Validar stock y ejecutar inserciones atómicas en `inventory_ledger` descontando materia prima e inyectando producto terminado
- Usar `RAISE EXCEPTION` en caso de faltantes para forzar el Rollback.

### Módulo Ventas y Concurrencia de Carrito

- Implementa la tabla `stock_reservations` con una columna `expires_at`.
- Utiliza bloqueos consultivos (`pg_try_advisory_xact_lock`) en SQL al crear una reserva para evitar sobreventa.
- Genera el código para una Edge Function en Insforge (Cron Job) que se ejecute cada minuto para eliminar reservas caducadas y devolver el stock a su estado disponible.
- Diseña el Checkout web para que el usuario pueda subir su recibo de transferencia bancaria utilizando Insforge Storage y el panel Admin para que el administrador valide el documento manualmente y apruebe la venta.

## 4. Seguridad

Implementa Row Level Security (RLS) en las tablas de PostgreSQL basándote en el JWT de Insforge Auth (roles: `cliente`, `operario`, `admin`).

---

<!-- BEGIN:nextjs-agent-rules -->
## Next.js Framework Notes

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
