import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachGestures } from '../src/pointer.js';

/** Stands in for the table element: keeps the listeners and fires plain event objects. */
function fakeSurface(capture = () => {}) {
  const listeners = {};
  return {
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    setPointerCapture: capture,
    fire(type, init = {}) {
      listeners[type]({
        isPrimary: true,
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        timeStamp: 0,
        target: 'card',
        ...init,
      });
    },
  };
}

/** Gesture handlers that write down every call. */
function recorder() {
  const calls = [];
  const note = (name) => (...args) => {
    calls.push([name, ...args]);
  };
  const handlers = {
    grab: (target) => (target === 'felt' ? null : { target }),
    canDrag: () => true,
    tap: note('tap'),
    doubleTap: note('doubleTap'),
    drag: note('drag'),
    drop: note('drop'),
    cancel: note('cancel'),
  };
  return { calls, handlers };
}

function tapAt(surface, x, y, timeStamp) {
  surface.fire('pointerdown', { clientX: x, clientY: y, timeStamp });
  surface.fire('pointerup', { clientX: x, clientY: y, timeStamp: timeStamp + 40 });
}

const CARD = { target: 'card' };

test('a quick second tap on the same spot is a double-tap and not another tap', () => {
  const surface = fakeSurface();
  const { calls, handlers } = recorder();
  attachGestures(surface, handlers);
  tapAt(surface, 100, 100, 0);
  tapAt(surface, 110, 104, 200); // 200 ms later, 11 px away
  tapAt(surface, 110, 104, 400); // the pair is over, so this starts a new one
  tapAt(surface, 300, 100, 500); // soon, but somewhere else
  tapAt(surface, 300, 100, 1000); // same spot, but too late
  assert.deepEqual(calls, [['tap', CARD], ['doubleTap', CARD], ['tap', CARD], ['tap', CARD], ['tap', CARD]]);
});

test('a press whose pointer is already gone is dropped, and the next press still works', () => {
  const surface = fakeSurface((pointerId) => {
    if (pointerId === 1) throw new DOMException('No active pointer with the given id is found.', 'NotFoundError');
  });
  const { calls, handlers } = recorder();
  attachGestures(surface, handlers);
  assert.doesNotThrow(() => surface.fire('pointerdown', { pointerId: 1 }));
  surface.fire('pointerdown', { pointerId: 2, timeStamp: 10 });
  surface.fire('pointerup', { pointerId: 2, timeStamp: 50 });
  assert.deepEqual(calls, [['tap', CARD]]);
});

test('a press that travels is a drag, and the browser may take it away', () => {
  const surface = fakeSurface();
  const { calls, handlers } = recorder();
  attachGestures(surface, handlers);
  surface.fire('pointerdown', { target: 'felt' }); // nothing to hold
  surface.fire('pointerup', {});
  surface.fire('pointerdown', { clientX: 100, clientY: 100 });
  surface.fire('pointermove', { clientX: 103, clientY: 100 }); // still a tap
  surface.fire('pointermove', { clientX: 130, clientY: 120 });
  surface.fire('pointerup', { clientX: 130, clientY: 120, timeStamp: 100 });
  tapAt(surface, 100, 100, 150); // right after the drop: a tap, not a double-tap
  surface.fire('pointerdown', { clientX: 200, clientY: 100, timeStamp: 1000 });
  surface.fire('pointermove', { clientX: 200, clientY: 140 });
  surface.fire('pointercancel', {});
  assert.deepEqual(calls, [
    ['drag', CARD, 30, 20],
    ['drop', CARD, 30, 20],
    ['tap', CARD],
    ['drag', CARD, 0, 40],
    ['cancel', CARD],
  ]);
});
