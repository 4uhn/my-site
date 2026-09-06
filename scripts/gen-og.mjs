/**
 * Screenshots /og (served by the dev server) into public/og.png at 1200x630.
 */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2] ?? fileURLToPath(new URL('../public/og.png', import.meta.url));
const URL = process.argv[3] ?? 'http://localhost:4321/og';

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
// Let the shader settle on a frame with pleasant banding.
await page.waitForTimeout(2600);

// Hide the Astro dev toolbar so it doesn't land in the card.
await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
await page.waitForTimeout(200);

const frame = page.locator('[data-og-frame]');
await frame.screenshot({ path: OUT });

const box = await frame.boundingBox();
console.log(`  wrote ${OUT}  frame ${Math.round(box.width)}x${Math.round(box.height)}`);

await browser.close();
