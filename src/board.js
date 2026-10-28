/**
 * Board model: pile ids, dealing and the stock/waste cycle.
 *
 * A board is a plain JSON-friendly object. Treat it as read-only: the rules
 * in rules.js return new boards that share unchanged piles with the old one,
 * which makes unlimited undo a matter of keeping old boards.
 *
 * @typedef {Object} TableauPile
 * @property {number[]} cards   bottom card first
 * @property {number} faceDown  how many of the first cards are face down
 *
 * @typedef {Object} Board
 * @property {1|3} drawCount         cards turned per draw
 * @property {number[]} stock        face down, last item is the top
 * @property {number[]} waste        face up, last item is the top
 * @property {number[][]} foundations 4 piles, Ace first
 * @property {TableauPile[]} tableau 7 piles
 *
 * Pile ids: 'stock', 'waste', 'f0'..'f3' (foundations), 't0'..'t6' (tableau).
 * @typedef {string} PileId
 *
 * @typedef {Object} BoardLayout readable layout for boardFromCodes
 * @property {number} [drawCount]
 * @property {string[]} [stock]
 * @property {string[]} [waste]
 * @property {string[][]} [foundations]
 * @property {{ down?: string[], up?: string[] }[]} [tableau]
 */
import { createDeck, parseCard } from './cards.js';
import { createRng, shuffle } from './rng.js';

export const TABLEAU_PILES = 7;
export const FOUNDATION_PILES = 4;

/** Highest deal number handed out by randomDealNumber. */
export const MAX_DEAL = 999999;

export const TABLEAU_IDS = Object.freeze(
  Array.from({ length: TABLEAU_PILES }, (_, index) => `t${index}`),
);
export const FOUNDATION_IDS = Object.freeze(
  Array.from({ length: FOUNDATION_PILES }, (_, index) => `f${index}`),
);

const PILES = new Map([
  ['stock', Object.freeze({ kind: 'stock', index: 0 })],
  ['waste', Object.freeze({ kind: 'waste', index: 0 })],
  ...FOUNDATION_IDS.map((id, index) => [id, Object.freeze({ kind: 'foundation', index })]),
  ...TABLEAU_IDS.map((id, index) => [id, Object.freeze({ kind: 'tableau', index })]),
]);

/**
 * Splits a pile id into its kind and index.
 * @param {PileId} id
 * @returns {{ kind: 'stock'|'waste'|'foundation'|'tableau', index: number } | null}
 *   null for unknown ids
 */
export function parsePileId(id) {
  return PILES.get(id) ?? null;
}

/**
 * The cards of any pile, bottom first (for the tableau: hidden ones included).
 * @param {Board} board
 * @param {PileId} id
 * @returns {number[]} an empty array for unknown ids
 */
export function pileCards(board, id) {
  const pile = parsePileId(id);
  if (!pile) return [];
  if (pile.kind === 'stock') return board.stock;
  if (pile.kind === 'waste') return board.waste;
  if (pile.kind === 'foundation') return board.foundations[pile.index];
  return board.tableau[pile.index].cards;
}

/**
 * @param {unknown} drawCount
 * @returns {1|3} 3 when asked for 3, otherwise 1
 */
export function normalizeDrawCount(drawCount) {
  return drawCount === 3 ? 3 : 1;
}

/**
 * Deals a new game: 28 cards to the tableau (pile n gets n + 1 cards, only the
 * top one face up) and 24 to the stock. A deal number always gives the same layout.
 * @param {number} deal deal number, used as the shuffle seed
 * @param {number} [drawCount=1] 1 or 3
 * @returns {Board}
 */
export function dealGame(deal, drawCount = 1) {
  const deck = shuffle(createDeck(), createRng(deal));
  const tableau = TABLEAU_IDS.map((_, index) => ({ cards: [], faceDown: index }));
  let next = 0;
  for (let row = 0; row < TABLEAU_PILES; row += 1) {
    for (let column = row; column < TABLEAU_PILES; column += 1) {
      tableau[column].cards.push(deck[next]);
      next += 1;
    }
  }
  return {
    drawCount: normalizeDrawCount(drawCount),
    stock: deck.slice(next),
    waste: [],
    foundations: FOUNDATION_IDS.map(() => []),
    tableau,
  };
}

/**
 * Picks a deal number in 1..MAX_DEAL.
 * @param {() => number} [random=Math.random] generator returning floats in [0, 1)
 * @returns {number}
 */
export function randomDealNumber(random = Math.random) {
  return 1 + Math.floor(random() * MAX_DEAL);
}

/**
 * Builds a board from readable card codes ("QH", "10S"); missing piles are empty.
 * Used for the demo layout and for tests.
 * @param {BoardLayout} layout
 * @returns {Board}
 */
export function boardFromCodes(layout) {
  const parse = (codes = []) => codes.map(parseCard);
  return {
    drawCount: normalizeDrawCount(layout.drawCount),
    stock: parse(layout.stock),
    waste: parse(layout.waste),
    foundations: FOUNDATION_IDS.map((_, index) => parse(layout.foundations?.[index])),
    tableau: TABLEAU_IDS.map((_, index) => {
      const pile = layout.tableau?.[index] ?? {};
      const hidden = parse(pile.down);
      return { cards: hidden.concat(parse(pile.up)), faceDown: hidden.length };
    }),
  };
}

/**
 * Stock and waste as one sequence in draw order: the waste from bottom to top,
 * then the stock from top to bottom. Drawing and recycling never change this
 * sequence; they only move the boundary, which is the waste size.
 * @param {Board} board
 * @returns {number[]}
 */
export function stockCycle(board) {
  return board.waste.concat(board.stock.slice().reverse());
}

/**
 * Waste sizes reachable by drawing and recycling alone, in the order they
 * appear, starting with the current size. At waste size `s` (> 0) the waste
 * top is `stockCycle(board)[s - 1]`.
 * @param {number} total cards in stock and waste together
 * @param {number} wasteSize current waste size
 * @param {number} drawCount 1 or 3
 * @returns {number[]}
 */
export function reachableWasteSizes(total, wasteSize, drawCount) {
  const seen = new Set();
  let size = wasteSize;
  while (!seen.has(size)) {
    seen.add(size);
    size = size === total ? 0 : Math.min(total, size + drawCount);
  }
  return [...seen];
}
