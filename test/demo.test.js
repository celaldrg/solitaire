import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DEAL, createDemoBoard, createDemoGame } from '../src/demo.js';
import { applyMove, isLegalMove, isWon, validateBoard } from '../src/rules.js';
import { solve } from '../src/solver.js';

test('the demo board is a valid mid-game position', () => {
  const board = createDemoBoard();
  assert.deepEqual(validateBoard(board), []);
  assert.equal(board.foundations.flat().length, 11);
  assert.ok(board.tableau.some((pile) => pile.faceDown > 0));
  assert.ok(board.stock.length > 0 && board.waste.length > 0);
});

test('every call builds a fresh demo board', () => {
  const first = createDemoBoard();
  first.tableau[0].cards.pop();
  assert.deepEqual(validateBoard(createDemoBoard()), []);
});

test('the demo game shows plausible numbers and is still playable', () => {
  const game = createDemoGame();
  const state = game.getState();
  assert.deepEqual(state.board, createDemoBoard());
  assert.equal(state.deal, DEMO_DEAL);
  assert.equal(state.score, 175);
  assert.equal(state.moves, 64);
  assert.equal(state.elapsed, 287);
  assert.equal(state.won, false);
  assert.equal(state.canUndo, false);
  const hint = game.hint();
  assert.ok(hint);
  assert.equal(isLegalMove(state.board, hint), true);
  game.update(1);
  assert.equal(game.getState().elapsed, 288);
});

test('the demo game can be set up again with Draw 3', () => {
  const state = createDemoGame(3).getState();
  assert.equal(state.drawCount, 3);
  assert.deepEqual(state.board, { ...createDemoBoard(), drawCount: 3 });
  assert.equal(createDemoGame().getState().drawCount, 1);
});

test('the demo position can still be won', () => {
  const board = createDemoBoard();
  const result = solve(board);
  assert.equal(result.solved, true);
  const end = result.moves.reduce((current, move) => applyMove(current, move), board);
  assert.equal(isWon(end), true);
});
