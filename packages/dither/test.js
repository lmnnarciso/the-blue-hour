import test from 'node:test';
import assert from 'node:assert/strict';
import { profile } from './index.js';

test('profile follows a circle, not its bounding box', () => {
  const w = 40, h = 40, alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - 19.5) ** 2 + (y - 19.5) ** 2 <= 400) alpha[y * w + x] = 255;
  const rows = profile({ w, h, alpha }, 2);
  assert.equal(rows.length, 20);
  const mid = rows[10], top = rows[0];
  assert.deepEqual(mid, [0, 40]);
  assert.ok(top[1] - top[0] <= 16, `top row should be narrow, got ${top}`);
  assert.equal(profile({ w, h, alpha: new Uint8Array(w * h) }, 4)[0], null);
});
