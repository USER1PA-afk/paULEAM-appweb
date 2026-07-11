import { Client } from "pg";

const connectionString = process.argv[2];
const client = new Client({ connectionString });
await client.connect();

const { rows } = await client.query(`
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('production_requests', 'notifications', 'profiles')
  ORDER BY tablename, policyname
`);
console.log(rows);
await client.end();
