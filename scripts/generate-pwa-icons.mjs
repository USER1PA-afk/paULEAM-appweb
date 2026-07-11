// One-off script: generate PWA icons from public/logo-pauleam.png
// Usage: npm run gen:icons   (requires `sharp` devDependency)
//
// The source logo is portrait (1024x1536). We use `fit: contain` over a white
// background so the logo is never distorted into a square. Maskable icons get
// extra safe padding (~10%) so Android's mask never clips the logo.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SRC = join(root, "public", "logo-pauleam.png");
const OUT_DIR = join(root, "public", "icons");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function makeIcon(size, outName, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const buffer = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: buffer, gravity: "center" }])
    .png()
    .toFile(join(OUT_DIR, outName));

  console.log(`✓ ${outName} (${size}x${size}${padding ? `, padding ${padding * 100}%` : ""})`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await makeIcon(192, "icon-192.png");
  await makeIcon(512, "icon-512.png");
  await makeIcon(512, "maskable-512.png", { padding: 0.1 });
  await makeIcon(180, "apple-touch-icon.png");
  console.log("Done. Icons written to public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
