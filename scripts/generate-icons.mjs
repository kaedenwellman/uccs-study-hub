// Generates the PWA icon set from an inline SVG "SH" monogram.
// Run with: npm run icons
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");

const BLACK = "#000000";
const GOLD = "#CFB87C";

// `pad` is the fraction of the canvas kept clear on each side. Maskable icons
// need a safe zone (~10%+) so the monogram survives platform masking.
function monogramSvg({ size, pad = 0, radius = 0.18 }) {
  const inset = size * pad;
  const inner = size - inset * 2;
  const r = inner * radius;
  const fontSize = inner * 0.46;
  const cx = size / 2;
  const cy = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${size}" height="${size}" fill="${BLACK}"/>
  <rect x="${inset}" y="${inset}" width="${inner}" height="${inner}" rx="${r}" ry="${r}" fill="${BLACK}"/>
  <rect x="${inset}" y="${inset}" width="${inner}" height="${inner}" rx="${r}" ry="${r}" fill="none" stroke="${GOLD}" stroke-width="${inner * 0.03}"/>
  <text x="${cx}" y="${cy}" fill="${GOLD}" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" letter-spacing="${inner * -0.01}">SH</text>
</svg>`;
}

async function render(svg, size, file) {
  await sharp(Buffer.from(svg)).png().resize(size, size).toFile(join(outDir, file));
  console.log("wrote", file);
}

await mkdir(outDir, { recursive: true });

await render(monogramSvg({ size: 192 }), 192, "icon-192.png");
await render(monogramSvg({ size: 512 }), 512, "icon-512.png");
await render(monogramSvg({ size: 512, pad: 0.14, radius: 0.5 }), 512, "icon-maskable-512.png");
await render(monogramSvg({ size: 180 }), 180, "apple-touch-icon.png");
await render(monogramSvg({ size: 64 }), 64, "favicon.png");

console.log("Icons generated in", outDir);
