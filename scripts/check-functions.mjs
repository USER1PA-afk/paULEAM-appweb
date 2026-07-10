import { Client } from "pg";

const connectionString = process.argv[2];
const client = new Client({ connectionString });
await client.connect();

const { rows } = await client.query(`
  SELECT proname, prosecdef, proowner::regrole
  FROM pg_proc
  WHERE proname IN ('get_user_role', 'trg_production_request_notify_new', 'trg_production_request_status_change')
`);
console.log(rows);

const { rows: tables } = await client.query(`
  SELECT relname, relrowsecurity, relowner::regrole
  FROM pg_class
  WHERE relname IN ('production_requests', 'notifications')
`);
console.log(tables);

await client.end();
