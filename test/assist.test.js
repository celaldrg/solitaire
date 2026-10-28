import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFromCodes, dealGame } from '../src/board.js';
import { createRng } from '../src/rng.js';
import { applyMove, isLegalMove, legalMoves } from '../src/rules.js';
import { bestMoveFor, findHint, foundationMoveFor } from '../src/assist.js';

const move = (from, to, count = 1) => ({ from, to, count });
const DRAW_ONE = Object.freeze({ from: 'stock', to: 'waste', count: 1 });

test('the hint prefers turning over a hidden card', () => {
  const board = boardFromCodes({
    waste: ['9H'],
    tableau: [{ down: ['AC'], up: ['8S'] }, { up: ['10S'] }, { up: ['9D'] }],
  });
  assert.deepEqual(findHint(board), move('t0', 't2'));
});

test('the hint sends up a card that uncovers a hidden one before anything else', () => {
  const board = boardFromCodes({
    tableau: [
      { down: ['5C', '6C'], up: ['AS'] },
      { down: ['2C', '3C', '4C'], up: ['8S'] },
      { up: ['9D'] },
    ],
  });
  assert.deepEqual(findHint(board), move('t0', 'f0'));
});

test('the hint suggests drawing only when the stock holds a card that could be played', () => {
  const playable = boardFromCodes({ stock: ['KD', 'AS', '7C'], tableau: [{ up: ['QS'] }] });
  assert.deepEqual(findHint(playable), DRAW_ONE);
  const useless = boardFromCodes({ stock: ['7C', '8C'], tableau: [{ up: ['QS'] }] });
  assert.equal(findHint(useless), null);
});

test('in draw-3 the hint only counts stock cards that drawing can bring up', () => {
  // Draw-3 shows 8C, then 7C, and never the Ace between them.
  const layout = { drawCount: 3, stock: ['7C', '8C', 'AS', '9C'], tableau: [{ up: ['QS'] }] };
  assert.equal(findHint(boardFromCodes(layout)), null);
  assert.deepEqual(findHint(boardFromCodes({ ...layout, drawCount: 1 })), DRAW_ONE);
});

test('the hint splits a run when that frees a card for the foundations', () => {
  const board = boardFromCodes({
    foundations: [['AC', '2C']],
    tableau: [{ up: ['3C', '2D'] }, { up: ['3S'] }],
  });
  assert.deepEqual(findHint(board), move('t0', 't1'));
});

test('the hint empties a pile when a King is waiting for the space', () => {
  const board = boardFromCodes({
    waste: ['KD'],
    tableau: [
      { up: ['QH'] }, { up: ['KS'] },
      { up: ['2C'] }, { up: ['2S'] }, { up: ['4C'] }, { up: ['4S'] }, { up: ['6C'] },
    ],
  });
  assert.deepEqual(findHint(board), move('t0', 't1'));
});

test('the hint never suggests moves that only shuffle cards around', () => {
  const board = boardFromCodes({
    foundations: [['AH', '2H', '3H']],
    tableau: [{ up: ['KS'] }, {}, { up: ['4S'] }],
  });
  assert.ok(legalMoves(board).length > 0);
  assert.equal(findHint(board), null);
});

test('hints are always legal moves', () => {
  const random = createRng(17);
  for (let deal = 1; deal <= 30; deal += 1) {
    let board = dealGame(deal, deal % 2 === 0 ? 3 : 1);
    for (let step = 0; step < 30; step += 1) {
      const hint = findHint(board);
      if (hint) assert.equal(isLegalMove(board, hint), true, `deal ${deal}, step ${step}`);
      const moves = legalMoves(board);
      if (moves.length === 0) break;
      board = applyMove(board, moves[Math.floor(random() * moves.length)]);
    }
  }
});

test('a tapped card goes to a foundation first, otherwise to a tableau pile that takes it', () => {
  const board = boardFromCodes({
    waste: ['2D'],
    foundations: [['AD']],
    tableau: [
      {},
      { up: ['3S'] },
      { up: ['KH', 'QS'] },
      { up: ['KC'] },
      { up: ['JH'] },
      { down: ['5H'], up: ['KD'] },
    ],
  });
  assert.deepEqual(bestMoveFor(board, 'waste'), move('waste', 'f0'));
  assert.deepEqual(bestMoveFor(board, 't4'), move('t4', 't2'));
  assert.deepEqual(bestMoveFor(board, 't5'), move('t5', 't0'));
  assert.equal(bestMoveFor(board, 't2', 2), null, 'a whole King-led pile stays put');
  assert.equal(bestMoveFor(board, 't3'), null, 'so does a lone King');
  assert.equal(bestMoveFor(board, 't1'), null);
  assert.equal(bestMoveFor(board, 'stock'), null);
  assert.equal(bestMoveFor(board, 'nowhere'), null);
});

test('a card alone on its pile still goes up when tapped, a lone Ace included', () => {
  const board = boardFromCodes({
    foundations: [['AH']],
    tableau: [{ up: ['AS'] }, { up: ['2H'] }, {}],
  });
  assert.deepEqual(bestMoveFor(board, 't0'), move('t0', 'f1'));
  assert.deepEqual(bestMoveFor(board, 't1'), move('t1', 'f0'));
});

test('a tapped foundation card can only come back to the tableau', () => {
  const board = boardFromCodes({
    foundations: [['AD', '2D'], ['AC']],
    tableau: [{ up: ['3S'] }, { up: ['3C'] }],
  });
  assert.deepEqual(bestMoveFor(board, 'f0'), move('f0', 't0'));
  assert.equal(bestMoveFor(board, 'f1'), null);
});

test('sending a card up takes the top card of the waste or a tableau pile to its foundation', () => {
  const board = boardFromCodes({
    waste: ['AH'],
    foundations: [['AC']],
    tableau: [{ up: ['2C'] }, { up: ['3C'] }, {}],
  });
  assert.deepEqual(foundationMoveFor(board, 'waste'), move('waste', 'f1'));
  assert.deepEqual(foundationMoveFor(board, 't0'), move('t0', 'f0'));
  assert.equal(foundationMoveFor(board, 't1'), null);
  assert.equal(foundationMoveFor(board, 't2'), null);
  assert.equal(foundationMoveFor(board, 'f0'), null);
  assert.equal(foundationMoveFor(board, 'stock'), null);
  assert.equal(foundationMoveFor(board, 'x'), null);
});
