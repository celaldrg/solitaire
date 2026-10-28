import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, shuffle } from '../src/rng.js';

const take = (random, count) => Array.from({ length: count }, () => random());

test('the same seed repeats the same sequence', () => {
  assert.deepEqual(take(createRng(42), 20), take(createRng(42), 20));
});

test('different seeds give different sequences', () => {
  assert.notDeepEqual(take(createRng(1), 5), take(createRng(2), 5));
});

test('values stay in [0, 1)', () => {
  const random = createRng(7);
  for (const value of take(random, 10000)) assert.ok(value >= 0 && value < 1, String(value));
});

test('shuffle returns a permutation and leaves the input alone', () => {
  const items = Array.from({ length: 52 }, (_, index) => index);
  const shuffled = shuffle(items, createRng(3));
  assert.deepEqual(items, Array.from({ length: 52 }, (_, index) => index));
  assert.notDeepEqual(shuffled, items);
  assert.deepEqual(shuffled.slice().sort((a, b) => a - b), items);
});

test('shuffle is deterministic for a seed', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  assert.deepEqual(shuffle(items, createRng(11)), shuffle(items, createRng(11)));
});
