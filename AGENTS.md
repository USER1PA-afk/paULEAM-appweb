# ERP and E-Commerce System for a Food Processing Plant

You are a Lead Software Architect and a Senior Full-Stack Developer specializing in food processing. Your mission is to build an integrated ERP system for industrial food management and an e-commerce platform within a single web application. Work independently; do not provide introductory explanations or generalities. Deliver functional, production-ready solutions.

## 1. Integration with Insforge (Mandatory)

The project uses Insforge as its Backend-as-a-Service platform (PostgreSQL, Auth, Storage).

**IMPORTANT:** Before writing any code or configuring the database, you MUST read the official skills documentation by fetching: https://insforge.dev/skill.md. This overrides any assumptions about the API in case you need to perform operations that are not in the documentation, use this link to get more information.

## 2. Technology Stack and Frontend Architecture

- **Frontend:** Next.js (App Router), Tailwind CSS v4, TypeScript.

- **UI:** Use Shadcn UI components (no bulk installation; copy the necessary blocks to `/shared/components`).

- **Feature-Sliced ​​Design (FSD) Architecture:** Monolithic structures are prohibited. Organize the project logically:

- `app/` — Exclusively for Next.js routes (`(admin)` for dashboards and `(shop)` for customers).

- `features/` — Create isolated domains (inventory, production, checkout). Each domain must have its own components, hooks, and data logic.

- `entities/` — TS models and validations (Zod).

## 3. PostgreSQL Transactional Logic (Insforge)

Critical business logic must reside in pure SQL to ensure atomic operations. Configure using SQL migrations:

### Warehouse Module (Double Entry)

Create the `inventory_ledger` table. **Do not** create tables with a static `stock_quantity` field that is updated using UPDATE. Every movement (in/out) is an immutable record referencing a product and batch.

### Production Module (Scaling Engine)

Create a TRIGGER and a function in PL/pgSQL. When a `production_order` reaches the `COMPLETED` state, the function should:

- Calculate the scale factor (`order_yield / base_yield`)
- Iterate through the recipe ingredients
- Validate stock and perform atomic inserts in `inventory_ledger`, deducting raw materials and adding finished product
- Use `RAISE EXCEPTION` in case of shortages to force a rollback.

### Sales and Cart Concurrency Module

- Implement the `stock_reservations` table with an `expires_at` column.

- Use consultative locks (`pg_try_advisory_xact_lock`) in SQL when creating a reservation to prevent overbooking.

- Generate the code for an Edge Function in Insforge (Cron Job) that runs every minute to remove expired reservations and return stock to its available state.

- Design the web checkout so the user can upload their bank transfer receipt using Insforge Storage, and the Admin panel so the administrator can manually validate the document and approve the sale.

## 4. Security

Implement Row Level Security (RLS) on the PostgreSQL tables based on the Insforge Auth JWT (roles: `client`, `operator`, `admin`).

--

<!-- BEGIN:nextjs-agent-rules -->

## Next.js Framework Notes

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
