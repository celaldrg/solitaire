/**
 * Keyboard play. The arrow keys move a cursor over the piles (on a tableau
 * pile ↑ and ↓ take more or fewer cards), Space picks the cards up and puts
 * them down on another pile, Enter plays their best move, F sends a card to
 * its foundation, Esc puts the cards back and letters run the header commands.
 */
import { pileCards } from './board.js';
import { actionForKey, cursorCount, grabAt, moveCursor } from './controls.js';
import { selectionRect } from './layout.js';

const COMMANDS = new Set(['draw', 'undo', 'hint', 'newDeal', 'restart', 'autoComplete']);
const DIRECTIONS = new Set(['left', 'right', 'up', 'down']);
/** Actions that keep running while a key is held down. */
const REPEATABLE = new Set([...DIRECTIONS, 'undo']);
/** Focused elements that handle Space and Enter themselves. */
const CONTROLS = 'button, input, select, textarea, a[href], summary';
const START = Object.freeze({ pile: 't0', depth: 1 });

/**
 * @typedef {import('./rules.js').Move} Move
 *
 * @typedef {Object} KeyboardHost what the keyboard needs from the page
 * @property {() => import('./board.js').Board | null} board null while the table takes no input
 * @property {(move: Move) => boolean} play plays a move; true when it was legal
 * @property {(pile: string, count: number) => boolean} playBest
 * @property {(pile: string) => boolean} toFoundation
 * @property {(cards: number[]) => void} shake
 * @property {() => void} render draws the table again (cursor and lifted cards)
 * @property {Object<string, () => void>} commands draw, undo, hint, newDeal, restart, autoComplete
 */

/**
 * Listens for keys on `doc` while no dialog is open.
 * @param {Document} doc
 * @param {KeyboardHost} host
 */
export function createKeyboard(doc, host) {
  /** @type {import('./controls.js').Cursor | null} */
  let cursor = null;
  /** @type {{ pile: string, count: number } | null} cards picked up with Space */
  let picked = null;

  const topCards = (board, pile, count) => pileCards(board, pile).slice(-count);

  /** The cards under the cursor, when they may be picked up. */
  function selection(board) {
    const count = cursorCount(board, cursor);
    return grabAt(board, cursor.pile, pileCards(board, cursor.pile).length - count);
  }

  function failed(board, pile, count) {
    host.render();
    host.shake(topCards(board, pile, count));
  }

  function pickOrPlace(board) {
    if (picked) {
      const { pile, count } = picked;
      picked = null;
      if (pile === cursor.pile) host.render();
      else if (!host.play({ from: pile, to: cursor.pile, count })) failed(board, pile, count);
      return;
    }
    if (cursor.pile === 'stock') {
      host.commands.draw();
      return;
    }
    picked = selection(board);
    if (picked) host.render();
    else failed(board, cursor.pile, 1);
  }

  function playBest(board) {
    if (cursor.pile === 'stock') {
      host.commands.draw();
      return;
    }
    const chosen = picked ?? selection(board);
    picked = null;
    if (!chosen) failed(board, cursor.pile, 1);
    else if (!host.playBest(chosen.pile, chosen.count)) failed(board, chosen.pile, chosen.count);
  }

  function sendUp(board) {
    const pile = picked?.pile ?? cursor?.pile ?? 'waste';
    picked = null;
    if (!host.toFoundation(pile)) failed(board, pile, 1);
  }

  function handle(action) {
    if (COMMANDS.has(action)) {
      if (picked) {
        picked = null;
        host.render();
      }
      host.commands[action]();
      return;
    }
    const board = host.board();
    if (!board) return;
    if (action === 'foundation') {
      sendUp(board);
    } else if (!cursor) {
      if (action !== 'cancel') cursor = { ...START };
      host.render();
    } else if (DIRECTIONS.has(action)) {
      cursor = moveCursor(board, cursor, action);
      host.render();
    } else if (action === 'cancel') {
      if (picked) picked = null;
      else cursor = null;
      host.render();
    } else if (action === 'pick') {
      pickOrPlace(board);
    } else {
      playBest(board);
    }
  }

  doc.addEventListener('keydown', (event) => {
    const action = actionForKey(event);
    if (!action || doc.querySelector('dialog[open]')) return;
    if (event.repeat && !REPEATABLE.has(action)) return;
    const onControl = event.target instanceof Element && event.target.closest(CONTROLS);
    if (onControl && (action === 'pick' || action === 'smart')) return;
    event.preventDefault();
    handle(action);
  });

  return {
    /**
     * Cards lifted because they were picked up.
     * @param {import('./board.js').Board} board
     * @returns {number[]}
     */
    lifted: (board) => (picked ? topCards(board, picked.pile, picked.count) : []),

    /**
     * The outline the cursor draws, or null when it is hidden.
     * @param {import('./layout.js').Layout} layout
     * @param {import('./board.js').Board} board
     * @returns {import('./layout.js').Rect | null}
     */
    cursorRect(layout, board) {
      if (!cursor) return null;
      return selectionRect(layout, cursor.pile, pileCards(board, cursor.pile), cursorCount(board, cursor));
    },

    /** After a move: puts picked cards down and selects one card again. */
    settle() {
      picked = null;
      if (cursor) cursor = { pile: cursor.pile, depth: 1 };
    },

    /**
     * The pointer took over: hides the cursor and puts picked cards back.
     * @returns {boolean} true when the cursor or picked cards were showing
     */
    hide() {
      const shown = cursor !== null || picked !== null;
      picked = null;
      cursor = null;
      return shown;
    },
  };
}
