/**
 * Table geometry: card size, pile positions and fan offsets for a play area of
 * a given size. Pure functions, so the fitting rules are tested without a DOM.
 *
 * The top row holds the stock, the waste (fanned in draw-3) and the four
 * foundations. The seven tableau piles fan downwards; a pile that would run
 * past the bottom of the area squeezes its offsets, down to readable minimums.
 *
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 *
 * @typedef {Object} CardSpot where a card lies
 * @property {string} pile    pile id
 * @property {number} index   position in the pile, bottom card 0
 * @property {boolean} faceUp
 * @property {number} x
 * @property {number} y
 * @property {number} z       stacking order inside the pile, 1 at the bottom
 *
 * @typedef {Object} Layout
 * @property {number} width       table width
 * @property {number} height      at least the area height; more when a pile cannot fit
 * @property {number} cardWidth
 * @property {number} cardHeight
 * @property {number} rankSize    font size of the corner index
 * @property {Object<string, Rect>} slots the base of every pile, by pile id
 * @property {CardSpot[]} cards   indexed by card
 */
import { DECK_SIZE } from './cards.js';
import { FOUNDATION_IDS, TABLEAU_IDS, TABLEAU_PILES } from './board.js';

/** Card height divided by card width. */
export const CARD_RATIO = 1.4;

const CARD_WIDTH = Object.freeze({ min: 36, max: 112 });
/** Card heights the area should hold: top row, row gap and a pile of about nine face-up cards. */
const PLANNED_ROWS = 4.5;
/** Tableau offsets in card heights, the waste fan step in card widths. */
const FAN = Object.freeze({ up: 0.28, down: 0.12, minUp: 0.15, minDown: 0.05, waste: 0.3 });
/** Top-row columns; the draw-3 waste fan reaches into column 2. */
const TOP_COLUMNS = Object.freeze({ stock: 0, waste: 1, f0: 3, f1: 4, f2: 5, f3: 6 });

/**
 * Lays out a board in a play area.
 * @param {{ width: number, height: number }} area CSS pixels
 * @param {import('./board.js').Board} board
 * @returns {Layout}
 */
export function computeLayout(area, board) {
  const metrics = measure(area);
  const slots = placeSlots(metrics);
  const cards = new Array(DECK_SIZE);
  placeStack(cards, board.stock, 'stock', slots.stock, false);
  placeWaste(cards, board, slots.waste, metrics);
  FOUNDATION_IDS.forEach((id, index) => placeStack(cards, board.foundations[index], id, slots[id], true));
  const room = area.height - metrics.tableauTop - metrics.pad;
  const bottom = Math.max(...board.tableau.map((pile, index) => (
    placeTableauPile(cards, pile, TABLEAU_IDS[index], slots[TABLEAU_IDS[index]], room)
  )));
  return {
    width: area.width,
    height: Math.max(area.height, Math.ceil(bottom + metrics.pad)),
    cardWidth: metrics.cardWidth,
    cardHeight: metrics.cardHeight,
    rankSize: metrics.rankSize,
    slots,
    cards,
  };
}

/**
 * Where cards may be dropped: the slot of each foundation and each tableau
 * column from its slot down to the bottom of the table.
 * @param {Layout} layout
 * @returns {{ id: string, rect: Rect }[]}
 */
export function dropZones(layout) {
  const foundations = FOUNDATION_IDS.map((id) => ({ id, rect: layout.slots[id] }));
  const columns = TABLEAU_IDS.map((id) => {
    const slot = layout.slots[id];
    return { id, rect: { ...slot, height: layout.height - slot.y } };
  });
  return [...foundations, ...columns];
}

/**
 * The accepted zone that a dragged card overlaps the most.
 * @param {Rect} rect the dragged card
 * @param {{ id: string, rect: Rect }[]} zones
 * @param {(id: string) => boolean} accepts tells whether a drop on the zone is legal
 * @returns {string | null}
 */
export function pickDropTarget(rect, zones, accepts) {
  let best = null;
  let bestArea = 0;
  for (const zone of zones) {
    const area = overlapArea(rect, zone.rect);
    if (area > bestArea && accepts(zone.id)) {
      best = zone.id;
      bestArea = area;
    }
  }
  return best;
}

/**
 * The outline around the top `count` cards of a pile, or around its slot when
 * it is empty (for the keyboard cursor).
 * @param {Layout} layout
 * @param {string} pile pile id
 * @param {number[]} cards the pile's cards, bottom first
 * @param {number} count
 * @returns {Rect}
 */
export function selectionRect(layout, pile, cards, count) {
  if (cards.length === 0) return layout.slots[pile];
  const top = layout.cards[cards[cards.length - 1]];
  const first = layout.cards[cards[Math.max(0, cards.length - count)]];
  return {
    x: first.x,
    y: first.y,
    width: top.x - first.x + layout.cardWidth,
    height: top.y - first.y + layout.cardHeight,
  };
}

function measure({ width, height }) {
  const pad = clamp(Math.round(width * 0.018), 5, 20);
  const minGap = clamp(Math.round(width * 0.011), 3, 12);
  const byWidth = (width - 2 * pad - (TABLEAU_PILES - 1) * minGap) / TABLEAU_PILES;
  const byHeight = (height - 2 * pad) / (PLANNED_ROWS * CARD_RATIO);
  const cardWidth = Math.floor(clamp(Math.min(byWidth, byHeight), CARD_WIDTH.min, CARD_WIDTH.max));
  const cardHeight = Math.round(cardWidth * CARD_RATIO);
  const spare = (width - 2 * pad - TABLEAU_PILES * cardWidth) / (TABLEAU_PILES - 1);
  const gap = Math.floor(clamp(spare, minGap, cardWidth * 0.22));
  const rowWidth = TABLEAU_PILES * cardWidth + (TABLEAU_PILES - 1) * gap;
  return {
    pad,
    gap,
    cardWidth,
    cardHeight,
    left: Math.round((width - rowWidth) / 2),
    tableauTop: pad + cardHeight + clamp(Math.round(cardHeight * 0.14), 8, 20),
    rankSize: clamp(Math.round(cardWidth * 0.2 + 5), 11, 24),
  };
}

function placeSlots(metrics) {
  const { left, pad, gap, cardWidth, cardHeight, tableauTop } = metrics;
  const rect = (column, y) => ({
    x: left + column * (cardWidth + gap), y, width: cardWidth, height: cardHeight,
  });
  const slots = {};
  for (const [id, column] of Object.entries(TOP_COLUMNS)) slots[id] = rect(column, pad);
  TABLEAU_IDS.forEach((id, column) => {
    slots[id] = rect(column, tableauTop);
  });
  return slots;
}

function placeStack(spots, cards, pile, slot, faceUp) {
  cards.forEach((card, index) => {
    spots[card] = { pile, index, faceUp, x: slot.x, y: slot.y, z: index + 1 };
  });
}

/** Draw-3 fans the top three waste cards to the right; draw-1 stacks them. */
function placeWaste(spots, board, slot, metrics) {
  const firstFanned = Math.max(0, board.waste.length - (board.drawCount === 3 ? 3 : 1));
  const step = metrics.cardWidth * FAN.waste;
  board.waste.forEach((card, index) => {
    const x = slot.x + Math.max(0, index - firstFanned) * step;
    spots[card] = { pile: 'waste', index, faceUp: true, x, y: slot.y, z: index + 1 };
  });
}

/** Places one tableau pile and returns the y of its lower edge. */
function placeTableauPile(spots, pile, id, slot, room) {
  const { down, up } = fanOffsets(pile, slot.height, room);
  let y = slot.y;
  let lastY = slot.y;
  pile.cards.forEach((card, index) => {
    const faceUp = index >= pile.faceDown;
    spots[card] = { pile: id, index, faceUp, x: slot.x, y, z: index + 1 };
    lastY = y;
    y += faceUp ? up : down;
  });
  return lastY + slot.height;
}

/**
 * Offsets between tableau cards: the preferred ones when the pile fits in
 * `room`, otherwise squeezed in proportion but never below the minimums.
 */
function fanOffsets(pile, cardHeight, room) {
  const down = cardHeight * FAN.down;
  const up = cardHeight * FAN.up;
  const hidden = pile.faceDown;
  const upGaps = Math.max(0, pile.cards.length - hidden - 1);
  const free = room - cardHeight;
  const need = hidden * down + upGaps * up;
  if (need <= free) return { down, up };
  const fitDown = Math.max(cardHeight * FAN.minDown, (down * free) / need);
  const fitUp = upGaps === 0 ? up : (free - hidden * fitDown) / upGaps;
  return { down: fitDown, up: clamp(fitUp, cardHeight * FAN.minUp, up) };
}

function overlapArea(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
