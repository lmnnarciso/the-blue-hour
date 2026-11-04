// The Blue Hour: grayscale+alpha illustrations (black = full ink, white = no ink, alpha = silhouette).
const ink = v => { const g = Math.round(255 * (1 - v)); return `rgb(${g},${g},${g})`; };
// mulberry32 seeded PRNG
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const TAU = Math.PI * 2;
// filled ellipse in ink v, optional rim stroke (rimV, lineWidth)
const el = (c, x, y, rx, ry, v, rot = 0, rimV, lw) => {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (v != null) { c.fillStyle = typeof v === 'string' ? v : ink(v); c.fill(); }
  if (rimV != null) { c.strokeStyle = ink(rimV); c.lineWidth = lw; c.stroke(); }
};
// filled bezier path from an array of [op, ...coords] in fractions of w,h
const path = (c, w, h, segs, v, rimV, lw) => {
  c.beginPath();
  segs.forEach(([op, ...p]) => c[op](...p.map((n, i) => n * (i % 2 ? h : w))));
  c.closePath(); c.fillStyle = ink(v); c.fill();
  if (rimV != null) { c.strokeStyle = ink(rimV); c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
};

// shared moon body: shaded disc of diameter k*size, mottling, maria, craters, dark rim
function drawMoon(ctx, w, h, k) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * k / 2, r = rng(7);
  const g = ctx.createRadialGradient(cx - .35 * R, cy - .35 * R, 0, cx, cy, R * 1.05);
  g.addColorStop(0, ink(.24)); g.addColorStop(.7, ink(.4)); g.addColorStop(1, ink(.66));
  ctx.save();
  el(ctx, cx, cy, R, R, g);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  for (let i = 0; i < 26; i++) { // soft mottling
    const a = r() * TAU, d = Math.sqrt(r()) * .9 * R;
    el(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, (.03 + r() * .05) * R, (.03 + r() * .05) * R, .3 + r() * .16);
  }
  [[-.25, -.1, .3, .22, .3, .74], [.28, .22, .24, .2, -.4, .7], [.0, .55, .2, .12, 0, .76], [.38, -.3, .16, .12, .5, .72], [-.5, .3, .1, .1, 0, .68]]
    .forEach(([x, y, rx, ry, rot, v]) => el(ctx, cx + x * R, cy + y * R, rx * R, ry * R, v, rot)); // maria
  [[-.4, -.35, .1], [.3, -.55, .07], [.55, .05, .09], [-.1, .35, .1], [-.62, .05, .06], [.12, -.12, .06], [.55, .45, .07]]
    .forEach(([x, y, cr]) => { // craters: dark lip, light floor
      const X = cx + x * R, Y = cy + y * R, q = cr * R;
      el(ctx, X, Y, q, q, .7); el(ctx, X - .15 * q, Y - .15 * q, q * .72, q * .72, .06);
    });
  ctx.restore();
  const rw = Math.max(2.5, R * .04);
  el(ctx, cx, cy, R - rw / 2, R - rw / 2, null, 0, .78, rw);
}

export const ART = {
  // full moon: lit upper-left, dense rim, maria blotches and craters
  moon(ctx, w, h) { drawMoon(ctx, w, h, .92); },

  // five overlapping balloons on converging strings with a bow
  balloons(ctx, w, h) {
    const B = [[.19, .46, .17, .155, .42], [.82, .45, .16, .15, .5], [.30, .22, .22, .2, .55], [.68, .21, .22, .2, .45], [.50, .41, .22, .2, .65]];
    const lw = Math.max(2.5, w * .02), px = .5 * w, py = .86 * h;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = ink(.85); ctx.lineWidth = Math.max(2.5, w * .018);
    B.forEach(([x, y, rx, ry], i) => { // strings from knots to the gathering point
      const kx = x * w, ky = (y + ry) * h + lw * 1.8, side = i % 2 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.quadraticCurveTo(kx + (px - kx) * .2 + side * .05 * w, ky + (py - ky) * .6, px, py); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + .04 * w, py + .1 * h, px - .03 * w, py + .13 * h); ctx.stroke();
    el(ctx, px - .09 * w, py + .015 * h, .09 * w, .035 * h, .85, -.4); el(ctx, px + .09 * w, py + .015 * h, .09 * w, .035 * h, .85, .4); // bow
    el(ctx, px, py, .025 * w, .02 * h, .92);
    B.forEach(([x, y, rx, ry, v]) => {
      const cx = x * w, cy = y * h, X = rx * w, Y = ry * h;
      const g = ctx.createRadialGradient(cx - .35 * X, cy - .35 * Y, 0, cx, cy, X * 1.15);
      g.addColorStop(0, ink(v - .12)); g.addColorStop(1, ink(v + .2));
      el(ctx, cx, cy, X, Y, g, 0, .85, lw);
      el(ctx, cx - .42 * X, cy - .42 * Y, .2 * X, .3 * Y, .08, -.6); // highlight
      path(ctx, w, h, [['moveTo', x - .03, y + ry - .005], ['lineTo', x + .03, y + ry - .005], ['lineTo', x, y + ry + .03]], .85); // knot
    });
    ctx.restore();
  },

  // rubber duck facing left with beak, eye, wing and two wave strokes
  duck(ctx, w, h) {
    const lw = Math.max(2.5, w * .02);
    ctx.save(); ctx.lineCap = 'round';
    path(ctx, w, h, [['moveTo', .2, .58], ['bezierCurveTo', .18, .82, .38, .88, .58, .88], ['bezierCurveTo', .8, .88, .93, .74, .96, .42],
      ['bezierCurveTo', .86, .55, .78, .5, .72, .42], ['bezierCurveTo', .6, .38, .4, .4, .3, .48]], .5, .85, lw); // body + tail
    el(ctx, .3 * w, .31 * h, .17 * w, .22 * h, .5, 0, .85, lw); // head
    el(ctx, .1 * w, .38 * h, .09 * w, .055 * h, .92, .15, .95, lw * .6); // beak
    path(ctx, w, h, [['moveTo', .42, .58], ['bezierCurveTo', .5, .8, .72, .78, .8, .56], ['bezierCurveTo', .66, .62, .54, .55, .42, .58]], .66, .9, lw * .8); // wing
    el(ctx, .22 * w, .26 * h, .035 * w, .07 * h, .14, -.5); el(ctx, .58 * w, .47 * h, .11 * w, .03 * h, .2, -.1); // highlights
    el(ctx, .26 * w, .3 * h, .03 * w, .04 * h, .97); el(ctx, .252 * w, .285 * h, Math.max(1.5, .01 * w), Math.max(1.5, .01 * w), .03); // eye + glint
    ctx.strokeStyle = ink(.75); ctx.lineWidth = lw;
    [[.14, .42], [.56, .84]].forEach(([a, b]) => { // waves
      ctx.beginPath(); ctx.moveTo(a * w, .95 * h);
      ctx.bezierCurveTo((a + (b - a) * .25) * w, .91 * h, (a + (b - a) * .35) * w, .91 * h, (a + (b - a) * .5) * w, .95 * h);
      ctx.bezierCurveTo((a + (b - a) * .65) * w, .99 * h, (a + (b - a) * .75) * w, .99 * h, b * w - lw, .95 * h); ctx.stroke();
    });
    ctx.restore();
  },

  // round star chart: dense sky, double ring, ticks, stars, constellations, dashed ecliptic
  chart(ctx, w, h) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - .5, r = rng(11), lw = Math.max(3, R * .025), gap = R - lw - 2;
    ctx.save();
    el(ctx, cx, cy, R, R, .88);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    el(ctx, cx, cy, R - lw / 2, R - lw / 2, null, 0, .95, lw);
    el(ctx, cx, cy, gap, gap, null, 0, .15, Math.max(1.5, R * .012));
    ctx.strokeStyle = ink(.1); ctx.lineWidth = 1.5;
    for (let i = 0; i < 72; i++) { // ticks
      const a = i / 72 * TAU, o = gap - 3, n = o - R * (i % 6 ? .04 : .08);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * n, cy + Math.sin(a) * n); ctx.lineTo(cx + Math.cos(a) * o, cy + Math.sin(a) * o); ctx.stroke();
    }
    ctx.setLineDash([R * .07, R * .05]); ctx.strokeStyle = ink(.25); // ecliptic
    el(ctx, cx + .14 * R, cy - .1 * R, .55 * R, .55 * R, null, 0, .25, 1.5); ctx.setLineDash([]);
    const F = [[[-.55, -.4], [-.4, -.25], [-.25, -.3], [-.1, -.12]], [[.3, -.55], [.45, -.4], [.4, -.2], [.6, -.1]],
      [[-.5, .3], [-.3, .45], [-.1, .35], [-.15, .6]], [[.2, .25], [.4, .4], [.55, .3], [.3, .6], [.2, .25]]];
    ctx.strokeStyle = ink(.2); ctx.lineWidth = 1.5;
    F.forEach(f => { ctx.beginPath(); f.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](cx + x * R, cy + y * R)); ctx.stroke(); });
    F.forEach(f => f.forEach(([x, y]) => el(ctx, cx + x * R, cy + y * R, 2.4, 2.4, .04)));
    for (let i = 0; i < 52; i++) { // random stars
      const a = r() * TAU, d = Math.sqrt(r()) * .78 * R, big = i % 9 === 0, s = big ? 2.6 + r() * .6 : 1.2 + r() * 1.2;
      el(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s, big ? .02 : .02 + r() * .08);
    }
    ctx.restore();
  },

  // moon phase for age in days: lit side mottled, unlit side pale but opaque with a thin rim ring
  phase(age) {
    return (ctx, w, h) => {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .45, c = Math.cos(TAU * age / 29.530588), waxing = age < 14.765294;
      drawMoon(ctx, w, h, .9);
      const img = ctx.getImageData(0, 0, w, h), d = img.data, ring = Math.max(2, R * .04);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const nx = (x + .5 - cx) / R, ny = (y + .5 - cy) / R, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const t = c * Math.sqrt(1 - ny * ny);
        if (waxing ? nx > t : nx < -t) continue; // lit
        const g = Math.round(255 * (1 - (Math.sqrt(d2) * R >= R - ring ? .5 : .08))), i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
  },
};
