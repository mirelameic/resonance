import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrottle, sleep } from '../scripts/lib/rateLimit.mjs';

test('createThrottle enforces minimum spacing between resolved calls', async () => {
  const throttle = createThrottle(50);
  const start = Date.now();
  await Promise.all([throttle(), throttle(), throttle()]);
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 100, `expected at least 100ms of spacing across 3 calls, got ${elapsed}ms`);
});

test('createThrottle does not delay a single call', async () => {
  const throttle = createThrottle(200);
  const start = Date.now();
  await throttle();
  assert.ok(Date.now() - start < 50, 'a single call should resolve immediately');
});

test('sleep resolves after roughly the requested delay', async () => {
  const start = Date.now();
  await sleep(30);
  assert.ok(Date.now() - start >= 30);
});
