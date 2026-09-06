# my-site

[jacobchau.vercel.app](https://jacobchau.vercel.app)

A single-page personal site. Astro 5 + Tailwind 4, no UI framework, one runtime
dependency, ~3.4 kB of gzipped JavaScript.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build
npm run check      # astro check
```

## Shape of it

Everything lives on `/`, in five anchored sections: `#top`, `#about`, `#work`,
`#path`, `#contact`. The old `/projects`, `/experience` and `/contact` routes are
kept alive as redirects in `astro.config.mjs` so existing links don't 404.

| Path | What it is |
| --- | --- |
| `src/data/site.ts` | Every word on the site. Start here to edit content. |
| `src/pages/index.astro` | The page: hero plus four sections, and the theme toggle. |
| `src/components/LiquidMark.astro` | The chrome `jc` monogram. Raw WebGL2. |
| `src/components/Rail.astro` | Left rail: section nav and progress dot. |
| `src/components/Work.astro` | Projects, expanded in place. |
| `src/components/Timeline.astro` | The Path list. |
| `src/components/Clocks.astro` | Live local time per location. |
| `src/pages/og.astro` | Source frame for the social card. Not linked. |
| `scripts/` | Asset generators — see `scripts/README.md`. |

Layout is one CSS grid on `.shell`: a fixed-width rail column, a fixed
`--rail-gap`, then the content. Below `60rem` the rail is hidden and the grid
collapses to a single column. The knobs are all at the top of
`src/styles/global.css`.

## The chrome monogram

`public/jc-mask.png` is a baked bevel map of the glyphs: red channel is depth
(0 at the outline, 1 at the medial axis), green is coverage. The shader takes the
gradient of that depth to get a surface normal and refracts a flowing band
pattern through it.

The depth map comes from a Poisson relaxation far too slow to run on page load,
so `scripts/gen-mask.mjs` solves it once, offline. That keeps the runtime cost to
one texture upload plus one fragment shader over a 4-vertex triangle strip — no
three.js, no ogl, no React Three Fiber.

Regenerate it if you change the mark or the font, then paste the printed metrics
into the custom properties at the top of `LiquidMark.astro`.

It degrades in three steps: no WebGL2 falls back to a styled text mark;
`prefers-reduced-motion` renders one static frame; scrolling out of view or
hiding the tab parks the render loop.

## Motion

Reveals are CSS scroll-driven animations (`animation-timeline: view()`), so they
run off the main thread and cost no JavaScript. They're wrapped in `@supports`
and gated on `prefers-reduced-motion`, and content is **visible by default** —
browsers without scroll timelines get plain content rather than a blank page.

No smooth-scroll library. Native `scroll-behavior` only.

The rail's progress dot and its active highlight both derive from a single scroll
probe in `Rail.astro`, so they can't drift apart.

## Generated assets

`public/` holds four committed, generated files. Don't hand-edit them; re-run the
script instead.

| Asset | Script |
| --- | --- |
| `jc-mask.png` | `npm run gen:mask` |
| `og.png` | `npm run gen:og` (needs `npm run dev` running) |
| `favicon-*.png`, `apple-touch-icon.png` | `npm run gen:favicon` |

## Content

`src/data/site.ts` carries `TODO(jacob)` markers on what still needs filling in:
links for CounterTime / FF / the AWS hackathon, a line on the Amazon internship,
and the 2023 timeline entry.
