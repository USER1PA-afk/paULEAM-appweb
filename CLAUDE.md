@AGENTS.md

# PAuleam — ERP & E-Commerce (Planta de Alimentos)

## Arquitectura

- **Backend-as-a-Service:** Insforge (PostgreSQL, Auth, Storage)
- **Frontend:** Next.js App Router + TypeScript + Tailwind CSS v4
- **UI Components:** Shadcn UI (copiados en `shared/components/ui/`)
- **Estructura:** Feature-Sliced Design (FSD)

## Estructura de Carpetas (FSD)

```
ProjectPAuleam/
├── app/                          # Next.js App Router (SOLO rutas)
│   ├── (admin)/                  # Route group: Panel administrativo
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── inventory/
│   │   │   ├── production/
│   │   │   ├── orders/
│   │   │   └── layout.tsx
│   │   └── layout.tsx
│   ├── (shop)/                   # Route group: E-Commerce público
│   │   ├── shop/
│   │   │   ├── catalog/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── layout.tsx
│   │   └── layout.tsx
│   ├── (auth)/                   # Route group: Autenticación
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css
├── features/                     # Dominios aislados (FSD)
│   ├── inventory/                # Módulo Bodega
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── production/               # Módulo Producción
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── checkout/                 # Módulo Checkout/Ventas
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   └── auth/                     # Módulo Autenticación
│       ├── components/
│       ├── hooks/
│       └── lib/
├── entities/                     # Modelos TS + validaciones Zod
│   ├── product/
│   ├── recipe/
│   ├── order/
│   └── user/
├── shared/                       # Código compartido
│   ├── components/
│   │   └── ui/                   # Shadcn UI components
│   ├── hooks/
│   ├── lib/
│   │   └── insforge/             # Cliente Insforge
│   └── types/
├── insforge/                     # Edge Functions
│   └── functions/
│       └── cleanup-expired-reservations.js
├── migrations/                   # SQL Migrations (Insforge CLI)
│   ├── 20260427024507_create-base-schema.sql
│   ├── 20260427024514_create-rls-policies.sql
│   └── 20260427024517_create-production-trigger.sql
└── public/
```

## Reglas Críticas

1. **Inventario inmutable:** NUNCA usar `UPDATE` para stock. Todo movimiento es un INSERT en `inventory_ledger`.
2. **Lógica de negocio en SQL:** Triggers y funciones PL/pgSQL para operaciones atómicas.
3. **RLS obligatorio:** Todas las tablas con Row Level Security por roles JWT (`cliente`, `operario`, `admin`).
4. **Bloqueos consultivos:** `pg_try_advisory_xact_lock` para concurrencia en reservas de stock.
5. **FSD estricto:** `app/` solo contiene rutas. Lógica de negocio en `features/`. Modelos en `entities/`.

## SDK Insforge — API Correcta

```typescript
// Auth
auth.signUp({ email, password, name })          // async → { data, error }
auth.signInWithPassword({ email, password })     // async → { data, error }
auth.signOut()                                    // async → { error }
auth.getCurrentUser()                             // async → { data: { user }, error }
auth.refreshSession()                             // async → { data, error }
auth.getProfile(userId)                           // async → { data, error }

// Database (PostgREST)
database.from(table).select().eq().order()        // PromiseLike → { data, error }
database.rpc(fn, args)                            // async → { data, error }
// ⚠️ PromiseLike NO tiene .catch() ni .finally(), usar .then(onOk, onErr)

// Storage
storage.from(bucket).upload(path, file)           // async → { data, error }
storage.from(bucket).getPublicUrl(path)           // sync → string
```

## Insforge Project

- **Project ID:** `72a1bb81-178c-498a-8901-71267d29b38f`
- **AppKey:** `8i4ga35v`
- **API URL:** `https://8i4ga35v.us-east.insforge.app`
- **Functions URL:** `https://8i4ga35v.functions.insforge.app`
- **SDK:** `@insforge/sdk@1.2.5`
- **Documentación:** https://insforge.dev/skill.md

## Base de Datos — 11 Tablas

`profiles` · `categories` · `products` · `lots` · `inventory_ledger` · `recipes` · `recipe_ingredients` · `production_orders` · `orders` · `order_items` · `stock_reservations`

Vista: `stock_summary` | Funciones: `get_stock_balance`, `get_available_stock`, `reserve_stock`, `cleanup_expired_reservations`

## Storage Buckets

- `payment-receipts` (público) — Comprobantes de pago
- `product-images` (público) — Imágenes de productos

