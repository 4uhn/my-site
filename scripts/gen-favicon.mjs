/**
 * Renders the `jc.` monogram into favicon PNGs using the real Space Grotesk.
 *
 * Why raster rather than SVG: an SVG favicon containing <text> is rasterised by
 * the browser chrome with whatever fonts the OS happens to have, so Space
 * Grotesk is never applied — that is the bug this replaces. Emitting true vector
 * paths would mean decompressing the woff2 and walking the glyph outlines,
 * which is disproportionate for something drawn at 16px. PNGs rendered from the
 * actual font are exact and universally supported.
 *
 * Usage: npm run dev, then `node scripts/gen-favicon.mjs`
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../public/', import.meta.url));

// Apple applies its own corner mask, so that one is drawn full-bleed square.
const TARGETS = [
  { file: 'favicon-32.png', size: 32, rounded: true },
  { file: 'favicon-192.png', size: 192, rounded: true },
  { file: 'favicon-512.png', size: 512, rounded: true },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
];

const BG = '#0a0a0b';
const FG = '#fafafa';
const ACCENT = '#be123c';

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();

await page.setContent(`<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=block">
</head><body></body></html>`);

const fontOk = await page.evaluate(async () => {
  try {
    await document.fonts.load('700 400px "Space Grotesk"');
    await document.fonts.ready;
    return document.fonts.check('700 400px "Space Grotesk"');
  } catch {
    return false;
  }
});
if (!fontOk) {
  await browser.close();
  throw new Error('Space Grotesk did not load — refusing to bake a favicon in a fallback font.');
}

for (const target of TARGETS) {
  const dataUrl = await page.evaluate(
    ({ size, rounded, BG, FG, ACCENT }) => {
      // Render at 4x then downscale, so small sizes get proper antialiasing
      // instead of the chunky edges you get drawing 16px text directly.
      const SS = 4;
      const S = size * SS;

      const cv = document.createElement('canvas');
      cv.width = S;
      cv.height = S;
      const ctx = cv.getContext('2d');

      // Background
      ctx.fillStyle = BG;
      if (rounded) {
        const r = S * 0.22;
        ctx.beginPath();
        ctx.roundRect(0, 0, S, S, r);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, S, S);
      }

      // Measure `jc` so it can be fitted to the box by its real ink bounds
      // rather than by the em box, which is mostly empty above and below.
      const PROBE = 400;
      ctx.font = `700 ${PROBE}px "Space Grotesk"`;
      ctx.letterSpacing = '-0.02em';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText('jc');
      const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

      // Leave room on the right for the accent dot. Proportionally larger than
      // the real wordmark's period: at 16-32px a true-to-scale dot disappears.
      const dotGap = 0.09;
      const dotD = 0.26;
      const totalW = inkW * (1 + dotGap + dotD);

      // Tight padding — a favicon is mostly read at 16px, so every pixel of
      // glyph height counts.
      const pad = S * 0.11;
      const avail = S - pad * 2;
      const scale = Math.min(avail / totalW, avail / inkH);
      const fontSize = PROBE * scale;

      const drawW = totalW * scale;
      const drawH = inkH * scale;
      const originX = (S - drawW) / 2;
      const originY = (S - drawH) / 2;

      ctx.font = `700 ${fontSize}px "Space Grotesk"`;
      ctx.letterSpacing = '-0.02em';
      ctx.fillStyle = FG;
      ctx.fillText(
        'jc',
        originX + m.actualBoundingBoxLeft * scale,
        originY + m.actualBoundingBoxAscent * scale
      );

      // Accent dot, sitting on the baseline just right of the `c`.
      const baseline = originY + m.actualBoundingBoxAscent * scale;
      const d = inkW * dotD * scale;
      const cx = originX + (inkW + inkW * dotGap) * scale + d / 2;
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(cx, baseline - d / 2, d / 2, 0, Math.PI * 2);
      ctx.fill();

      // Downscale to the target size.
      const out = document.createElement('canvas');
      out.width = size;
      out.height = size;
      const octx = out.getContext('2d');
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(cv, 0, 0, size, size);
      return out.toDataURL('image/png');
    },
    { size: target.size, rounded: target.rounded, BG, FG, ACCENT }
  );

  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(OUT_DIR + target.file, buf);
  console.log(`  ${target.file.padEnd(22)} ${target.size}x${target.size}  ${(buf.length / 1024).toFixed(1)} KB`);
}

await browser.close();
