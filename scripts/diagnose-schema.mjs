import { Client } from "pg";

const connectionString = process.argv[2];
const client = new Client({ connectionString });
await client.connect();

const checks = [
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('production_requests', 'notifications')",
  "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_ledger' AND column_name = 'reserved_for_user_id'",
  "SELECT u.usename AS owner, c.relname AS view FROM pg_class c JOIN pg_user u ON u.usesysid = c.relowner WHERE c.relkind = 'v' AND c.relname = 'inventory_ledger_view'",
  "SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.production_requests'::regclass",
  "SELECT proname FROM pg_proc WHERE proname IN ('settle_production_request_balance', 'get_reserved_stock_not_owned')",
  "SELECT conname FROM pg_constraint WHERE conname = 'inventory_ledger_reference_type_whitelist'",
  "SELECT version, name FROM system.custom_migrations WHERE version >= '20260709000000' ORDER BY version",
];

for (const sql of checks) {
  console.log("\nQUERY:", sql.split("\n")[0], "...");
  const { rows } = await client.query(sql);
  console.log(rows);
}

await client.end();
