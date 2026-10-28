import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFromCodes } from '../src/board.js';
import { createGame } from '../src/game.js';
import { applyMove, isWon, validateBoard } from '../src/rules.js';
import { autoCompleteMoves, canAutoComplete } from '../src/assist.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suitUpTo = (suit, count = RANKS.length) => RANKS.slice(0, count).map((rank) => rank + suit);

/** Every card face up, stock empty: won in principle, 34 cards still to go up. */
const OPEN_LAYOUT = Object.freeze({
  waste: ['6S', '4S'],
  foundations: [suitUpTo('C', 5), suitUpTo('D', 4), suitUpTo('H', 6), suitUpTo('S', 3)],
  tableau: [
    { up: ['KS', 'QD', 'JC', '10D', '9C', '8D', '7C', '6D', '5S'] },
    { up: ['KD', 'QC', 'JD', '10C', '9D', '8C', '7D', '6C', '5D'] },
    { up: ['KH', 'QS', 'JH', '10S', '9H', '8S', '7H'] },
    { up: ['KC', 'QH', 'JS', '10H', '9S', '8H', '7S'] },
  ],
});

function replay(board, moves) {
  return moves.reduce((current, move) => {
    const next = applyMove(current, move);
    assert.ok(next, `refused ${JSON.stringify(move)}`);
    return next;
  }, board);
}

test('auto-complete finishes a position that is won in principle', () => {
  for (const drawCount of [1, 3]) {
    const board = boardFromCodes({ ...OPEN_LAYOUT, drawCount });
    assert.deepEqual(validateBoard(board), []);
    assert.equal(canAutoComplete(board), true);
    const moves = autoCompleteMoves(board);
    assert.equal(moves.length, 34);
    assert.ok(moves.every((move) => move.to.startsWith('f')));
    assert.equal(isWon(replay(board, moves)), true);
  }
});

test('auto-complete draws from the stock when nothing else plays', () => {
  const board = boardFromCodes({ ...OPEN_LAYOUT, waste: [], stock: ['6S', '4S'] });
  assert.equal(canAutoComplete(board), false, 'offered only once the stock is empty');
  const moves = autoCompleteMoves(board);
  assert.ok(moves.some((move) => move.from === 'stock'));
  assert.equal(isWon(replay(board, moves)), true);
});

test('auto-complete waits while a tableau card is face down', () => {
  const tableau = OPEN_LAYOUT.tableau.slice();
  tableau[2] = { down: ['KH'], up: tableau[2].up.slice(1) };
  const board = boardFromCodes({ ...OPEN_LAYOUT, tableau });
  assert.equal(autoCompleteMoves(board), null);
  assert.equal(canAutoComplete(board), false);
});

test('auto-complete gives up when draw-3 keeps burying the card it needs', () => {
  const layout = {
    drawCount: 3,
    stock: ['QC', 'KC', '4C', '3C', '2C'],
    foundations: [['AC'], suitUpTo('D'), suitUpTo('H'), suitUpTo('S')],
    tableau: ['5C', '6C', '7C', '8C', '9C', '10C', 'JC'].map((code) => ({ up: [code] })),
  };
  assert.equal(autoCompleteMoves(boardFromCodes(layout)), null);
  const drawOne = boardFromCodes({ ...layout, drawCount: 1 });
  assert.equal(isWon(replay(drawOne, autoCompleteMoves(drawOne))), true);
});

test('in draw-3 auto-complete may put the waste top on a pile to reach the card under it', () => {
  // Draw-3 always turns 3C 2C KC over together, so drawing alone never brings up the 2C.
  const layout = {
    drawCount: 3,
    waste: ['3C', '2C', 'KC', 'QC', 'JC', '10C'],
    foundations: [['AC'], suitUpTo('D'), suitUpTo('H'), suitUpTo('S')],
    tableau: ['4C', '5C', '6C', '7C', '8C', '9C'].map((code) => ({ up: [code] })),
  };
  const board = boardFromCodes(layout);
  assert.deepEqual(validateBoard(board), []);
  assert.equal(canAutoComplete(board), true);
  const moves = autoCompleteMoves(board);
  assert.ok(moves.some((move) => move.from === 'waste' && move.to.startsWith('t')));
  assert.equal(isWon(replay(board, moves)), true);

  const game = createGame({ deal: 1, board });
  let steps = 0;
  while (game.autoCompleteStep()) steps += 1;
  assert.ok(steps > 0);
  assert.equal(game.getState().won, true);

  // Draw-1 reaches every card, so the plain plan needs no tableau move.
  const drawOne = boardFromCodes({ ...layout, drawCount: 1 });
  const simple = autoCompleteMoves(drawOne);
  assert.ok(simple.every((move) => !move.to.startsWith('t')));
  assert.equal(isWon(replay(drawOne, simple)), true);
});

test('a won board needs no auto-complete', () => {
  const won = boardFromCodes({ foundations: ['C', 'D', 'H', 'S'].map((suit) => suitUpTo(suit)) });
  assert.deepEqual(autoCompleteMoves(won), []);
  assert.equal(canAutoComplete(won), false);
});

test('the game plays auto-complete one step at a time until it is won', () => {
  const game = createGame({ deal: 1, board: boardFromCodes(OPEN_LAYOUT) });
  assert.equal(game.getState().canAutoComplete, true);
  let steps = 0;
  while (game.autoCompleteStep()) steps += 1;
  const state = game.getState();
  assert.equal(steps, 34);
  assert.equal(state.won, true);
  assert.equal(state.moves, 34);
  assert.equal(state.score, 34 * 10);
  assert.equal(state.canAutoComplete, false);
  assert.equal(game.autoCompleteStep(), null);
});

test('the game does not auto-complete while cards are hidden', () => {
  const game = createGame({ deal: 1 });
  assert.equal(game.autoCompleteStep(), null);
  assert.equal(game.getState().moves, 0);
});
