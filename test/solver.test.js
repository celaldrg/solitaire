import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFromCodes, dealGame } from '../src/board.js';
import { createGame } from '../src/game.js';
import { applyMove, isWon, validateBoard } from '../src/rules.js';
import { DEFAULT_NODE_LIMIT, findWinnableDeal, solve } from '../src/solver.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suitUpTo = (suit, count = RANKS.length) => RANKS.slice(0, count).map((rank) => rank + suit);

/** Plays moves with applyMove; fails on the first one it refuses. */
function replay(board, moves) {
  return moves.reduce((current, move, index) => {
    const next = applyMove(current, move);
    assert.ok(next, `move ${index} ${JSON.stringify(move)} was refused`);
    return next;
  }, board);
}

const FIXED_DEALS = [
  { drawCount: 1, deals: [1, 2, 5] },
  { drawCount: 3, deals: [2, 4, 8] },
];

for (const { drawCount, deals } of FIXED_DEALS) {
  test(`draw-${drawCount} deals ${deals.join(', ')}: the solution replays to a win in a game`, () => {
    for (const deal of deals) {
      const result = solve(dealGame(deal, drawCount));
      assert.equal(result.solved, true, `deal ${deal}`);
      assert.equal(result.exhausted, false);
      assert.ok(result.nodes <= DEFAULT_NODE_LIMIT);
      const game = createGame({ deal, drawCount });
      result.moves.forEach((move, index) => {
        assert.equal(game.move(move), true, `deal ${deal}, move ${index} ${JSON.stringify(move)}`);
      });
      const state = game.getState();
      assert.equal(state.won, true, `deal ${deal}`);
      assert.equal(state.moves, result.moves.length);
      assert.equal(isWon(replay(dealGame(deal, drawCount), result.moves)), true);
    }
  });
}

test('solutions include the draws and recycles a player has to make', () => {
  const { moves } = solve(dealGame(1));
  assert.ok(moves.some((move) => move.from === 'stock'));
  assert.ok(moves.every((move) => move.from !== 'stock' || move.to === 'waste'));
});

test('the solver stops at its node limit and does not call a cut-off search exhausted', () => {
  const result = solve(dealGame(3), { nodeLimit: 200 });
  assert.deepEqual(result, { solved: false, exhausted: false, nodes: 200, moves: null });
});

test('a position that cannot be won is reported as exhausted', () => {
  // The Jack of spades covers both red Queens, so it can never move.
  const layout = {
    foundations: [suitUpTo('C'), suitUpTo('H', 11), suitUpTo('D', 11), suitUpTo('S', 9)],
    tableau: [{ down: ['10S', 'QH', 'QD'], up: ['JS'] }],
    stock: ['KH', 'KD', 'QS', 'KS'],
  };
  for (const drawCount of [1, 3]) {
    const board = boardFromCodes({ ...layout, drawCount });
    assert.deepEqual(validateBoard(board), []);
    const result = solve(board);
    assert.equal(result.solved, false);
    assert.equal(result.exhausted, true);
    assert.equal(result.moves, null);
  }
});

test('draw-3 can bury the card a game needs where draw-1 cannot', () => {
  const layout = {
    stock: ['QC', 'KC', '4C', '3C', '2C'],
    foundations: [['AC'], suitUpTo('D'), suitUpTo('H'), suitUpTo('S')],
    tableau: ['5C', '6C', '7C', '8C', '9C', '10C', 'JC'].map((code) => ({ up: [code] })),
  };
  const drawThree = boardFromCodes({ ...layout, drawCount: 3 });
  assert.equal(solve(drawThree).exhausted, true);
  const drawOne = boardFromCodes(layout);
  assert.equal(isWon(replay(drawOne, solve(drawOne).moves)), true);
});

test('a won board needs no moves; an open board is played out to a win', () => {
  const won = boardFromCodes({ foundations: ['C', 'D', 'H', 'S'].map((suit) => suitUpTo(suit)) });
  assert.deepEqual(solve(won), { solved: true, exhausted: false, nodes: 0, moves: [] });
  for (const drawCount of [1, 3]) {
    const open = boardFromCodes({
      drawCount,
      stock: ['QH'],
      waste: ['KD'],
      foundations: [suitUpTo('C'), suitUpTo('D', 11), suitUpTo('H', 11), suitUpTo('S', 11)],
      tableau: [{ up: ['KS', 'QD'] }, { up: ['KH', 'QS'] }],
    });
    const result = solve(open);
    assert.equal(result.solved, true);
    assert.equal(isWon(replay(open, result.moves)), true);
  }
});

test('the solver leaves the board it was given untouched', () => {
  const board = dealGame(2, 3);
  const before = structuredClone(board);
  solve(board);
  assert.deepEqual(board, before);
});

test('findWinnableDeal returns the first deal from the start number that the solver wins', () => {
  const found = findWinnableDeal(3);
  assert.deepEqual(found, { deal: 4, solved: true, attempts: 2 });
  assert.deepEqual(findWinnableDeal(3), found, 'deterministic');
  assert.equal(solve(dealGame(found.deal), { nodeLimit: 10000 }).solved, true);
  const drawThree = findWinnableDeal(1, { drawCount: 3 });
  assert.equal(drawThree.solved, true);
  assert.equal(solve(dealGame(drawThree.deal, 3), { nodeLimit: 10000 }).solved, true);
});

test('findWinnableDeal gives up after maxAttempts and keeps the start number', () => {
  assert.deepEqual(
    findWinnableDeal(3, { nodeLimit: 10, maxAttempts: 1 }),
    { deal: 3, solved: false, attempts: 1 },
  );
});
