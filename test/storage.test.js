import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readValue, writeValue } from '../src/storage.js';

function memoryStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

const broken = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('quota exceeded');
  },
};

test('values are stored as JSON under the game prefix', () => {
  const storage = memoryStorage();
  assert.equal(writeValue('settings', { drawCount: 3 }, storage), true);
  assert.equal(storage.items.get('solitaire:settings'), '{"drawCount":3}');
  assert.deepEqual(readValue('settings', null, storage), { drawCount: 3 });
});

test('a missing value gives the fallback', () => {
  assert.equal(readValue('language', 'en', memoryStorage()), 'en');
});

test('an unreadable value gives the fallback', () => {
  const storage = memoryStorage();
  storage.setItem('solitaire:language', '{not json');
  assert.equal(readValue('language', 'en', storage), 'en');
});

test('failing storage never throws', () => {
  assert.equal(readValue('language', 'en', broken), 'en');
  assert.equal(writeValue('language', 'tr', broken), false);
});
