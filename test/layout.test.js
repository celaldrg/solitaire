import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK_SIZE } from '../src/cards.js';
import { FOUNDATION_IDS, TABLEAU_IDS, boardFromCodes, dealGame } from '../src/board.js';
import { createDemoBoard } from '../src/demo.js';
import {
  CARD_RATIO, computeLayout, dropZones, pickDropTarget, selectionRect,
} from '../src/layout.js';

const PHONE = { width: 363, height: 420 };
const DESKTOP = { width: 1188, height: 646 };

/** Six hidden cards under a full run from King to Ace: the tallest pile there is. */
const tallest = boardFromCodes({
  tableau: [{}, {}, {}, {}, {}, {}, {
    down: ['KC', 'QC', 'JC', '10C', '9C', '8C'],
    up: ['KS', 'QH', 'JS', '10H', '9S', '8H', '7S', '6H', '5S', '4H', '3S', '2H', 'AS'],
  }],
});

const right = (rect) => rect.x + rect.width;
const bottom = (rect) => rect.y + rect.height;

test('every card of a deal gets exactly one spot', () => {
  const layout = computeLayout(PHONE, dealGame(7));
  assert.equal(layout.cards.length, DECK_SIZE);
  const pileSizes = new Map();
  for (const spot of layout.cards) pileSizes.set(spot.pile, (pileSizes.get(spot.pile) ?? 0) + 1);
  assert.equal(pileSizes.get('stock'), 24);
  TABLEAU_IDS.forEach((id, index) => assert.equal(pileSizes.get(id), index + 1));
});

test('the seven piles fit the width of a phone', () => {
  for (const area of [PHONE, { width: 320, height: 400 }]) {
    const layout = computeLayout(area, dealGame(1));
    assert.ok(layout.cardWidth >= 36);
    assert.equal(layout.cardHeight, Math.round(layout.cardWidth * CARD_RATIO));
    for (const slot of Object.values(layout.slots)) {
      assert.ok(slot.x >= 0 && right(slot) <= area.width, JSON.stringify(slot));
    }
  }
});

test('cards grow with the screen, up to a maximum', () => {
  const phone = computeLayout(PHONE, dealGame(1)).cardWidth;
  const desktop = computeLayout(DESKTOP, dealGame(1)).cardWidth;
  const huge = computeLayout({ width: 4000, height: 3000 }, dealGame(1)).cardWidth;
  assert.ok(phone < desktop && desktop <= huge);
  assert.equal(huge, 112);
});

test('a tall pile squeezes its offsets to stay on a phone screen', () => {
  const area = { width: 363, height: 380 };
  const layout = computeLayout(area, tallest);
  const top = layout.cards[tallest.tableau[6].cards.at(-1)];
  assert.ok(top.y + layout.cardHeight <= area.height, `${top.y}`);
  assert.equal(layout.height, area.height);
  const spots = tallest.tableau[6].cards.map((card) => layout.cards[card]);
  const lastGap = spots[18].y - spots[17].y;
  assert.ok(lastGap < layout.cardHeight * 0.28, `not squeezed: ${lastGap}`);
  for (let index = 1; index < spots.length; index += 1) {
    const gap = spots[index].y - spots[index - 1].y;
    assert.ok(gap >= layout.cardHeight * 0.05 - 1e-9, `gap ${gap}`);
  }
});

test('when a pile cannot fit, the table grows instead of overlapping cards', () => {
  const area = { width: 363, height: 200 };
  const layout = computeLayout(area, tallest);
  assert.ok(layout.height > area.height);
  const up = tallest.tableau[6].cards.slice(6).map((card) => layout.cards[card].y);
  for (let index = 1; index < up.length; index += 1) {
    assert.ok(up[index] - up[index - 1] >= layout.cardHeight * 0.15 - 1e-9);
  }
});

test('draw 3 fans the top three waste cards', () => {
  const board = boardFromCodes({ drawCount: 3, waste: ['2C', '3C', '4C', '5C', '6C'] });
  const layout = computeLayout(DESKTOP, board);
  const xs = board.waste.map((card) => layout.cards[card].x);
  const slot = layout.slots.waste.x;
  assert.deepEqual(xs.slice(0, 3), [slot, slot, slot]);
  assert.ok(xs[3] > xs[2] && xs[4] > xs[3]);
  assert.ok(right({ x: xs[4], width: layout.cardWidth }) <= layout.slots.f0.x);
  const single = computeLayout(DESKTOP, { ...board, drawCount: 1 });
  assert.ok(board.waste.every((card) => single.cards[card].x === slot));
});

test('drop zones cover the foundations and the tableau columns', () => {
  const layout = computeLayout(DESKTOP, createDemoBoard());
  const zones = dropZones(layout);
  assert.deepEqual(zones.map((zone) => zone.id), [...FOUNDATION_IDS, ...TABLEAU_IDS]);
  for (const zone of zones.slice(4)) assert.equal(bottom(zone.rect), layout.height);
});

test('a dragged card drops on the accepted zone it overlaps most', () => {
  const layout = computeLayout(DESKTOP, createDemoBoard());
  const zones = dropZones(layout);
  const t1 = layout.slots.t1;
  const { cardWidth: width, cardHeight: height } = layout;
  const card = { x: t1.x + width * 0.55, y: t1.y + 200, width, height };
  assert.equal(pickDropTarget(card, zones, () => true), 't1');
  assert.equal(pickDropTarget(card, zones, (id) => id === 't2'), 't2');
  assert.equal(pickDropTarget(card, zones, (id) => id === 't5'), null);
  assert.equal(pickDropTarget({ ...card, x: -500 }, zones, () => true), null);
});

test('the selection outline covers the chosen cards, or the empty slot', () => {
  const board = createDemoBoard();
  const layout = computeLayout(DESKTOP, board);
  const cards = board.tableau[0].cards;
  const rect = selectionRect(layout, 't0', cards, 2);
  assert.equal(rect.y, layout.cards[cards[4]].y);
  assert.equal(bottom(rect), layout.cards[cards[5]].y + layout.cardHeight);
  assert.equal(rect.width, layout.cardWidth);
  assert.deepEqual(selectionRect(layout, 't3', [], 1), layout.slots.t3);
});
