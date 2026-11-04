import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, layout, fitRows, freeSpans } from './index.js';

const measure = (s) => s.length; // monospace: 1 unit per char
const text = 'The moon rose over the eastern roof­tops exactly where every­body had left it, a well-known habit.';
const rejoin = (lines) => lines.map((l) => l.text + (l.mid ? '' : ' ')).join('').trim();

test('freeSpans subtracts obstacles and drops slivers', () => {
  assert.deepEqual(freeSpans(0, 20, [[5, 15]], 3), [[0, 5], [15, 20]]);
  assert.deepEqual(freeSpans(0, 20, [[2, 15]], 3), [[15, 20]]);
  assert.deepEqual(freeSpans(0, 20, [[-5, 30]], 3), []);
});

test('lines wrap around an obstacle without overlap and keep every word in order', () => {
  const paras = prepare([text], measure);
  const block = [6, 13]; // obstacle covers x 6..13 on rows 1–3
  const blocked = (x0, x1, y0) => (y0 >= 1 && y0 < 4 ? [block.slice()] : []);
  const opts = { paras, cols: [{ x: 0, w: 20 }], lh: 1, blocked, measure, minSpan: 3 };
  const rows = fitRows(opts);
  const { lines, done } = layout({ ...opts, rows });
  assert.ok(done);
  for (const l of lines) {
    assert.ok(l.used <= l.w + 0.01, `line "${l.text}" overflows its span`);
    if (l.y >= 1 && l.y < 4) assert.ok(l.x + l.w <= block[0] || l.x >= block[1], `line "${l.text}" overlaps the obstacle`);
  }
  assert.ok(lines.some((l) => l.y === 1 && l.x >= block[1]), 'text continues on the far side of the obstacle');
  assert.ok(lines.some((l) => l.hy), 'a soft hyphen was used');
  assert.equal(rejoin(lines), text.replace(/­/g, ''));
});

test('a growing obstacle needs more rows, never fewer', () => {
  const paras = prepare([text, text], measure);
  const base = { paras, cols: [{ x: 0, w: 24 }, { x: 26, w: 24 }], lh: 1, measure, minSpan: 3 };
  const small = fitRows({ ...base, blocked: (x0, x1, y0) => (y0 < 3 && x0 > 20 ? [[24, 36]] : []) });
  const big = fitRows({ ...base, blocked: (x0, x1, y0) => (y0 < 8 && x0 > 20 ? [[20, 40]] : []) });
  assert.ok(big >= small);
});
