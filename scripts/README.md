# scripts

Two one-off asset generators. Neither runs during `npm run build` — both write
files into `public/`, and those files are committed. You only need to run them
when the mark, the font, or the OG copy changes.

Both need Playwright's driver plus a local Chrome:

```bash
npm i -D playwright-core        # already in devDependencies
```

They launch `channel: 'chrome'` (your installed Google Chrome) and fall back to
Playwright's bundled Chromium if you've run `npx playwright install`.

---

## `gen-mask.mjs` → `public/jc-mask.png`

Bakes the `jc` wordmark into the bevel/depth map that `LiquidMark.astro`'s
shader reads.

```bash
node scripts/gen-mask.mjs                      # defaults: public/jc-mask.png, 1024px wide
node scripts/gen-mask.mjs /tmp/test.png 1280   # custom path and width
```

**Why this is a build-time step.** The depth field comes from a Poisson
relaxation (Gauss–Seidel with over-relaxation, 200 sweeps) over every pixel of
the glyph silhouette. At 1024px that is ~2×10⁸ scalar updates. Running it in the
browser on page load would freeze the main thread for seconds. The mark never
changes, so it is solved once here.

**Output channels:**

| Channel | Meaning |
| --- | --- |
| R | depth — 0 at the outline, 255 at the medial axis |
| G | coverage — 0 outside the glyphs, 255 inside |
| B | unused |
| A | always 255, so nothing gets premultiplied on texture upload |

Alpha is deliberately left opaque and coverage moved to green. That means the
consumer can hand the `<img>` straight to `texImage2D` without worrying about
premultiplication, and it measured smaller as a PNG than packing depth into
R=G=B with coverage in alpha.

**After running it, check the printed metrics.** It emits the ink bounding box
and baseline as percentages:

```
--ink-right: 92.97%;
--baseline-from-bottom: 25.46%;
```

Those go into the `--ink-right` / `--baseline-from-bottom` custom properties at
the top of `src/components/LiquidMark.astro`. The mask is padded, so the ink
stops short of the image edge — without these the accent dot hangs in space
instead of sitting where a `.` belongs. Note the component uses a slightly
smaller baseline value than the raw number, because the `c` is a round glyph and
optically overshoots.

The script refuses to run if Space Grotesk fails to load, rather than silently
baking a mask in a fallback face.

---

## `gen-favicon.mjs` → `public/favicon-*.png`, `public/apple-touch-icon.png`

Renders the `jc.` monogram into favicons using the real Space Grotesk. Needs no
dev server.

```bash
npm run gen:favicon
```

Emits 32, 192 and 512px rounded icons plus a full-bleed 180px
`apple-touch-icon.png` (Apple applies its own corner mask, so rounding it here
would double up).

**Why raster and not SVG.** Browser chrome rasterises an SVG favicon using the
fonts the OS has, not the ones the page loads — so an SVG `<text>` favicon
renders in a fallback face no matter what. That was the bug this replaced.
Emitting true vector paths would mean decompressing the woff2 and walking glyph
outlines, which is disproportionate for something drawn at 16px.

Each icon is drawn at 4x and downsampled so small sizes antialias properly, and
the accent dot is deliberately larger in proportion than the real wordmark's
period — at 16px a true-to-scale dot vanishes. Like `gen-mask.mjs`, it refuses
to run if Space Grotesk fails to load.

---

## `gen-og.mjs` → `public/og.png`

Screenshots the `/og` route at 1200×630 for the social card.

```bash
npm run dev                    # in one terminal
node scripts/gen-og.mjs        # in another
```

`src/pages/og.astro` is the source frame. It is `noindex` and linked from
nowhere; it exists so the card can be regenerated when the mark or the tagline
changes, rather than being a hand-edited binary.
