import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECADES, decadeLabel } from '../scripts/lib/coverage.mjs';

test('DECADES spans from 1900s through 2020s with no gaps', () => {
  assert.equal(DECADES[0].label, '1900s');
  assert.equal(DECADES[DECADES.length - 1].label, '2020s');
  for (let i = 1; i < DECADES.length; i++) {
    assert.equal(DECADES[i].start, DECADES[i - 1].end + 1, `gap between ${DECADES[i - 1].label} and ${DECADES[i].label}`);
  }
});

test('decadeLabel matches the DECADES list convention', () => {
  assert.equal(decadeLabel(2002), '2000s');
  assert.equal(decadeLabel(1968), '1960s');
  assert.equal(decadeLabel(1899), '1890s');
});
