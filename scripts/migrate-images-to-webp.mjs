/**
 * scripts/migrate-images-to-webp.mjs
 *
 * One-shot migration: convert all existing product images in the
 * `product-images` bucket from their original format (jpeg/png/webp/gif/avif)
 * to a single 1920px-max WebP variant, and rewrite the DB rows that point at
 * them so the catalog, carousel, and detail pages all serve the new file.
 *
 * The original file is deleted from the bucket after a successful conversion
 * (decision: hard-delete — same as the upload pipeline).
 *
 * IDEMPOTENT: re-runs skip any step that's already done:
 *   - rows already pointing to a .webp storage_path are skipped
 *   - if the target .webp already exists in the bucket, upload is skipped
 *   - if the original is already gone, delete is skipped
 *
 * RETRY: each network/storage call is retried up to 2 times on transient
 * failures (fetch errors, 5xx, network resets) with a short backoff.
 *
 * USAGE:
 *   node scripts/migrate-images-to-webp.mjs                  # dry run, all
 *   node scripts/migrate-images-to-webp.mjs --apply          # actually convert
 *   node scripts/migrate-images-to-webp.mjs --apply --limit 5
 *   node scripts/migrate-images-to-webp.mjs --apply --product <uuid>
 *
 * EXIT CODES:
 *   0  success (dry-run always succeeds; --apply succeeds if no fatal errors)
 *   1  configuration error (env vars missing)
 *   2  fatal runtime error (DB unreachable, etc.)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createClient } from "@insforge/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, "..");

// ── 1. Parse args ────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const APPLY        = args.has("--apply");
const LIMIT        = (() => {
  const i = process.argv.indexOf("--limit");
  return i > -1 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();
const PRODUCT_FILTER = (() => {
  const i = process.argv.indexOf("--product");
  return i > -1 ? process.argv[i + 1] : null;
})();

// ── 2. Load .env.local ───────────────────────────────────────────────────
const envPath = resolve(ROOT, ".env.local");
if (!existsSync(envPath)) {
  console.error("✗ .env.local not found at", envPath);
  process.exit(1);
}

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val   = trimmed.slice(eq + 1).trim();
  if ((val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'")  && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = val;
}

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey  = process.env.INSFORGE_API_KEY;

if (!baseUrl || !apiKey) {
  console.error("✗ NEXT_PUBLIC_INSFORGE_URL or INSFORGE_API_KEY missing in .env.local");
  process.exit(1);
}

// ── 3. Initialize Insforge ───────────────────────────────────────────────
const client  = createClient({ baseUrl, anonKey: apiKey });
const storage = client.storage.from("product-images");
const db      = client.database;

const MAX_DIMENSION = 1920;
const WEBP_QUALITY  = 82;
const BUCKET        = "product-images";
const MAX_ATTEMPTS  = 3;

const stats = {
  scanned:      0,
  skippedWebp:  0,
  downloaded:   0,
  converted:    0,
  uploaded:     0,
  dbUpdated:    0,
  deleted:      0,
  orphans:      [],   // .webp in bucket but DB row not updated
  errors:       [],   // {row, step, message, attempts}
};

// ── 4. Helpers ───────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logLine = (s) => process.stdout.write(s + "\n");

function makeNewPath(oldPath) {
  return oldPath.replace(/\.[a-z0-9]+$/i, ".webp");
}

function publicUrl(path) {
  return storage.getPublicUrl(path);
}

async function convertBufferToWebp(buf) {
  return await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();
}

/**
 * Wrap a storage call with retry. Only retries on transient-looking failures
 * (network errors, 5xx, timeouts). Validation / 4xx errors are returned as-is.
 */
async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await fn();
      if (result && result.error) {
        const msg = result.error.message ?? JSON.stringify(result.error);
        // Retry on transient indicators
        const transient = /fetch failed|timeout|5\d\d|network|reset|ETIMEDOUT|ECONNRESET/i.test(msg);
        if (!transient || attempt === MAX_ATTEMPTS) {
          return result;
        }
        lastErr = new Error(`${label}: ${msg}`);
      } else {
        return result;
      }
    } catch (e) {
      lastErr = e;
      const transient = /fetch failed|timeout|network|reset|ETIMEDOUT|ECONNRESET/i.test(e.message);
      if (!transient || attempt === MAX_ATTEMPTS) {
        throw e;
      }
    }
    await sleep(400 * attempt);
  }
  throw lastErr;
}

async function tryDownload(path) {
  return await withRetry(() => storage.download(path), `download ${path}`);
}

async function tryUpload(path, blob) {
  return await withRetry(() => storage.upload(path, blob), `upload ${path}`);
}

async function tryRemove(path) {
  return await withRetry(() => storage.remove(path), `remove ${path}`);
}

async function tryDbUpdate(table, patch, filter) {
  return await withRetry(() => db.from(table).update(patch).match(filter), `${table}.update`);
}

async function processRow(row) {
  const oldPath = row.storage_path;
  const newPath = makeNewPath(oldPath);
  const newUrl  = publicUrl(newPath);
  const ctx     = `row ${row.id.slice(0, 8)}  ${oldPath}`;

  if (oldPath.toLowerCase().endsWith(".webp")) {
    stats.skippedWebp++;
    if (!APPLY) return;

    // Cleanup pass: if a previous partial run left the original format
    // alongside the new .webp, delete it now.
    const candidates = [".jpg", ".jpeg", ".png", ".gif", ".avif"]
      .map((e) => oldPath.replace(/\.webp$/i, e))
      .filter((c) => c !== oldPath);

    let cleaned = 0;
    for (const candidate of candidates) {
      const { data: probe } = await tryDownload(candidate);
      if (!probe) continue;
      const { error: rmErr } = await tryRemove(candidate);
      if (rmErr) {
        const msg = `stale original cleanup failed: ${rmErr.message ?? rmErr}`;
        stats.errors.push({ row: row.id, step: "cleanup", message: `${candidate}: ${msg}` });
        logLine(`  ⚠ ${ctx}  ${msg}`);
      } else {
        cleaned++;
        logLine(`  ↻ ${ctx}  removed stale ${candidate.split("/").pop()}`);
      }
    }
    if (cleaned === 0) {
      logLine(`  · ${ctx}  (already webp, no stale original)`);
    }
    return;
  }

  logLine(`  → ${ctx}`);

  if (!APPLY) return;

  // ── 1. Download original (with retry) ───────────────────────────────
  const { data: blob, error: dlErr } = await tryDownload(oldPath);
  if (dlErr || !blob) {
    const msg = `download failed: ${dlErr?.message ?? "no data"}`;
    stats.errors.push({ row: row.id, step: "download", message: msg });
    logLine(`    ✗ ${msg}`);
    return;
  }
  stats.downloaded++;
  const buf = Buffer.from(await blob.arrayBuffer());

  // ── 2. Convert ──────────────────────────────────────────────────────
  let webp;
  try {
    webp = await convertBufferToWebp(buf);
  } catch (e) {
    const msg = `convert failed: ${e.message}`;
    stats.errors.push({ row: row.id, step: "convert", message: msg });
    logLine(`    ✗ ${msg}`);
    return;
  }
  stats.converted++;

  // ── 3. Upload WebP — idempotent: skip if already there ──────────────
  let didUpload = false;
  const { data: existingBlob } = await tryDownload(newPath);
  if (existingBlob) {
    logLine(`    ↻ .webp already in bucket, skipping upload`);
  } else {
    const webpBlob = new Blob([new Uint8Array(webp)], { type: "image/webp" });
    const { error: upErr } = await tryUpload(newPath, webpBlob);
    if (upErr) {
      const msg = `upload failed: ${upErr.message ?? JSON.stringify(upErr)}`;
      stats.errors.push({ row: row.id, step: "upload", message: msg });
      logLine(`    ✗ ${msg}`);
      return;
    }
    didUpload = true;
  }
  stats.uploaded++;

  // ── 4. Update product_images row ────────────────────────────────────
  if (row.storage_path === newPath) {
    logLine(`    ↻ storage_path already up to date, skipping update`);
  } else {
    const { error: imgErr } = await tryDbUpdate(
      "product_images",
      { storage_path: newPath },
      { id: row.id }
    );
    if (imgErr) {
      const msg = `product_images update failed: ${imgErr.message ?? JSON.stringify(imgErr)}`;
      stats.errors.push({ row: row.id, step: "db:product_images", message: msg });
      stats.orphans.push({ row: row.id, bucketPath: newPath });
      logLine(`    ✗ ${msg}  (orphan .webp at ${newPath})`);
      return;
    }
  }
  stats.dbUpdated++;

  // ── 5. If this row is primary, also update products.image_url ──────
  if (row.is_primary) {
    const { error: prodErr } = await tryDbUpdate(
      "products",
      { image_url: newUrl },
      { id: row.product_id }
    );
    if (prodErr) {
      const msg = `products.image_url update failed: ${prodErr.message ?? JSON.stringify(prodErr)}`;
      stats.errors.push({ row: row.id, step: "db:products", message: msg });
      logLine(`    ✗ ${msg}`);
      return;
    }
  }

  // ── 6. Delete the original — idempotent: skip if already gone ───────
  const { data: stillThere, error: probeErr } = await tryDownload(oldPath);
  if (probeErr || !stillThere) {
    logLine(`    ↻ original already gone, skipping delete`);
  } else {
    const { error: rmErr } = await tryRemove(oldPath);
    if (rmErr) {
      const msg = `original delete failed: ${rmErr.message ?? JSON.stringify(rmErr)}`;
      stats.errors.push({ row: row.id, step: "delete", message: msg });
      logLine(`    ✗ ${msg}`);
      return;
    }
    stats.deleted++;
  }

  const savedKB = Math.max(0, Math.round((buf.length - webp.length) / 1024));
  logLine(`    ✓ ${(buf.length / 1024).toFixed(0)} KB → ${(webp.length / 1024).toFixed(0)} KB (saved ${savedKB} KB)${didUpload ? "" : "  [no-op upload]"}`);
}

// ── 5. Run ───────────────────────────────────────────────────────────────
(async () => {
  logLine(`\n┌─ migrate-images-to-webp ${APPLY ? "(APPLY)" : "(DRY RUN)"}`);
  logLine(`│  bucket:      ${BUCKET}`);
  logLine(`│  max dim:     ${MAX_DIMENSION}px`);
  logLine(`│  webp q:      ${WEBP_QUALITY}`);
  logLine(`│  retries:     ${MAX_ATTEMPTS}`);
  logLine(`│  limit:       ${LIMIT === Infinity ? "∞" : LIMIT}`);
  if (PRODUCT_FILTER) logLine(`│  product:     ${PRODUCT_FILTER}`);
  logLine("");

  let query = db
    .from("product_images")
    .select("id, product_id, storage_path, is_primary")
    .order("created_at", { ascending: true });

  if (PRODUCT_FILTER) query = query.eq("product_id", PRODUCT_FILTER);

  const { data: rows, error } = await query;
  if (error) {
    console.error("✗ failed to list product_images:", error);
    process.exit(2);
  }

  const list = (rows ?? []).slice(0, LIMIT);
  logLine(`│  found:       ${rows?.length ?? 0} row(s) — processing ${list.length}`);
  logLine("");

  for (const row of list) {
    stats.scanned++;
    try {
      await processRow(row);
    } catch (e) {
      stats.errors.push({ row: row.id, step: "unhandled", message: e.message });
      logLine(`    ✗ unhandled: ${e.message}`);
    }
  }

  logLine("");
  logLine("├─ summary");
  logLine(`│  scanned:     ${stats.scanned}`);
  logLine(`│  already webp: ${stats.skippedWebp}`);
  logLine(`│  downloaded:  ${stats.downloaded}`);
  logLine(`│  converted:   ${stats.converted}`);
  logLine(`│  uploaded:    ${stats.uploaded}`);
  logLine(`│  db updated:  ${stats.dbUpdated}`);
  logLine(`│  deleted:     ${stats.deleted}`);
  logLine(`│  errors:      ${stats.errors.length}`);

  if (stats.errors.length) {
    logLine("│");
    logLine("│  ── errors ──");
    for (const e of stats.errors) {
      logLine(`│    [${e.step}] row ${e.row}: ${e.message}`);
    }
  }
  if (stats.orphans.length) {
    logLine("│");
    logLine("│  ── orphan webp files in bucket (DB row not updated) ──");
    for (const o of stats.orphans) {
      logLine(`│    row ${o.row}: ${o.bucketPath}`);
    }
  }
  logLine("└─ done\n");

  process.exit(stats.errors.length > 0 ? 2 : 0);
})();
