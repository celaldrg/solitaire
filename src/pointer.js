/**
 * Pointer gestures on the card table, the same for mouse, pen and touch: a
 * press that travels becomes a drag, a press that stays put is a tap, and a
 * second tap soon after on the same spot makes a double-tap.
 */

/** Distance in px a press has to travel before it counts as a drag. */
const DRAG_DISTANCE = 6;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE = 30;

/**
 * @template Held
 * @typedef {Object} GestureHandlers
 * @property {(target: EventTarget) => Held | null} grab what a press on `target`
 *   takes hold of; null ignores the press
 * @property {(held: Held) => boolean} canDrag
 * @property {(held: Held) => void} tap
 * @property {(held: Held) => void} doubleTap the second tap of a quick pair on the same
 *   spot; it does not count as a tap of its own
 * @property {(held: Held, dx: number, dy: number) => void} drag on every move while dragging
 * @property {(held: Held, dx: number, dy: number) => void} drop
 * @property {(held: Held) => void} cancel the browser took the pointer away mid-drag
 */

/**
 * Listens for gestures on `surface`, one pointer at a time.
 * @template Held
 * @param {HTMLElement} surface
 * @param {GestureHandlers<Held>} handlers
 */
export function attachGestures(surface, handlers) {
  let press = null;
  let lastTap = null;

  surface.addEventListener('pointerdown', (event) => {
    if (press || !event.isPrimary || event.button !== 0) return;
    const held = handlers.grab(event.target);
    if (held === null) return;
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone, so no pointerup will come to end this press.
      return;
    }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, held, dragging: false };
  });

  surface.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.dragging) {
      if (Math.hypot(dx, dy) < DRAG_DISTANCE || !handlers.canDrag(press.held)) return;
      press.dragging = true;
    }
    handlers.drag(press.held, dx, dy);
  });

  surface.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.id) return;
    const { held, dragging, x, y } = press;
    press = null;
    if (dragging) {
      lastTap = null;
      handlers.drop(held, event.clientX - x, event.clientY - y);
    } else if (isSecondTap(lastTap, event.timeStamp, x, y)) {
      lastTap = null;
      handlers.doubleTap(held);
    } else {
      lastTap = { time: event.timeStamp, x, y };
      handlers.tap(held);
    }
  });

  surface.addEventListener('pointercancel', (event) => {
    if (!press || event.pointerId !== press.id) return;
    const { held, dragging } = press;
    press = null;
    if (dragging) handlers.cancel(held);
  });

  // A long press on a touch screen must not open the context menu over the cards.
  surface.addEventListener('contextmenu', (event) => event.preventDefault());
}

function isSecondTap(lastTap, time, x, y) {
  return lastTap !== null
    && time - lastTap.time < DOUBLE_TAP_MS
    && Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_DISTANCE;
}
