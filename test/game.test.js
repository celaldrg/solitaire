import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFromCodes, dealGame } from '../src/board.js';
import { createGame } from '../src/game.js';
import { createRng } from '../src/rng.js';
import { isLegalMove, legalMoves } from '../src/rules.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suitUpTo = (suit, count = RANKS.length) => RANKS.slice(0, count).map((rank) => rank + suit);

test('a new game deals the given deal number', () => {
  const state = createGame({ deal: 42 }).getState();
  assert.deepEqual(state.board, dealGame(42, 1));
  assert.deepEqual({ ...state, board: null }, {
    deal: 42,
    drawCount: 1,
    board: null,
    score: 0,
    moves: 0,
    elapsed: 0,
    won: false,
    canUndo: false,
    canAutoComplete: false,
  });
  const drawThree = createGame({ deal: 42, drawCount: 3 }).getState();
  assert.equal(drawThree.drawCount, 3);
  assert.deepEqual(drawThree.board, dealGame(42, 3));
});

test('a missing or invalid deal number comes from the injected random source', () => {
  assert.equal(createGame({ random: () => 0.5 }).getState().deal, 500000);
  for (const deal of [-1, 2.5, '7', null, 2 ** 32]) {
    assert.equal(createGame({ deal, random: () => 0 }).getState().deal, 1, String(deal));
  }
  assert.equal(createGame({ deal: 0 }).getState().deal, 0);
});

test('legal moves update board, score and move counter; illegal moves change nothing', () => {
  const board = boardFromCodes({
    waste: ['9H'],
    tableau: [{ down: ['AC'], up: ['8S'] }, { up: ['10S'] }],
  });
  const game = createGame({ deal: 1, board });
  const before = game.getState();
  assert.equal(game.move({ from: 't0', to: 't1' }), false);
  assert.deepEqual(game.getState(), before);
  assert.equal(game.move({ from: 'waste', to: 't1' }), true);
  assert.equal(game.move({ from: 't0', to: 't1' }), true);
  assert.equal(game.move({ from: 't0', to: 'f0' }), true);
  const state = game.getState();
  assert.equal(state.score, 5 + 5 + 10);
  assert.equal(state.moves, 3);
  assert.equal(state.canUndo, true);
  assert.deepEqual(state.board.foundations[0], board.tableau[0].cards.slice(0, 1));
});

test('undo restores every earlier state exactly', () => {
  for (const drawCount of [1, 3]) {
    const game = createGame({ deal: 7, drawCount });
    const random = createRng(99);
    const states = [];
    for (let step = 0; step < 80; step += 1) {
      const moves = legalMoves(game.getState().board);
      if (moves.length === 0) break;
      states.push(structuredClone(game.getState()));
      assert.equal(game.move(moves[Math.floor(random() * moves.length)]), true);
    }
    assert.ok(states.length > 40);
    while (states.length > 0) {
      assert.equal(game.undo(), true);
      assert.deepEqual(game.getState(), states.pop());
    }
    assert.equal(game.undo(), false);
    assert.equal(game.getState().canUndo, false);
  }
});

test('the score never drops below zero', () => {
  const board = boardFromCodes({ foundations: [['AH', '2H', '3H']], tableau: [{ up: ['4S'] }] });
  const game = createGame({ deal: 1, board });
  assert.equal(game.move({ from: 'f0', to: 't0' }), true);
  assert.equal(game.getState().score, 0);
  const richer = createGame({ deal: 1, board, score: 20 });
  assert.equal(richer.move({ from: 'f0', to: 't0' }), true);
  assert.equal(richer.getState().score, 5);
  assert.equal(richer.undo(), true);
  assert.equal(richer.getState().score, 20);
});

test('drawing and recycling count as moves but score nothing', () => {
  const game = createGame({ deal: 1, board: boardFromCodes({ stock: ['5C', '6C'] }) });
  assert.deepEqual(game.drawFromStock(), { from: 'stock', to: 'waste', count: 1 });
  assert.deepEqual(game.drawFromStock(), { from: 'stock', to: 'waste', count: 1 });
  assert.deepEqual(game.drawFromStock(), { from: 'waste', to: 'stock', count: 2 });
  const state = game.getState();
  assert.equal(state.moves, 3);
  assert.equal(state.score, 0);
  assert.deepEqual(state.board.stock, boardFromCodes({ stock: ['5C', '6C'] }).stock);
  const empty = createGame({ deal: 1, board: boardFromCodes({}) });
  assert.equal(empty.drawFromStock(), null);
  assert.equal(empty.getState().moves, 0);
});

test('the clock starts with the first move and stops on a win', () => {
  const board = boardFromCodes({
    foundations: [suitUpTo('C'), suitUpTo('D'), suitUpTo('H', 12), suitUpTo('S', 12)],
    tableau: [{ up: ['KH'] }, { up: ['KS'] }],
  });
  const game = createGame({ deal: 1, board });
  game.update(5);
  assert.equal(game.getState().elapsed, 0);
  assert.equal(game.move({ from: 't0', to: 'f2' }), true);
  game.update(2.5);
  game.update(0);
  game.update(-3);
  assert.equal(game.getState().elapsed, 2.5);
  assert.equal(game.move({ from: 't1', to: 'f3' }), true);
  assert.equal(game.getState().won, true);
  game.update(10);
  assert.equal(game.getState().elapsed, 2.5);
});

test('a game resumed with moves already made keeps its clock running', () => {
  const game = createGame({ deal: 5, moves: 3, elapsed: 10 });
  game.update(1);
  assert.equal(game.getState().elapsed, 11);
});

test('tap and F-key helpers play and return their move, or return null', () => {
  const board = boardFromCodes({
    stock: ['3D'],
    waste: ['AH'],
    tableau: [{ down: ['5C'], up: ['2H'] }, { up: ['KS'] }, {}, { up: ['4C'] }],
  });
  const game = createGame({ deal: 1, board });
  assert.deepEqual(game.moveToFoundation('waste'), { from: 'waste', to: 'f0', count: 1 });
  assert.deepEqual(game.autoMove('t0'), { from: 't0', to: 'f0', count: 1 });
  assert.equal(game.autoMove('t1'), null, 'a lone King does not hop between empty piles');
  assert.equal(game.moveToFoundation('t3'), null);
  assert.equal(game.autoMove('stock'), null);
  const state = game.getState();
  assert.equal(state.moves, 2);
  assert.equal(state.score, 10 + 10 + 5);
  assert.deepEqual(state.board.tableau[0], { cards: board.tableau[0].cards.slice(0, 1), faceDown: 0 });
});

test('a hint is a legal move and is not played', () => {
  const board = boardFromCodes({
    waste: ['9H'],
    tableau: [{ down: ['AC'], up: ['8S'] }, { up: ['10S'] }, { up: ['9D'] }],
  });
  const game = createGame({ deal: 1, board });
  const hint = game.hint();
  assert.deepEqual(hint, { from: 't0', to: 't2', count: 1 });
  assert.equal(isLegalMove(board, hint), true);
  assert.equal(game.getState().board, board);
  assert.equal(game.getState().moves, 0);
});
