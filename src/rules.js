/**
 * Klondike move rules on immutable boards (see board.js for the board shape).
 *
 * A move is `{ from, to, count }` between pile ids:
 *  - `{ from: 'stock', to: 'waste' }` turns drawCount cards (fewer if the stock runs out);
 *  - `{ from: 'waste', to: 'stock' }` turns the waste back over once the stock is empty;
 *  - any other move takes `count` cards (default 1) from the top of `from`.
 * Only a tableau pile gives up more than one card, and only from its face-up run.
 * Stock moves ignore `count`. When a tableau pile loses its last face-up card,
 * the card below is turned face up automatically.
 *
 * @typedef {{ from: string, to: string, count?: number }} Move
 */
import { ACE, DECK_SIZE, KING, RANKS_PER_SUIT, cardCode, isRed, rankOf, suitOf } from './cards.js';
import {
  FOUNDATION_IDS, FOUNDATION_PILES, TABLEAU_IDS, TABLEAU_PILES, parsePileId,
} from './board.js';

/** Points per move, standard Klondike scoring. Tableau-to-tableau moves score 0. */
export const SCORING = Object.freeze({
  wasteToTableau: 5,
  toFoundation: 10,
  flip: 5,
  foundationToTableau: -15,
});

const TARGET_IDS = Object.freeze([...FOUNDATION_IDS, ...TABLEAU_IDS]);

/**
 * Tableau building rule: one rank lower and the other colour.
 * @param {number} card the card being placed
 * @param {number} onto the card it would cover
 * @returns {boolean}
 */
export function stacksOn(card, onto) {
  return rankOf(onto) === rankOf(card) + 1 && isRed(onto) !== isRed(card);
}

/**
 * Can `card` (the head of a run) go on a tableau pile? Only a King goes on an empty pile.
 * @param {number} card
 * @param {number[]} cards the target pile, bottom first
 * @returns {boolean}
 */
export function canStackOnTableau(card, cards) {
  return cards.length === 0 ? rankOf(card) === KING : stacksOn(card, cards[cards.length - 1]);
}

/**
 * Can `card` go on a foundation? Foundations start with an Ace and build up by suit.
 * @param {number} card
 * @param {number[]} cards the foundation pile, Ace first
 * @returns {boolean}
 */
export function canStackOnFoundation(card, cards) {
  if (cards.length === 0) return rankOf(card) === ACE;
  const top = cards[cards.length - 1];
  return suitOf(card) === suitOf(top) && rankOf(card) === rankOf(top) + 1;
}

/**
 * Is `cards` a run that can move as one unit (descending, alternating colours)?
 * @param {number[]} cards bottom card first
 * @returns {boolean}
 */
export function isValidRun(cards) {
  for (let i = 1; i < cards.length; i += 1) {
    if (!stacksOn(cards[i], cards[i - 1])) return false;
  }
  return true;
}

/**
 * Checks that a board is complete and consistent: 52 distinct cards, sane
 * face-down counts, face-up tableau runs and foundations built by suit.
 * @param {import('./board.js').Board} board
 * @returns {string[]} problems found; empty when the board is valid
 */
export function validateBoard(board) {
  const shapeProblem = checkShape(board);
  if (shapeProblem) return [shapeProblem];
  return [...checkCards(board), ...checkTableau(board), ...checkFoundations(board)];
}

function checkShape(board) {
  if (!board || typeof board !== 'object') return 'board must be an object';
  if (board.drawCount !== 1 && board.drawCount !== 3) return 'drawCount must be 1 or 3';
  if (!Array.isArray(board.stock) || !Array.isArray(board.waste)) return 'stock and waste must be arrays';
  const { foundations, tableau } = board;
  if (!Array.isArray(foundations) || foundations.length !== FOUNDATION_PILES
    || !foundations.every(Array.isArray)) return 'foundations must be 4 arrays';
  if (!Array.isArray(tableau) || tableau.length !== TABLEAU_PILES
    || !tableau.every((pile) => Array.isArray(pile?.cards) && Number.isInteger(pile.faceDown))) {
    return 'tableau must be 7 piles of { cards, faceDown }';
  }
  return null;
}

function checkCards(board) {
  const problems = [];
  const seen = new Array(DECK_SIZE).fill(0);
  const cards = [
    ...board.stock, ...board.waste, ...board.foundations.flat(),
    ...board.tableau.flatMap((pile) => pile.cards),
  ];
  for (const card of cards) {
    if (!Number.isInteger(card) || card < 0 || card >= DECK_SIZE) problems.push(`invalid card ${card}`);
    else if (++seen[card] === 2) problems.push(`duplicate ${cardCode(card)}`);
  }
  seen.forEach((count, card) => {
    if (count === 0) problems.push(`missing ${cardCode(card)}`);
  });
  return problems;
}

function checkTableau(board) {
  const problems = [];
  board.tableau.forEach((pile, index) => {
    const maxHidden = Math.max(0, pile.cards.length - 1);
    if (pile.faceDown < 0 || pile.faceDown > maxHidden) {
      problems.push(`t${index}: faceDown ${pile.faceDown} is out of range`);
    } else if (!isValidRun(pile.cards.slice(pile.faceDown))) {
      problems.push(`t${index}: face-up cards are not a run`);
    }
  });
  return problems;
}

function checkFoundations(board) {
  const problems = [];
  board.foundations.forEach((cards, index) => {
    const built = cards.every((card, k) => canStackOnFoundation(card, k === 0 ? [] : [cards[k - 1]]));
    if (!built) problems.push(`f${index}: not built up by suit from the Ace`);
  });
  return problems;
}

/**
 * @param {import('./board.js').Board} board
 * @param {Move} move
 * @returns {boolean}
 */
export function isLegalMove(board, move) {
  return resolveMove(board, move) !== null;
}

/**
 * Plays a move.
 * @param {import('./board.js').Board} board
 * @param {Move} move
 * @returns {import('./board.js').Board | null} the new board, or null when the move is illegal
 */
export function applyMove(board, move) {
  const resolved = resolveMove(board, move);
  if (!resolved) return null;
  if (resolved.kind === 'draw') return drawCards(board);
  if (resolved.kind === 'recycle') return recycleWaste(board);
  return transferCards(board, resolved);
}

/**
 * Points a legal move earns (see SCORING), including the bonus for turning
 * over a tableau card. Illegal moves, draws and recycles score 0.
 * @param {import('./board.js').Board} board the board before the move
 * @param {Move} move
 * @returns {number}
 */
export function scoreMove(board, move) {
  const resolved = resolveMove(board, move);
  if (!resolved || resolved.kind !== 'transfer') return 0;
  const { from, to, cards } = resolved;
  let points = 0;
  if (to.kind === 'foundation') points += SCORING.toFoundation;
  else if (from.kind === 'waste') points += SCORING.wasteToTableau;
  else if (from.kind === 'foundation') points += SCORING.foundationToTableau;
  if (exposesHiddenCard(board, from, cards.length)) points += SCORING.flip;
  return points;
}

/**
 * The move a click on the stock makes: draw, or recycle the waste when the stock is empty.
 * `count` tells how many cards change sides.
 * @param {import('./board.js').Board} board
 * @returns {Move | null} null when stock and waste are both empty
 */
export function stockMove(board) {
  if (board.stock.length > 0) {
    return { from: 'stock', to: 'waste', count: Math.min(board.drawCount, board.stock.length) };
  }
  if (board.waste.length > 0) return { from: 'waste', to: 'stock', count: board.waste.length };
  return null;
}

/**
 * Every legal move, the stock move first. An Ace that may go to several empty
 * foundations is listed once per foundation.
 * @param {import('./board.js').Board} board
 * @returns {Move[]}
 */
export function legalMoves(board) {
  const moves = [];
  const fromStock = stockMove(board);
  if (fromStock) moves.push(fromStock);
  for (const { from, count } of moveSources(board)) {
    for (const to of TARGET_IDS) {
      const move = { from, to, count };
      if (isLegalMove(board, move)) moves.push(move);
    }
  }
  return moves;
}

/**
 * The foundation a card may go to: the pile of its suit, or the first empty one for an Ace.
 * @param {import('./board.js').Board} board
 * @param {number} card
 * @returns {string | null} a foundation id, or null when the card cannot go up yet
 */
export function foundationTargetFor(board, card) {
  const index = board.foundations.findIndex((cards) => canStackOnFoundation(card, cards));
  return index === -1 ? null : FOUNDATION_IDS[index];
}

/**
 * @param {import('./board.js').Board} board
 * @returns {boolean} true when all four foundations are complete
 */
export function isWon(board) {
  return board.foundations.every((cards) => cards.length === RANKS_PER_SUIT);
}

function moveSources(board) {
  const sources = [{ from: 'waste', count: 1 }, ...FOUNDATION_IDS.map((from) => ({ from, count: 1 }))];
  board.tableau.forEach((pile, index) => {
    for (let count = 1; count <= pile.cards.length - pile.faceDown; count += 1) {
      sources.push({ from: TABLEAU_IDS[index], count });
    }
  });
  return sources;
}

function resolveMove(board, move) {
  const from = parsePileId(move?.from);
  const to = parsePileId(move?.to);
  if (!from || !to) return null;
  if (from.kind === 'stock' || to.kind === 'stock' || to.kind === 'waste') {
    return resolveStockMove(board, from, to);
  }
  const cards = takeableCards(board, from, move.count ?? 1);
  if (!cards || !canReceive(board, from, to, cards)) return null;
  return { kind: 'transfer', from, to, cards };
}

function resolveStockMove(board, from, to) {
  if (from.kind === 'stock' && to.kind === 'waste' && board.stock.length > 0) {
    return { kind: 'draw' };
  }
  if (from.kind === 'waste' && to.kind === 'stock'
    && board.stock.length === 0 && board.waste.length > 0) {
    return { kind: 'recycle' };
  }
  return null;
}

function takeableCards(board, from, count) {
  if (!Number.isInteger(count) || count < 1) return null;
  if (from.kind === 'tableau') {
    const pile = board.tableau[from.index];
    if (count > pile.cards.length - pile.faceDown) return null;
    const cards = pile.cards.slice(pile.cards.length - count);
    return isValidRun(cards) ? cards : null;
  }
  const pile = from.kind === 'waste' ? board.waste : board.foundations[from.index];
  return count === 1 && pile.length > 0 ? pile.slice(-1) : null;
}

function canReceive(board, from, to, cards) {
  if (to.kind === 'foundation') {
    return from.kind !== 'foundation' && cards.length === 1
      && canStackOnFoundation(cards[0], board.foundations[to.index]);
  }
  if (from.kind === 'tableau' && from.index === to.index) return false;
  return canStackOnTableau(cards[0], board.tableau[to.index].cards);
}

function exposesHiddenCard(board, from, count) {
  if (from.kind !== 'tableau') return false;
  const pile = board.tableau[from.index];
  const remaining = pile.cards.length - count;
  return remaining > 0 && remaining === pile.faceDown;
}

function drawCards(board) {
  const count = Math.min(board.drawCount, board.stock.length);
  const drawn = board.stock.slice(-count).reverse();
  return { ...board, stock: board.stock.slice(0, -count), waste: board.waste.concat(drawn) };
}

function recycleWaste(board) {
  return { ...board, stock: board.waste.slice().reverse(), waste: [] };
}

function transferCards(board, { from, to, cards }) {
  const next = { ...board, foundations: board.foundations.slice(), tableau: board.tableau.slice() };
  removeCards(next, from, cards.length);
  addCards(next, to, cards);
  return next;
}

function removeCards(next, from, count) {
  if (from.kind === 'waste') {
    next.waste = next.waste.slice(0, -count);
  } else if (from.kind === 'foundation') {
    next.foundations[from.index] = next.foundations[from.index].slice(0, -count);
  } else {
    const pile = next.tableau[from.index];
    const cards = pile.cards.slice(0, pile.cards.length - count);
    // Turning the new top card face up when it was hidden.
    next.tableau[from.index] = { cards, faceDown: Math.min(pile.faceDown, Math.max(0, cards.length - 1)) };
  }
}

function addCards(next, to, cards) {
  if (to.kind === 'foundation') {
    next.foundations[to.index] = next.foundations[to.index].concat(cards);
  } else {
    const pile = next.tableau[to.index];
    next.tableau[to.index] = { cards: pile.cards.concat(cards), faceDown: pile.faceDown };
  }
}
