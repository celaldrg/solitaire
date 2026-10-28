import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBoard } from '../src/demo.js';
import { boardFromCodes } from '../src/board.js';
import { actionForKey, cursorCount, grabAt, moveCursor } from '../src/controls.js';

// Demo board: t0 holds six face-up cards, t2 one hidden card under 9D 8C,
// t6 five hidden cards under KD; the waste holds 8S QH 4C.
const board = createDemoBoard();

test('a press on a face-up tableau card takes the cards above it too', () => {
  assert.deepEqual(grabAt(board, 't0', 0), { pile: 't0', count: 6 });
  assert.deepEqual(grabAt(board, 't0', 4), { pile: 't0', count: 2 });
  assert.deepEqual(grabAt(board, 't2', 1), { pile: 't2', count: 2 });
});

test('hidden, buried and stock cards cannot be taken', () => {
  assert.equal(grabAt(board, 't2', 0), null);
  assert.equal(grabAt(board, 't6', 3), null);
  assert.equal(grabAt(board, 'waste', 1), null);
  assert.equal(grabAt(board, 'f0', 2), null);
  assert.equal(grabAt(board, 'stock', 6), null);
  assert.equal(grabAt(board, 't0', 6), null);
  assert.equal(grabAt(board, 'x9', 0), null);
});

test('the top card of the waste or a foundation can be taken', () => {
  assert.deepEqual(grabAt(board, 'waste', 2), { pile: 'waste', count: 1 });
  assert.deepEqual(grabAt(board, 'f0', 3), { pile: 'f0', count: 1 });
});

test('keys map to actions and browser shortcuts stay untouched', () => {
  const cases = [
    [{ key: 'ArrowLeft' }, 'left'],
    [{ key: 'ArrowDown' }, 'down'],
    [{ key: ' ' }, 'pick'],
    [{ key: 'Enter' }, 'smart'],
    [{ key: 'Escape' }, 'cancel'],
    [{ key: 'f' }, 'foundation'],
    [{ key: 'D' }, 'draw'],
    [{ key: 'Backspace' }, 'undo'],
    [{ key: 'z', ctrlKey: true }, 'undo'],
    [{ key: 'z', metaKey: true }, 'undo'],
    [{ key: 'h' }, 'hint'],
    [{ key: 'n' }, 'newDeal'],
    [{ key: 'r' }, 'restart'],
    [{ key: 'a' }, 'autoComplete'],
    [{ key: 'r', ctrlKey: true }, null],
    [{ key: 'd', altKey: true }, null],
    [{ key: 'q' }, null],
  ];
  for (const [event, action] of cases) assert.equal(actionForKey(event), action, JSON.stringify(event));
});

test('left and right walk along a row and wrap around', () => {
  assert.deepEqual(moveCursor(board, { pile: 't0', depth: 3 }, 'right'), { pile: 't1', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 't6', depth: 1 }, 'right'), { pile: 't0', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 'stock', depth: 1 }, 'left'), { pile: 'f3', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 'waste', depth: 1 }, 'right'), { pile: 'f0', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 'f0', depth: 1 }, 'left'), { pile: 'waste', depth: 1 });
});

test('up takes more cards of a run, then jumps to the top row', () => {
  assert.deepEqual(moveCursor(board, { pile: 't0', depth: 1 }, 'up'), { pile: 't0', depth: 2 });
  assert.deepEqual(moveCursor(board, { pile: 't0', depth: 6 }, 'up'), { pile: 'stock', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 't2', depth: 2 }, 'up'), { pile: 'waste', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 't5', depth: 1 }, 'up'), { pile: 'f2', depth: 1 });
});

test('down gives cards back, and leads from the top row to the pile below', () => {
  assert.deepEqual(moveCursor(board, { pile: 't0', depth: 4 }, 'down'), { pile: 't0', depth: 3 });
  assert.deepEqual(moveCursor(board, { pile: 't0', depth: 1 }, 'down'), { pile: 't0', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 'f0', depth: 1 }, 'down'), { pile: 't3', depth: 1 });
  assert.deepEqual(moveCursor(board, { pile: 'stock', depth: 1 }, 'down'), { pile: 't0', depth: 1 });
});

test('the cursor selects at most the face-up run of a pile', () => {
  assert.equal(cursorCount(board, { pile: 't0', depth: 4 }), 4);
  assert.equal(cursorCount(board, { pile: 't2', depth: 9 }), 2);
  assert.equal(cursorCount(board, { pile: 'waste', depth: 3 }), 1);
  const empty = boardFromCodes({});
  assert.equal(cursorCount(empty, { pile: 't3', depth: 2 }), 1);
});
