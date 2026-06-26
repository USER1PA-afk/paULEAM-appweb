// scripts/shoot-cliente-mobile.mjs
// Drive Chrome at 425px viewport, sign in as test cliente, capture
// catalog (with items pre-added via the admin SDK so the cart and checkout
// screenshots show real content), cart, and checkout.
//
// Run order:
//   1. node scripts/create-test-cliente.mjs   (creates user + writes token)
//   2. node scripts/shoot-cliente-mobile.mjs  (this file)

import puppeteer from "puppeteer-core";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@insforge/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "capture", "screenshots", "cliente-mobile");
const BASE = process.env.APP_URL || "http://localhost:3001";
const TOKEN = (await readFile(resolve(__dirname, "..", ".cliente-token"), "utf8")).trim();
const INSFORGE_BASE = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://8i4ga35v.us-east.insforge.app";
const ADMIN_KEY = process.env.INSFORGE_API_KEY;

if (!TOKEN) { console.error("missing .cliente-token. run create-test-cliente.mjs first."); process.exit(1); }
if (!ADMIN_KEY) { console.error("INSFORGE_API_KEY env var is required to seed cart items."); process.exit(1); }

const CHROME = "C:\\Users\\Alejandro-md\\.cache\\puppeteer\\chrome-headless-shell\\win64-149.0.7827.22\\chrome-headless-shell-win64\\chrome-headless-shell.exe";

// ============================================================
// Pre-step: seed the cart with 2 items via the admin SDK (bypasses
// the browser's "Agregar" button which requires the SDK to be hydrated
// from localStorage — too fragile in headless mode).
// ============================================================
const insforge = createClient({
  baseUrl: INSFORGE_BASE,
  anonKey: ADMIN_KEY,
  isServerMode: true,
  timeout: 10000,
  retryCount: 1,
});

const { data: clienteProfile } = await insforge.database
  .from("profiles")
  .select("id")
  .eq("email", "cliente.video@pauleam.test")
  .maybeSingle();
const clienteId = clienteProfile?.id;
if (!clienteId) { console.error("cliente not found"); process.exit(1); }
console.log(`cliente.id = ${clienteId}`);

const { data: products } = await insforge.database
  .from("products")
  .select("id, sku, name, price, sales_unit_name, conversion_factor")
  .eq("type", "PRODUCTO_TERMINADO")
  .order("name")
  .limit(3);
console.log(`found ${products?.length ?? 0} products:`, products?.map(p => p.name));

// Clean any prior reservations for this cliente
await insforge.database
  .from("stock_reservations")
  .delete()
  .eq("user_id", clienteId);

// Reserve 1 unit of the first 2 products via the reserve_stock RPC
// (avoids RLS pitfalls; the RPC is SECURITY DEFINER per AGENTS.md).
for (let i = 0; i < Math.min(2, products?.length ?? 0); i++) {
  const p = products[i];
  // The cart UI uses commercial_qty=1 (the unit the customer adds).
  // The reserve_stock RPC takes (user_id, product_id, qty) where qty is
  // the physical quantity (commercial / conversion_factor).
  const commercialQty = 1;
  const physicalQty = commercialQty / (p.conversion_factor || 1);
  const { data, error: rErr } = await insforge.database
    .rpc("reserve_stock", {
      p_user_id: clienteId,
      p_product_id: p.id,
      p_quantity: physicalQty,
    });
  if (rErr) {
    console.error(`reservation for ${p.name} failed:`, rErr);
  } else {
    console.log(`reserved 1 × ${p.name} (physical=${physicalQty} ${p.sales_unit_name})`);
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
      "--window-size=425,900",
    ],
    defaultViewport: {
      width: 425,
      height: 900,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  });

  const page = await browser.newPage();
  await page.setCookie(
    { name: "pauleam-session", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "pauleam-role",    value: "cliente", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  );

  // Navigate first so cookies are scoped to the origin, then call /api/auth/me
  // to rehydrate the SDK. The endpoint reads the httpOnly cookie and returns
  // { user, token }; we stash the token in localStorage so the SDK picks it up.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.evaluate(async (base) => {
    try {
      const r = await fetch(base + "/api/auth/me", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json();
      if (j?.token && j?.user) {
        localStorage.setItem("insforge-auth", JSON.stringify({
          accessToken: j.token,
          refreshToken: null,
          user: j.user,
        }));
      }
    } catch {}
  }, BASE);

  await page.addStyleTag({
    content: `
      nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay],
      [data-next-mark], [data-nextjs-toast-wrapper] { display: none !important; }
      body { padding-bottom: 0 !important; }
    `,
  });

  // Helper: wait for the SDK to rehydrate (Agregar buttons appear)
  async function waitForAgregarButtons(timeoutMs = 10000) {
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll("button"))
          .some(b => /^\s*Agregar\s*$/i.test(b.textContent || "")),
        { timeout: timeoutMs }
      );
      return true;
    } catch {
      return false;
    }
  }

  // Helper: click the first N Agregar buttons
  async function clickAgregarButtons(count) {
    const clicked = await page.evaluate((n) => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const agregar = buttons.filter(b => /^\s*Agregar\s*$/i.test(b.textContent || ""));
      let c = 0;
      for (const btn of agregar.slice(0, n)) {
        btn.click();
        c++;
      }
      return c;
    }, count);
    return clicked;
  }

  // 1) CATALOG (top of page) — wait for SDK to rehydrate, then screenshot
  {
    const url = `${BASE}/shop/catalog`;
    process.stdout.write(`-> ${url}\n`);
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const ok = await waitForAgregarButtons(10000);
    process.stdout.write(ok ? "   sdk rehydrated\n" : "   warn: SDK did not rehydrate\n");
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: resolve(OUT, "01-catalog.png") });
    process.stdout.write(`   ok ${resp?.status() ?? "?"} -> 01-catalog.png\n`);
  }

  // 1b) Click 2 Agregar buttons to populate the cart (writes to localStorage)
  {
    process.stdout.write(`-> clicking Agregar buttons to add 2 items\n`);
    const clicked = await clickAgregarButtons(2);
    process.stdout.write(`   clicked ${clicked} buttons\n`);
    // Give the React state time to update + localStorage to persist
    await new Promise(r => setTimeout(r, 1500));
  }

  // 1c) Seed localStorage directly with the cart items as a backup.
  // The Agregar click should have populated localStorage already, but on
  // some headless runs the React onClick handler doesn't fire reliably.
  // The cart key format is `pauleam_cart_<userId>` (see features/checkout/hooks).
  {
    process.stdout.write(`-> seeding localStorage cart as backup\n`);
    const cartKey = `pauleam_cart_${clienteId}`;
    const cartItems = [
      {
        product_id: products[0].id,
        name: products[0].name,
        sku: products[0].sku,
        unit: products[0].sales_unit_name || "unidad",
        price: products[0].price,
        image_url: null,
        quantity: 1,
        reservation_id: "seed-1",
        conversion_factor: products[0].conversion_factor || 1,
        sales_unit_name: products[0].sales_unit_name,
        capacity_unit: null,
      },
      {
        product_id: products[1].id,
        name: products[1].name,
        sku: products[1].sku,
        unit: products[1].sales_unit_name || "unidad",
        price: products[1].price,
        image_url: null,
        quantity: 1,
        reservation_id: "seed-2",
        conversion_factor: products[1].conversion_factor || 1,
        sales_unit_name: products[1].sales_unit_name,
        capacity_unit: null,
      },
    ];
    await page.evaluate(({ key, items }) => {
      localStorage.setItem(key, JSON.stringify(items));
    }, { key: cartKey, items: cartItems });
    process.stdout.write(`   seeded ${cartItems.length} items in ${cartKey}\n`);
  }

  // 2) CATALOG scrolled view
  {
    process.stdout.write(`-> catalog scrolled view\n`);
    await page.goto(`${BASE}/shop/catalog`, { waitUntil: "networkidle2" });
    await waitForAgregarButtons(8000);
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => window.scrollTo(0, 600));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: resolve(OUT, "02-catalog-scrolled.png") });
  }

  // 3) CART — should now have 2 items
  {
    const url = `${BASE}/shop/cart`;
    process.stdout.write(`-> ${url}\n`);
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // Wait for the cart to show items OR for the "vacío" message
    // (whichever comes first). The auth state needs to rehydrate first
    // (useCart reads from localStorage keyed by userId, and userId is null
    // until /api/auth/me completes).
    try {
      await page.waitForFunction(
        () => /Carrito de Compras|Tu carrito est/.test(document.body.textContent || ""),
        { timeout: 10000 }
      );
    } catch {}
    // Extra time for the auth rehydration + cart load
    await new Promise(r => setTimeout(r, 2000));
    // Check if the cart is empty (auth not rehydrated in time)
    const cartIsEmpty = await page.evaluate(() =>
      /Tu carrito está vacío/.test(document.body.textContent || "")
    );
    if (cartIsEmpty) {
      process.stdout.write("   warn: cart shows empty (auth not rehydrated in time)\n");
    }
    await page.screenshot({ path: resolve(OUT, "03-cart.png"), fullPage: true });
    process.stdout.write(`   ok ${resp?.status() ?? "?"} -> 03-cart.png\n`);
  }

  // 4) CHECKOUT — payment gateway
  {
    const url = `${BASE}/shop/checkout`;
    process.stdout.write(`-> ${url}\n`);
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    try {
      await page.waitForFunction(
        () => /Checkout|Res|Forma de entrega/.test(document.body.textContent || ""),
        { timeout: 10000 }
      );
    } catch {}
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: resolve(OUT, "04-checkout.png"), fullPage: true });
    process.stdout.write(`   ok ${resp?.status() ?? "?"} -> 04-checkout.png\n`);
  }

  await browser.close();
  process.stdout.write(`done.\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });

