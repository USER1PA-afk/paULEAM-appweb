import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@insforge/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");

const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

const c = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL, anonKey: process.env.INSFORGE_API_KEY });
const { data: rows, error } = await c.database.from("product_images").select("id, product_id, storage_path, is_primary").order("created_at");
if (error) { console.error("DB error:", error); process.exit(1); }

const webp  = rows.filter((r) => r.storage_path.toLowerCase().endsWith(".webp"));
const other = rows.filter((r) => !r.storage_path.toLowerCase().endsWith(".webp"));

console.log(`Total: ${rows.length}  |  webp: ${webp.length}  |  non-webp: ${other.length}`);
console.log("");

for (const r of other) {
  const { data: blob } = await c.storage.from("product-images").download(r.storage_path);
  const webpPath = r.storage_path.replace(/\.[a-z0-9]+$/i, ".webp");
  const { data: webpBlob } = await c.storage.from("product-images").download(webpPath);
  const jpgs = [".jpg", ".jpeg", ".png", ".gif"].map((e) =>
    r.storage_path.replace(/\.[a-z0-9]+$/i, e)
  );
  let altFound = null;
  for (const alt of jpgs) {
    if (alt === r.storage_path) continue;
    const { data: altBlob } = await c.storage.from("product-images").download(alt);
    if (altBlob) { altFound = alt; break; }
  }
  console.log(`ROW ${r.id}  ${r.storage_path}`);
  console.log(`  current in bucket: ${blob ? "YES" : "NO "}`);
  console.log(`  .webp counterpart:  ${webpBlob ? "YES" : "NO "}`);
  if (altFound) console.log(`  alt-format present: ${altFound}`);
  console.log("");
}

for (const r of webp) {
  const cands = [".jpg", ".jpeg", ".png", ".gif"].map((e) =>
    r.storage_path.replace(/\.webp$/i, e)
  );
  let stale = null;
  for (const alt of cands) {
    if (alt === r.storage_path) continue;
    const { data: altBlob } = await c.storage.from("product-images").download(alt);
    if (altBlob) { stale = alt; break; }
  }
  console.log(`WEBP ${r.id}  ${r.storage_path}`);
  if (stale) console.log(`  ⚠ stale original still in bucket: ${stale}`);
  console.log("");
}
