// @blue-hour/dither — one-ink ordered dither (8×8 Bayer) and per-row silhouettes.
// Art is drawn in grayscale: black = full ink, white = paper; alpha = the shape.

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];
export const PALETTE = ['#8f97e8', '#5a64d8', '#2b35c9', '#1e2aa8'];

/** Rasterise draw(ctx, w, h) into { w, h, ink: 0..1 per px, alpha: 0..255 per px }. */
export function toneMap(draw, w, h) {
  w = Math.round(w); h = Math.round(h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  draw(ctx, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const ink = new Float32Array(w * h), alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { alpha[i] = d[i * 4 + 3]; ink[i] = 1 - d[i * 4] / 255; }
  return { w, h, ink, alpha };
}

/** Paint the map as dither cells of `cell` px onto ctx (backing store may be dpr-scaled). Rotation keeps pixels axis-aligned. */
export function render(ctx, map, cell, angle = 0) {
  const { w, h, ink, alpha } = map;
  const k = ctx.canvas.width / w;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const cos = Math.cos(angle), sin = Math.sin(angle), hx = w / 2, hy = h / 2;
  const runs = PALETTE.map(() => []);
  for (let j = 0, gy = 0; gy < h; j++, gy += cell) {
    for (let i = 0, gx = 0; gx < w; i++, gx += cell) {
      const x = gx + cell / 2 - hx, y = gy + cell / 2 - hy;
      const px = Math.floor(cos * x + sin * y + hx), py = Math.floor(-sin * x + cos * y + hy);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const at = py * w + px;
      if (alpha[at] < 128) continue;
      const v = Math.min(ink[at], 0.92);
      if (v * 64 - 0.5 <= BAYER[(j & 7) * 8 + (i & 7)]) continue;
      runs[Math.min(3, (v * 4) | 0)].push(gx, gy);
    }
  }
  const s = cell * k;
  runs.forEach((r, n) => {
    ctx.fillStyle = PALETTE[n];
    for (let q = 0; q < r.length; q += 2) ctx.fillRect(r[q] * k, r[q + 1] * k, s, s);
  });
}

/** Per cell-row [left, right) extent of the silhouette in local px; null for empty rows. Sampled like render(). */
export function profile({ w, h, alpha }, cell) {
  const rows = [];
  for (let gy = 0; gy < h; gy += cell) {
    const py = Math.min(h - 1, Math.floor(gy + cell / 2));
    let lo = -1, hi = -1;
    for (let gx = 0; gx < w; gx += cell) {
      if (alpha[py * w + Math.min(w - 1, Math.floor(gx + cell / 2))] >= 128) {
        if (lo < 0) lo = gx;
        hi = Math.min(w, gx + cell);
      }
    }
    rows.push(lo < 0 ? null : [lo, hi]);
  }
  return rows;
}
