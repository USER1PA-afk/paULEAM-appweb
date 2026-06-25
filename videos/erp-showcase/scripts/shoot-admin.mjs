// scripts/shoot-admin.mjs
// Drive Chrome with admin cookies, screenshot every module as admin.
// Token comes from env to avoid hardcoding; pass via:
//   $env:ADMIN_JWT="eyJh..."; $env:ADMIN_ROLE="admin"; npm run shoot:admin
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "capture", "screenshots", "admin");
const BASE = process.env.APP_URL || "http://localhost:3001";
const TOKEN = process.env.ADMIN_JWT;
const ROLE = process.env.ADMIN_ROLE || "admin";

if (!TOKEN) {
  console.error("ADMIN_JWT env var is required.");
  process.exit(1);
}

// (path, name, waitForSelector?, fullPage?) — skip /admin/audit, /admin/users per user
const ROUTES = [
  ["admin/dashboard",        "01-dashboard",        '[class*="grid"]', true],
  ["admin/inventory",        "02-inventory",        "table",            true],
  ["admin/products",         "03-products",         "table",            true],
  ["admin/store/products",   "04-store-products",   "table",            true],
  ["admin/recipes",          "05-recipes",          "table",            true],
  ["admin/production",       "06-production",       "table",            true],
  ["admin/packaging",        "07-packaging",        "table",            true],
  ["admin/packaging/templates", "08-packaging-templates", "table",       true],
  ["admin/suppliers",        "09-suppliers",        "table",            true],
  ["admin/orders",           "10-orders",           "table",            true],
  ["admin/notifications",    "11-notifications",    "table, [class*='card'], main", true],
  ["admin/settings",         "12-settings",         "form, [class*='card'], main", true],
  ["pos",                    "13-pos-kiosk",        '[class*="grid"], main', true],
  ["shop/catalog",           "14-shop-catalog",     '[class*="grid"]',  true],
];

const CHROME = "C:\\Users\\Alejandro-md\\.cache\\puppeteer\\chrome-headless-shell\\win64-149.0.7827.22\\chrome-headless-shell-win64\\chrome-headless-shell.exe";

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "shell",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  });

  const page = await browser.newPage();
  // Inject cookies before any navigation
  await page.setCookie(
    { name: "pauleam-session", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "pauleam-role",    value: ROLE,  domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  );

  for (const [path, name, waitSel, fullPage] of ROUTES) {
    const url = `${BASE}/${path}`;
    process.stdout.write(`-> ${url}\n`);
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      // give the SDK hydrate + DB queries time to settle
      await new Promise(r => setTimeout(r, 1500));
      if (waitSel) {
        try {
          await page.waitForSelector(waitSel, { timeout: 8000 });
        } catch {
          process.stdout.write(`   warn: selector "${waitSel}" not found, screenshotting anyway\n`);
        }
      }
      // tiny extra wait for any "loading" -> data swap
      await new Promise(r => setTimeout(r, 800));
      const file = resolve(OUT, `${name}.png`);
      await page.screenshot({ path: file, fullPage });
      process.stdout.write(`   ok ${resp?.status() ?? "?"} -> ${file}\n`);
    } catch (err) {
      process.stdout.write(`   FAIL ${err.message}\n`);
    }
  }

  await browser.close();
  process.stdout.write(`done. ${ROUTES.length} routes attempted.\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
