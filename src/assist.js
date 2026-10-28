/**
 * Player assistance on top of the rules: hints, where a tapped card or a card
 * sent up should go, and auto-complete.
 */
import { DECK_SIZE, KING, rankOf } from './cards.js';
import {
  FOUNDATION_IDS, TABLEAU_IDS, parsePileId, pileCards, reachableWasteSizes, stockCycle,
} from './board.js';
import {
  applyMove, canStackOnTableau, foundationTargetFor, isLegalMove, isWon, legalMoves, stockMove,
} from './rules.js';
import { solve } from './solver.js';

/** Hint priorities; a move worth 0 is never suggested. */
const HINT_VALUE = Object.freeze({
  revealToFoundation: 90,
  reveal: 60,
  wasteToFoundation: 55,
  toFoundation: 50,
  wasteToTableau: 40,
  freeCard: 30,
  roomForKing: 20,
  stock: 1,
});

/** Stock clicks in a row without a foundation move before the simple plan gives up. */
const MAX_IDLE_STOCK_MOVES = 2 * DECK_SIZE + 2;

/**
 * Search budget when the simple plan gets stuck. Open positions are small:
 * the wins measured on thousands of them needed at most a few hundred nodes.
 */
const AUTO_COMPLETE_NODE_LIMIT = 2000;

/**
 * Suggests a useful legal move: turning over hidden cards first, then
 * foundation moves, emptying the waste, and finally drawing when a card in
 * the stock could be played. Moves that only shuffle cards around are skipped.
 * @param {import('./board.js').Board} board
 * @returns {import('./rules.js').Move | null} null when no move helps
 */
export function findHint(board) {
  let best = null;
  let bestValue = 0;
  for (const move of legalMoves(board)) {
    const value = hintValue(board, move);
    if (value > bestValue) {
      best = move;
      bestValue = value;
    }
  }
  return best;
}

/**
 * Where a tapped card (with the `count - 1` cards on top of it) should go:
 * a foundation when possible, otherwise the first tableau pile that takes it,
 * preferring non-empty piles. Moving a whole pile to another empty pile
 * changes nothing and is never chosen.
 * @param {import('./board.js').Board} board
 * @param {string} from pile id ('waste', 'f0'..'f3' or 't0'..'t6')
 * @param {number} [count=1] cards taken from the top of `from`
 * @returns {import('./rules.js').Move | null}
 */
export function bestMoveFor(board, from, count = 1) {
  const source = parsePileId(from);
  if (!source || source.kind === 'stock') return null;
  const isEmpty = (id) => pileCards(board, id).length === 0;
  const targets = [
    ...(source.kind === 'foundation' ? [] : FOUNDATION_IDS),
    ...TABLEAU_IDS.filter((id) => !isEmpty(id)),
    ...TABLEAU_IDS.filter(isEmpty),
  ];
  for (const to of targets) {
    const move = { from, to, count };
    if (isLegalMove(board, move) && !isPileShuffle(board, move)) return move;
  }
  return null;
}

/**
 * The move that sends the top card of the waste or a tableau pile to a foundation.
 * @param {import('./board.js').Board} board
 * @param {string} from 'waste' or 't0'..'t6'
 * @returns {import('./rules.js').Move | null}
 */
export function foundationMoveFor(board, from) {
  const source = parsePileId(from);
  if (!source || (source.kind !== 'waste' && source.kind !== 'tableau')) return null;
  const cards = pileCards(board, from);
  if (cards.length === 0) return null;
  const to = foundationTargetFor(board, cards[cards.length - 1]);
  const move = { from, to, count: 1 };
  return to && isLegalMove(board, move) ? move : null;
}

/**
 * Auto-complete is offered when the stock is empty, every card is face up
 * and autoCompleteMoves finds a way to finish.
 * @param {import('./board.js').Board} board
 * @returns {boolean}
 */
export function canAutoComplete(board) {
  return board.stock.length === 0 && !isWon(board) && autoCompleteMoves(board) !== null;
}

/**
 * Moves that finish a game in which every tableau card is face up. The plan
 * plays the lowest cards up first and draws from the stock when nothing else
 * plays. In draw-3 that can get stuck on a card buried in the waste; then the
 * solver looks for a line that also uses the tableau, such as putting the
 * waste top on a pile to reach the card under it.
 * @param {import('./board.js').Board} board
 * @returns {import('./rules.js').Move[] | null} null when a tableau card is
 *   still face down or no way to finish is found
 */
export function autoCompleteMoves(board) {
  if (board.tableau.some((pile) => pile.faceDown > 0)) return null;
  return foundationPlan(board) ?? solve(board, { nodeLimit: AUTO_COMPLETE_NODE_LIMIT }).moves;
}

/** Lowest cards up first, drawing when nothing plays; null when that gets stuck. */
function foundationPlan(board) {
  const moves = [];
  let current = board;
  let idleStockMoves = 0;
  while (!isWon(current)) {
    let move = lowestFoundationMove(current);
    if (move) {
      idleStockMoves = 0;
    } else {
      move = stockMove(current);
      idleStockMoves += 1;
      if (!move || idleStockMoves > MAX_IDLE_STOCK_MOVES) return null;
    }
    moves.push(move);
    current = applyMove(current, move);
  }
  return moves;
}

function lowestFoundationMove(board) {
  let best = null;
  let bestRank = Infinity;
  for (const from of ['waste', ...TABLEAU_IDS]) {
    const move = foundationMoveFor(board, from);
    if (!move) continue;
    const cards = pileCards(board, from);
    const rank = rankOf(cards[cards.length - 1]);
    if (rank < bestRank) {
      best = move;
      bestRank = rank;
    }
  }
  return best;
}

/** A whole tableau pile going to an empty tableau pile, e.g. a lone King hopping across. */
function isPileShuffle(board, move) {
  const source = parsePileId(move.from);
  const target = parsePileId(move.to);
  return source.kind === 'tableau' && target.kind === 'tableau'
    && move.count === board.tableau[source.index].cards.length
    && board.tableau[target.index].cards.length === 0;
}

function hintValue(board, move) {
  const from = parsePileId(move.from);
  const to = parsePileId(move.to);
  if (from.kind === 'stock' || to.kind === 'stock') return stockHelps(board) ? HINT_VALUE.stock : 0;
  if (from.kind === 'foundation') return 0;
  if (from.kind === 'waste') {
    return to.kind === 'foundation' ? HINT_VALUE.wasteToFoundation : HINT_VALUE.wasteToTableau;
  }
  return tableauMoveValue(board, board.tableau[from.index], move.count, to);
}

function tableauMoveValue(board, pile, count, to) {
  const start = pile.cards.length - count;
  const reveals = start > 0 && start === pile.faceDown;
  if (to.kind === 'foundation') return reveals ? HINT_VALUE.revealToFoundation : HINT_VALUE.toFoundation;
  if (reveals) return HINT_VALUE.reveal + pile.faceDown;
  if (start === 0) {
    return rankOf(pile.cards[0]) !== KING && kingNeedsRoom(board) ? HINT_VALUE.roomForKing : 0;
  }
  return exposedCardHelps(board, pile.cards[start - 1]) ? HINT_VALUE.freeCard : 0;
}

/** A King is waiting for an empty pile: on top of hidden cards or in the stock/waste. */
function kingNeedsRoom(board) {
  if (board.tableau.some((pile) => pile.cards.length === 0)) return false;
  const isKing = (card) => rankOf(card) === KING;
  return board.tableau.some((pile) => pile.faceDown > 0 && isKing(pile.cards[pile.faceDown]))
    || board.stock.some(isKing) || board.waste.some(isKing);
}

/** Uncovering `card` lets it go up, or lets the waste top go on it. */
function exposedCardHelps(board, card) {
  if (foundationTargetFor(board, card)) return true;
  const wasteTop = board.waste[board.waste.length - 1];
  return wasteTop !== undefined && canStackOnTableau(wasteTop, [card]);
}

/** Drawing can bring up a card (other than the current waste top) that can be played now. */
function stockHelps(board) {
  const cycle = stockCycle(board);
  return reachableWasteSizes(cycle.length, board.waste.length, board.drawCount)
    .some((size) => size > 0 && size !== board.waste.length && isPlayable(board, cycle[size - 1]));
}

function isPlayable(board, card) {
  return foundationTargetFor(board, card) !== null
    || board.tableau.some((pile) => canStackOnTableau(card, pile.cards));
}
