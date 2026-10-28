import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardCode } from '../src/cards.js';
import { boardFromCodes, dealGame } from '../src/board.js';
import { applyMove, isLegalMove, legalMoves, stockMove } from '../src/rules.js';

const codes = (cards) => cards.map(cardCode);
const DRAW = Object.freeze({ from: 'stock', to: 'waste' });
const RECYCLE = Object.freeze({ from: 'waste', to: 'stock' });

test('draw-1 turns the top stock card onto the waste', () => {
  const board = boardFromCodes({ stock: ['AS', '2S', '3S'] });
  assert.deepEqual(stockMove(board), { from: 'stock', to: 'waste', count: 1 });
  const next = applyMove(board, DRAW);
  assert.deepEqual(codes(next.stock), ['AS', '2S']);
  assert.deepEqual(codes(next.waste), ['3S']);
});

test('draw-1 goes through the whole stock one card per click', () => {
  let board = dealGame(12, 1);
  const stock = board.stock.slice();
  for (let click = 1; click <= 24; click += 1) {
    board = applyMove(board, DRAW);
    assert.equal(board.waste.at(-1), stock[stock.length - click]);
    assert.equal(board.stock.length, 24 - click);
  }
  assert.equal(isLegalMove(board, DRAW), false);
  assert.deepEqual(stockMove(board), { from: 'waste', to: 'stock', count: 24 });
});

test('draw-3 turns three cards, the third one ending on top of the waste', () => {
  const board = boardFromCodes({ drawCount: 3, stock: ['AS', '2S', '3S', '4S', '5S'] });
  assert.deepEqual(stockMove(board), { from: 'stock', to: 'waste', count: 3 });
  const next = applyMove(board, DRAW);
  assert.deepEqual(codes(next.stock), ['AS', '2S']);
  assert.deepEqual(codes(next.waste), ['5S', '4S', '3S']);
  assert.deepEqual(stockMove(next), { from: 'stock', to: 'waste', count: 2 });
  assert.deepEqual(codes(applyMove(next, DRAW).waste), ['5S', '4S', '3S', '2S', 'AS']);
});

test('draw-3 cycles 24 cards in eight draws and recycles them in the same order', () => {
  const start = dealGame(21, 3);
  let board = start;
  for (let draw = 1; draw <= 8; draw += 1) {
    assert.deepEqual(stockMove(board), { from: 'stock', to: 'waste', count: 3 });
    board = applyMove(board, DRAW);
    assert.equal(board.waste.length, 3 * draw);
    assert.equal(board.waste.at(-1), start.stock[24 - 3 * draw]);
  }
  assert.equal(isLegalMove(board, DRAW), false);
  assert.deepEqual(stockMove(board), { from: 'waste', to: 'stock', count: 24 });
  board = applyMove(board, RECYCLE);
  assert.deepEqual(board, start);
});

test('draw-3 with seven cards draws 3, 3 and 1, then recycles', () => {
  const stock = ['AC', '2C', '3C', '4C', '5C', '6C', '7C'];
  let board = boardFromCodes({ drawCount: 3, stock });
  const counts = [];
  while (board.stock.length > 0) {
    counts.push(stockMove(board).count);
    board = applyMove(board, DRAW);
  }
  assert.deepEqual(counts, [3, 3, 1]);
  assert.deepEqual(codes(board.waste), ['7C', '6C', '5C', '4C', '3C', '2C', 'AC']);
  assert.deepEqual(codes(applyMove(board, RECYCLE).stock), stock);
});

test('in draw-3, playing a card from the waste shifts the following passes', () => {
  let board = boardFromCodes({
    drawCount: 3,
    stock: ['AC', '2C', '3C', '4C', '5C', '6C', '7C'],
    tableau: [{ up: ['6H'] }],
  });
  board = applyMove(board, DRAW);
  assert.equal(cardCode(board.waste.at(-1)), '5C');
  board = applyMove(board, { from: 'waste', to: 't0' });
  assert.equal(cardCode(board.waste.at(-1)), '6C');
  board = applyMove(applyMove(board, DRAW), DRAW);
  board = applyMove(board, RECYCLE);
  assert.deepEqual(codes(board.stock), ['AC', '2C', '3C', '4C', '6C', '7C']);
  assert.deepEqual(codes(applyMove(board, DRAW).waste), ['7C', '6C', '4C']);
});

test('an empty stock cannot be drawn, and the waste turns over only once the stock is empty', () => {
  assert.equal(isLegalMove(boardFromCodes({ stock: ['AS'], waste: ['2S'] }), RECYCLE), false);
  const wasteOnly = boardFromCodes({ waste: ['2S', 'AS'] });
  assert.equal(isLegalMove(wasteOnly, DRAW), false);
  assert.deepEqual(stockMove(wasteOnly), { from: 'waste', to: 'stock', count: 2 });
  assert.deepEqual(codes(applyMove(wasteOnly, RECYCLE).stock), ['AS', '2S']);
  const empty = boardFromCodes({});
  assert.equal(stockMove(empty), null);
  assert.equal(isLegalMove(empty, DRAW), false);
  assert.equal(isLegalMove(empty, RECYCLE), false);
  assert.deepEqual(legalMoves(empty), []);
});

test('stock moves ignore count: a draw always turns drawCount cards', () => {
  const board = boardFromCodes({ stock: ['AS', '2S', '3S'] });
  assert.deepEqual(codes(applyMove(board, { ...DRAW, count: 3 }).waste), ['3S']);
  const drawThree = { ...board, drawCount: 3 };
  assert.deepEqual(codes(applyMove(drawThree, { ...DRAW, count: 1 }).waste), ['3S', '2S', 'AS']);
});

test('the stock can be gone through any number of times', () => {
  for (const drawCount of [1, 3]) {
    const start = dealGame(8, drawCount);
    let board = start;
    for (let pass = 0; pass < 5; pass += 1) {
      while (board.stock.length > 0) board = applyMove(board, DRAW);
      board = applyMove(board, RECYCLE);
      assert.deepEqual(board, start);
    }
  }
});
