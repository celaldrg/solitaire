/**
 * Klondike solver: depth-first search over a compact, mutable copy of the
 * board, with a visited-state set and a node limit. It sees the hidden cards,
 * so it answers "can this deal be won?", not "how would a player find the win?".
 *
 * The search space stays small without dropping the moves a win needs:
 *  - stock and waste form one cycle; a move may play any card that drawing
 *    alone brings to the waste top, so single draws are never search steps;
 *  - a card that no tableau card can need any more goes up at once; once every
 *    tableau card is face up (and, in draw-3, stock and waste are empty) these
 *    moves alone finish the game, because the next card of the lowest
 *    foundation is then always in reach and always safe;
 *  - moves that cannot help are skipped: foundation-to-tableau moves, a whole
 *    King-led pile to an empty pile, splitting a run unless the card left
 *    behind can go up or take a waste card, emptying a pile unless a King is
 *    waiting for it, all but the first empty pile as a King target and, in
 *    draw-1, bringing a stock card down when nothing could go on it;
 *  - states are keyed without pile order, so mirrored layouts count once;
 *  - moves that turn over hidden cards are tried first.
 * Because of this pruning and the limits, "not solved" means "no win found
 * within the limits", not "unwinnable".
 */
import {
  CLUBS, DECK_SIZE, DIAMONDS, HEARTS, KING, RANKS_PER_SUIT, SPADES, isRed, rankOf, suitOf,
} from './cards.js';
import { TABLEAU_IDS, TABLEAU_PILES, dealGame, reachableWasteSizes, stockCycle } from './board.js';
import { applyMove, foundationTargetFor, stacksOn, stockMove } from './rules.js';

/** Default number of distinct positions solve() may expand. */
export const DEFAULT_NODE_LIMIT = 100000;

/** Deepest branch explored; keeps the recursion well inside the call stack. */
const MAX_DEPTH = 400;
const WASTE = 'waste';
const FOUNDATION = 'foundation';
const PILE_INDEXES = Array.from({ length: TABLEAU_PILES }, (_, index) => index);

/** Search order, higher first; reveals add the number of hidden cards they work on. */
const PRIORITY = Object.freeze({ reveal: 100, unblock: 80, up: 60, fromWaste: 40, other: 20 });

// Character codes for state keys: digits for counts, letters for cards.
const COUNT_CODE = 48;
const CARD_CODE = 65;
const PILE_END = 124;
const STOCK_END = 35;

/**
 * @typedef {Object} SolveResult
 * @property {boolean} solved     a winning line was found
 * @property {boolean} exhausted  not solved, and every candidate move was tried
 *                                within the limits
 * @property {number} nodes       positions expanded
 * @property {import('./rules.js').Move[] | null} moves the winning line as
 *   public moves (draws and recycles included), playable with applyMove
 */

/**
 * Searches for a winning line from `board`.
 * @param {import('./board.js').Board} board a valid board
 * @param {{ nodeLimit?: number }} [options]
 * @returns {SolveResult}
 */
export function solve(board, { nodeLimit = DEFAULT_NODE_LIMIT } = {}) {
  const search = {
    state: toSearchState(board),
    visited: new Set(),
    path: [],
    nodes: 0,
    nodeLimit,
    aborted: false,
    truncated: false,
  };
  const solved = explore(search, 0);
  return {
    solved,
    exhausted: !solved && !search.aborted && !search.truncated,
    nodes: search.nodes,
    moves: solved ? toPublicMoves(board, search.path) : null,
  };
}

/**
 * Finds the first deal number from `firstDeal` upwards that the solver wins
 * (for the "winnable deals only" option). Most winnable deals are solved within
 * a few thousand nodes, so a small limit keeps each attempt quick.
 * @param {number} firstDeal
 * @param {{ drawCount?: number, nodeLimit?: number, maxAttempts?: number }} [options]
 * @returns {{ deal: number, solved: boolean, attempts: number }} when no deal
 *   is solved within maxAttempts, `deal` is `firstDeal` and `solved` is false
 */
export function findWinnableDeal(
  firstDeal,
  { drawCount = 1, nodeLimit = 10000, maxAttempts = 20 } = {},
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const deal = firstDeal + attempt;
    if (solve(dealGame(deal, drawCount), { nodeLimit }).solved) {
      return { deal, solved: true, attempts: attempt + 1 };
    }
  }
  return { deal: firstDeal, solved: false, attempts: maxAttempts };
}

function toSearchState(board) {
  const found = [0, 0, 0, 0];
  for (const cards of board.foundations) {
    if (cards.length > 0) found[suitOf(cards[0])] = cards.length;
  }
  return {
    drawCount: board.drawCount,
    tableau: board.tableau.map((pile) => pile.cards.slice()),
    hidden: board.tableau.map((pile) => pile.faceDown),
    cycle: stockCycle(board),
    wasteSize: board.waste.length,
    found,
  };
}

function explore(search, depth) {
  const { state } = search;
  const autoPlayed = playSafeMoves(search);
  if (isComplete(state)) return true;
  if (depth >= MAX_DEPTH) {
    search.truncated = true;
  } else if (markVisited(search)) {
    for (const move of candidateMoves(state)) {
      const undo = play(state, move);
      search.path.push(move);
      if (explore(search, depth + 1)) return true;
      search.path.pop();
      unplay(state, undo);
      if (search.aborted) break;
    }
  }
  for (let i = autoPlayed.length - 1; i >= 0; i -= 1) {
    unplay(state, autoPlayed[i]);
    search.path.pop();
  }
  return false;
}

function playSafeMoves(search) {
  const undos = [];
  for (let move = nextSafeMove(search.state); move; move = nextSafeMove(search.state)) {
    undos.push(play(search.state, move));
    search.path.push(move);
  }
  return undos;
}

/** All four foundations are full. */
function isComplete(state) {
  return state.found.every((count) => count === RANKS_PER_SUIT);
}

function markVisited(search) {
  const key = stateKey(search.state);
  if (search.visited.has(key)) return false;
  if (search.nodes >= search.nodeLimit) {
    search.aborted = true;
    return false;
  }
  search.visited.add(key);
  search.nodes += 1;
  return true;
}

/**
 * A flat string key: each pile (hidden count, cards) in order of its bottom
 * card, so mirrored layouts share a key, then the stock cycle and waste size.
 * Foundations need no place in it: they hold exactly the cards missing elsewhere.
 */
function stateKey(state) {
  const codes = [];
  for (const index of pileOrder(state)) {
    codes.push(COUNT_CODE + state.hidden[index]);
    for (const card of state.tableau[index]) codes.push(CARD_CODE + card);
    codes.push(PILE_END);
  }
  for (const card of state.cycle) codes.push(CARD_CODE + card);
  codes.push(STOCK_END, COUNT_CODE + canonicalWasteSize(state));
  return String.fromCharCode(...codes);
}

function pileOrder(state) {
  const bottom = (index) => state.tableau[index][0] ?? DECK_SIZE;
  return PILE_INDEXES.slice().sort((a, b) => bottom(a) - bottom(b));
}

/**
 * Waste sizes that drawing alone turns into each other are the same state:
 * in draw-1 that is every size, in draw-3 the multiples of 3 and a full waste.
 */
function canonicalWasteSize({ drawCount, cycle, wasteSize }) {
  return wasteSize % drawCount === 0 || wasteSize === cycle.length ? 0 : wasteSize;
}

function canPlayUp(state, card) {
  return state.found[suitOf(card)] === rankOf(card) - 1;
}

/**
 * A card may go up for good when no tableau card can still need it as a base:
 * Aces and twos always, other cards once both opposite-colour foundations hold
 * the rank below (the solver never moves cards back down).
 */
function isSafeToPlayUp(state, card) {
  if (!canPlayUp(state, card)) return false;
  const rank = rankOf(card);
  if (rank <= 2) return true;
  const [first, second] = isRed(card) ? [CLUBS, SPADES] : [DIAMONDS, HEARTS];
  return state.found[first] >= rank - 1 && state.found[second] >= rank - 1;
}

function nextSafeMove(state) {
  for (let from = 0; from < TABLEAU_PILES; from += 1) {
    const pile = state.tableau[from];
    const top = pile[pile.length - 1];
    if (top !== undefined && isSafeToPlayUp(state, top)) return tableauMove(from, FOUNDATION, 1, top);
  }
  // In draw-1 every stock card is in reach, so taking one out changes nothing else.
  if (state.drawCount === 1) {
    for (let pos = 0; pos < state.cycle.length; pos += 1) {
      if (isSafeToPlayUp(state, state.cycle[pos])) return wasteMove(pos, FOUNDATION, state.cycle[pos]);
    }
  }
  return null;
}

/** Candidate moves, most promising first. */
function candidateMoves(state) {
  const waste = reachableWaste(state);
  const moves = [];
  addTableauMoves(state, waste, moves);
  addWasteMoves(state, waste, moves);
  return moves.sort((a, b) => b.priority - a.priority);
}

/** Stock and waste cards that drawing can bring to the waste top, with their cycle positions. */
function reachableWaste(state) {
  return reachableWasteSizes(state.cycle.length, state.wasteSize, state.drawCount)
    .filter((size) => size > 0)
    .map((size) => ({ pos: size - 1, card: state.cycle[size - 1] }));
}

function addTableauMoves(state, waste, moves) {
  const kingWaiting = kingWaitsForRoom(state, waste);
  for (let from = 0; from < TABLEAU_PILES; from += 1) {
    const pile = state.tableau[from];
    if (pile.length === 0) continue;
    const hidden = state.hidden[from];
    const top = pile[pile.length - 1];
    if (canPlayUp(state, top)) {
      const reveals = hidden > 0 && hidden === pile.length - 1;
      moves.push(tableauMove(from, FOUNDATION, 1, top, reveals ? PRIORITY.reveal + hidden : PRIORITY.up));
    }
    for (let start = hidden; start < pile.length; start += 1) {
      const priority = runPriority(state, from, start, { waste, kingWaiting });
      if (priority === 0) continue;
      for (const to of tableauTargets(state, pile[start], from)) {
        moves.push(tableauMove(from, to, pile.length - start, pile[start], priority));
      }
    }
  }
}

/** Priority of moving the run that starts at `start`, or 0 when that cannot help. */
function runPriority(state, from, start, { waste, kingWaiting }) {
  const pile = state.tableau[from];
  if (start > 0 && start === state.hidden[from]) return PRIORITY.reveal + start;
  if (start === 0) return kingWaiting && rankOf(pile[0]) !== KING ? PRIORITY.other : 0;
  const left = pile[start - 1];
  const helps = canPlayUp(state, left) || waste.some(({ card }) => stacksOn(card, left));
  return helps ? PRIORITY.other : 0;
}

/** More Kings wait for an empty pile than there are empty piles. */
function kingWaitsForRoom(state, waste) {
  let kings = waste.filter(({ card }) => rankOf(card) === KING).length;
  let empty = 0;
  for (let index = 0; index < TABLEAU_PILES; index += 1) {
    const pile = state.tableau[index];
    const hidden = state.hidden[index];
    if (pile.length === 0) empty += 1;
    else if (hidden > 0 && rankOf(pile[hidden]) === KING) kings += 1;
  }
  return kings > empty;
}

function addWasteMoves(state, waste, moves) {
  for (const { pos, card } of waste) {
    if (canPlayUp(state, card)) moves.push(wasteMove(pos, FOUNDATION, card, PRIORITY.up));
    if (state.drawCount === 1 && !hasFollower(state, card)) continue;
    const priority = wastePriority(state, card);
    for (const to of tableauTargets(state, card, -1)) moves.push(wasteMove(pos, to, card, priority));
  }
}

/**
 * In draw-1 every stock card stays in reach, so bringing one down only helps
 * when another card could go on it right away.
 */
function hasFollower(state, card) {
  for (let index = 0; index < TABLEAU_PILES; index += 1) {
    const pile = state.tableau[index];
    for (let i = state.hidden[index]; i < pile.length; i += 1) {
      if (stacksOn(pile[i], card)) return true;
    }
  }
  return state.cycle.some((other) => stacksOn(other, card));
}

/** A waste card that would become the base of a run lying on hidden cards ranks higher. */
function wastePriority(state, card) {
  let best = PRIORITY.fromWaste;
  for (let index = 0; index < TABLEAU_PILES; index += 1) {
    const hidden = state.hidden[index];
    if (hidden > 0 && stacksOn(state.tableau[index][hidden], card)) {
      best = Math.max(best, PRIORITY.unblock + hidden);
    }
  }
  return best;
}

/** Tableau piles that take `card`; only the first empty pile is offered to a King. */
function tableauTargets(state, card, from) {
  const targets = [];
  let emptyOffered = false;
  for (let to = 0; to < TABLEAU_PILES; to += 1) {
    const pile = state.tableau[to];
    if (to === from) continue;
    if (pile.length > 0) {
      if (stacksOn(card, pile[pile.length - 1])) targets.push(to);
    } else if (!emptyOffered && rankOf(card) === KING) {
      targets.push(to);
      emptyOffered = true;
    }
  }
  return targets;
}

function tableauMove(from, to, count, card, priority = 0) {
  return { from, to, count, card, pos: -1, priority };
}

function wasteMove(pos, to, card, priority = 0) {
  return { from: WASTE, to, count: 1, card, pos, priority };
}

function play(state, move) {
  const undo = { move, wasteSize: state.wasteSize, flipped: false };
  let cards;
  if (move.from === WASTE) {
    state.cycle.splice(move.pos, 1);
    state.wasteSize = move.pos;
    cards = [move.card];
  } else {
    const pile = state.tableau[move.from];
    cards = pile.splice(pile.length - move.count, move.count);
    if (pile.length > 0 && state.hidden[move.from] === pile.length) {
      state.hidden[move.from] -= 1;
      undo.flipped = true;
    }
  }
  if (move.to === FOUNDATION) state.found[suitOf(move.card)] += 1;
  else state.tableau[move.to].push(...cards);
  return undo;
}

function unplay(state, { move, wasteSize, flipped }) {
  let cards;
  if (move.to === FOUNDATION) {
    state.found[suitOf(move.card)] -= 1;
    cards = [move.card];
  } else {
    const pile = state.tableau[move.to];
    cards = pile.splice(pile.length - move.count, move.count);
  }
  if (move.from === WASTE) {
    state.cycle.splice(move.pos, 0, move.card);
    state.wasteSize = wasteSize;
  } else {
    if (flipped) state.hidden[move.from] += 1;
    state.tableau[move.from].push(...cards);
  }
}

/** Replays the winning search path on the real board, adding the draws and recycles it needs. */
function toPublicMoves(board, path) {
  const replay = { board, moves: [] };
  for (const step of path) {
    if (step.from === WASTE) bringToWasteTop(replay, step.card);
    playPublic(replay, {
      from: step.from === WASTE ? 'waste' : TABLEAU_IDS[step.from],
      to: step.to === FOUNDATION ? foundationTargetFor(replay.board, step.card) : TABLEAU_IDS[step.to],
      count: step.count,
    });
  }
  return replay.moves;
}

function bringToWasteTop(replay, card) {
  for (let clicks = 0; replay.board.waste[replay.board.waste.length - 1] !== card; clicks += 1) {
    if (clicks > 2 * DECK_SIZE) throw new Error('Solver lost track of a stock card');
    playPublic(replay, stockMove(replay.board));
  }
}

function playPublic(replay, move) {
  const next = applyMove(replay.board, move);
  if (!next) throw new Error(`Solver produced an illegal move: ${JSON.stringify(move)}`);
  replay.moves.push(move);
  replay.board = next;
}
