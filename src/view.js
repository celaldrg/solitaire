/**
 * The card table in the DOM: one element per card and per pile slot, placed
 * with transforms so every move glides into place and turned cards flip.
 * It only draws what it is given; main.js decides what happens.
 */
import { ACE, DECK_SIZE, KING, isRed, rankOf, suitOf } from './cards.js';
import { FOUNDATION_IDS, TABLEAU_IDS, TABLEAU_PILES, parsePileId } from './board.js';
import { SUIT_PATHS } from './suits.js';
import { DEFAULT_LANGUAGE, rankLabel } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PILE_IDS = Object.freeze(['stock', 'waste', ...FOUNDATION_IDS, ...TABLEAU_IDS]);
/** Longest card transition (move or flip) in ms; moved cards stay on top this long. */
const SETTLE_MS = 260;
/** Delay between two cards of the dealing animation, in ms. */
const DEAL_STEP_MS = 34;
/** Stacking levels above the piles for cards in flight. */
const Z = Object.freeze({ moving: 200, dragging: 400 });
/** How far a card picked up with the keyboard rises, in card heights. */
const PICK_LIFT = 0.1;

/**
 * Builds the slots and the 52 cards inside `table`.
 * @param {HTMLElement} table
 */
export function createTableView(table) {
  const slots = new Map(PILE_IDS.map((id) => [id, createSlot(id)]));
  const cards = Array.from({ length: DECK_SIZE }, (_, card) => createCard(card));
  const cursor = element('div', 'kbd-cursor');
  table.append(...slots.values(), ...cards, cursor);
  const marks = new Map();
  setLanguage(DEFAULT_LANGUAGE);
  let previous = [];
  let settleTimer = 0;

  /**
   * Draws a board.
   * @param {import('./layout.js').Layout} layout
   * @param {import('./board.js').Board} board
   * @param {{ deal?: boolean, instant?: boolean, lifted?: number[] }} [options]
   *   deal: cards fly out of the stock; instant: no transitions (after a resize);
   *   lifted: cards picked up with the keyboard
   */
  function render(layout, board, { deal = false, instant = false, lifted = [] } = {}) {
    applyMetrics(layout);
    placeSlots(layout, board);
    const order = deal ? dealOrder(board) : new Map();
    if (deal) gatherInStock(layout);
    if (instant) table.classList.add('instant');
    const raised = new Set(lifted);
    cards.forEach((el, card) => {
      const spot = layout.cards[card];
      const moving = order.has(card) || el.classList.contains('dragging')
        || (previous[card] !== undefined && previous[card].pile !== spot.pile);
      const lift = raised.has(card) ? layout.cardHeight * PICK_LIFT : 0;
      el.classList.remove('dragging');
      el.classList.toggle('picked', raised.has(card));
      el.classList.toggle('down', !spot.faceUp);
      el.style.setProperty('--delay', order.has(card) ? `${order.get(card) * DEAL_STEP_MS}ms` : '0ms');
      el.style.zIndex = String(moving ? Z.moving + (order.get(card) ?? 0) + spot.z : spot.z);
      el.style.transform = `translate(${spot.x}px, ${spot.y - lift}px)`;
    });
    if (instant) finishInstantly();
    previous = layout.cards.map(({ pile, z }) => ({ pile, z }));
    scheduleSettle(order.size * DEAL_STEP_MS + SETTLE_MS);
  }

  function applyMetrics(layout) {
    table.style.height = `${layout.height}px`;
    table.style.setProperty('--card-w', `${layout.cardWidth}px`);
    table.style.setProperty('--card-h', `${layout.cardHeight}px`);
    table.style.setProperty('--rank-size', `${layout.rankSize}px`);
  }

  function placeSlots(layout, board) {
    for (const [id, el] of slots) {
      const { x, y } = layout.slots[id];
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
    slots.get('stock').classList.toggle('recycle', board.stock.length === 0 && board.waste.length > 0);
  }

  /**
   * Prints the card indices and the empty-slot hints (Ace, King) in a language.
   * @param {string} language
   */
  function setLanguage(language) {
    cards.forEach((el, card) => {
      const label = rankLabel(language, rankOf(card));
      for (const span of el.querySelectorAll('.rank, .court-rank')) span.textContent = label;
    });
    for (const [id, el] of slots) {
      const { kind } = parsePileId(id);
      if (kind === 'foundation') el.dataset.hint = rankLabel(language, ACE);
      if (kind === 'tableau') el.dataset.hint = rankLabel(language, KING);
    }
  }

  /** Puts every card face down on the stock without animation, ready to be dealt. */
  function gatherInStock(layout) {
    const { x, y } = layout.slots.stock;
    table.classList.add('instant');
    cards.forEach((el) => {
      el.classList.add('down');
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    finishInstantly();
  }

  function finishInstantly() {
    table.getBoundingClientRect();
    table.classList.remove('instant');
  }

  /** Once cards have landed, they drop back to their pile's stacking order. */
  function scheduleSettle(delay) {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      cards.forEach((el, card) => {
        if (el.classList.contains('dragging')) return;
        el.style.zIndex = String(previous[card].z);
        el.style.setProperty('--delay', '0ms');
      });
    }, delay);
  }

  return {
    render,
    setLanguage,

    /**
     * Moves cards along with the pointer.
     * @param {number[]} list the dragged cards, bottom first
     * @param {import('./layout.js').Layout} layout
     * @param {number} dx
     * @param {number} dy
     */
    drag(list, layout, dx, dy) {
      list.forEach((card, index) => {
        const el = cards[card];
        const spot = layout.cards[card];
        el.classList.add('dragging');
        el.style.zIndex = String(Z.dragging + index);
        el.style.transform = `translate(${spot.x + dx}px, ${spot.y + dy}px)`;
      });
    },

    /**
     * Highlights cards and empty slots; each kind replaces its previous marks.
     * @param {'hint'|'drop'} kind
     * @param {{ cards?: number[], slots?: string[] }} [targets]
     */
    mark(kind, { cards: cardList = [], slots: slotIds = [] } = {}) {
      const className = `mark-${kind}`;
      for (const el of marks.get(kind) ?? []) el.classList.remove(className);
      const marked = [...cardList.map((card) => cards[card]), ...slotIds.map((id) => slots.get(id))];
      for (const el of marked) el.classList.add(className);
      marks.set(kind, marked);
    },

    /**
     * A short shake for a card that has nowhere to go.
     * @param {number[]} list
     */
    shake(list) {
      for (const card of list) {
        const el = cards[card];
        el.classList.remove('nope');
        el.getBoundingClientRect();
        el.classList.add('nope');
      }
    },

    /**
     * Shows the keyboard cursor around a rectangle, or hides it.
     * @param {import('./layout.js').Rect | null} rect
     */
    showCursor(rect) {
      cursor.classList.toggle('on', rect !== null);
      if (!rect) return;
      cursor.style.width = `${rect.width}px`;
      cursor.style.height = `${rect.height}px`;
      cursor.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
    },

    /**
     * What a pointer event hit: a card or the slot of a pile.
     * @param {EventTarget} target
     * @returns {{ card: number } | { pile: string } | null}
     */
    locate(target) {
      const cardEl = target instanceof Element ? target.closest('.card') : null;
      if (cardEl) return { card: Number(cardEl.dataset.card) };
      const slotEl = target instanceof Element ? target.closest('.slot') : null;
      return slotEl ? { pile: slotEl.dataset.pile } : null;
    },
  };
}

/** Deal order of the tableau cards (row by row, as dealGame deals them). */
function dealOrder(board) {
  const order = new Map();
  for (let row = 0; row < TABLEAU_PILES; row += 1) {
    for (let column = row; column < TABLEAU_PILES; column += 1) {
      order.set(board.tableau[column].cards[row], order.size);
    }
  }
  return order;
}

function createSlot(id) {
  const el = element('div', `slot slot-${parsePileId(id).kind}`);
  el.dataset.pile = id;
  return el;
}

function createCard(card) {
  const el = element('div', `card ${isRed(card) ? 'red' : 'black'} down`);
  el.dataset.card = String(card);
  el.addEventListener('animationend', () => el.classList.remove('nope'));
  const face = element('div', 'card-face');
  face.append(element('span', 'rank'), suitIcon(suitOf(card), 'corner-suit'), artwork(card));
  const inner = element('div', 'card-inner');
  inner.append(face, element('div', 'card-back'));
  el.append(inner);
  return el;
}

/** A large suit for number cards and Aces, a framed letter for court cards. */
function artwork(card) {
  const rank = rankOf(card);
  if (rank <= 10) return suitIcon(suitOf(card), rank === ACE ? 'pip ace' : 'pip');
  const court = element('div', 'court');
  court.append(element('span', 'court-rank'), suitIcon(suitOf(card), 'court-suit'));
  return court;
}

function suitIcon(suit, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', SUIT_PATHS[suit]);
  svg.append(path);
  return svg;
}

function element(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
