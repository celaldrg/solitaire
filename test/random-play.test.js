import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { createRng } from '../src/rng.js';
import { legalMoves, validateBoard } from '../src/rules.js';

const GAMES = 500;
const STEPS = 150;
const UNDO_CHANCE = 0.1;

/**
 * Plays one seeded random game: random legal moves with an occasional undo,
 * checking the whole board after every step.
 */
function playRandomGame(index) {
  const random = createRng(index);
  const deal = 1000 + index;
  const game = createGame({ deal, drawCount: index % 2 === 0 ? 1 : 3 });
  const boards = [];
  for (let step = 0; step < STEPS && !game.getState().won; step += 1) {
    if (boards.length > 0 && random() < UNDO_CHANCE) {
      assert.equal(game.undo(), true);
      assert.equal(game.getState().board, boards.pop(), 'undo brings back the same board');
    } else {
      const { board } = game.getState();
      const moves = legalMoves(board);
      if (moves.length === 0) break;
      boards.push(board);
      assert.equal(game.move(moves[Math.floor(random() * moves.length)]), true);
    }
    const state = game.getState();
    const problems = validateBoard(state.board);
    if (problems.length > 0) assert.fail(`deal ${deal}, step ${step}: ${problems.join('; ')}`);
    assert.equal(state.moves, boards.length);
    assert.ok(state.score >= 0);
  }
}

test(`${GAMES} seeded random games never lose or duplicate a card`, () => {
  for (let index = 0; index < GAMES; index += 1) playRandomGame(index);
});
