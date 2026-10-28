import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK_SIZE, cardCode, parseCard } from '../src/cards.js';
import {
  MAX_DEAL, boardFromCodes, dealGame, normalizeDrawCount, parsePileId, pileCards,
  randomDealNumber, reachableWasteSizes, stockCycle,
} from '../src/board.js';
import { applyMove, stockMove, validateBoard } from '../src/rules.js';

const allCards = (board) => [
  ...board.stock, ...board.waste, ...board.foundations.flat(),
  ...board.tableau.flatMap((pile) => pile.cards),
];
const codes = (cards) => cards.map(cardCode);

test('a deal has 52 distinct cards', () => {
  for (const deal of [0, 1, 2, 3, 12345, MAX_DEAL]) {
    const board = dealGame(deal);
    const cards = allCards(board);
    assert.equal(cards.length, DECK_SIZE);
    assert.equal(new Set(cards).size, DECK_SIZE);
    assert.deepEqual(validateBoard(board), []);
  }
});

test('tableau piles hold 1 to 7 cards with only the top card face up', () => {
  for (const deal of [1, 42, 777]) {
    dealGame(deal).tableau.forEach((pile, index) => {
      assert.equal(pile.cards.length, index + 1);
      assert.equal(pile.faceDown, index);
    });
  }
});

test('the other 24 cards form the stock; waste and foundations start empty', () => {
  const board = dealGame(9);
  assert.equal(board.stock.length, 24);
  assert.deepEqual(board.waste, []);
  assert.deepEqual(board.foundations, [[], [], [], []]);
});

test('a deal number always gives the same layout, other numbers give others', () => {
  assert.deepEqual(dealGame(7), dealGame(7));
  assert.notDeepEqual(dealGame(7), dealGame(8));
  assert.notDeepEqual(dealGame(1).stock, dealGame(2).stock);
});

test('drawCount is 3 when asked for, otherwise 1, and does not change the layout', () => {
  assert.equal(normalizeDrawCount(3), 3);
  for (const value of [1, 2, '3', undefined, null]) assert.equal(normalizeDrawCount(value), 1);
  assert.equal(dealGame(1, 3).drawCount, 3);
  assert.equal(dealGame(1, 1).drawCount, 1);
  assert.equal(dealGame(1, 2).drawCount, 1);
  assert.equal(dealGame(1).drawCount, 1);
  assert.deepEqual(dealGame(5, 3).tableau, dealGame(5, 1).tableau);
  assert.deepEqual(dealGame(5, 3).stock, dealGame(5, 1).stock);
});

test('randomDealNumber maps the injected random source onto 1..MAX_DEAL', () => {
  assert.equal(randomDealNumber(() => 0), 1);
  assert.equal(randomDealNumber(() => 0.5), 500000);
  assert.equal(randomDealNumber(() => 0.9999999999), MAX_DEAL);
});

test('parsePileId knows every pile id and nothing else', () => {
  assert.deepEqual(parsePileId('stock'), { kind: 'stock', index: 0 });
  assert.deepEqual(parsePileId('waste'), { kind: 'waste', index: 0 });
  assert.deepEqual(parsePileId('f0'), { kind: 'foundation', index: 0 });
  assert.deepEqual(parsePileId('f3'), { kind: 'foundation', index: 3 });
  assert.deepEqual(parsePileId('t6'), { kind: 'tableau', index: 6 });
  for (const bad of ['f4', 't7', 't', 'x1', 'T1', '', undefined, null, 3]) {
    assert.equal(parsePileId(bad), null, String(bad));
  }
});

test('pileCards returns the cards of any pile', () => {
  const board = boardFromCodes({
    stock: ['2C'], waste: ['3C'], foundations: [[], ['AD']], tableau: [{ down: ['KS'], up: ['QH'] }],
  });
  assert.deepEqual(codes(pileCards(board, 'stock')), ['2C']);
  assert.deepEqual(codes(pileCards(board, 'waste')), ['3C']);
  assert.deepEqual(codes(pileCards(board, 'f1')), ['AD']);
  assert.deepEqual(codes(pileCards(board, 't0')), ['KS', 'QH']);
  assert.deepEqual(pileCards(board, 'nowhere'), []);
});

test('boardFromCodes builds boards from readable codes; missing piles are empty', () => {
  const board = boardFromCodes({
    drawCount: 3,
    stock: ['AS'],
    waste: ['2H'],
    foundations: [['AC']],
    tableau: [{ down: ['KD'], up: ['QS', 'JH'] }],
  });
  assert.equal(board.drawCount, 3);
  assert.deepEqual(board.stock, [parseCard('AS')]);
  assert.deepEqual(board.waste, [parseCard('2H')]);
  assert.deepEqual(board.foundations, [[parseCard('AC')], [], [], []]);
  assert.deepEqual(board.tableau[0], { cards: ['KD', 'QS', 'JH'].map(parseCard), faceDown: 1 });
  assert.equal(board.tableau.length, 7);
  assert.deepEqual(board.tableau[6], { cards: [], faceDown: 0 });
  assert.equal(boardFromCodes({}).drawCount, 1);
});

test('the stock cycle lists the waste bottom to top, then the stock top to bottom', () => {
  const board = boardFromCodes({ stock: ['AS', '2S', '3S'], waste: ['4S', '5S'] });
  assert.deepEqual(codes(stockCycle(board)), ['4S', '5S', '3S', '2S', 'AS']);
});

test('drawing and recycling never change the stock cycle', () => {
  for (const drawCount of [1, 3]) {
    let board = dealGame(31, drawCount);
    const cycle = stockCycle(board);
    for (let click = 0; click < 30; click += 1) {
      board = applyMove(board, stockMove(board));
      assert.deepEqual(stockCycle(board), cycle);
    }
  }
});

test('reachableWasteSizes follows draws and recycles in order', () => {
  assert.deepEqual(reachableWasteSizes(5, 2, 1), [2, 3, 4, 5, 0, 1]);
  assert.deepEqual(reachableWasteSizes(7, 0, 3), [0, 3, 6, 7]);
  assert.deepEqual(reachableWasteSizes(7, 1, 3), [1, 4, 7, 0, 3, 6]);
  assert.deepEqual(reachableWasteSizes(0, 0, 3), [0]);
});

test('reachableWasteSizes matches what clicking the stock really shows', () => {
  let board = boardFromCodes({
    drawCount: 3, waste: ['AS'], stock: ['2S', '3S', '4S', '5S', '6S', '7S'],
  });
  const seen = [];
  while (!seen.includes(board.waste.length)) {
    seen.push(board.waste.length);
    board = applyMove(board, stockMove(board));
  }
  assert.deepEqual(seen, reachableWasteSizes(7, 1, 3));
});
