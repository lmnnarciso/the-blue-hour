# The Blue Hour

A broadsheet of gentle, absurd news printed in one cobalt ink. Body text is set line by line and reflows, every frame, around the real outline of each dithered illustration as it resolves, bobs, drifts, spins or grows on hover.

Inspired by “The Blue Hour”, an original piece by keshav ([@kshvbgde](https://x.com/kshvbgde/status/2116270360417243293)). Copy and drawings here are original.

## Layout

| Path | What it is |
| --- | --- |
| `packages/reflow` | Line breaker: cached canvas `measureText` widths, free spans per line after subtracting obstacles, greedy fill with soft-hyphen breaks. Pure, DOM-free except `measurer()`. |
| `packages/dither` | 8×8 Bayer ordered dither in one ink, plus per-row silhouettes sampled from the art's alpha mask. |
| `apps/paper` | The Vite site: page markup and copy (`index.html`), illustrations (`art.js`), motion and DOM painting (`main.js`). |

## Commands

```bash
pnpm install
pnpm dev     # http://localhost:5173
pnpm test    # node:test in each package
pnpm build   # apps/paper/dist
```

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## How the reflow works

1. Each paragraph is hyphenated once (Liang patterns via `hyphen`) and split into words; widths are cached.
2. Column heights are fixed once per width using the art's largest possible envelope, so motion never shifts the page.
3. Each frame, an illustration that moved reports, for every line band, the x-range between its leftmost and rightmost inked cells (+ padding). The breaker subtracts those ranges and fills the remaining spans.
4. Lines are absolutely positioned `<span>`s inside their original `<p>`, justified with per-line `word-spacing`, so the text stays selectable and reads in order for screen readers. Only flows whose art moved are re-laid out, and only changed spans are touched.
5. `prefers-reduced-motion`: art is drawn fully resolved, nothing moves, layout runs once.
