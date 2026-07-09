-- Diagnostic: list every CHECK constraint on inventory_ledger.
-- Run this in the Insforge SQL console and compare to what
-- migration 20260708000009_defense-in-depth-constraints.sql
-- is supposed to install.

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.inventory_ledger'::regclass
  AND contype = 'c'
ORDER BY conname;

-- Also list product constraints
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.products'::regclass
  AND contype = 'c'
ORDER BY conname;
