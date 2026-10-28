import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DEAL } from '../src/board.js';
import { findWinnableDeal } from '../src/solver.js';
import { searchWinnableDeal } from '../src/winnable.js';

const OPTIONS = { drawCount: 1, nodeLimit: 10000, maxAttempts: 20 };

test('finds the same deal as the blocking solver search', async () => {
  for (const first of [1, 500, 31337]) {
    const expected = findWinnableDeal(first, OPTIONS);
    assert.deepEqual(await searchWinnableDeal(first, OPTIONS), expected, String(first));
  }
});

test('pauses between attempts and reports when nothing was solved', async () => {
  let pauses = 0;
  const result = await searchWinnableDeal(40, {
    nodeLimit: 1,
    maxAttempts: 3,
    pause: async () => {
      pauses += 1;
    },
  });
  assert.deepEqual(result, { deal: 40, solved: false, attempts: 3 });
  assert.equal(pauses, 2);
});

test('stops when cancelled', async () => {
  let checks = 0;
  const result = await searchWinnableDeal(40, {
    nodeLimit: 1,
    maxAttempts: 5,
    isCancelled: () => {
      checks += 1;
      return checks > 1;
    },
  });
  assert.equal(result, null);
  assert.equal(checks, 2);
});

test('wraps around after the highest deal number', async () => {
  const fromOne = findWinnableDeal(1, OPTIONS);
  assert.equal(fromOne.solved, true);
  const lastSolved = findWinnableDeal(MAX_DEAL, { ...OPTIONS, maxAttempts: 1 }).solved;
  const result = await searchWinnableDeal(MAX_DEAL, { ...OPTIONS, maxAttempts: fromOne.deal + 1 });
  const expected = lastSolved
    ? { deal: MAX_DEAL, solved: true, attempts: 1 }
    : { deal: fromOne.deal, solved: true, attempts: fromOne.deal + 1 };
  assert.deepEqual(result, expected);
});
