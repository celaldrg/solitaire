/**
 * Game controller for the UI: one deal with score, move counter, timer and
 * unlimited undo. All rules live in pure modules; this file only keeps history.
 *
 * Restarting a deal or dealing a new one means creating a new game.
 */
import { dealGame, randomDealNumber } from './board.js';
import { applyMove, isWon, scoreMove, stockMove } from './rules.js';
import {
  autoCompleteMoves, bestMoveFor, canAutoComplete, findHint, foundationMoveFor,
} from './assist.js';

/**
 * @typedef {Object} GameOptions
 * @property {number} [deal] deal number; a random one when missing or invalid
 * @property {number} [drawCount=1] 1 or 3 (ignored when `board` is given)
 * @property {() => number} [random=Math.random] picks the deal number when `deal` is missing
 * @property {import('./board.js').Board} [board] start from this board instead of dealing
 * @property {number} [score=0]
 * @property {number} [moves=0]
 * @property {number} [elapsed=0] seconds already played
 *
 * @typedef {Object} GameState
 * @property {number} deal
 * @property {1|3} drawCount
 * @property {import('./board.js').Board} board read-only
 * @property {number} score never below 0
 * @property {number} moves successful moves, draws included
 * @property {number} elapsed seconds; the clock starts with the first move and stops on a win
 * @property {boolean} won
 * @property {boolean} canUndo
 * @property {boolean} canAutoComplete
 *
 * @typedef {Object} Game
 * @property {() => GameState} getState
 * @property {(move: import('./rules.js').Move) => boolean} move plays a move if it is legal
 * @property {() => import('./rules.js').Move | null} drawFromStock draws, or recycles the waste
 * @property {(from: string, count?: number) => import('./rules.js').Move | null} autoMove
 *   tap: moves the top `count` cards of `from` to their best destination
 * @property {(from: string) => import('./rules.js').Move | null} moveToFoundation
 *   F key: sends the top card of the waste or a tableau pile up
 * @property {() => import('./rules.js').Move | null} autoCompleteStep plays the next
 *   auto-complete move (works once every tableau card is face up)
 * @property {() => import('./rules.js').Move | null} hint a useful move, not played
 * @property {() => boolean} undo
 * @property {(seconds: number) => void} update advances the clock
 */

/**
 * Starts a game.
 * @param {GameOptions} [options]
 * @returns {Game}
 */
export function createGame(options = {}) {
  const deal = isDealNumber(options.deal) ? options.deal : randomDealNumber(options.random);
  let current = {
    board: options.board ?? dealGame(deal, options.drawCount),
    score: options.score ?? 0,
    moves: options.moves ?? 0,
  };
  let elapsed = options.elapsed ?? 0;
  let started = current.moves > 0;
  const history = [];

  function move(candidate) {
    const board = applyMove(current.board, candidate);
    if (!board) return false;
    history.push(current);
    current = {
      board,
      score: Math.max(0, current.score + scoreMove(current.board, candidate)),
      moves: current.moves + 1,
    };
    started = true;
    return true;
  }

  const playChosen = (candidate) => (candidate && move(candidate) ? candidate : null);

  return {
    getState: () => ({
      deal,
      drawCount: current.board.drawCount,
      board: current.board,
      score: current.score,
      moves: current.moves,
      elapsed,
      won: isWon(current.board),
      canUndo: history.length > 0,
      canAutoComplete: canAutoComplete(current.board),
    }),
    move,
    drawFromStock: () => playChosen(stockMove(current.board)),
    autoMove: (from, count = 1) => playChosen(bestMoveFor(current.board, from, count)),
    moveToFoundation: (from) => playChosen(foundationMoveFor(current.board, from)),
    autoCompleteStep: () => playChosen(autoCompleteMoves(current.board)?.[0]),
    hint: () => findHint(current.board),
    undo() {
      if (history.length === 0) return false;
      current = history.pop();
      return true;
    },
    update(seconds) {
      if (started && seconds > 0 && !isWon(current.board)) elapsed += seconds;
    },
  };
}

function isDealNumber(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
