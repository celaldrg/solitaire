import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  DEFAULT_LANGUAGE, LANGUAGES, STRINGS, formatTime, normalizeLanguage, otherLanguage, translate,
} from '../src/i18n.js';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const sources = readdirSync(new URL('src/', root))
  .map((name) => readFileSync(new URL(`src/${name}`, root), 'utf8'))
  .join('\n');
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('every language has the same keys as English', () => {
  const english = Object.keys(STRINGS.en).sort();
  for (const language of LANGUAGES) {
    assert.deepEqual(Object.keys(STRINGS[language]).sort(), english, language);
  }
});

test('translations keep the placeholders of the English text', () => {
  for (const [key, text] of Object.entries(STRINGS.en)) {
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(text), key);
  }
});

test('no string is empty', () => {
  for (const language of LANGUAGES) {
    for (const [key, text] of Object.entries(STRINGS[language])) {
      assert.ok(text.trim().length > 0, `${language}.${key}`);
    }
  }
});

test('every key used by the page exists', () => {
  const used = [...html.matchAll(/data-i18n(?:-title|-label)?="(\w+)"/g)].map((match) => match[1]);
  assert.ok(used.length > 40);
  for (const key of used) assert.ok(key in STRINGS.en, key);
});

test('every key used by the scripts exists', () => {
  const used = [...sources.matchAll(/(?:toast|translate)\([^'")]*'(\w+)'/g)].map((match) => match[1]);
  assert.ok(used.length > 5);
  for (const key of used) assert.ok(key in STRINGS.en, key);
});

test('every string is used somewhere', () => {
  for (const key of Object.keys(STRINGS.en)) {
    const quoted = new RegExp(`["']${key}["']`);
    assert.ok(quoted.test(html) || quoted.test(sources), key);
  }
});

test('translate fills placeholders and falls back to English, then to the key', () => {
  assert.equal(translate('en', 'drawRestart', { count: 3 }), 'Draw 3: this deal starts over.');
  assert.equal(translate('tr', 'drawRestart', { count: 3 }), 'Her çekişte 3 kart: bu el baştan başlıyor.');
  assert.equal(translate('en', 'drawRestart'), 'Draw {count}: this deal starts over.');
  assert.equal(translate('de', 'undo'), 'Undo');
  assert.equal(translate('tr', 'missingKey'), 'missingKey');
});

test('language codes are normalized', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('de'), 'en');
  assert.equal(normalizeLanguage(null), 'en');
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
  assert.equal(otherLanguage('xx'), 'tr');
});

test('formatTime shows minutes and seconds, and hours when needed', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(7.9), '0:07');
  assert.equal(formatTime(247), '4:07');
  assert.equal(formatTime(3600), '1:00:00');
  assert.equal(formatTime(3723), '1:02:03');
  assert.equal(formatTime(-5), '0:00');
});
