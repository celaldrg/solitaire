/**
 * Input rules shared by the pointer and keyboard handlers: which cards a press
 * picks up, which action a key triggers and how the keyboard cursor moves.
 *
 * @typedef {{ pile: string, depth: number }} Cursor the keyboard cursor;
 *   `depth` is how many cards it takes from the top of a tableau pile
 */
import { TABLEAU_IDS, parsePileId, pileCards } from './board.js';

const KEY_ACTIONS = Object.freeze({
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  ' ': 'pick',
  enter: 'smart',
  escape: 'cancel',
  f: 'foundation',
  d: 'draw',
  u: 'undo',
  z: 'undo',
  backspace: 'undo',
  h: 'hint',
  n: 'newDeal',
  r: 'restart',
  a: 'autoComplete',
});

/** Top-row piles by column; column 2 lies under the waste fan and has no pile. */
const TOP_ROW = Object.freeze(['stock', 'waste', null, 'f0', 'f1', 'f2', 'f3']);

/**
 * The cards a press on a card picks up: a face-up tableau card with every card
 * above it, or the top card of the waste or of a foundation.
 * @param {import('./board.js').Board} board
 * @param {string} pile pile id
 * @param {number} index position of the pressed card, bottom card 0
 * @returns {{ pile: string, count: number } | null} null for stock cards,
 *   face-down cards and cards buried in the waste or a foundation
 */
export function grabAt(board, pile, index) {
  const place = parsePileId(pile);
  const cards = pileCards(board, pile);
  if (!place || index < 0 || index >= cards.length) return null;
  if (place.kind === 'tableau') {
    return index >= board.tableau[place.index].faceDown ? { pile, count: cards.length - index } : null;
  }
  const isTop = index === cards.length - 1;
  return isTop && (place.kind === 'waste' || place.kind === 'foundation') ? { pile, count: 1 } : null;
}

/**
 * The action a key press triggers. Browser shortcuts stay untouched: with Ctrl
 * or Cmd only Z (undo) counts, and Alt combinations are ignored.
 * @param {{ key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }} event
 * @returns {string | null} an action name such as 'undo' or 'left', or null
 */
export function actionForKey({ key, ctrlKey = false, metaKey = false, altKey = false }) {
  const name = String(key).toLowerCase();
  if (ctrlKey || metaKey) return name === 'z' ? 'undo' : null;
  return altKey ? null : KEY_ACTIONS[name] ?? null;
}

/**
 * How many cards the cursor selects: up to `depth` face-up cards of a tableau
 * pile, one card anywhere else.
 * @param {import('./board.js').Board} board
 * @param {Cursor} cursor
 * @returns {number}
 */
export function cursorCount(board, cursor) {
  const place = parsePileId(cursor.pile);
  if (place?.kind !== 'tableau') return 1;
  return Math.max(1, Math.min(cursor.depth, runLength(board, place.index)));
}

/**
 * Moves the keyboard cursor. Left and right walk along the current row and
 * wrap around. On a tableau pile, up takes one more card of its face-up run and
 * then jumps to the top row; down gives back a card. From the top row, down
 * goes to the tableau pile below.
 * @param {import('./board.js').Board} board
 * @param {Cursor} cursor
 * @param {'left'|'right'|'up'|'down'} direction
 * @returns {Cursor}
 */
export function moveCursor(board, cursor, direction) {
  const place = parsePileId(cursor.pile);
  const inTableau = place?.kind === 'tableau';
  const row = inTableau ? TABLEAU_IDS : TOP_ROW;
  const column = Math.max(0, row.indexOf(cursor.pile));
  if (direction === 'left' || direction === 'right') {
    return { pile: stepAlong(row, column, direction === 'left' ? -1 : 1), depth: 1 };
  }
  if (!inTableau) return direction === 'down' ? { pile: TABLEAU_IDS[column], depth: 1 } : cursor;
  const count = cursorCount(board, cursor);
  if (direction === 'down') return { pile: cursor.pile, depth: Math.max(1, count - 1) };
  if (count < runLength(board, place.index)) return { pile: cursor.pile, depth: count + 1 };
  return { pile: TOP_ROW[column] ?? 'waste', depth: 1 };
}

function runLength(board, index) {
  const { cards, faceDown } = board.tableau[index];
  return cards.length - faceDown;
}

function stepAlong(row, column, step) {
  let index = column;
  do {
    index = (index + step + row.length) % row.length;
  } while (row[index] === null);
  return row[index];
}
