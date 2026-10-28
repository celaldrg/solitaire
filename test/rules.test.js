import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACE, cardCode, parseCard, rankOf } from '../src/cards.js';
import { FOUNDATION_IDS, TABLEAU_IDS, boardFromCodes, dealGame } from '../src/board.js';
import { createGame } from '../src/game.js';
import { createRng } from '../src/rng.js';
import {
  SCORING, applyMove, canStackOnFoundation, canStackOnTableau, foundationTargetFor, isLegalMove,
  isValidRun, isWon, legalMoves, scoreMove, stacksOn, stockMove, validateBoard,
} from '../src/rules.js';

const card = parseCard;
const cards = (...codes) => codes.map(parseCard);
const pileCodes = (board, index) => board.tableau[index].cards.map(cardCode);
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const fullSuit = (suit) => RANKS.map((rank) => rank + suit);

/** Asserts that a move is legal and returns the board after it. */
function play(board, move) {
  assert.equal(isLegalMove(board, move), true, `expected legal: ${JSON.stringify(move)}`);
  const next = applyMove(board, move);
  assert.ok(next);
  return next;
}

/** Asserts that a move is illegal and that applyMove refuses it. */
function refuse(board, move) {
  assert.equal(isLegalMove(board, move), false, `expected illegal: ${JSON.stringify(move)}`);
  assert.equal(applyMove(board, move), null);
}

test('tableau cards build down by one rank in alternating colours', () => {
  assert.equal(stacksOn(card('QH'), card('KS')), true);
  assert.equal(stacksOn(card('QS'), card('KD')), true);
  assert.equal(stacksOn(card('QS'), card('KC')), false, 'same colour');
  assert.equal(stacksOn(card('JH'), card('KS')), false, 'skips a rank');
  assert.equal(stacksOn(card('KS'), card('QH')), false, 'upwards');
  assert.equal(canStackOnTableau(card('8H'), cards('10D', '9C')), true);
  assert.equal(canStackOnTableau(card('8C'), cards('10D', '9C')), false);
});

test('only a King starts an empty tableau pile', () => {
  assert.equal(canStackOnTableau(card('KD'), []), true);
  assert.equal(canStackOnTableau(card('QD'), []), false);
  assert.equal(canStackOnTableau(card('AS'), []), false);
});

test('foundations start with an Ace and build up by suit', () => {
  assert.equal(canStackOnFoundation(card('AS'), []), true);
  assert.equal(canStackOnFoundation(card('2S'), []), false);
  assert.equal(canStackOnFoundation(card('2S'), cards('AS')), true);
  assert.equal(canStackOnFoundation(card('2C'), cards('AS')), false, 'other suit');
  assert.equal(canStackOnFoundation(card('3S'), cards('AS')), false, 'skips a rank');
  assert.equal(canStackOnFoundation(card('AH'), cards('AS')), false);
});

test('runs descend one rank at a time in alternating colours', () => {
  assert.equal(isValidRun([]), true);
  assert.equal(isValidRun(cards('7D')), true);
  assert.equal(isValidRun(cards('KS', 'QH', 'JC', '10D')), true);
  assert.equal(isValidRun(cards('KS', 'QH', 'JD')), false);
  assert.equal(isValidRun(cards('KS', 'JH')), false);
});

test('a tableau card moves onto a card one rank higher of the other colour', () => {
  const board = boardFromCodes({
    tableau: [{ up: ['9S'] }, { up: ['10H'] }, { up: ['10C'] }, { up: ['8D'] }],
  });
  const next = play(board, { from: 't0', to: 't1', count: 1 });
  assert.deepEqual(pileCodes(next, 1), ['10H', '9S']);
  assert.deepEqual(next.tableau[0], { cards: [], faceDown: 0 });
  assert.deepEqual(play(board, { from: 't0', to: 't1' }), next, 'count defaults to 1');
  refuse(board, { from: 't0', to: 't2' }); // 9S on 10C: same colour
  refuse(board, { from: 't3', to: 't2' }); // 8D on 10C: skips a rank
  refuse(board, { from: 't1', to: 't0' }); // 10H on 9S: upwards
});

test('only a King, or a run led by a King, moves to an empty tableau pile', () => {
  const board = boardFromCodes({
    tableau: [
      {},
      { down: ['2C'], up: ['KH', 'QS', 'JD'] },
      { up: ['QC', 'JH'] },
      { down: ['3C'], up: ['KS'] },
      { up: ['5D'] },
    ],
  });
  const withRun = play(board, { from: 't1', to: 't0', count: 3 });
  assert.deepEqual(pileCodes(withRun, 0), ['KH', 'QS', 'JD']);
  assert.deepEqual(withRun.tableau[1], { cards: cards('2C'), faceDown: 0 });
  assert.deepEqual(pileCodes(play(board, { from: 't3', to: 't0' }), 0), ['KS']);
  refuse(board, { from: 't1', to: 't0', count: 2 }); // run led by a Queen
  refuse(board, { from: 't2', to: 't0', count: 2 });
  refuse(board, { from: 't2', to: 't0', count: 1 });
  refuse(board, { from: 't4', to: 't0' });
});

test('a face-up run moves between tableau piles as one unit', () => {
  const board = boardFromCodes({
    tableau: [
      { down: ['AC', '2C'], up: ['9H', '8S', '7D'] },
      { up: ['10S'] },
      { up: ['9D'] },
      { up: ['8C'] },
    ],
  });
  const whole = play(board, { from: 't0', to: 't1', count: 3 });
  assert.deepEqual(pileCodes(whole, 1), ['10S', '9H', '8S', '7D']);
  assert.deepEqual(whole.tableau[0], { cards: cards('AC', '2C'), faceDown: 1 });
  const part = play(board, { from: 't0', to: 't2', count: 2 });
  assert.deepEqual(pileCodes(part, 2), ['9D', '8S', '7D']);
  assert.deepEqual(part.tableau[0], { cards: cards('AC', '2C', '9H'), faceDown: 2 });
  play(board, { from: 't0', to: 't3', count: 1 });
  refuse(board, { from: 't0', to: 't1', count: 2 }); // 8S on 10S
  refuse(board, { from: 't0', to: 't1', count: 4 }); // only three cards are face up
  for (const count of [0, -1, 1.5, '1', Number.NaN]) {
    refuse(board, { from: 't0', to: 't3', count });
  }
});

test('a face-down card never moves, even when it would continue the run', () => {
  const hidden = boardFromCodes({ tableau: [{ down: ['9H'], up: ['8S'] }, { up: ['10C'] }] });
  refuse(hidden, { from: 't0', to: 't1', count: 2 }); // the hidden 9H would fit on 10C
  const game = createGame({ deal: 1, board: hidden });
  assert.equal(game.move({ from: 't0', to: 't1', count: 2 }), false);
  assert.equal(game.getState().board, hidden);
  assert.equal(game.getState().moves, 0);
  const shown = boardFromCodes({ tableau: [{ up: ['9H', '8S'] }, { up: ['10C'] }] });
  assert.deepEqual(pileCodes(play(shown, { from: 't0', to: 't1', count: 2 }), 1), ['10C', '9H', '8S']);
});

test('face-up cards that are not a run never move together', () => {
  // Real play never builds such a pile; the rule must still hold on any board.
  const broken = boardFromCodes({ tableau: [{ up: ['9H', '8H'] }, { up: ['10S'] }] });
  refuse(broken, { from: 't0', to: 't1', count: 2 }); // 9H fits on 10S, but 8H on 9H is no run
  const run = boardFromCodes({ tableau: [{ up: ['9H', '8S'] }, { up: ['10S'] }] });
  play(run, { from: 't0', to: 't1', count: 2 });
});

test('the top hidden card turns face up when it is uncovered, for 5 points', () => {
  const board = boardFromCodes({
    tableau: [{ down: ['AC', '5H'], up: ['9S'] }, { up: ['10H'] }],
  });
  const move = { from: 't0', to: 't1' };
  assert.equal(scoreMove(board, move), SCORING.flip);
  assert.deepEqual(play(board, move).tableau[0], { cards: cards('AC', '5H'), faceDown: 1 });
});

test('no card turns over while face-up cards remain on the pile', () => {
  const board = boardFromCodes({
    tableau: [{ down: ['AC'], up: ['10S', '9H'] }, { up: ['10C'] }],
  });
  const move = { from: 't0', to: 't1' };
  assert.equal(scoreMove(board, move), 0);
  assert.deepEqual(play(board, move).tableau[0], { cards: cards('AC', '10S'), faceDown: 1 });
});

test('the waste top card moves to the tableau (5 points) or a foundation (10 points)', () => {
  const board = boardFromCodes({
    waste: ['AS', '9H'],
    tableau: [{ up: ['10S'] }, { up: ['10D'] }],
  });
  assert.equal(scoreMove(board, { from: 'waste', to: 't0' }), SCORING.wasteToTableau);
  const next = play(board, { from: 'waste', to: 't0' });
  assert.deepEqual(pileCodes(next, 0), ['10S', '9H']);
  assert.deepEqual(next.waste, cards('AS'));
  refuse(board, { from: 'waste', to: 't1' }); // 9H on 10D: same colour
  refuse(board, { from: 'waste', to: 't0', count: 2 }); // one waste card at a time
  refuse(board, { from: 'waste', to: 'f0' }); // 9H cannot go up
  assert.equal(scoreMove(next, { from: 'waste', to: 'f0' }), SCORING.toFoundation);
  assert.deepEqual(play(next, { from: 'waste', to: 'f0' }).foundations[0], cards('AS'));
  refuse(boardFromCodes({ tableau: [{ up: ['10S'] }] }), { from: 'waste', to: 't0' });
});

test('tableau cards go up one at a time, by suit from the Ace', () => {
  const board = boardFromCodes({
    foundations: [['AH']],
    tableau: [{ up: ['2H'] }, { up: ['2D'] }, { up: ['3H'] }, { up: ['AS'] }, { up: ['5C'] }],
  });
  assert.deepEqual(play(board, { from: 't0', to: 'f0' }).foundations[0], cards('AH', '2H'));
  for (const [index, to] of FOUNDATION_IDS.entries()) {
    if (index > 0) assert.deepEqual(play(board, { from: 't3', to }).foundations[index], cards('AS'));
  }
  refuse(board, { from: 't3', to: 'f0' }); // an Ace on a started foundation
  refuse(board, { from: 't1', to: 'f0' }); // other suit
  refuse(board, { from: 't2', to: 'f0' }); // skips a rank
  refuse(board, { from: 't4', to: 'f1' }); // only an Ace starts a foundation
  refuse(board, { from: 't0', to: 'f1' });
  const run = boardFromCodes({ foundations: [['AH']], tableau: [{ up: ['3S', '2H'] }] });
  refuse(run, { from: 't0', to: 'f0', count: 2 });
  play(run, { from: 't0', to: 'f0', count: 1 });
});

test('a foundation card may come back to the tableau for -15 points, never to another foundation', () => {
  const board = boardFromCodes({
    foundations: [['AH', '2H', '3H'], [], ['AC']],
    tableau: [{ up: ['4S'] }, { up: ['4D'] }, {}],
  });
  assert.equal(scoreMove(board, { from: 'f0', to: 't0' }), SCORING.foundationToTableau);
  const next = play(board, { from: 'f0', to: 't0' });
  assert.deepEqual(pileCodes(next, 0), ['4S', '3H']);
  assert.deepEqual(next.foundations[0], cards('AH', '2H'));
  refuse(board, { from: 'f0', to: 't1' }); // same colour
  refuse(board, { from: 'f0', to: 't2' }); // not a King
  refuse(board, { from: 'f0', to: 't0', count: 2 });
  refuse(board, { from: 'f1', to: 't0' }); // empty foundation
  refuse(board, { from: 'f2', to: 'f1' }); // an Ace may not hop between foundations
});

test('moves onto the stock or waste, onto the same pile or with unknown piles are refused', () => {
  const board = boardFromCodes({
    stock: ['5C'], waste: ['4H'], tableau: [{ up: ['KS', 'QH'] }, { up: ['6S'] }],
  });
  const moves = [
    { from: 't0', to: 'waste' }, { from: 't0', to: 'stock' }, { from: 'waste', to: 'waste' },
    { from: 'stock', to: 't1' }, { from: 'stock', to: 'f0' }, { from: 't0', to: 't0', count: 2 },
    { from: 't7', to: 't1' }, { from: 't1', to: 'f4' }, { from: 'tableau', to: 't1' }, {},
  ];
  for (const move of moves) refuse(board, move);
  // 9H would fit on t0's 10S, so only the waste destination itself can refuse this.
  refuse(boardFromCodes({ tableau: [{ up: ['10S'] }, { up: ['9H'] }] }), { from: 't1', to: 'waste' });
  assert.equal(isLegalMove(board, null), false);
  assert.equal(applyMove(board, undefined), null);
});

test('scoring: +10 up, +5 waste to tableau, +5 per turned card, -15 back down, 0 otherwise', () => {
  assert.deepEqual(
    { ...SCORING },
    { wasteToTableau: 5, toFoundation: 10, flip: 5, foundationToTableau: -15 },
  );
  const board = boardFromCodes({
    stock: ['7C'],
    waste: ['9H'],
    foundations: [['AS']],
    tableau: [{ down: ['3D'], up: ['2S'] }, { up: ['10S'] }, { up: ['10C', '9D'] }, { up: ['8S'] }],
  });
  assert.equal(scoreMove(board, { from: 't0', to: 'f0' }), 15);
  assert.equal(scoreMove(board, { from: 'waste', to: 't1' }), 5);
  assert.equal(scoreMove(board, { from: 't3', to: 't2' }), 0);
  assert.equal(scoreMove(board, { from: 'stock', to: 'waste' }), 0);
  assert.equal(scoreMove(board, { from: 't3', to: 't1' }), 0, 'illegal moves score nothing');
});

test('foundationTargetFor finds the pile of the suit, or the first empty one for an Ace', () => {
  const board = boardFromCodes({ foundations: [['AH'], [], ['AC']] });
  assert.equal(foundationTargetFor(board, card('2H')), 'f0');
  assert.equal(foundationTargetFor(board, card('AS')), 'f1');
  assert.equal(foundationTargetFor(board, card('2C')), 'f2');
  assert.equal(foundationTargetFor(board, card('3C')), null);
  assert.equal(foundationTargetFor(board, card('2S')), null);
});

test('the game is won when all four foundations hold thirteen cards', () => {
  assert.equal(isWon(boardFromCodes({ foundations: ['C', 'D', 'H', 'S'].map(fullSuit) })), true);
  const almost = boardFromCodes({
    foundations: [fullSuit('C'), fullSuit('D'), fullSuit('H'), fullSuit('S').slice(0, 12)],
    tableau: [{ up: ['KS'] }],
  });
  assert.equal(isWon(almost), false);
  assert.equal(isWon(play(almost, { from: 't0', to: 'f3' })), true);
  assert.equal(isWon(dealGame(1)), false);
});

const SOURCES = ['waste', ...FOUNDATION_IDS, ...TABLEAU_IDS];
const TARGETS = [...FOUNDATION_IDS, ...TABLEAU_IDS];
const moveKeys = (moves) => moves.map(({ from, to, count }) => `${from}>${to}x${count}`);

function bruteForceCardMoves(board) {
  const moves = [];
  for (const from of SOURCES) {
    for (const to of TARGETS) {
      for (let count = 1; count <= RANKS.length; count += 1) {
        if (isLegalMove(board, { from, to, count })) moves.push({ from, to, count });
      }
    }
  }
  return moves;
}

test('legalMoves lists the stock move first, then every legal card move exactly once', () => {
  const random = createRng(5);
  for (let deal = 1; deal <= 6; deal += 1) {
    let board = dealGame(deal, deal % 2 === 0 ? 3 : 1);
    for (let step = 0; step < 40; step += 1) {
      const moves = legalMoves(board);
      const fromStock = stockMove(board);
      if (fromStock) assert.deepEqual(moves[0], fromStock);
      const cardMoves = moveKeys(fromStock ? moves.slice(1) : moves);
      assert.equal(new Set(cardMoves).size, cardMoves.length);
      assert.deepEqual(cardMoves.sort(), moveKeys(bruteForceCardMoves(board)).sort());
      if (moves.length === 0) break;
      board = applyMove(board, moves[Math.floor(random() * moves.length)]);
    }
  }
});

test('applyMove leaves the board it was given untouched', () => {
  const random = createRng(8);
  let board = dealGame(3);
  for (let step = 0; step < 30; step += 1) {
    const before = structuredClone(board);
    const moves = legalMoves(board);
    for (const move of moves) applyMove(board, move);
    assert.deepEqual(board, before);
    board = applyMove(board, moves[Math.floor(random() * moves.length)]);
  }
});

test('validateBoard accepts dealt boards and names every problem it finds', () => {
  assert.deepEqual(validateBoard(dealGame(4)), []);

  const duplicate = structuredClone(dealGame(4));
  const lost = duplicate.stock[0];
  duplicate.stock[0] = duplicate.stock[1];
  assert.deepEqual(validateBoard(duplicate), [
    `duplicate ${cardCode(duplicate.stock[1])}`, `missing ${cardCode(lost)}`,
  ]);

  const invalid = structuredClone(dealGame(4));
  const replaced = invalid.stock[5];
  invalid.stock[5] = 52;
  assert.deepEqual(validateBoard(invalid), ['invalid card 52', `missing ${cardCode(replaced)}`]);

  const tooHidden = structuredClone(dealGame(4));
  tooHidden.tableau[2].faceDown = 3;
  assert.deepEqual(validateBoard(tooHidden), ['t2: faceDown 3 is out of range']);

  const notRun = structuredClone(dealGame(4));
  notRun.tableau[6].faceDown = 0;
  assert.deepEqual(validateBoard(notRun), ['t6: face-up cards are not a run']);

  const misplaced = structuredClone(dealGame(4));
  const index = misplaced.stock.findIndex((each) => rankOf(each) !== ACE);
  misplaced.foundations[1] = misplaced.stock.splice(index, 1);
  assert.deepEqual(validateBoard(misplaced), ['f1: not built up by suit from the Ace']);
});

test('validateBoard reports a malformed board without looking further', () => {
  const board = dealGame(1);
  assert.deepEqual(validateBoard(null), ['board must be an object']);
  assert.deepEqual(validateBoard({ ...board, drawCount: 2 }), ['drawCount must be 1 or 3']);
  assert.deepEqual(validateBoard({ ...board, waste: null }), ['stock and waste must be arrays']);
  assert.deepEqual(
    validateBoard({ ...board, foundations: [[], [], []] }),
    ['foundations must be 4 arrays'],
  );
  assert.deepEqual(
    validateBoard({ ...board, tableau: board.tableau.slice(1) }),
    ['tableau must be 7 piles of { cards, faceDown }'],
  );
});
