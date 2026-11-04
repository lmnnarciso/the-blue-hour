import { hyphenateSync } from 'hyphen/en';
import { measurer, prepare, layout, fitRows } from '@blue-hour/reflow';
import { toneMap, render, profile } from '@blue-hour/dither';
import { ART } from './art.js';

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const $ = (s) => document.querySelector(s);
const cssNum = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name));
const FS = cssNum('--fs'), LH = cssNum('--lh'), GUTTER = cssNum('--gutter');
const TEXT = `400 ${FS}px "Source Serif 4", Georgia, serif`;
const DISPLAY = '"Newsreader", Georgia, serif';
const PAD_X = 9, PAD_Y = 2, MIN_SPAN = 26, MIN_COL = 180, MAX_STRETCH = FS * 0.9;
const CELLS = [16, 8, 4, 2];
const STILL = { x: 0, y: 0 };
const MOTION = { bob: { x: 0, y: 6 }, drift: { x: 10, y: 0 }, spin: STILL };
const ENVELOPE = 1.13; // largest scale an illustration reaches: reveal overshoot × hover
const TAU = Math.PI * 2, SYNODIC = 29.530588853, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const moonAge = (t) => ((((t - NEW_MOON) / 864e5) % SYNODIC) + SYNODIC) % SYNODIC;
const litFraction = (age) => (1 - Math.cos((TAU * age) / SYNODIC)) / 2;
const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const phaseName = (age) => PHASES[Math.floor((age / SYNODIC) * 8 + 0.5) % 8];

function bezier(x1, y1, x2, y2) {
  const f = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 18; i++) { t = (lo + hi) / 2; if (f(t, x1, x2) < x) lo = t; else hi = t; }
    return f(t, y1, y2);
  };
}
const popIn = bezier(0.34, 1.56, 0.64, 1);

let measure, DROP, bootAt = null;
const figures = [], flows = [];

/* ---------- illustrations ---------- */

function figure(canvas, draw, w, h, { flow = null, motion = null, delay = 0 } = {}) {
  const map = toneMap(draw, w, h);
  const k = Math.ceil((devicePixelRatio || 1) * 1.1); // integer backing scale keeps cells crisp
  canvas.width = map.w * k;
  canvas.height = map.h * k;
  const f = {
    canvas, ctx: canvas.getContext('2d'), map, w: map.w, h: map.h, flow, delay,
    motion: REDUCE ? null : motion,
    profiles: Object.fromEntries(CELLS.map((c) => [c, profile(map, c)])),
    cx: 0, cy: 0, k: 1, S: NaN, dx: 0, dy: 0, cell: 0, angle: 0,
    t0: null, seen: false, live: false, hv: 0, hvT: 0, tl: 0,
  };
  if (REDUCE) {
    f.t0 = -Infinity;
    canvas.parentElement.classList.add('on');
    step(f, 0);
  } else {
    canvas.addEventListener('pointerenter', () => { f.hvT = 1; f.live = true; });
    canvas.addEventListener('pointerleave', () => { f.hvT = 0; f.live = true; });
  }
  canvas._fig = f;
  figures.push(f);
  return f;
}

/** Advance one illustration; returns true when its silhouette moved. */
function step(f, now) {
  const p = Math.min(1, (now - f.t0) / 900);
  const cell = CELLS[Math.min(3, Math.floor(p * 4))]; // 16 → 8 → 4 → 2 px
  const dt = Math.min(64, now - (f.tl || now));
  f.tl = now;
  if (f.hv !== f.hvT) f.hv = f.hvT > f.hv ? Math.min(f.hvT, f.hv + dt / 300) : Math.max(f.hvT, f.hv - dt / 300);
  const grow = f.hv * f.hv * (3 - 2 * f.hv);
  const S = f.k * (0.6 + 0.4 * popIn(p)) * (1 + 0.08 * grow);
  const ti = Math.max(0, now - f.t0 - 900);
  const dx = f.motion === 'drift' ? 10 * Math.sin((TAU * ti) / 6000) : 0;
  const dy = f.motion === 'bob' ? 6 * Math.sin((TAU * ti) / 3000) : 0;
  const angle = f.motion === 'spin' ? (TAU * ti) / 90000 : 0;
  if (cell !== f.cell || Math.abs(angle - f.angle) > 0.006) { render(f.ctx, f.map, cell, angle); f.angle = angle; }
  const moved = cell !== f.cell || S !== f.S || dx !== f.dx || dy !== f.dy;
  if (moved) {
    Object.assign(f, { cell, S, dx, dy });
    f.canvas.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(${S.toFixed(4)})`;
  }
  f.live = p < 1 || f.hv !== f.hvT || !!f.motion;
  return moved;
}

/* ---------- flows: columns of text around illustrations ---------- */

function dropMetrics() {
  const c = document.createElement('canvas').getContext('2d');
  c.font = TEXT;
  const b = c.measureText('H');
  const baseline = (LH - (b.fontBoundingBoxAscent + b.fontBoundingBoxDescent)) / 2 + b.fontBoundingBoxAscent;
  c.font = `500 100px ${DISPLAY}`;
  const size = ((2 * LH + b.actualBoundingBoxAscent) / c.measureText('H').actualBoundingBoxAscent) * 100;
  c.font = `500 ${size}px ${DISPLAY}`;
  const d = c.measureText('H');
  const top = 2 * LH + baseline - ((size - (d.fontBoundingBoxAscent + d.fontBoundingBoxDescent)) / 2 + d.fontBoundingBoxAscent);
  return { size, top, width: (ch) => c.measureText(ch).actualBoundingBoxRight };
}

function setupFlow(el) {
  const ps = [...el.querySelectorAll(':scope > p')].filter((p) => p.textContent.trim());
  const texts = ps.map((p) => p.textContent.replace(/\s+/g, ' ').trim());
  const cap = document.createElement('span');
  cap.className = 'dropcap';
  cap.textContent = texts[0][0] + (texts[0][1] === ' ' ? ' ' : '');
  cap.style.cssText = `font-size:${DROP.size}px;top:${DROP.top}px`;
  texts[0] = texts[0].slice(1).trimStart();
  ps.forEach((p) => (p.textContent = ''));
  ps[0].append(cap);
  const flow = {
    el, story: el.closest('.story'), ps, pools: ps.map(() => []),
    paras: prepare(texts.map((t) => hyphenateSync(t)), measure),
    capRect: { x0: -1, x1: DROP.width(cap.textContent.trim()) + 6, y0: 0, y1: 3 * LH - 1 },
    figs: [], rules: [], visible: false, inkedAt: null, dirty: false, count: 0, hy: 0,
  };
  el._flow = flow;
  for (const fe of el.querySelectorAll('.art')) {
    const d = fe.dataset;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', d.alt || '');
    fe.prepend(canvas);
    const f = figure(canvas, ART[d.art], +d.w, +d.h, { flow, motion: d.motion, delay: 300 });
    Object.assign(f, { x: +d.x, y: +d.y, caption: fe.querySelector('figcaption') });
    canvas.style.width = `${f.w}px`;
    canvas.style.height = `${f.h}px`;
    flow.figs.push(f);
  }
  return flow;
}

/** Obstacle query for the line breaker. env = the widest the art can ever get (sizes the columns once). */
function blockedFor(flow, env) {
  return (x0, x1, y0, y1) => {
    const out = [];
    for (const r of flow.rects) if (r.y0 < y1 && r.y1 > y0) out.push([r.x0, r.x1]);
    for (const f of flow.figs) {
      if (!env && f.t0 == null) continue;
      const m = env ? MOTION[f.motion] || STILL : STILL;
      for (const cell of env ? CELLS : [f.cell]) {
        const S = env ? f.k * ENVELOPE : f.S, rows = f.profiles[cell], ch = cell * S;
        const ox = f.cx + (env ? 0 : f.dx) - (f.w * S) / 2, oy = f.cy + (env ? 0 : f.dy) - (f.h * S) / 2;
        const r0 = Math.max(0, Math.floor((y0 - PAD_Y - m.y - oy) / ch));
        const r1 = Math.min(rows.length - 1, Math.floor((y1 + PAD_Y + m.y - oy) / ch));
        let lo = Infinity, hi = -Infinity;
        for (let r = r0; r <= r1; r++) {
          const row = rows[r];
          if (row) { lo = Math.min(lo, row[0]); hi = Math.max(hi, row[1]); }
        }
        if (lo < hi) out.push([f.side === 'left' ? -1e9 : ox + lo * S - PAD_X - m.x, f.side === 'right' ? 1e9 : ox + hi * S + PAD_X + m.x]);
      }
    }
    return out;
  };
}

/** Columns, art positions and the fixed column height for the current width. */
function arrange(flow) {
  const W = flow.el.clientWidth;
  const n = Math.max(1, Math.min(+flow.el.dataset.cols || 1, Math.floor((W + GUTTER) / (MIN_COL + GUTTER))));
  const cw = (W - GUTTER * (n - 1)) / n;
  flow.cols = Array.from({ length: n }, (_, i) => ({ x: i * (cw + GUTTER), w: cw }));
  flow.rects = [flow.capRect];
  flow.figs.forEach((f, i) => {
    f.k = Math.min(1, (n === 1 ? W * 0.5 : cw * 1.2) / f.w);
    const hw = (f.w * f.k) / 2, hh = (f.h * f.k) / 2;
    f.side = n === 1 ? (i % 2 ? 'left' : 'right') : null; // one column: a shaped float, text on one side only
    f.cx = n === 1 ? (i % 2 ? hw : W - hw) : Math.min(W - hw, Math.max(hw, f.x * W));
    f.cy = f.y * LH + hh;
    f.canvas.style.left = `${f.cx - f.w / 2}px`;
    f.canvas.style.top = `${f.cy - f.h / 2}px`;
    const capW = Math.min(W, f.w * f.k + 24);
    const left = Math.min(W - capW, Math.max(0, f.cx - capW / 2));
    const top = f.cy + hh * ENVELOPE + (MOTION[f.motion] || STILL).y + 6;
    Object.assign(f.caption.style, { left: `${left}px`, top: `${top}px`, width: `${capW}px` });
    const capH = f.caption.offsetHeight;
    flow.rects.push({ x0: left - PAD_X, x1: left + capW + PAD_X, y0: top - PAD_Y, y1: top + capH + PAD_Y });
    f.bottom = top + capH;
    f.S = NaN; // force a transform write at the new scale
    if (f.t0 != null) step(f, performance.now());
  });
  const base = { paras: flow.paras, cols: flow.cols, lh: LH, measure, indent: FS, minSpan: MIN_SPAN };
  flow.rows = Math.max(fitRows({ ...base, blocked: blockedFor(flow, true) }), ...flow.figs.map((f) => Math.ceil(f.bottom / LH)));
  flow.opts = { ...base, rows: flow.rows, blocked: blockedFor(flow, false) };
  flow.el.style.height = `${flow.rows * LH}px`;
  flow.rules.forEach((r) => r.remove());
  flow.rules = flow.cols.slice(1).map((c) => {
    const r = document.createElement('div');
    r.className = 'crule';
    r.setAttribute('aria-hidden', 'true');
    r.style.cssText = `left:${c.x - GUTTER / 2 - 0.5}px;height:${flow.rows * LH}px`;
    flow.el.append(r);
    return r;
  });
  relayout(flow);
}

function relayout(flow) {
  const { lines } = layout(flow.opts);
  const per = flow.ps.map(() => []);
  lines.forEach((l, i) => { l.i = i; per[l.p].push(l); });
  per.forEach((ls, i) => paint(flow.ps[i], flow.pools[i], ls));
  flow.count = lines.length;
  flow.hy = lines.reduce((s, l) => s + l.hy, 0);
}

/** Sync a paragraph's line spans with the layout, touching only what changed. */
function paint(p, pool, lines) {
  while (pool.length < lines.length) {
    const s = document.createElement('span');
    s.className = 'ln';
    s.style.setProperty('--i', lines[pool.length].i);
    p.append(s);
    pool.push(s);
  }
  while (pool.length > lines.length) pool.pop().remove();
  lines.forEach((l, i) => {
    const s = pool[i];
    const text = l.text + (l.mid ? '' : ' ');
    if (s._t !== text) { s.textContent = text; s._t = text; }
    if (s._hy !== l.hy) { s.classList.toggle('hy', l.hy); s._hy = l.hy; }
    const tr = `translate(${l.x.toFixed(1)}px,${l.y}px)`;
    if (s._tr !== tr) { s.style.transform = tr; s._tr = tr; }
    const extra = (l.w - l.used) / l.gaps;
    const ws = !l.last && l.gaps > 0 && extra < MAX_STRETCH ? `${extra.toFixed(2)}px` : '';
    if (s._ws !== ws) { s.style.wordSpacing = ws; s._ws = ws; }
  });
}

/* ---------- the rest of the paper ---------- */

function stampDate() {
  const now = new Date();
  const t = $('#today');
  t.dateTime = now.toISOString().slice(0, 10);
  t.textContent = `${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  $('#st-lit').textContent = `${Math.round(litFraction(moonAge(Date.now())) * 100)}%`;
}

function buildMoons() {
  const ol = $('.phases');
  const today = new Date();
  today.setHours(21, 0, 0, 0); // the moon as seen this evening
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const age = moonAge(d.getTime()), pct = Math.round(litFraction(age) * 100), name = phaseName(age);
    const li = document.createElement('li');
    if (d.toDateString() === today.toDateString()) li.className = 'today';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}: ${name}, ${pct}% lit`);
    const day = document.createElement('b');
    day.textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    const info = document.createElement('span');
    info.textContent = `${pct}% · ${name}`;
    li.append(canvas, day, info);
    ol.append(li);
    figure(canvas, ART.phase(age), 88, 88, { delay: i * 90 });
  }
}

let statsAt = 0;
function stats(now) {
  statsAt = now;
  const set = (id, v) => { const e = document.getElementById(id); if (e.textContent !== String(v)) e.textContent = v; };
  set('st-lines', flows.reduce((s, f) => s + f.count, 0));
  set('st-hy', flows.reduce((s, f) => s + f.hy, 0));
  const t = Math.max(0, Math.floor((now - (bootAt ?? now)) / 1000));
  set('st-time', `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
}

let lastFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (now - lastFrame < 14) return; // hold ~60fps on faster displays
  lastFrame = now;
  for (const f of figures) {
    if (f.t0 == null) {
      const base = f.flow ? f.flow.inkedAt : bootAt;
      if (!f.seen || base == null || now < base + f.delay) continue;
      f.t0 = now;
      f.live = true;
      f.canvas.parentElement.classList.add('on');
    }
    if (!f.live || (f.flow && !f.flow.visible)) continue;
    if (step(f, now) && f.flow) f.flow.dirty = true;
  }
  for (const fl of flows) if (fl.dirty) { fl.dirty = false; relayout(fl); }
  if (now - statsAt > 250) stats(now);
}

function ink(section) {
  if (section.classList.contains('inked')) return;
  section.classList.add('inked');
  const flow = section.querySelector('.flow')?._flow;
  if (flow) flow.inkedAt = performance.now();
  setTimeout(() => section.classList.add('settled'), (flow ? flow.count * 8 : 0) + 500);
}

async function boot() {
  stampDate();
  const fonts = [TEXT, `500 60px ${DISPLAY}`, `italic 400 13px ${DISPLAY}`, '400 10px "IBM Plex Mono"'];
  await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3000))]);
  measure = measurer(TEXT);
  DROP = dropMetrics();
  figure($('.o-moon canvas'), ART.moon, 64, 64);
  buildMoons();
  document.querySelectorAll('.flow').forEach((el) => flows.push(setupFlow(el)));
  const page = $('.page');
  let lastW = page.clientWidth;
  flows.forEach(arrange);
  new ResizeObserver(() => {
    if (page.clientWidth === lastW) return;
    lastW = page.clientWidth;
    flows.forEach(arrange);
  }).observe(page);

  root.classList.add('ready');
  const sections = document.querySelectorAll('.story, .moons');
  if (REDUCE) {
    bootAt = performance.now();
    sections.forEach((s) => s.classList.add('inked', 'settled'));
  } else {
    bootAt = performance.now() + 400; // masthead fades in first
    const inkIO = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && ink(e.target)), { threshold: 0.12 });
    setTimeout(() => sections.forEach((s) => inkIO.observe(s)), 400);
    const revealIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target._fig.seen = true; }), { threshold: 0.3 });
    figures.forEach((f) => revealIO.observe(f.canvas));
    const visIO = new IntersectionObserver((es) => es.forEach((e) => { e.target._flow.visible = e.isIntersecting; }), { rootMargin: '120px 0px' });
    flows.forEach((f) => visIO.observe(f.el));
  }
  requestAnimationFrame(frame);
}

boot();
