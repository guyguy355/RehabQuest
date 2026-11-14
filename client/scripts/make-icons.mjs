// Renders the original RehabQuest app icons (PNG) from SVG with Playwright's Chromium.
// Usage: node scripts/make-icons.mjs   (writes public/icons/icon-192.png, icon-512.png, icon-maskable-512.png)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// Stepping stones rising to a plus: progress, one small step at a time.
const artwork = `
  <circle cx="150" cy="350" r="46" fill="#96E8D6"/>
  <circle cx="250" cy="268" r="46" fill="#C9F4EA"/>
  <rect x="300" y="110" width="140" height="44" rx="22" fill="#FFC81A"/>
  <rect x="348" y="62" width="44" height="140" rx="22" fill="#FFC81A"/>`;

const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="#076B5F"/>
  <rect width="512" height="490" rx="116" fill="#0A8274"/>
  ${artwork}
</svg>`;

// Maskable: full-bleed background, artwork scaled into the central safe zone (80%).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0A8274"/>
  <g transform="translate(76.8 76.8) scale(0.7)">${artwork}</g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, svg, size] of [
  ['icon-192.png', standard, 192],
  ['icon-512.png', standard, 512],
  ['icon-maskable-512.png', maskable, 512],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(out, name), omitBackground: true });
  console.log('wrote', name);
}
fs.writeFileSync(path.join(out, 'rehabquest-icon.svg'), standard.trim() + '\n');
await browser.close();
