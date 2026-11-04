// @blue-hour/reflow — a small line breaker for text that flows around shapes.
// Words are measured once (cached). Every line slot asks which x-ranges are blocked,
// then fills the free spans left to right, hyphenating at soft hyphens.

const EPS = 0.01;

/** Cached string width for a CSS font, via canvas measureText. Create it after the font has loaded. */
export function measurer(font) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font;
  const cache = new Map();
  return (s) => {
    let w = cache.get(s);
    if (w === undefined) cache.set(s, (w = ctx.measureText(s).width));
    return w;
  };
}

/** Paragraph strings (may contain U+00AD) → arrays of { pieces, text, w }. Breaks allowed at soft hyphens and after hyphens or em dashes. */
export function prepare(paragraphs, measure) {
  return paragraphs
    .map((text) => text.split(/\s+/).filter(Boolean).map((word) => {
      const pieces = word.split(/(?<=[-—])(?=.)|­/);
      const t = pieces.join('');
      return { pieces, text: t, w: measure(t) };
    }))
    .filter((words) => words.length);
}

/** [x0, x1] minus blocked intervals, keeping pieces at least minW wide. */
export function freeSpans(x0, x1, blocked, minW) {
  blocked.sort((a, b) => a[0] - b[0]);
  const out = [];
  let x = x0;
  for (const [a, b] of blocked) {
    if (b <= x) continue;
    if (a >= x1) break;
    if (a - x >= minW) out.push([x, a]);
    x = Math.max(x, b);
  }
  if (x1 - x >= minW) out.push([x, x1]);
  return out;
}

function fill(words, wi, pi, width, measure, space, hyW, force) {
  const parts = [];
  let used = 0;
  while (wi < words.length) {
    const word = words[wi];
    const text = pi ? word.pieces.slice(pi).join('') : word.text;
    const w = pi ? measure(text) : word.w;
    const gap = parts.length ? space : 0;
    if (used + gap + w <= width + EPS) { parts.push(text); used += gap + w; wi++; pi = 0; continue; }
    for (let j = word.pieces.length - 1; j > pi; j--) {
      const pre = word.pieces.slice(pi, j).join('');
      const hy = !/[-—]$/.test(pre);
      const pw = measure(pre) + (hy ? hyW : 0);
      if (used + gap + pw <= width + EPS) {
        parts.push(pre);
        return { text: parts.join(' '), used: used + gap + pw, n: parts.length, wi, pi: j, hy, mid: true };
      }
    }
    if (!parts.length && force) { parts.push(text); used = w; wi++; pi = 0; }
    break;
  }
  return parts.length ? { text: parts.join(' '), used, n: parts.length, wi, pi, hy: false, mid: false } : null;
}

/**
 * Lay prepared paragraphs into columns on a fixed baseline grid.
 * blocked(x0, x1, y0, y1) returns [[a, b], …] x-ranges an obstacle covers in that band.
 * Lines: { p, x, y, w, text, used, gaps, hy (show a hyphen), mid (ends inside a word), last (ends its paragraph) }.
 */
export function layout({ paras, cols, rows, lh, blocked, measure, indent = 0, minSpan = 24 }) {
  const space = measure(' '), hyW = measure('-');
  const lines = [];
  let p = 0, wi = 0, pi = 0;
  for (const col of cols) {
    for (let r = 0; r < rows && p < paras.length; r++) {
      const y = r * lh;
      const spans = freeSpans(col.x, col.x + col.w, blocked(col.x, col.x + col.w, y, y + lh), minSpan);
      for (const [a, b] of spans) {
        const x = a + (wi === 0 && pi === 0 && p > 0 ? indent : 0);
        const res = fill(paras[p], wi, pi, b - x, measure, space, hyW, b - a >= col.w - 0.5);
        if (!res) continue;
        const last = res.wi >= paras[p].length;
        lines.push({ p, x, y, w: b - x, text: res.text, used: res.used, gaps: res.n - 1, hy: res.hy, mid: res.mid, last });
        wi = res.wi; pi = res.pi;
        if (last) { p++; wi = pi = 0; break; } // a new paragraph starts on a new line
      }
    }
  }
  return { lines, done: p >= paras.length };
}

/** Fewest rows per column that fit all the text, scanning up from a no-obstacle lower bound. */
export function fitRows(opts, max = 600) {
  const total = opts.paras.flat().reduce((s, w) => s + w.w, 0);
  const width = opts.cols.reduce((s, c) => s + c.w, 0);
  for (let rows = Math.max(1, Math.floor(total / width)); rows <= max; rows++) {
    if (layout({ ...opts, rows }).done) return rows;
  }
  return max;
}
