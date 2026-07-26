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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

const c = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL, anonKey: process.env.INSFORGE_API_KEY });
const bucket = c.storage.from("product-images");

// Find all primary product_images rows and check that the parent product's image_url
// matches the public URL of that storage_path.
const { data: primaries, error } = await c.database
  .from("product_images")
  .select("id, product_id, storage_path, is_primary")
  .eq("is_primary", true);

if (error) { console.error("DB error:", error); process.exit(1); }

let drift = 0;
for (const p of primaries) {
  const want = bucket.getPublicUrl(p.storage_path);
  const { data: prod } = await c.database.from("products").select("id, name, image_url").eq("id", p.product_id).single();
  if (!prod) { console.log(`? ${p.id}  product ${p.product_id} missing`); continue; }
  const ok = prod.image_url === want;
  if (!ok) drift++;
  console.log(`${ok ? "✓" : "✗"} ${prod.name}  product_id=${p.product_id}`);
  console.log(`   row storage_path:  ${p.storage_path}`);
  console.log(`   products.image_url: ${prod.image_url}`);
  console.log(`   expected:           ${want}`);
  console.log("");
}
console.log(`Drift: ${drift} / ${primaries.length} primary image URLs out of sync with product_images`);
