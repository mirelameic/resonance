import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGE_SAMPLES, DECADES, ISO2_TO_COUNTRY_NAME, decadeLabel } from '../scripts/lib/coverage.mjs';

test('LANGUAGE_SAMPLES includes Brazil explicitly', () => {
  assert.ok(LANGUAGE_SAMPLES.some((l) => l.displayCountry === 'Brazil'));
});

test('LANGUAGE_SAMPLES spans a broad set of countries, not just English-speaking ones', () => {
  const countries = new Set(LANGUAGE_SAMPLES.map((l) => l.displayCountry));
  assert.ok(countries.size >= 10, 'expected broad country/language sampling');
});

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

test('ISO2_TO_COUNTRY_NAME covers every LANGUAGE_SAMPLES country', () => {
  const names = new Set(Object.values(ISO2_TO_COUNTRY_NAME));
  for (const { displayCountry } of LANGUAGE_SAMPLES) {
    assert.ok(names.has(displayCountry), `${displayCountry} missing from ISO2_TO_COUNTRY_NAME`);
  }
});
