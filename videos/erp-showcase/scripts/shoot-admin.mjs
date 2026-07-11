// scripts/shoot-admin.mjs
// Drive Chrome with admin cookies, screenshot every module as admin.
// Token comes from env to avoid hardcoding; pass via:
//   $env:ADMIN_JWT="eyJh..."; $env:ADMIN_ROLE="admin"; node scripts/shoot-admin.mjs
//
// Post-load steps applied to every page before screenshot:
//   1. Hide the Next.js dev mode indicator (the small "N" badge in dev mode).
//      User can also disable it permanently via next.config.js -> devIndicators: false.
//   2. Expand the "Comercial" sidebar group so all admin modules (Punto de Venta,
//      Órdenes de Venta, Gestionar Tienda > Ver E-Commerce) are visible.

import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "capture", "screenshots", "admin");
const BASE = process.env.APP_URL || "http://localhost:3001";

// Token source: $env:ADMIN_JWT (legacy) OR .admin-token file (from create-test-admin.mjs)
import { readFile } from "node:fs/promises";
let TOKEN = process.env.ADMIN_JWT;
let ROLE = process.env.ADMIN_ROLE || "admin";
if (!TOKEN) {
  try {
    TOKEN = (await readFile(resolve(__dirname, "..", ".admin-token"), "utf8")).trim();
    // For the test admin created via create-test-admin.mjs, role was set there.
    ROLE = "admin";
  } catch {
    // fallthrough
  }
}
if (!TOKEN) {
  console.error("ADMIN_JWT env var OR .admin-token file is required.");
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

async function applyChromeFlags(page) {
  // Hide the Next.js dev mode indicator (small "N" badge in bottom-left of dev mode).
  // Next.js renders it as <nextjs-portal> custom element + a styled container.
  await page.addStyleTag({
    content: `
      nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay],
      [data-next-mark], [data-nextjs-toast-wrapper] { display: none !important; }
      body { padding-bottom: 0 !important; }
    `,
  });
}

async function expandSidebar(page) {
  // The Comercial group is collapsed by default. Click the chevron button to expand it
  // so "Punto de Venta", "Órdenes de Venta" and "Gestionar Tienda > Ver E-Commerce"
  // all render. The chevron has aria-label "Expandir tienda" when collapsed.
  try {
    const expanded = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Expandir tienda"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (expanded) {
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch {
    // ignore — some pages don't have the sidebar
  }
}

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
      await new Promise((r) => setTimeout(r, 1500));
      if (waitSel) {
        try {
          await page.waitForSelector(waitSel, { timeout: 8000 });
        } catch {
          process.stdout.write(`   warn: selector "${waitSel}" not found, screenshotting anyway\n`);
        }
      }
      // tiny extra wait for any "loading" -> data swap
      await new Promise((r) => setTimeout(r, 600));
      // Apply post-load cleanup
      await applyChromeFlags(page);
      await expandSidebar(page);
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
