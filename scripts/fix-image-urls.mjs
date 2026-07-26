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

// Re-sync products.image_url for any product whose primary product_images row
// has a .webp storage_path but the product's own image_url is still on the
// old format.
const { data: primaries, error } = await c.database
  .from("product_images")
  .select("id, product_id, storage_path, is_primary")
  .eq("is_primary", true);
if (error) { console.error(error); process.exit(1); }

let fixed = 0;
for (const p of primaries) {
  const want = bucket.getPublicUrl(p.storage_path);
  const { data: prod, error: pErr } = await c.database
    .from("products")
    .select("id, name, image_url")
    .eq("id", p.product_id)
    .single();
  if (pErr) { console.log(`? skip ${p.id}: ${pErr.message}`); continue; }
  if (prod.image_url === want) continue;

  console.log(`✗ ${prod.name}`);
  console.log(`   current: ${prod.image_url}`);
  console.log(`   want:    ${want}`);

  const { error: uErr } = await c.database
    .from("products")
    .update({ image_url: want })
    .eq("id", p.product_id);
  if (uErr) {
    console.log(`   ✗ update failed: ${uErr.message ?? uErr}`);
  } else {
    console.log(`   ✓ fixed`);
    fixed++;
  }
}
console.log(`\nFixed: ${fixed} / ${primaries.length}`);
