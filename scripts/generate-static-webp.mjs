import sharp from "sharp";
import { resolve } from "node:path";

const inputs = [
  "public/logo-pauleam.png",
  "public/PANCHITOS_logo_page-0001.png",
];

for (const rel of inputs) {
  const abs = resolve(process.cwd(), rel);
  const dir = abs.replace(/[/\\][^/\\]+$/, "");
  const name = abs.match(/[/\\]([^/\\]+)\.[^.]+$/)[1];
  const out = `${dir}/${name}.webp`;
  const info = await sharp(abs)
    .webp({ quality: 88, effort: 4 })
    .toFile(out);
  console.log(`✓ ${rel}  →  ${rel.replace(/\.[^.]+$/, ".webp")}  (${(info.size / 1024).toFixed(1)} KB)`);
}
