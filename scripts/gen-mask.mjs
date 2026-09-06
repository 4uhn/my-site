/**
 * Bakes the `jc` wordmark into a bevel/depth mask PNG for the liquid-metal shader.
 *
 * Why bake: the depth field comes from a Poisson relaxation over every pixel of the
 * glyph silhouette (~200 sweeps). Doing that at runtime freezes the main thread for
 * seconds. The mark never changes, so we solve it once here and ship the result.
 *
 * Output channels:
 *   R = depth   0 at the outline -> 255 at the medial axis (the "bevel")
 *   G = coverage 0 outside the glyphs, 255 inside
 *   B = 0       spare
 *   A = 255     always opaque, so nothing gets premultiplied on upload
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] ?? fileURLToPath(new URL('../public/jc-mask.png', import.meta.url));
const TEXT = 'jc';
// Must match the committed mask, or the printed metrics stop matching LiquidMark.
const WIDTH = Number(process.argv[3] ?? 1024); // height derives from the glyph bounds
const TRACKING = '-0.02em';  // the wordmark's letter-spacing
const PAD_RATIO = 0.07;   // breathing room so refraction never samples past the edge
const ITERATIONS = 200;   // Poisson sweeps
const OMEGA = 1.85;       // over-relaxation factor
const C = 0.01;           // constant source term for the Laplacian
const GAMMA = 0.62;       // <1 rounds the bevel out, >1 sharpens it to a ridge

// Prefer the installed Chrome; fall back to Playwright's bundled Chromium if
// it has been downloaded (`npx playwright install`).
const browser = await chromium
  .launch({ channel: 'chrome' })
  .catch(() => chromium.launch());
const page = await browser.newContext({ deviceScaleFactor: 1 }).then((c) => c.newPage());

page.on('console', (m) => console.log('  [page]', m.text()));

await page.setContent(`<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=block">
</head><body></body></html>`);

// Fail loudly rather than silently rendering in a fallback face.
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
  throw new Error('Space Grotesk did not load — refusing to bake a mask in a fallback font.');
}
console.log('  font: Space Grotesk 700 loaded');

const result = await page.evaluate(
  async ({ TEXT, WIDTH, TRACKING, PAD_RATIO, ITERATIONS, OMEGA, C, GAMMA }) => {
    // ---- 1. measure the glyphs so the mask is cropped tight to the mark ----
    const probe = document.createElement('canvas').getContext('2d');
    const PROBE_SIZE = 400;
    probe.font = `700 ${PROBE_SIZE}px "Space Grotesk"`;
    probe.letterSpacing = TRACKING;
    probe.textBaseline = 'alphabetic';
    const m = probe.measureText(TEXT);
    // Space Grotesk's `j` descends well below the baseline; actualBoundingBox
    // is the only way to get the real ink extent rather than the em box.
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

    const pad = Math.round(WIDTH * PAD_RATIO);
    const drawW = WIDTH - pad * 2;
    const scale = drawW / inkW;
    const drawH = Math.round(inkH * scale);
    const HEIGHT = drawH + pad * 2;
    const fontSize = PROBE_SIZE * scale;

    // ---- 2. rasterise the silhouette ----
    const cv = document.createElement('canvas');
    cv.width = WIDTH;
    cv.height = HEIGHT;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.font = `700 ${fontSize}px "Space Grotesk"`;
    ctx.letterSpacing = TRACKING;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    ctx.fillText(TEXT, pad + m.actualBoundingBoxLeft * scale, pad + m.actualBoundingBoxAscent * scale);

    const src = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
    const n = WIDTH * HEIGHT;

    // ---- 3. classify shape / boundary ----
    const shape = new Uint8Array(n);
    for (let i = 0; i < n; i++) shape[i] = src[i * 4 + 3] > 127 ? 1 : 0;

    // A shape pixel touching anything non-shape (or the canvas edge) is boundary.
    // Boundary is pinned to zero, which is what makes the solve produce a mound.
    const boundary = new Uint8Array(n);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const i = y * WIDTH + x;
        if (!shape[i]) continue;
        if (
          x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ||
          !shape[i - 1] || !shape[i + 1] || !shape[i - WIDTH] || !shape[i + WIDTH]
        ) boundary[i] = 1;
      }
    }

    // ---- 4. Poisson solve, Gauss-Seidel with over-relaxation ----
    // Solving  laplacian(u) = -C  with u = 0 on the boundary and outside.
    // In-place updates (Gauss-Seidel) converge roughly twice as fast as Jacobi,
    // and omega ~1.85 buys another large factor on a domain this size.
    const u = new Float32Array(n);
    for (let it = 0; it < ITERATIONS; it++) {
      for (let y = 1; y < HEIGHT - 1; y++) {
        for (let x = 1; x < WIDTH - 1; x++) {
          const i = y * WIDTH + x;
          if (!shape[i] || boundary[i]) continue;
          const sum = u[i - 1] + u[i + 1] + u[i - WIDTH] + u[i + WIDTH];
          u[i] += OMEGA * ((C + sum) * 0.25 - u[i]);
        }
      }
    }

    let max = 0;
    for (let i = 0; i < n; i++) if (u[i] > max) max = u[i];
    // Degenerate case: strokes so thin every pixel is boundary. Better a flat
    // mark than a NaN-filled one.
    if (!(max > 0)) max = 1;

    // ---- 5. pack ----
    // R = depth, G = coverage, B unused, A always opaque. Keeping alpha at 255
    // sidesteps premultiplication on texture upload entirely, and measured
    // smaller than packing depth into R=G=B with coverage in alpha.
    const out = ctx.createImageData(WIDTH, HEIGHT);
    for (let i = 0; i < n; i++) {
      const depth = shape[i] ? Math.pow(u[i] / max, GAMMA) : 0;
      out.data[i * 4 + 0] = Math.round(depth * 255);
      out.data[i * 4 + 1] = shape[i] ? 255 : 0;
      out.data[i * 4 + 2] = 0;
      out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);

    let shapePx = 0;
    for (let i = 0; i < n; i++) shapePx += shape[i];

    return {
      dataUrl: cv.toDataURL('image/png'),
      width: WIDTH,
      height: HEIGHT,
      fontSize: Math.round(fontSize),
      coverage: ((shapePx / n) * 100).toFixed(1),
      // Where the ink actually sits inside the padded canvas, as fractions of
      // the image. Consumers need these to hang the accent dot off the mark:
      // without them the dot floats away from the `c` by the pad amount.
      ink: {
        left: pad / WIDTH,
        right: (pad + drawW) / WIDTH,
        top: pad / HEIGHT,
        bottom: (pad + drawH) / HEIGHT,
        // Baseline of the glyphs, measured from the top of the image.
        baseline: (pad + m.actualBoundingBoxAscent * scale) / HEIGHT,
      },
    };
  },
  { TEXT, WIDTH, TRACKING, PAD_RATIO, ITERATIONS, OMEGA, C, GAMMA }
);

const buf = Buffer.from(result.dataUrl.split(',')[1], 'base64');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);

console.log(`  mask:     ${result.width}x${result.height}  (font ${result.fontSize}px)`);
console.log(`  coverage: ${result.coverage}% of pixels are glyph`);
console.log(`  wrote:    ${OUT}  (${(buf.length / 1024).toFixed(1)} KB)`);
console.log('\n  --- paste into the .mark block in LiquidMark.astro ---');
console.log(`  --ink-right: ${(result.ink.right * 100).toFixed(2)}%;`);
console.log(`  --baseline-from-bottom: ${((1 - result.ink.baseline) * 100).toFixed(2)}%;  /* nudge down a little: the round \`c\` overshoots */`);
console.log(`  ink box: L ${(result.ink.left * 100).toFixed(2)}%  R ${(result.ink.right * 100).toFixed(2)}%  T ${(result.ink.top * 100).toFixed(2)}%  B ${(result.ink.bottom * 100).toFixed(2)}%`);

await browser.close();
