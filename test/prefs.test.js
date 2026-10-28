import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, normalizeSettings, parseDealNumber, parseLaunchOptions,
} from '../src/prefs.js';

test('stored settings are validated', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings('draw 3'), DEFAULT_SETTINGS);
  const custom = { drawCount: 3, winnableOnly: true };
  assert.deepEqual(normalizeSettings(custom), custom);
  const invalid = { drawCount: 2, winnableOnly: 'yes' };
  assert.deepEqual(normalizeSettings(invalid), { drawCount: 1, winnableOnly: false });
  assert.deepEqual(normalizeSettings({}), { drawCount: 1, winnableOnly: false });
});

test('deal numbers are whole numbers from 1 to 999999', () => {
  assert.equal(parseDealNumber('123'), 123);
  assert.equal(parseDealNumber(' 42 '), 42);
  assert.equal(parseDealNumber('999999'), 999999);
  assert.equal(parseDealNumber(7), 7);
  for (const bad of ['0', '1000000', '-5', '12.5', 'abc', '', '1e3', null, undefined]) {
    assert.equal(parseDealNumber(bad), null, String(bad));
  }
});

test('launch options come from the query string', () => {
  assert.deepEqual(parseLaunchOptions(''), { demo: false, deal: null, drawCount: null });
  assert.deepEqual(parseLaunchOptions('?demo'), { demo: true, deal: null, drawCount: null });
  assert.deepEqual(parseLaunchOptions('?deal=77&draw=3'), { demo: false, deal: 77, drawCount: 3 });
  assert.deepEqual(parseLaunchOptions('?deal=abc&draw=2'), { demo: false, deal: null, drawCount: 1 });
});
